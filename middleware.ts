import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // 0. API routes: return JSON 401 instead of HTML redirect when unauthenticated
    if (path.startsWith("/api/") && !token) {
      return NextResponse.json(
        { success: false, error: "Authentication required. Please sign in to claim food listings." },
        { status: 401 }
      );
    }

    // 1. Authentication check for dashboard and admin routes
    if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // 2. Admin portal protection
    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Redirect admins visiting dashboard directly to the admin command center
    if (path === "/dashboard" && token?.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // 3. Strict Role-Based Access Control (RBAC)
    // Restaurant-only portals
    if (
      (path.startsWith("/dashboard/listings") ||
        path.startsWith("/dashboard/claims/incoming")) &&
      token?.role !== "RESTAURANT" &&
      token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Shelter-only portals
    if (
      path.startsWith("/dashboard/claims") &&
      !path.startsWith("/dashboard/claims/incoming") &&
      token?.role !== "SHELTER" &&
      token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public whitelist and API routes (API routes handle their own JSON 401s in middleware)
        if (
          path === "/" ||
          path === "/login" ||
          path === "/register" ||
          path.startsWith("/api/") ||
          path.startsWith("/listings")
        ) {
          return true;
        }

        // All dashboard and admin pages require an active token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/admin/:path*",
    "/api/listings/:path*",
    "/api/claims/:path*",
    "/api/payments/:path*",
    "/api/users/:path*",
    "/api/dashboard/:path*",
    "/api/notifications/:path*",
  ],
};
