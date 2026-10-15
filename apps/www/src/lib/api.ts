import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
})

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
        if (
            error.response?.status !== 401 ||
            !original ||
            original._retry ||
            original.url?.startsWith("/auth/")
        ) {
            return Promise.reject(error)
        }

        original._retry = true
        await api.post("/auth/refresh")
        return api(original)
    }
)
