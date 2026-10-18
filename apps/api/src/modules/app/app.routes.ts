import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { appParamsSchema, createAppSchema, updateAppSchema, workspaceAppsParamsSchema } from "./app.types";
import * as appController from "./app.controller"

export const appRoutes = async (app: FastifyInstance) => {
    app.addHook("onRequest", app.authenticate)

    app.post(
        "/",
        {
            schema: { params: workspaceAppsParamsSchema, body: createAppSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await appController.createApp(req, reply)
    )

    app.get(
        "/",
        {
            schema: { params: workspaceAppsParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await appController.getApps(req, reply)
    )

    app.get(
        "/:appId",
        {
            schema: { params: appParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await appController.getApp(req, reply)
    )

    app.patch(
        "/:appId",
        {
            schema: { params: appParamsSchema, body: updateAppSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await appController.updateApp(req, reply)
    )

    app.delete(
        "/:appId",
        {
            schema: { params: appParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await appController.deleteApp(req, reply)
    )
}
