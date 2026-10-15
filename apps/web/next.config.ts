import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// One shared .env at the repo root for both apps. Next only reads apps/web/.env* by itself,
// so load the root file here. Variables already set (e.g. by Docker) win.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy (the "without nonces" recipe from the Next.js docs).
 * - connect-src: REST is same-origin; Socket.IO goes straight to the API origin
 *   (http(s):// for the handshake, ws(s):// for the WebSocket itself).
 * - frame-ancestors 'none': no other site may frame the app (clickjacking: tricking
 *   a player into dragging pieces or clicking "Resign" under an invisible overlay).
 * - 'unsafe-eval' only in dev (React's error overlay); upgrade-insecure-requests only
 *   in prod, since dev runs over plain http.
 * Next.js inlines scripts, so script-src still needs 'unsafe-inline'; a nonce-based
 * CSP (via proxy.ts) would remove that and is listed in the audit as a follow-up.
 */
const socketWs = SOCKET_URL.replace(/^http/, "ws");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${SOCKET_URL} ${socketWs}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" }, // frame-ancestors for older browsers
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Expose the socket URL to the browser bundle (Phase 7).
  env: {
    NEXT_PUBLIC_SOCKET_URL: SOCKET_URL,
  },

  poweredByHeader: false, // don't advertise the framework

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  /**
   * The browser only ever talks to this Next.js origin: /api/* is forwarded to NestJS.
   * So the auth cookie is first-party to the web origin (no cross-site cookie rules),
   * and proxy.ts can read it to decide redirects.
   */
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
    ];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
