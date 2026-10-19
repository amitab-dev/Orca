import type { FastifyReply, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { createWorkspaceSchema, updateWorkspaceSchema, workspaceParamsSchema } from "./workspace.types";
import { ApiError, ApiResponse } from "../../utils/response";
import { membersTable, usersTable, workspaceTable, type NewWorkspace, type Workspace } from "../../db/schema";
import slugify from "slugify"
import crypto from "node:crypto"
import { userInfo } from "node:os";
import { CLIENT_RENEG_WINDOW } from "node:tls";

const formatWorkspace = (workspace: Workspace) => {
    return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt
    }
}

export const getMembership = async (req: FastifyRequest, workspaceId: string) => {
    const [membership] = await req.server.db
        .select({
            id: workspaceTable.id,
            name: workspaceTable.name,
            slug: workspaceTable.slug,
            ownerId: workspaceTable.ownerId,
            role: membersTable.workspaceRole,
            createdAt: workspaceTable.createdAt,
            updatedAt: workspaceTable.updatedAt,
        })
        .from(workspaceTable)
        .innerJoin(membersTable, eq(membersTable.workspaceId, workspaceTable.id))
        .where(
            and(
                eq(workspaceTable.id, workspaceId),
                eq(membersTable.memberId, req.user.id)
            )
        )

    if (!membership) {
        throw new ApiError(404, "Workspace not found")
    }

    return membership
}

export const createWorkspace = async (req: FastifyRequest, reply: FastifyReply) => {
    const db = req.server.db

    const { success, data } = createWorkspaceSchema.safeParse(req.body)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const baseSlug = slugify(data.name, { lower: true, strict: true })
    const randomChars = crypto.randomBytes(4).toString("hex")
    const slug = baseSlug ? `${baseSlug}-${randomChars}` : randomChars

    const workspace = await db.transaction(async (tx) => {
        const [createdWorkspace] = await tx
            .insert(workspaceTable)
            .values({
                name: data.name,
                slug,
                ownerId: req.user.id,
            })
            .returning()

        if (!createdWorkspace) {
            throw new ApiError(500, "Failed to create workspace")
        }

        await tx.insert(membersTable).values({
            memberId: req.user.id,
            workspaceId: createdWorkspace.id,
            workspaceRole: "OWNER",
        })

        return createdWorkspace
    })

    return reply
        .code(201)
        .send(new ApiResponse(201, formatWorkspace(workspace), "Workspace created successfully"))
}

export const getWorkspaces = async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaces = await req.server.db
        .select({
            id: workspaceTable.id,
            name: workspaceTable.name,
            slug: workspaceTable.slug,
            role: membersTable.workspaceRole,
            createdAt: workspaceTable.createdAt,
        })
        .from(workspaceTable)
        .innerJoin(membersTable, eq(membersTable.workspaceId, workspaceTable.id))
        .where(eq(membersTable.memberId, req.user.id))
        .orderBy(desc(workspaceTable.createdAt))

    return reply.code(200).send(new ApiResponse(200, workspaces, "Workspace details"))
}

export const getWorkspace = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = workspaceParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const workspace = await getMembership(req, data.id)

    return reply.code(200).send(new ApiResponse(200, workspace))
}

export const updateWorkspace = async (req: FastifyRequest, reply: FastifyReply) => {
    const params = workspaceParamsSchema.safeParse(req.params)
    const body = updateWorkspaceSchema.safeParse(req.body)
    if (!params.success || !body.success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, params.data.id)
    if (membership.role !== "OWNER") {
        throw new ApiError(403, "Only workspace owners can update the workspace")
    }

    const [updatedWorkspace] = await req.server.db
        .update(workspaceTable)
        .set({ name: body.data.name })
        .where(eq(workspaceTable.id, params.data.id))
        .returning()

    if (!updatedWorkspace) {
        throw new ApiError(404, "Workspace not found")
    }

    return reply
        .code(200)
        .send(new ApiResponse(200, formatWorkspace(updatedWorkspace), "Workspace updated successfully"))
}

export const deleteWorkspace = async (req: FastifyRequest, reply: FastifyReply) => {
    const { success, data } = workspaceParamsSchema.safeParse(req.params)
    if (!success) {
        throw new ApiError(400, "Validation error")
    }

    const membership = await getMembership(req, data.id)
    if (membership.ownerId !== req.user.id) {
        throw new ApiError(403, "Only the workspace owner can delete the workspace")
    }

    await req.server.db
        .delete(workspaceTable)
        .where(eq(workspaceTable.id, data.id))

    return reply
        .code(200)
        .send(new ApiResponse(200, null, "Workspace deleted successfully"))
}

export const getMyWorkspace = async (req: FastifyRequest, reply: FastifyReply) => {
    const db = req.server.db
    const { id } = req.user

    const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, id)
    })

    if (!user) {
        throw new ApiError(401, "Unauthorized")
    }

    const workspaces = await db
        .select({
            id: workspaceTable.id,
            name: workspaceTable.name,
            slug: workspaceTable.slug,
            role: membersTable.workspaceRole
        })
        .from(workspaceTable)
        .innerJoin(membersTable, eq(membersTable.workspaceId, workspaceTable.id))
        .where(
            eq(membersTable.memberId, user.id)
        )

    return reply.code(200).send(new ApiResponse(200, workspaces))
}