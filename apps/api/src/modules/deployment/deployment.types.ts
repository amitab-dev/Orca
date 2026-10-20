import z from "zod";

export const createDeploymentSchema = z.object({
    branch: z.string().trim().min(1, "Branch is required").optional(),
    commitSha: z.string().trim().regex(/^[0-9a-f]{7,40}$/i, "Invalid commit SHA").optional()
})

export const listDeploymentsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const appDeploymentsParamsSchema = z.object({
    workspaceId: z.uuid(),
    appId: z.uuid()
})

export const deploymentParamsSchema = z.object({
    workspaceId: z.uuid(),
    appId: z.uuid(),
    deploymentId: z.uuid()
})

export type CreateDeployment = z.infer<typeof createDeploymentSchema>
export type ListDeploymentsQuery = z.infer<typeof listDeploymentsQuerySchema>
export type AppDeploymentsParams = z.infer<typeof appDeploymentsParamsSchema>
export type DeploymentParams = z.infer<typeof deploymentParamsSchema>
