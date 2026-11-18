import type { NextConfig } from "next";

// Static security headers for every response (the CSP is per-request, in middleware).
// HSTS only in production: Safari honours it even on http://localhost and would then
// try to load every asset over https, leaving a blank page in development.
const securityHeaders = [
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), accelerometer=(self), gyroscope=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets a production build run alongside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["exceljs", "sharp", "@prisma/client"],
  // Card images and PDFs read the crest and fonts from disk at runtime.
  outputFileTracingIncludes: { "/api/**": ["./public/brand/**", "./src/assets/fonts/**"] },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/(admin|account)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }] },
    ];
  },
};

export default nextConfig;
