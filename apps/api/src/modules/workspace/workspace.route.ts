import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createWorkspaceSchema, updateWorkspaceSchema, workspaceParamsSchema } from "./workspace.types";
import * as workspaceController from "./workspace.controller"

export const workspaceRoute = async (app: FastifyInstance) => {
    app.addHook("onRequest", app.authenticate)

    app.post(
        "/",
        {
            schema: { body: createWorkspaceSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await workspaceController.createWorkspace(req, reply) 
    )

    app.get(
        "/",
        async (req: FastifyRequest, reply: FastifyReply) => await workspaceController.getWorkspaces(req, reply)
    )

    app.get(
        "/:id",
        {
            schema: { params: workspaceParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await workspaceController.getWorkspace(req, reply)
    )

    app.patch(
        "/:id",
        {
            schema: { params: workspaceParamsSchema, body: updateWorkspaceSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await workspaceController.updateWorkspace(req, reply)
    )

    app.delete(
        "/:id",
        {
            schema: { params: workspaceParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await workspaceController.deleteWorkspace(req, reply)
    )
}
