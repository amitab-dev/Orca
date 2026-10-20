import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as webhookController from "./webhook.controller"

export const webhookRoutes = async (app: FastifyInstance) => {
    app.removeContentTypeParser("application/json")
    app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body))

    app.post(
        "/github",
        async (req: FastifyRequest, reply: FastifyReply) => await webhookController.handleGithubWebhook(req, reply)
    )
}
