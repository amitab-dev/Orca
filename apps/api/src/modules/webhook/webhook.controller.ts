import type { FastifyReply, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { githubInstallationPayloadSchema, githubPushPayloadSchema, type GithubInstallationPayload, type GithubPushPayload } from "./webhook.types";
import { ApiError, ApiResponse } from "../../utils/response";
import { applicationTable, deploymentsTable, githubInstallationsTable } from "../../db/schema";
import { IN_PROGRESS_STATUSES, queueDeployment } from "../deployment/deployment.controller";

const BRANCH_REF_PREFIX = "refs/heads/"

const verifySignature = (rawBody: Buffer, signature: string | undefined) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET
    if (!secret) {
        throw new ApiError(500, "Webhook secret is not configured")
    }

    if (!signature || !signature.startsWith("sha256=")) {
        throw new ApiError(401, "Missing webhook signature")
    }

    const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`)
    const received = Buffer.from(signature)

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        throw new ApiError(401, "Invalid webhook signature")
    }
}

const repositoryUrls = (repository: GithubPushPayload["repository"]) => {
    const urls = [repository.html_url, `${repository.html_url}.git`, `${repository.html_url}/`, repository.clone_url, repository.ssh_url]
    return urls.filter((url): url is string => Boolean(url)).map((url) => url.toLowerCase())
}

const handlePush = async (req: FastifyRequest, payload: GithubPushPayload) => {
    if (payload.deleted || !payload.ref.startsWith(BRANCH_REF_PREFIX)) {
        return []
    }

    const branch = payload.ref.slice(BRANCH_REF_PREFIX.length)
    const db = req.server.db

    const apps = await db
        .select({ id: applicationTable.id })
        .from(applicationTable)
        .where(
            and(
                eq(applicationTable.deployMode, "AUTOMATIC"),
                eq(applicationTable.branch, branch),
                or(
                    eq(applicationTable.githubRepositoryId, payload.repository.id),
                    eq(sql`lower(${applicationTable.repositoryName})`, payload.repository.full_name.toLowerCase()),
                    inArray(sql`lower(${applicationTable.sourceRepository})`, repositoryUrls(payload.repository))
                )
            )
        )

    const deployments = []
    for (const app of apps) {
        await db
            .update(deploymentsTable)
            .set({ status: "CANCELLED", finishedAt: new Date(), error: `Superseded by push ${payload.after.slice(0, 7)}` })
            .where(
                and(
                    eq(deploymentsTable.applicationId, app.id),
                    inArray(deploymentsTable.status, [...IN_PROGRESS_STATUSES])
                )
            )

        const deployment = await queueDeployment(db, app.id, {
            trigger: "PUSH",
            branch,
            commitSha: payload.after,
            commitMessage: payload.head_commit?.message ?? null,
            triggeredBy: null
        })
        deployments.push(deployment.id)
    }

    return deployments
}

const handleInstallation = async (req: FastifyRequest, payload: GithubInstallationPayload) => {
    const db = req.server.db
    const where = eq(githubInstallationsTable.installationId, payload.installation.id)

    switch (payload.action) {
        case "deleted":
            await db.delete(githubInstallationsTable).where(where)
            return "Installation removed"
        case "suspend":
            await db.update(githubInstallationsTable).set({ suspendedAt: new Date() }).where(where)
            return "Installation suspended"
        case "unsuspend":
            await db.update(githubInstallationsTable).set({ suspendedAt: null }).where(where)
            return "Installation unsuspended"
        default:
            return `Ignored installation ${payload.action} action`
    }
}

export const handleGithubWebhook =async (req: FastifyRequest, reply: FastifyReply) => {
    const rawBody = req.body
    if (!Buffer.isBuffer(rawBody)) {
        throw new ApiError(415, "Webhook payload must be sent as application/json")
    }

    verifySignature(rawBody, req.headers["x-hub-signature-256"] as string | undefined)

    const event = req.headers["x-github-event"]
    if (event === "ping") {
        return reply.code(200).send(new ApiResponse(200, null, "pong"))
    }

    if (event !== "push" && event !== "installation") {
        return reply.code(202).send(new ApiResponse(202, null, `Ignored ${event ?? "unknown"} event`))
    }

    let json: unknown
    try {
        json = JSON.parse(rawBody.toString("utf8"))
    } catch {
        throw new ApiError(400, "Invalid JSON payload")
    }

    if (event === "installation") {
        const installation = githubInstallationPayloadSchema.safeParse(json)
        if (!installation.success) {
            throw new ApiError(400, "Invalid installation payload")
        }
        const message = await handleInstallation(req, installation.data)
        return reply.code(202).send(new ApiResponse(202, null, message))
    }

    const { success, data } = githubPushPayloadSchema.safeParse(json)
    if (!success) {
        throw new ApiError(400, "Invalid push payload")
    }

    const deploymentIds = await handlePush(req, data)

    return reply
        .code(202)
        .send(new ApiResponse(202, { deploymentIds }, deploymentIds.length ? "Deployments queued" : "No apps to deploy for this push"))
}
