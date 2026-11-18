import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers for every response, including a per-request nonce-based CSP.
 * Also a cheap cookie gate for /admin and /account (real checks run on the server).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cheap gates: no cookie, no entry. Server-side role checks still run on every request.
  const adminOpen = pathname.startsWith("/admin/login") || pathname.startsWith("/admin/two-factor");
  if (pathname.startsWith("/admin") && !adminOpen && !req.cookies.get("le_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const memberOpen = pathname.startsWith("/account/login");
  if (pathname.startsWith("/account") && !memberOpen && !req.cookies.get("le_member")) {
    const url = req.nextUrl.clone();
    url.pathname = "/account/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self'${dev ? " ws:" : ""}`,
    `frame-src https://challenges.cloudflare.com https://www.google.com`,
    `frame-ancestors 'none'`,
    `form-action 'self' https://checkout.paystack.com`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    // Pages only; static assets, images and webhooks skip the nonce work.
    { source: "/((?!_next/static|_next/image|brand/|images/|favicon|robots.txt|sitemap.xml|api/).*)", missing: [{ type: "header", key: "next-router-prefetch" }] },
  ],
};
