import { AxiosError } from "axios"

const statusMessages: Record<number, string> = {
    400: "Please check the details you entered and try again.",
    401: "Invalid email or password.",
    409: "An account with this email already exists.",
    422: "Please check the details you entered and try again.",
    429: "Too many attempts. Please wait a moment and try again.",
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
    if (!(error instanceof AxiosError)) {
        return fallback
    }

    if (!error.response) {
        return "Can't reach the server. Check your connection and try again."
    }

    const { status, data } = error.response
    const serverMessage = typeof data?.message === "string" ? data.message : undefined

    if (status >= 500) {
        return "Something went wrong on our end. Please try again later."
    }
    if (serverMessage && status !== 400) {
        return serverMessage
    }
    return statusMessages[status] ?? fallback
}
