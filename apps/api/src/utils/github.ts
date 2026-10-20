import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { APPLICATION_NAME } from "../constants";
import { ApiError } from "./response";

const GITHUB_API_URL = "https://api.github.com"
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000

export type GithubAccount = {
    login: string
    type: string
}

export type GithubInstallationInfo = {
    id: number
    account: GithubAccount
}

export type GithubRepository = {
    id: number
    name: string
    full_name: string
    private: boolean
    html_url: string
    default_branch: string
}

type InstallationToken = {
    token: string
    expiresAt: number
}

export class GithubApiError extends ApiError {
    readonly githubStatus: number

    constructor(githubStatus: number, message: string) {
        super(githubStatus === 404 ? 404 : 502, message)
        this.githubStatus = githubStatus
    }
}

const installationTokens = new Map<number, InstallationToken>()

const requireEnv = (name: string) => {
    const value = process.env[name]
    if (!value) {
        throw new ApiError(500, `${name} is not configured`)
    }
    return value
}

const getPrivateKey = () => {
    const path = process.env.GITHUB_APP_PRIVATE_KEY_PATH
    if (path) {
        return readFileSync(path, "utf8")
    }
    return requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n")
}

const base64Url = (value: string | Buffer) => Buffer.from(value).toString("base64url")

export const createAppJwt = () => {
    const now = Math.floor(Date.now() / 1000)
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: requireEnv("GITHUB_APP_ID") }))
    const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(getPrivateKey())
    return `${header}.${payload}.${base64Url(signature)}`
}

export const githubRequest = async <T>(path: string, options: { token?: string, method?: string, body?: unknown } = {}): Promise<T> => {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": APPLICATION_NAME,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`
    }
    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json"
    }

    const res = await fetch(path.startsWith("http") ? path : `${GITHUB_API_URL}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (!res.ok) {
        const detail = await res.text().catch(() => "")
        throw new GithubApiError(res.status, `GitHub request failed (${res.status}): ${detail.slice(0, 200)}`)
    }

    return res.json() as Promise<T>
}

export const getInstallationToken = async (installationId: number) => {
    const cached = installationTokens.get(installationId)
    if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
        return cached.token
    }

    const { token, expires_at } = await githubRequest<{ token: string, expires_at: string }>(
        `/app/installations/${installationId}/access_tokens`,
        { method: "POST", token: createAppJwt() }
    )
    installationTokens.set(installationId, { token, expiresAt: new Date(expires_at).getTime() })
    return token
}

export const getAppInstallUrl = (state: string) => {
    return `https://github.com/apps/${requireEnv("GITHUB_APP_SLUG")}/installations/new?state=${encodeURIComponent(state)}`
}

export const exchangeUserCode = async (code: string) => {
    const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": APPLICATION_NAME },
        body: JSON.stringify({
            client_id: requireEnv("GITHUB_APP_CLIENT_ID"),
            client_secret: requireEnv("GITHUB_APP_CLIENT_SECRET"),
            code,
        }),
    })
    const data = await res.json() as { access_token?: string, error_description?: string }
    if (!data.access_token) {
        throw new ApiError(401, data.error_description ?? "Could not verify the GitHub installation")
    }
    return data.access_token
}

export const findUserInstallation = async (userToken: string, installationId: number) => {
    for (let page = 1; ; page++) {
        const { installations } = await githubRequest<{ installations: Array<GithubInstallationInfo> }>(
            `/user/installations?per_page=100&page=${page}`,
            { token: userToken }
        )
        const match = installations.find((installation) => installation.id === installationId)
        if (match || installations.length < 100) {
            return match
        }
    }
}

export const listInstallationRepositories = async (installationId: number) => {
    const token = await getInstallationToken(installationId)
    const repositories: Array<GithubRepository> = []
    for (let page = 1; ; page++) {
        const data = await githubRequest<{ repositories: Array<GithubRepository> }>(
            `/installation/repositories?per_page=100&page=${page}`,
            { token }
        )
        repositories.push(...data.repositories)
        if (data.repositories.length < 100) {
            return repositories
        }
    }
}

export const getInstallationRepository = async (installationId: number, repositoryId: number) => {
    const token = await getInstallationToken(installationId)
    return githubRequest<GithubRepository>(`/repositories/${repositoryId}`, { token })
}

export const resolveCommit = async (fullName: string, ref: string, token?: string) => {
    const commit = await githubRequest<{ sha: string, commit: { message: string } }>(
        `/repos/${fullName}/commits/${encodeURIComponent(ref)}`,
        { token }
    )
    return { sha: commit.sha, message: commit.commit.message }
}

export const downloadTarball = async (fullName: string, sha: string, destination: string, token?: string) => {
    const headers: Record<string, string> = { "User-Agent": APPLICATION_NAME }
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(`${GITHUB_API_URL}/repos/${fullName}/tarball/${sha}`, { headers, redirect: "follow" })
    if (!res.ok) {
        throw new ApiError(502, `Could not download source from GitHub (${res.status})`)
    }

    await Bun.write(destination, res)
}
