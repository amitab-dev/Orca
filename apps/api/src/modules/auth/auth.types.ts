import z from "zod"

export const registerSchema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.email().min(1),
    password: z.string().min(6, "Password must be 6 character long")
})

export const loginSchema = z.object({
    email: z.email().min(1),
    password: z.string().min(6, "Password must be 6 character long")
})

export type Register = z.infer<typeof registerSchema>
export type Login = z.infer<typeof loginSchema>