import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { ApiError, ApiResponse } from "../../utils/response";
import { tokensTable, usersTable, type User } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateRefreshToken, hashRefreshToken } from "../../utils/tokens";
import { ACCESS_TOKEN_NAME, ACCESS_TOKEN_TTL, APPLICATION_NAME, REFRESH_TOKEN_NAME, REFRESH_TOKEN_TTL } from "../../constants";

export interface IGithubUser {
    id: number,
    name: string,
    email: string | null,
    avatar_url: string
}

export interface IGithubUserEmail {
    email: string,
    primary: boolean,
    verified: boolean,
    visiblity: string
}

export const issueTokens = (req: FastifyRequest, user: User): { accessToken: string, refreshToken: string } => {
    const app = req.server
    const accessToken = app.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
    })
    const refreshToken = generateRefreshToken();
    return { accessToken, refreshToken }
}

export const setCookies = (reply: FastifyReply, accessToken: string, refreshToken: string): FastifyReply => {
    return reply
        .cookie(ACCESS_TOKEN_NAME, accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "prod", sameSite: "lax" as const, path: '/', maxAge: ACCESS_TOKEN_TTL })
        .cookie(REFRESH_TOKEN_NAME, refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "prod", sameSite: "lax" as const, path: '/', maxAge: REFRESH_TOKEN_TTL })
}

export const oauth2Routes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/github/callback", async (req: FastifyRequest, reply: FastifyReply) => {
        const { token } = await app.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(req)
        const headers = {
            Authorization: `Bearer ${token.access_token}`,
            "User-Agent": APPLICATION_NAME,
        }
        const user = await fetch("https://api.github.com/user", { headers })
            .then(res => res.json() as Promise<IGithubUser>)
            .catch(err => {
                throw new ApiError(500, "Github server error", err)
            })

        let email: string | null = user.email

        if (!email) {
            const emails = await fetch("https://api.github.com/user/emails", { headers })
                .then(r => r.json() as Promise<[IGithubUserEmail]>)
                .catch(err => {
                    throw new ApiError(500, "Github server error", err)
                })
            email = emails.find((e) => e.primary && e.verified)?.email ?? null
        }

        if (!email) {
            throw new ApiError(400, "Please verify you email via Github")
        }

        const [existingUser] = await app.db
            .select()
            .from(usersTable)
            .where(
                eq(usersTable.email, email)
            )
            .limit(1)

        if (existingUser) {
            const { accessToken, refreshToken } = issueTokens(req, existingUser)
            const hashedRefreshToken = hashRefreshToken(refreshToken)

            await app.db.insert(tokensTable).values({
                userId: existingUser?.id,
                refreshToken: hashedRefreshToken,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
            })
            reply = setCookies(reply, accessToken, refreshToken)
            return reply.code(302).redirect(`${process.env.FRONTEND_URL}/home`);
        }

        const [newUser] = await app.db.insert(usersTable).values({
            fullName: user.name,
            email,
            provderId: user.id,
            avatar: user.avatar_url,
            provider: "GITHUB"
        }).returning()
        if (!newUser) {
            throw new ApiError(500, "Internal server error")
        }

        const { accessToken, refreshToken } = issueTokens(req, newUser)
        const hashedRefreshToken = hashRefreshToken(refreshToken)
        await app.db.insert(tokensTable).values({
            userId: newUser.id,
            refreshToken: hashedRefreshToken,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
        })
        reply = setCookies(reply, accessToken, refreshToken)
        return reply.code(302).redirect(`${process.env.FRONTEND_URL}/home`);
    })
} 