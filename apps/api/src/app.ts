import Fastify from "fastify"
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import db from "./plugins/db";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import { authRoutes } from "./modules/auth/auth.routes";
import fastifyCors from "@fastify/cors";

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
    app.register(authRoutes, { prefix: "/api/v1/auth" })

    return app;
}