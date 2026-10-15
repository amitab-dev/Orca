import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify"
import fp from "fastify-plugin"
import { eq } from "drizzle-orm"
import { usersTable } from "../db/schema"
import { ApiError } from "../utils/response"
import type { AuthUser, TokenPayload } from "../modules/user/user.types"

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (req: FastifyRequest) => Promise<void>
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        user: AuthUser
    }
}

const authenticatePlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.decorate("authenticate", async (req: FastifyRequest) => {
        let payload: TokenPayload
        try {
            payload = await req.jwtVerify<TokenPayload>()
        } catch {
            throw new ApiError(401, "Unauthorized")
        }

        const [user] = await req.server.db
            .select({
                id: usersTable.id,
                name: usersTable.fullName,
                email: usersTable.email,
                avatar: usersTable.avatar,
                role: usersTable.role,
                createdAt: usersTable.createdAt,
            })
            .from(usersTable)
            .where(eq(usersTable.id, payload.id))

        if (!user) {
            throw new ApiError(401, "Unauthorized")
        }

        req.user = user
    })
}

export default fp(authenticatePlugin, {
    name: "authenticate",
    dependencies: ["@fastify/jwt"],
})
