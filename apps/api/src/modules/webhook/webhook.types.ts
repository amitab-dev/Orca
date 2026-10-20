import z from "zod";

export const githubPushPayloadSchema = z.object({
    ref: z.string(),
    after: z.string(),
    deleted: z.boolean().optional(),
    head_commit: z.object({
        id: z.string(),
        message: z.string()
    }).nullable().optional(),
    repository: z.object({
        id: z.number(),
        full_name: z.string(),
        html_url: z.string(),
        clone_url: z.string().optional(),
        ssh_url: z.string().optional()
    })
})

export const githubInstallationPayloadSchema = z.object({
    action: z.string(),
    installation: z.object({
        id: z.number(),
        account: z.object({
            login: z.string(),
            type: z.string()
        }).nullable().optional()
    })
})

export type GithubPushPayload = z.infer<typeof githubPushPayloadSchema>
export type GithubInstallationPayload = z.infer<typeof githubInstallationPayloadSchema>
