import z from "zod"

export const createAppSchema = z.object({
    name: z.string().trim().min(1, "App name is required").max(255, "App name is too long"),
    sourceRepository: z.string().trim().min(1, "Source repository is required"),
    repositoryName: z.string().trim().min(1, "Repository name is required")
})

export type CreateApp = z.infer<typeof createAppSchema>

export type AppStatus = "NOT STARTED" | "QUEUED" | "DEPLOYED"

export type App = {
    id: string
    name: string
    workspaceId: string
    sourceRepository: string
    repositoryName: string
    status: AppStatus
    createdBy: string
    createdAt: string
    updatedAt: string
}
