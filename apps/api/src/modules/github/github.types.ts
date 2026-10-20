import z from "zod";

export const workspaceGithubParamsSchema = z.object({
    workspaceId: z.uuid()
})

export const installationParamsSchema = z.object({
    workspaceId: z.uuid(),
    installationId: z.uuid()
})

export const setupQuerySchema = z.object({
    installation_id: z.coerce.number().int().positive().optional(),
    setup_action: z.string().optional(),
    code: z.string().optional(),
    state: z.string().optional()
})

export type InstallState = {
    purpose: "github_install"
    workspaceId: string
    userId: string
}

export type WorkspaceGithubParams = z.infer<typeof workspaceGithubParamsSchema>
export type InstallationParams = z.infer<typeof installationParamsSchema>
export type SetupQuery = z.infer<typeof setupQuerySchema>
