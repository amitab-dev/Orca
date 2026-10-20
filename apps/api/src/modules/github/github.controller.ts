import type { FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { installationParamsSchema, setupQuerySchema, workspaceGithubParamsSchema, type InstallState } from "./github.types";
import { ApiError, ApiResponse } from "../../utils/response";
import { githubInstallationsTable, membersTable, type GithubInstallation } from "../../db/schema";
import { getMembership } from "../workspace/workspace.controller";
import { assertCanWrite } from "../app/app.controller";
import { exchangeUserCode, findUserInstallation, getAppInstallUrl, listInstallationRepositories } from "../../utils/github";

const INSTALL_STATE_TTL = "10m"

const formatInstallation = (installation: GithubInstallation) => {
    return {
        id: installation.id,
        installationId: installation.installationId,
        workspaceId: installation.workspaceId,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        suspended: Boolean(installation.suspendedAt),
        createdAt: installation.createdAt
    }
}

export const findInstallation = async (req: FastifyRequest, workspaceId: string, installationId: string) => {
    const [installation] = await req.server.db
        .select()
        .from(githubInstallationsTable)
        .where(
            and(
                eq(githubInstallationsTable.id, installationId),
                eq(githubInstallationsTable.workspaceId, workspaceId)
            )
        )

    if (!installation) {
        throw new ApiError(404, "GitHub installation not found")
    }

    if (installation.suspendedAt) {
        throw new ApiError(409, "This GitHub installation is suspended")
    }

    return installation
}

const redirectToWorkspace = (reply: FastifyReply, workspaceId: string | undefined, params: Record<string, string>) => {
    const path = workspaceId ? `/workspaces/${workspaceId}` : "/home"
    return reply.code(302).redirect(`${process.env.FRONTEND_URL}${path}?${new URLSearchParams(params)}`)
}

export const getInstallUrl = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = workspaceGithubParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, data.workspaceId)
    assertCanWrite(membership.role)

    const state: InstallState = { purpose: "github_install", workspaceId: data.workspaceId, userId: req.user.id }
    const token = req.server.jwt.sign(state, { expiresIn: INSTALL_STATE_TTL })

    return reply.code(200).send(new ApiResponse(200, { url: getAppInstallUrl(token) }))
}

export const handleSetup = async (req: FastifyRequest, reply: FastifyReply) => {
    const query = setupQuerySchema.safeParse(req.query)
    if (!query.success) {
        return redirectToWorkspace(reply, undefined, { github: "error", message: "Invalid GitHub callback" })
    }

    let state: InstallState
    try {
        state = req.server.jwt.verify<InstallState>(query.data.state ?? "")
        if (state.purpose !== "github_install") {
            throw new Error("Invalid state")
        }
    } catch {
        return redirectToWorkspace(reply, undefined, { github: "error", message: "This install link has expired. Please try again." })
    }

    if (query.data.setup_action === "request") {
        return redirectToWorkspace(reply, state.workspaceId, { github: "requested" })
    }

    try {
        if (!query.data.installation_id || !query.data.code) {
            throw new ApiError(400, "GitHub did not return an installation")
        }

        const [membership] = await req.server.db
            .select({ role: membersTable.workspaceRole })
            .from(membersTable)
            .where(
                and(
                    eq(membersTable.workspaceId, state.workspaceId),
                    eq(membersTable.memberId, state.userId)
                )
            )
        if (!membership) {
            throw new ApiError(404, "Workspace not found")
        }
        assertCanWrite(membership.role)

        const userToken = await exchangeUserCode(query.data.code)
        const installation = await findUserInstallation(userToken, query.data.installation_id)
        if (!installation) {
            throw new ApiError(403, "You don't have access to this GitHub installation")
        }

        await req.server.db
            .insert(githubInstallationsTable)
            .values({
                installationId: installation.id,
                workspaceId: state.workspaceId,
                accountLogin: installation.account.login,
                accountType: installation.account.type,
                createdBy: state.userId
            })
            .onConflictDoUpdate({
                target: [githubInstallationsTable.installationId, githubInstallationsTable.workspaceId],
                set: {
                    accountLogin: installation.account.login,
                    accountType: installation.account.type,
                    suspendedAt: null
                }
            })

        return redirectToWorkspace(reply, state.workspaceId, { github: "connected" })
    } catch (error) {
        req.log.error(error)
        const message = error instanceof ApiError ? error.message : "Could not connect GitHub. Please try again."
        return redirectToWorkspace(reply, state.workspaceId, { github: "error", message })
    }
}

export const getInstallations = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = workspaceGithubParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, data.workspaceId)

    const installations = await req.server.db
        .select()
        .from(githubInstallationsTable)
        .where(eq(githubInstallationsTable.workspaceId, data.workspaceId))
        .orderBy(desc(githubInstallationsTable.createdAt))

    return reply.code(200).send(new ApiResponse(200, installations.map(formatInstallation), "GitHub installations"))
}

export const getInstallationRepositories = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = installationParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, data.workspaceId)
    const installation = await findInstallation(req, data.workspaceId, data.installationId)

    const repositories = await listInstallationRepositories(installation.installationId)

    return reply.code(200).send(new ApiResponse(200, repositories.map((repository) => ({
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        private: repository.private,
        url: repository.html_url,
        defaultBranch: repository.default_branch
    })), "Repositories"))
}

export const deleteInstallation = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = installationParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, data.workspaceId)
    assertCanWrite(membership.role)

    const [deleted] = await req.server.db
        .delete(githubInstallationsTable)
        .where(
            and(
                eq(githubInstallationsTable.id, data.installationId),
                eq(githubInstallationsTable.workspaceId, data.workspaceId)
            )
        )
        .returning({ id: githubInstallationsTable.id })

    if (!deleted) {
        throw new ApiError(404, "GitHub installation not found")
    }

    return reply.code(200).send(new ApiResponse(200, null, "GitHub installation disconnected"))
}
