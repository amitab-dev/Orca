import z from "zod"

export const tokenPayloadSchema = z.object({
    id: z.uuid(),
    email: z.email(),
    role: z.enum(["USER", "ADMIN", "SUPERADMIN"]),
})

export type TokenPayload = z.infer<typeof tokenPayloadSchema>

export type AuthUser = {
    id: string
    name: string
    email: string
    avatar: string
    role: TokenPayload["role"]
    createdAt: Date
}
