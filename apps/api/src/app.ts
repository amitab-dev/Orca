import Fastify from "fastify"
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import db from "./plugins/db";
import authenticate from "./plugins/authenticate";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { authRoutes } from "./modules/auth/auth.routes";
import { userRoutes } from "./modules/user/user.routes";
import fastifyCors from "@fastify/cors";
import oauth2 from "./plugins/oauth2";
import { oauth2Routes } from "./modules/oauth2/oauth2.handler";
import { workspaceRoute } from "./modules/workspace/workspace.route";
import { appRoutes } from "./modules/app/app.routes";

export default function bootstrap() {
    const app = Fastify({
        logger: {
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                    colorize: true,
                },
            }
        }
    }).withTypeProvider<ZodTypeProvider>()

    app.setSerializerCompiler(serializerCompiler)
    app.setValidatorCompiler(validatorCompiler)

    app.register(fastifyJwt, {
        secret: process.env.JWT_SECRET!,
        sign: {
            expiresIn: '15m'
        },
        cookie: {
            cookieName: "orca_access_token",
            signed: false
        }
    })

    app.register(fastifyCors, {
        credentials: true,
        origin: process.env.NODE_ENV === "dev" ? true : process.env.ORIGIN,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    });


    app.register(fastifyCookie)

    app.register(db)
    app.register(authenticate)
    app.register(oauth2)

    app.register(oauth2Routes, { prefix: "/auth" })
    app.register(authRoutes, { prefix: "/api/v1/auth" })
    app.register(userRoutes, { prefix: "/api/v1/users" })
    app.register(workspaceRoute, { prefix: "/api/v1/workspaces" })
    app.register(appRoutes, { prefix: "/api/v1/workspaces/:workspaceId/apps" })

    return app;
}