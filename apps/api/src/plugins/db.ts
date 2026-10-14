import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import fp from "fastify-plugin"
import connectDB from "../db"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

declare module "fastify" {
    interface FastifyInstance {
        db: NodePgDatabase<typeof import("../db/schema")>
    }
}

const dbPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
    const { db, pool } = connectDB()
    app.decorate("db", db)
    app.addHook("onClose", () => {
        pool.end()
    })
}

export default fp(dbPlugin)