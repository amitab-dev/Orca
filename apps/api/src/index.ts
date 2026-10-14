import bootstrap from "./app";

function start() {
    const app = bootstrap()
    const port  = Number(process.env.PORT) || 8000

    try {
        app.listen({ port, host: "0.0.0.0" })
    } catch (error) {
        app.log.fatal(error)
        process.exit(1)
    }
}

start()