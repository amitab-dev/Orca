import connectDB from "../db";
import { claimNextDeployment, failStaleBuilds, runDeployment } from "./pipeline";

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS) || 3000

const assertDockerAvailable = async () => {
    const proc = Bun.spawn(["docker", "version", "--format", "{{.Server.Version}}"], { stdout: "pipe", stderr: "pipe" })
    if (await proc.exited !== 0) {
        console.error("[worker] Docker is not available. Start Docker and try again.")
        process.exit(1)
    }
    console.log(`[worker] using Docker ${(await new Response(proc.stdout).text()).trim()}`)
}

const start = async () => {
    await assertDockerAvailable()
    const { db, pool } = connectDB()

    let running = true
    const shutdown = () => {
        if (!running) {
            process.exit(1)
        }
        console.log("[worker] finishing current build before exiting (press Ctrl+C again to force)")
        running = false
    }
    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    console.log("[worker] waiting for deployments")
    while (running) {
        try {
            await failStaleBuilds(db)
            const deployment = await claimNextDeployment(db)
            if (!deployment) {
                await Bun.sleep(POLL_INTERVAL_MS)
                continue
            }
            console.log(`[worker] building deployment ${deployment.id}`)
            await runDeployment(db, deployment)
        } catch (error) {
            console.error("[worker] unexpected error", error)
            await Bun.sleep(POLL_INTERVAL_MS)
        }
    }

    await pool.end()
}

start()
