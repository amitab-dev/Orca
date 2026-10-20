import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { installationParamsSchema, setupQuerySchema, workspaceGithubParamsSchema } from "./github.types";
import * as githubController from "./github.controller"

export const githubRoutes = async (app: FastifyInstance) => {
    app.addHook("onRequest", app.authenticate)

    app.get(
        "/install",
        {
            schema: { params: workspaceGithubParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await githubController.getInstallUrl(req, reply)
    )

    app.get(
        "/installations",
        {
            schema: { params: workspaceGithubParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await githubController.getInstallations(req, reply)
    )

    app.get(
        "/installations/:installationId/repositories",
        {
            schema: { params: installationParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await githubController.getInstallationRepositories(req, reply)
    )

    app.delete(
        "/installations/:installationId",
        {
            schema: { params: installationParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await githubController.deleteInstallation(req, reply)
    )
}

export const githubSetupRoutes = async (app: FastifyInstance) => {
    app.get(
        "/setup",
        {
            schema: { querystring: setupQuerySchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await githubController.handleSetup(req, reply)
    )
}
