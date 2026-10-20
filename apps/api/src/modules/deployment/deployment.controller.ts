import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, inArray } from "drizzle-orm";
import { appDeploymentsParamsSchema, createDeploymentSchema, deploymentParamsSchema, listDeploymentsQuerySchema } from "./deployment.types";
import { ApiError, ApiResponse } from "../../utils/response";
import { applicationTable, deploymentsTable, type Deployment, type NewDeployment } from "../../db/schema";
import { getMembership } from "../workspace/workspace.controller";
import { assertCanWrite, findApp } from "../app/app.controller";

export const IN_PROGRESS_STATUSES = ["QUEUED", "BUILDING", "DEPLOYING"] as const

const formatDeployment = (deployment: Deployment) => {
    return {
        id: deployment.id,
        applicationId: deployment.applicationId,
        status: deployment.status,
        trigger: deployment.trigger,
        branch: deployment.branch,
        commitSha: deployment.commitSha,
        commitMessage: deployment.commitMessage,
        imageTag: deployment.imageTag,
        error: deployment.error,
        triggeredBy: deployment.triggeredBy,
        startedAt: deployment.startedAt,
        finishedAt: deployment.finishedAt,
        createdAt: deployment.createdAt,
        updatedAt: deployment.updatedAt
    }
}

const findDeployment = async (req: FastifyRequest, appId: string, deploymentId: string) => {
    const [deployment] = await req.server.db
        .select()
        .from(deploymentsTable)
        .where(
            and(
                eq(deploymentsTable.id, deploymentId),
                eq(deploymentsTable.applicationId, appId)
            )
        )

    if (!deployment) {
        throw new ApiError(404, "Deployment not found")
    }

    return deployment
}

const assertNoDeploymentInProgress = async (req: FastifyRequest, appId: string) => {
    const [inProgress] = await req.server.db
        .select({ id: deploymentsTable.id })
        .from(deploymentsTable)
        .where(
            and(
                eq(deploymentsTable.applicationId, appId),
                inArray(deploymentsTable.status, [...IN_PROGRESS_STATUSES])
            )
        )
        .limit(1)

    if (inProgress) {
        throw new ApiError(409, "A deployment is already in progress for this app")
    }
}

export const queueDeployment = async (db: FastifyInstance["db"], appId: string, values: Omit<NewDeployment, "applicationId" | "status">) => {
    const createdDeployment = await db.transaction(async (tx) => {
        const [deployment] = await tx
            .insert(deploymentsTable)
            .values({
                ...values,
                applicationId: appId,
                status: "QUEUED"
            })
            .returning()

        await tx
            .update(applicationTable)
            .set({ status: "QUEUED" })
            .where(eq(applicationTable.id, appId))

        return deployment
    })

    if (!createdDeployment) {
        throw new ApiError(500, "Failed to create deployment")
    }

    return createdDeployment
}

export const createDeployment = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = appDeploymentsParamsSchema.safeParse(req.params)
    const body = createDeploymentSchema.safeParse(req.body ?? {})
    if (!params.success || !body.success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, params.data.workspaceId)
    assertCanWrite(membership.role)

    const app = await findApp(req, params.data.workspaceId, params.data.appId)
    if (app.deployMode !== "MANUAL") {
        throw new ApiError(409, "This app deploys automatically on push. Switch it to manual mode to trigger deployments")
    }

    await assertNoDeploymentInProgress(req, app.id)

    const deployment = await queueDeployment(req.server.db, app.id, {
        trigger: "MANUAL",
        branch: body.data.branch ?? app.branch,
        commitSha: body.data.commitSha,
        triggeredBy: req.user.id
    })

    return reply
        .code(201)
        .send(new ApiResponse(201, formatDeployment(deployment), "Deployment queued"))
}

export const getDeployments = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = appDeploymentsParamsSchema.safeParse(req.params)
    const query = listDeploymentsQuerySchema.safeParse(req.query)
    if (!params.success || !query.success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, params.data.workspaceId)
    await findApp(req, params.data.workspaceId, params.data.appId)

    const deployments = await req.server.db
        .select()
        .from(deploymentsTable)
        .where(eq(deploymentsTable.applicationId, params.data.appId))
        .orderBy(desc(deploymentsTable.createdAt))
        .limit(query.data.limit)

    return reply.code(200).send(new ApiResponse(200, deployments.map(formatDeployment), "Deployments"))
}

export const getDeployment = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = deploymentParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, data.workspaceId)
    await findApp(req, data.workspaceId, data.appId)
    const deployment = await findDeployment(req, data.appId, data.deploymentId)

    return reply.code(200).send(new ApiResponse(200, formatDeployment(deployment)))
}

export const cancelDeployment = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = deploymentParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, data.workspaceId)
    assertCanWrite(membership.role)

    const app = await findApp(req, data.workspaceId, data.appId)
    await findDeployment(req, app.id, data.deploymentId)

    const cancelledDeployment = await req.server.db.transaction(async (tx) => {
        const [deployment] = await tx
            .update(deploymentsTable)
            .set({ status: "CANCELLED", finishedAt: new Date() })
            .where(
                and(
                    eq(deploymentsTable.id, data.deploymentId),
                    eq(deploymentsTable.applicationId, app.id),
                    inArray(deploymentsTable.status, [...IN_PROGRESS_STATUSES])
                )
            )
            .returning()

        if (!deployment) {
            return undefined
        }

        await tx
            .update(applicationTable)
            .set({ status: app.activeDeploymentId ? "DEPLOYED" : "NOT STARTED" })
            .where(eq(applicationTable.id, app.id))

        return deployment
    })

    if (!cancelledDeployment) {
        throw new ApiError(409, "Only queued or running deployments can be cancelled")
    }

    return reply
        .code(200)
        .send(new ApiResponse(200, formatDeployment(cancelledDeployment), "Deployment cancelled"))
}

export const rollbackDeployment = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = deploymentParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, data.workspaceId)
    assertCanWrite(membership.role)

    const app = await findApp(req, data.workspaceId, data.appId)
    const target = await findDeployment(req, app.id, data.deploymentId)

    if (!target.imageTag) {
        throw new ApiError(409, "This deployment has no built image to roll back to")
    }

    if (target.id === app.activeDeploymentId) {
        throw new ApiError(409, "This deployment is already live")
    }

    await assertNoDeploymentInProgress(req, app.id)

    const deployment = await queueDeployment(req.server.db, app.id, {
        trigger: "ROLLBACK",
        branch: target.branch,
        commitSha: target.commitSha,
        commitMessage: target.commitMessage,
        imageTag: target.imageTag,
        triggeredBy: req.user.id
    })

    return reply
        .code(201)
        .send(new ApiResponse(201, formatDeployment(deployment), "Rollback queued"))
}

export const getDeploymentLogs = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = deploymentParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, data.workspaceId)
    await findApp(req, data.workspaceId, data.appId)
    const deployment = await findDeployment(req, data.appId, data.deploymentId)

    return reply.code(200).send(new ApiResponse(200, { status: deployment.status, logs: deployment.logs ?? "" }))
}
