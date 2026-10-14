import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

export default function connectDB() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error("DATABASE_URL not set")
    }

    const pool = new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 200000,
        idleTimeoutMillis:30000
    })

    const db = drizzle(pool)

    return db
}