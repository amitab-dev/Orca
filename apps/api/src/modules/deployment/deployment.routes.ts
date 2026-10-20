import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { appDeploymentsParamsSchema, createDeploymentSchema, deploymentParamsSchema, listDeploymentsQuerySchema } from "./deployment.types";
import * as deploymentController from "./deployment.controller"

export const deploymentRoutes = async (app: FastifyInstance) => {
    app.addHook("onRequest", app.authenticate)

    app.post(
        "/",
        {
            schema: { params: appDeploymentsParamsSchema, body: createDeploymentSchema.nullish() }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await deploymentController.createDeployment(req, reply)
    )

    app.get(
        "/",
        {
            schema: { params: appDeploymentsParamsSchema, querystring: listDeploymentsQuerySchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await deploymentController.getDeployments(req, reply)
    )

    app.get(
        "/:deploymentId",
        {
            schema: { params: deploymentParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await deploymentController.getDeployment(req, reply)
    )

    app.get(
        "/:deploymentId/logs",
        {
            schema: { params: deploymentParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await deploymentController.getDeploymentLogs(req, reply)
    )

    app.post(
        "/:deploymentId/cancel",
        {
            schema: { params: deploymentParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await deploymentController.cancelDeployment(req, reply)
    )

    app.post(
        "/:deploymentId/rollback",
        {
            schema: { params: deploymentParamsSchema }
        },
        async (req: FastifyRequest, reply: FastifyReply) => await deploymentController.rollbackDeployment(req, reply)
    )
}
