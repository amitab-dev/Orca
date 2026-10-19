import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as userController from "./user.controller"

export const userRoutes = async (app: FastifyInstance) => {
    app.addHook("onRequest", app.authenticate)

    app.get(
        "/me",
        async (req: FastifyRequest, reply: FastifyReply) => userController.getCurrentUser(req, reply)
    )
}
