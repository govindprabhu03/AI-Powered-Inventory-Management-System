import type { NextConfig } from "next";

// Safe, broadly-compatible security headers. A strict CSP is deliberately
// omitted — it needs per-deploy tuning for Supabase/Vercel and is easy to break;
// that's a follow-up if the app ever handles untrusted embedded content.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Only the scanner page uses the camera; everything else is denied.
    value: "camera=(self), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
