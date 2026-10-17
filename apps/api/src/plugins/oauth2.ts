import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fastifyOauth2, { type OAuth2Namespace } from "@fastify/oauth2";
import fp from "fastify-plugin"

declare module 'fastify' {
    interface FastifyInstance {
        githubOAuth2: OAuth2Namespace
        gitlabOAuth2: OAuth2Namespace
    }
}

const oAuthPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
    await app.register(fastifyOauth2, {
        name: "githubOAuth2",
        scope: ["read:user","user:email"],
        credentials:{
            client:{
                id: process.env.GITHUB_CLIENT_ID!,
                secret: process.env.GITHUB_CLIENT_SECRET!
            },
            auth: fastifyOauth2.GITHUB_CONFIGURATION
        },
        startRedirectPath: "/auth/github",
        callbackUri: `http://localhost:8000/auth/github/callback`
    })
}

export default fp(oAuthPlugin, { name: "oAuthAuthentication" })