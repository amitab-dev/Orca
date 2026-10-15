import { NextResponse, type NextRequest } from "next/server"

const ACCESS_TOKEN_COOKIE = "orca_access_token"
const REFRESH_TOKEN_COOKIE = "orca_refresh_token"

const publicRoutes = ["/"]
const authRoutes = ["/auth/login", "/auth/register"]

const LOGIN_ROUTE = "/auth/login"
const DEFAULT_PRIVATE_ROUTE = "/home"

export function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isPublicRoute = publicRoutes.includes(path)
    const isAuthRoute = authRoutes.includes(path)

    const isLoggedIn =
        req.cookies.has(ACCESS_TOKEN_COOKIE) || req.cookies.has(REFRESH_TOKEN_COOKIE)

    if (isAuthRoute && isLoggedIn) {
        return NextResponse.redirect(new URL(DEFAULT_PRIVATE_ROUTE, req.nextUrl))
    }

    if (!isPublicRoute && !isAuthRoute && !isLoggedIn) {
        return NextResponse.redirect(new URL(LOGIN_ROUTE, req.nextUrl))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
