import z from "zod"

export const createWorkspaceSchema = z.object({
    name: z.string().trim().min(1, "Workspace name is required").max(255, "Workspace name is too long")
})

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>

export type Workspace = {
    id: string
    name: string
    slug: string
    role: "OWNER" | "MEMEBER" | "VIEWER"
    createdAt?: string
}
