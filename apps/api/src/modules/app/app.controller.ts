import type { FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq, ne } from "drizzle-orm";
import { appParamsSchema, createAppSchema, updateAppSchema, workspaceAppsParamsSchema } from "./app.types";
import { ApiError, ApiResponse } from "../../utils/response";
import { applicationTable, type Application } from "../../db/schema";
import { getMembership } from "../workspace/workspace.controller";

const formatApp = (app: Application) => {
    return {
        id: app.id,
        name: app.name,
        workspaceId: app.workspaceId,
        sourceRepository: app.sourceRepository,
        repositoryName: app.repositoryName,
        status: app.status,
        createdBy: app.createdBy,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt
    }
}

const assertCanWrite = (role: string) => {
    if (role === "VIEWER") {
        throw new ApiError(403, "Viewers cannot modify apps")
    }
}

const assertRepositoryAvailable = async (req: FastifyRequest, sourceRepository: string, excludeAppId?: string) => {
    const [existingApp] = await req.server.db
        .select({ id: applicationTable.id })
        .from(applicationTable)
        .where(
            excludeAppId
                ? and(eq(applicationTable.sourceRepository, sourceRepository), ne(applicationTable.id, excludeAppId))
                : eq(applicationTable.sourceRepository, sourceRepository)
        )

    if (existingApp) {
        throw new ApiError(409, "An app for this repository already exists")
    }
}

const findApp = async (req: FastifyRequest, workspaceId: string, appId: string) => {
    const [app] = await req.server.db
        .select()
        .from(applicationTable)
        .where(
            and(
                eq(applicationTable.id, appId),
                eq(applicationTable.workspaceId, workspaceId)
            )
        )

    if (!app) {
        throw new ApiError(404, "App not found")
    }

    return app
}

export const createApp = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = workspaceAppsParamsSchema.safeParse(req.params)
    const body = createAppSchema.safeParse(req.body)
    if (!params.success || !body.success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, params.data.workspaceId)
    assertCanWrite(membership.role)

    await assertRepositoryAvailable(req, body.data.sourceRepository)

    const [createdApp] = await req.server.db
        .insert(applicationTable)
        .values({
            name: body.data.name,
            sourceRepository: body.data.sourceRepository,
            repositoryName: body.data.repositoryName,
            workspaceId: params.data.workspaceId,
            createdBy: req.user.id,
        })
        .returning()

    if (!createdApp) {
        throw new ApiError(500, "Failed to create app")
    }

    return reply
        .code(201)
        .send(new ApiResponse(201, formatApp(createdApp), "App created successfully"))
}

export const getApps = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = workspaceAppsParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, data.workspaceId)

    const apps = await req.server.db
        .select()
        .from(applicationTable)
        .where(eq(applicationTable.workspaceId, data.workspaceId))
        .orderBy(desc(applicationTable.createdAt))

    return reply.code(200).send(new ApiResponse(200, apps.map(formatApp), "App details"))
}

export const getApp = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = appParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    await getMembership(req, data.workspaceId)
    const app = await findApp(req, data.workspaceId, data.appId)

    return reply.code(200).send(new ApiResponse(200, formatApp(app)))
}

export const updateApp = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = appParamsSchema.safeParse(req.params)
    const body = updateAppSchema.safeParse(req.body)
    if (!params.success || !body.success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, params.data.workspaceId)
    assertCanWrite(membership.role)

    await findApp(req, params.data.workspaceId, params.data.appId)

    if (body.data.sourceRepository) {
        await assertRepositoryAvailable(req, body.data.sourceRepository, params.data.appId)
    }

    const [updatedApp] = await req.server.db
        .update(applicationTable)
        .set(body.data)
        .where(
            and(
                eq(applicationTable.id, params.data.appId),
                eq(applicationTable.workspaceId, params.data.workspaceId)
            )
        )
        .returning()

    if (!updatedApp) {
        throw new ApiError(404, "App not found")
    }

    return reply
        .code(200)
        .send(new ApiResponse(200, formatApp(updatedApp), "App updated successfully"))
}

export const deleteApp = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = appParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, data.workspaceId)
    assertCanWrite(membership.role)

    const [deletedApp] = await req.server.db
        .delete(applicationTable)
        .where(
            and(
                eq(applicationTable.id, data.appId),
                eq(applicationTable.workspaceId, data.workspaceId)
            )
        )
        .returning({ id: applicationTable.id })

    if (!deletedApp) {
        throw new ApiError(404, "App not found")
    }

    return reply
        .code(200)
        .send(new ApiResponse(200, null, "App deleted successfully"))
}
