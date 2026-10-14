import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loginSchema, registerSchema } from "./auth.types";
import * as authController from "./auth.controller"

export const authRoutes = async (app: FastifyInstance) => {
    app.post(
        "/",
        {
            schema: {
                body: { registerSchema }
            }
        },
        async (req: FastifyRequest, reply: FastifyReply) => authController.registerUser(req, reply)
    ),

    app.post(
        "/login",
        {
            schema: {
                body: { loginSchema }
            }
        },
        async (req: FastifyRequest, reply: FastifyReply) => authController.loginUser(req, reply)
    )

    app.post(
        "/logout",
        async (req: FastifyRequest, reply: FastifyReply) => authController.logoutUser(req, reply)
    )

    app.post(
        "/refresh",
        async (req: FastifyRequest, reply: FastifyReply) => authController.refreshTokens(req, reply)
    )
}