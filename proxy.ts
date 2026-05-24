import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl

  // 1. Allow public files, auth API routes, and landing pages
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icon.svg") ||
    pathname === "/"
  ) {
    return NextResponse.next()
  }

  // 2. Redirect unauthenticated users trying to access protected paths
  if (!token) {
    if (pathname === "/sign-in") {
      return NextResponse.next()
    }
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  // User is authenticated
  const role = token.role as string

  // 3. Redirect logged-in users visiting /sign-in to /dashboard
  if (pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // 4. Role-based URL route redirects for /dashboard route
  if (pathname === "/dashboard") {
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", req.url))
    }
    if (role === "PROFESSOR") {
      return NextResponse.redirect(new URL("/professor", req.url))
    }
    if (role === "STUDENT") {
      return NextResponse.redirect(new URL("/student", req.url))
    }
    // Fallback: If no role matches, let it proceed to dashboard
    return NextResponse.next()
  }

  // 5. Strict role routing guards
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if (pathname.startsWith("/professor") && role !== "PROFESSOR") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if (pathname.startsWith("/student") && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (other than auth API routes)
     * - static files
     * - images
     */
    "/((?!api/|static|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
}
