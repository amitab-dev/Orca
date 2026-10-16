import { NextRequest, NextResponse } from "next/server"

const ACCESS_TOKEN_COOKIE = "orca_access_token"
const REFRESH_TOKEN_COOKIE = "orca_refresh_token"

const PUBLIC_ROUTES = ["/auth/login", "/auth/register"]

export function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl

    const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value
    const hasSession = Boolean(accessToken || refreshToken)

    const isPublic = PUBLIC_ROUTES.some((routes) => pathname === routes || pathname.startsWith(`${routes}`))
    if (!hasSession && !isPublic) {
        return NextResponse.redirect(new URL("/auth/login", req.url))
    }

    if (hasSession && isPublic) {
        return NextResponse.redirect(new URL("/home", req.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
    ],
}
