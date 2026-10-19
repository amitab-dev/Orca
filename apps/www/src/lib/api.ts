import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
})

let refreshPromise: Promise<void> | null = null

const refreshTokens = () => {
    if (!refreshPromise) {
        refreshPromise = api
            .post("/api/v1/auth/refresh")
            .then(() => undefined)
            .finally(() => {
                refreshPromise = null
            })
    }
    return refreshPromise
}

const redirectToLogin = () => {
    if (typeof window !== "undefined" && window.location.pathname !== "/auth/login") {
        window.location.href = "/auth/login"
    }
}

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
        if (
            error.response?.status !== 401 ||
            !original ||
            original._retry ||
            original.url?.startsWith("/api/v1/auth/")
        ) {
            return Promise.reject(error)
        }

        original._retry = true
        try {
            await refreshTokens()
        } catch (refreshError) {
            redirectToLogin()
            return Promise.reject(refreshError)
        }
        return api(original)
    }
)
