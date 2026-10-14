export class ApiResponse<T = unknown> {
    readonly success: boolean
    readonly status: number
    readonly data: T
    readonly message: string

    constructor(status: number, data: T, message = "Success") {
        this.success = status < 400
        this.status = status
        this.data = data
        this.message = message
    }
}

export class ApiError extends Error {
    readonly success: boolean
    readonly status: number
    readonly error: Error | null

    constructor(status: number, message = "Something went wrong", err?: Error) {
        super(message)
        this.success = false
        this.status = status
        this.error = err ? err : null
    }
}