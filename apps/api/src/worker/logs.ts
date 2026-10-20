import { eq, sql } from "drizzle-orm";
import { deploymentsTable } from "../db/schema";
import type { Database } from "./types";

const FLUSH_INTERVAL_MS = 1000
const MAX_LOG_BYTES = 1024 * 1024

export const createDeploymentLogger = (db: Database, deploymentId: string, onCancel: () => void) => {
    let pending = ""
    let written = 0
    let truncated = false
    let flushing: Promise<void> = Promise.resolve()

    const append = (text: string) => {
        if (truncated) {
            return
        }
        if (written + pending.length + text.length > MAX_LOG_BYTES) {
            pending += "\n[log truncated]\n"
            truncated = true
            return
        }
        pending += text
    }

    const flush = () => {
        flushing = flushing.then(async () => {
            const chunk = pending
            pending = ""
            written += chunk.length
            const [row] = await db
                .update(deploymentsTable)
                .set({ logs: sql`coalesce(${deploymentsTable.logs}, '') || ${chunk}` })
                .where(eq(deploymentsTable.id, deploymentId))
                .returning({ status: deploymentsTable.status })
            if (row?.status === "CANCELLED") {
                onCancel()
            }
        }).catch((error) => {
            console.error(`[worker] failed to write logs for ${deploymentId}`, error)
        })
        return flushing
    }

    const timer = setInterval(flush, FLUSH_INTERVAL_MS)

    return {
        log: (line: string) => append(`${line}\n`),
        append,
        flush,
        stop: async () => {
            clearInterval(timer)
            await flush()
        }
    }
}

export type DeploymentLogger = ReturnType<typeof createDeploymentLogger>
