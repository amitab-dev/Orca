import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiResponse } from "../../utils/response";

export const getCurrentUser = async (req: FastifyRequest, reply: FastifyReply) => {
    const { role, ...user } = req.user
    return reply.code(200).send(new ApiResponse(200, user))
}
