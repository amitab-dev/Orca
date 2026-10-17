import type { FastifyReply, FastifyRequest } from "fastify";
import { tokensTable, usersTable, type User } from "../../db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { loginSchema, registerSchema } from "./auth.types";
import { ApiError, ApiResponse } from "../../utils/response";
import { generateRefreshToken, hashRefreshToken } from "../../utils/tokens";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from "../../constants";

export const formatUser = (user: User) => {
    return {
        id: user.id,
        name: user.fullName,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt
    }
}

export const registerUser = async (req: FastifyRequest, reply: FastifyReply) => {
    const db = req.server.db;

    const { data, error } = registerSchema.safeParse(req.body);
    if (error) {
        throw new ApiError(422, "Validation error");
    }

    const existingUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, data.email),
    });
    if (existingUser) {
        throw new ApiError(409, "Email already taken");
    }

    const hashedPassword = await Bun.password.hash(data.password, {
        algorithm: "bcrypt",
        cost: 12
    });

    const [createdUser] = await db
        .insert(usersTable)
        .values({
            fullName: data.fullName,
            email: data.email,
            password: hashedPassword,
        })
        .returning();

    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    return reply
        .code(201)
        .send(new ApiResponse(201, formatUser(createdUser), "Account created successfully"));
};

export const loginUser = async (req: FastifyRequest, reply: FastifyReply) => {
    const db = req.server.db;

    const { data, error } = loginSchema.safeParse(req.body);
    if (error) {
        throw new ApiError(422, "Validation error");
    }

    const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, data.email),
    });

    if (!user || !user.password) {
        throw new ApiError(401, "Invalid email or password");
    }

    const isMatch = await Bun.password.verify(data.password, user.password);
    if (!isMatch) {
        throw new ApiError(401, "Invalid email or password");
    }

    const accessToken = req.server.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
    });

    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashRefreshToken(refreshToken);

    await db.insert(tokensTable).values({
        userId: user.id,
        refreshToken: hashedRefreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)
    });

    return reply.code(200)
        .cookie("orca_access_token", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "dev", sameSite: "lax" as const, path: '/', maxAge: ACCESS_TOKEN_TTL })
        .cookie("orca_refresh_token", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "dev", sameSite: "lax" as const, path: '/', maxAge: REFRESH_TOKEN_TTL })
        .send(
            new ApiResponse(200, { accessToken }, "Logged in successfully")
        );
};

export const logoutUser = async (req: FastifyRequest, reply: FastifyReply) => {
    const db = req.server.db;

    const refreshToken = req.cookies["orca_refresh_token"]
    if (refreshToken) {
        const hashedRefreshToken = hashRefreshToken(refreshToken)

        await db
            .update(tokensTable)
            .set({
                revokedAt: new Date(Date.now())
            }).where(
                and(
                    eq(tokensTable.refreshToken, hashedRefreshToken),
                    isNull(tokensTable.revokedAt)
                )
            )
    }

    return reply
        .code(200)
        .clearCookie("orca_access_token")
        .clearCookie("orca_refresh_token")
        .send(new ApiResponse(200, null, "Logged out successfully"));
};

export const refreshTokens = async (req: FastifyRequest, reply: FastifyReply) => {
    const db = req.server.db;

    const incomingRefreshToken = req.cookies["orca_refresh_token"]
    if (!incomingRefreshToken) {
        throw new ApiError(400, "Refresh token not found")
    }
    const hashedRefreshToken = hashRefreshToken(incomingRefreshToken)

    const user = await db.transaction(async (tx) => {
        const [tokenUser] = await tx.update(tokensTable).set({
            revokedAt: new Date(Date.now())
        }).where(
            and(
                eq(tokensTable.refreshToken, hashedRefreshToken),
                isNull(tokensTable.revokedAt),
                gt(tokensTable.expiresAt, new Date())
            )
        ).returning({
            id: tokensTable.userId
        })

        if (!tokenUser) {
            throw new ApiError(401, "Invalid or expired refresh token");
        }

        const [user] = await tx.select({
            id: usersTable.id,
            email: usersTable.email,
            role: usersTable.role,
            createdAt: usersTable.createdAt
        })
            .from(usersTable)
            .where(
                eq(usersTable.id, tokenUser.id)
            )
        if (!user) {
            throw new ApiError(401, "Invalid or expired refresh token");
        }
        return user
    })

    const accessToken = req.server.jwt.sign({ ...user })
    const newRefreshToken = generateRefreshToken()
    const newHashedRefreshToken = hashRefreshToken(newRefreshToken);

    await db.insert(tokensTable).values({
        userId: user.id,
        refreshToken: newHashedRefreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)
    })

    return reply
        .code(200)
        .cookie("orca_access_token", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "dev", sameSite: "lax" as const, path: '/', maxAge: ACCESS_TOKEN_TTL })
        .cookie("orca_refresh_token", newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "dev", sameSite: "lax" as const, path: '/', maxAge: REFRESH_TOKEN_TTL })
        .send(
            new ApiResponse(200, { accessToken }, "Token refreshed successfully"),
        );
};