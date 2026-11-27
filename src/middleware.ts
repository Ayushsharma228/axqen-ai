import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public pages — never block these
  if (
    pathname === "/admin/login" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = token?.role as string | undefined;
  const onboardingDone = token?.onboardingDone as boolean | undefined;

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!token) return NextResponse.redirect(new URL("/admin/login", req.url));
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }

  // ── Seller routes ─────────────────────────────────────────────────────────
  if (pathname.startsWith("/seller")) {
    if (!token) {
      // Remember the page (e.g. the Shopify claim link) so login can return there.
      const login = new URL("/login", req.url);
      login.searchParams.set("next", pathname + req.nextUrl.search);
      return NextResponse.redirect(login);
    }
    if (role !== "SELLER") return NextResponse.redirect(new URL("/login", req.url));
    if (!onboardingDone) return NextResponse.redirect(new URL("/onboarding", req.url));
    return NextResponse.next();
  }

  // ── Supplier routes ───────────────────────────────────────────────────────
  if (pathname.startsWith("/supplier")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "SUPPLIER") return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }

  // ── Sales routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/sales")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "SALES" && role !== "ADMIN") return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Match all dashboard routes — login exclusion is handled inside the function above
  matcher: ["/admin/:path*", "/seller/:path*", "/supplier/:path*", "/sales/:path*"],
};
