import Fastify from "fastify"
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";

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

    return app;
}