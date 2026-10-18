import z from "zod";

export const createAppSchema = z.object({
    name: z.string().min(1, "App name is required").max(255),
    sourceRepository: z.string().min(1, "Source repository is required"),
    repositoryName: z.string().min(1, "Repository name is required")
})

export const updateAppSchema = createAppSchema
    .partial()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: "At least one field is required"
    })

export const workspaceAppsParamsSchema = z.object({
    workspaceId: z.uuid()
})

export const appParamsSchema = z.object({
    workspaceId: z.uuid(),
    appId: z.uuid()
})

export type CreateApp = z.infer<typeof createAppSchema>
export type UpdateApp = z.infer<typeof updateAppSchema>
export type WorkspaceAppsParams = z.infer<typeof workspaceAppsParamsSchema>
export type AppParams = z.infer<typeof appParamsSchema>
