import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { applicationTable, deploymentsTable, githubInstallationsTable, type Application, type Deployment } from "../db/schema";
import { downloadTarball, getInstallationToken, GithubApiError, resolveCommit } from "../utils/github";
import { createDeploymentLogger, type DeploymentLogger } from "./logs";
import type { Database } from "./types";
import { IN_PROGRESS_STATUSES } from "../modules/deployment/deployment.controller";

const BUILD_ROOT = join(tmpdir(), "orca-builds")
const BUILD_TIMEOUT_MS = (Number(process.env.BUILD_TIMEOUT_MINUTES) || 20) * 60 * 1000
const STALE_BUILD_MS = 2 * 60 * 1000
const GITHUB_URL_PATTERN = /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i
const FULL_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/

class BuildCancelledError extends Error {}

export const claimNextDeployment = (db: Database) => db.transaction(async (tx) => {
    const [next] = await tx
        .select({ id: deploymentsTable.id })
        .from(deploymentsTable)
        .where(eq(deploymentsTable.status, "QUEUED"))
        .orderBy(asc(deploymentsTable.createdAt))
        .limit(1)
        .for("update", { skipLocked: true })

    if (!next) {
        return undefined
    }

    const [claimed] = await tx
        .update(deploymentsTable)
        .set({ status: "BUILDING", startedAt: new Date(), logs: "" })
        .where(eq(deploymentsTable.id, next.id))
        .returning()

    return claimed
})

export const settleApplicationStatus = async (db: Database, appId: string) => {
    const [inProgress] = await db
        .select({ id: deploymentsTable.id })
        .from(deploymentsTable)
        .where(
            and(
                eq(deploymentsTable.applicationId, appId),
                inArray(deploymentsTable.status, [...IN_PROGRESS_STATUSES])
            )
        )
        .limit(1)

    const [app] = await db
        .select({ activeDeploymentId: applicationTable.activeDeploymentId })
        .from(applicationTable)
        .where(eq(applicationTable.id, appId))

    if (!app) {
        return
    }

    await db
        .update(applicationTable)
        .set({ status: inProgress ? "QUEUED" : app.activeDeploymentId ? "DEPLOYED" : "NOT STARTED" })
        .where(eq(applicationTable.id, appId))
}

export const failStaleBuilds = async (db: Database) => {
    const stale = await db
        .update(deploymentsTable)
        .set({ status: "FAILED", error: "Build worker stopped responding", finishedAt: new Date() })
        .where(
            and(
                eq(deploymentsTable.status, "BUILDING"),
                lt(deploymentsTable.updatedAt, new Date(Date.now() - STALE_BUILD_MS))
            )
        )
        .returning({ id: deploymentsTable.id, applicationId: deploymentsTable.applicationId })

    for (const deployment of stale) {
        console.warn(`[worker] marked stale deployment ${deployment.id} as failed`)
        await settleApplicationStatus(db, deployment.applicationId)
    }
}

const finishDeployment = (db: Database, deploymentId: string, values: Partial<Deployment>) => {
    return db
        .update(deploymentsTable)
        .set({ ...values, finishedAt: new Date() })
        .where(
            and(
                eq(deploymentsTable.id, deploymentId),
                eq(deploymentsTable.status, "BUILDING")
            )
        )
}

const getRepositoryFullName = (app: Application) => {
    if (app.githubRepositoryId && FULL_NAME_PATTERN.test(app.repositoryName)) {
        return app.repositoryName
    }
    const fromUrl = app.sourceRepository.match(GITHUB_URL_PATTERN)?.[1]
    if (fromUrl) {
        return fromUrl
    }
    if (FULL_NAME_PATTERN.test(app.repositoryName)) {
        return app.repositoryName
    }
    throw new Error(`Can't work out the GitHub repository for "${app.sourceRepository}". Connect the app to a GitHub repository.`)
}

const resolveInsideSource = (sourceDir: string, ...segments: Array<string>) => {
    const target = resolve(sourceDir, ...segments)
    const rel = relative(sourceDir, target)
    if (rel.startsWith("..") || resolve(sourceDir, rel) !== target) {
        throw new Error(`Path ${segments.join("/")} points outside the repository`)
    }
    return target
}

const getGithubToken = async (db: Database, app: Application, logger: DeploymentLogger) => {
    if (!app.githubInstallationId) {
        logger.log("App is not connected to the ORCA GitHub App, fetching as a public repository")
        return undefined
    }

    const [installation] = await db
        .select()
        .from(githubInstallationsTable)
        .where(eq(githubInstallationsTable.id, app.githubInstallationId))

    if (!installation) {
        throw new Error("The GitHub installation for this app was removed. Reconnect the repository.")
    }
    if (installation.suspendedAt) {
        throw new Error(`The GitHub installation for ${installation.accountLogin} is suspended`)
    }

    logger.log(`Using GitHub installation for ${installation.accountLogin}`)
    return getInstallationToken(installation.installationId)
}

const pipeToLogger = async (stream: ReadableStream<Uint8Array>, logger: DeploymentLogger) => {
    const decoder = new TextDecoder()
    for await (const chunk of stream) {
        logger.append(decoder.decode(chunk, { stream: true }))
    }
    logger.append(decoder.decode())
}

const runCommand = async (command: Array<string>, logger: DeploymentLogger, signal: AbortSignal) => {
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe", env: { ...process.env, DOCKER_BUILDKIT: "1" } })
    const kill = () => proc.kill()
    signal.addEventListener("abort", kill, { once: true })

    try {
        await Promise.all([pipeToLogger(proc.stdout, logger), pipeToLogger(proc.stderr, logger)])
        const exitCode = await proc.exited
        if (signal.aborted) {
            throw signal.reason
        }
        if (exitCode !== 0) {
            throw new Error(`${command[0]} ${command[1]} exited with code ${exitCode}`)
        }
    } finally {
        signal.removeEventListener("abort", kill)
    }
}

const buildImage = async (db: Database, deployment: Deployment, app: Application, logger: DeploymentLogger, signal: AbortSignal) => {
    const token = await getGithubToken(db, app, logger)
    const fullName = getRepositoryFullName(app)

    const ref = deployment.commitSha ?? deployment.branch
    logger.log(`Resolving ${fullName}@${ref}`)
    const commit = await resolveCommit(fullName, ref, token).catch((error) => {
        if (error instanceof GithubApiError && [404, 422].includes(error.githubStatus)) {
            throw new Error(`Couldn't find branch or commit "${ref}" in ${fullName}. Check the repository is accessible and the branch exists.`)
        }
        throw error
    })
    await db
        .update(deploymentsTable)
        .set({ commitSha: commit.sha, commitMessage: deployment.commitMessage ?? commit.message })
        .where(eq(deploymentsTable.id, deployment.id))
    logger.log(`Building commit ${commit.sha}: ${commit.message.split("\n")[0]}`)

    const workDir = join(BUILD_ROOT, deployment.id)
    const sourceDir = join(workDir, "source")
    const archive = join(workDir, "source.tar.gz")
    await rm(workDir, { recursive: true, force: true })
    await mkdir(sourceDir, { recursive: true })

    try {
        logger.log("Downloading source from GitHub")
        await downloadTarball(fullName, commit.sha, archive, token)
        await runCommand(["tar", "-xzf", archive, "-C", sourceDir, "--strip-components=1"], logger, signal)

        const contextDir = resolveInsideSource(sourceDir, app.rootDirectory || ".")
        const dockerfile = resolveInsideSource(contextDir, app.dockerfilePath)
        if (!existsSync(dockerfile)) {
            throw new Error(`No Dockerfile found at ${relative(sourceDir, dockerfile)}. Add one to the repository or change the Dockerfile path in the app settings.`)
        }

        const imageTag = `orca/${app.id}:${deployment.id}`
        logger.log(`Building image ${imageTag}`)
        await runCommand([
            "docker", "build",
            "--progress=plain",
            "--label", `orca.app=${app.id}`,
            "--label", `orca.deployment=${deployment.id}`,
            "--label", `orca.commit=${commit.sha}`,
            "-t", imageTag,
            "-f", dockerfile,
            contextDir
        ], logger, signal)

        return imageTag
    } finally {
        await rm(workDir, { recursive: true, force: true })
    }
}

const reuseImage = async (deployment: Deployment, logger: DeploymentLogger, signal: AbortSignal) => {
    const imageTag = deployment.imageTag!
    logger.log(`Rollback: reusing image ${imageTag}`)
    await runCommand(["docker", "image", "inspect", "--format", "{{.Id}}", imageTag], logger, signal).catch((error) => {
        if (signal.aborted) {
            throw error
        }
        throw new Error(`Image ${imageTag} no longer exists, so this deployment can't be rolled back to`)
    })
    return imageTag
}

export const runDeployment = async (db: Database, deployment: Deployment) => {
    const controller = new AbortController()
    const cancel = () => controller.abort(new BuildCancelledError("Deployment was cancelled"))
    const logger = createDeploymentLogger(db, deployment.id, cancel)
    const timeout = setTimeout(() => controller.abort(new Error(`Build timed out after ${BUILD_TIMEOUT_MS / 60000} minutes`)), BUILD_TIMEOUT_MS)

    try {
        const [app] = await db
            .select()
            .from(applicationTable)
            .where(eq(applicationTable.id, deployment.applicationId))
        if (!app) {
            throw new Error("App no longer exists")
        }

        const imageTag = deployment.imageTag
            ? await reuseImage(deployment, logger, controller.signal)
            : await buildImage(db, deployment, app, logger, controller.signal)

        logger.log(`Build finished: ${imageTag}`)
        await logger.stop()
        await finishDeployment(db, deployment.id, { status: "BUILT", imageTag })
        console.log(`[worker] deployment ${deployment.id} built ${imageTag}`)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.log(`Error: ${message}`)
        await logger.stop()
        if (!(error instanceof BuildCancelledError)) {
            await finishDeployment(db, deployment.id, { status: "FAILED", error: message })
        }
        console.error(`[worker] deployment ${deployment.id} ${error instanceof BuildCancelledError ? "cancelled" : "failed"}: ${message}`)
    } finally {
        clearTimeout(timeout)
        await settleApplicationStatus(db, deployment.applicationId)
    }
}
