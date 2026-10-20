import z from "zod";

const repositoryPathSchema = z.string().trim().max(255).refine(
    (value) => !value.startsWith("/") && !value.split("/").includes(".."),
    "Path must stay inside the repository"
)

const appFieldsSchema = z.object({
    name: z.string().min(1, "App name is required").max(255),
    sourceRepository: z.string().min(1, "Source repository is required").optional(),
    repositoryName: z.string().min(1, "Repository name is required").optional(),
    branch: z.string().trim().min(1, "Branch is required").optional(),
    rootDirectory: repositoryPathSchema.optional(),
    dockerfilePath: repositoryPathSchema.refine((value) => value.length > 0, "Dockerfile path is required").optional()
})

export const createAppSchema = appFieldsSchema
    .extend({
        installationId: z.uuid().optional(),
        repositoryId: z.number().int().positive().optional()
    })
    .refine(
        (data) => (data.installationId && data.repositoryId) || (data.sourceRepository && data.repositoryName),
        { message: "Pick a GitHub repository or provide the source repository and repository name" }
    )

export const updateAppSchema = appFieldsSchema
    .partial()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: "At least one field is required"
    })

export const updateDeployModeSchema = z.object({
    deployMode: z.enum(["MANUAL", "AUTOMATIC"])
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
export type UpdateDeployMode = z.infer<typeof updateDeployModeSchema>
export type WorkspaceAppsParams = z.infer<typeof workspaceAppsParamsSchema>
export type AppParams = z.infer<typeof appParamsSchema>
