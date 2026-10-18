import z from "zod";

export const createWorkspaceSchema = z.object({
    name: z.string().min(1, "Workspace name is required")
})

export const updateWorkspaceSchema = z.object({
    name: z.string().min(1, "Workspace name is required")
})

export const workspaceParamsSchema = z.object({
    id: z.uuid()
})

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>
export type WorkspaceParams = z.infer<typeof workspaceParamsSchema>
