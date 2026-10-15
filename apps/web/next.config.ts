import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// One shared .env at the repo root for both apps. Next only reads apps/web/.env* by itself,
// so load the root file here. Variables already set (e.g. by Docker) win.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Expose the socket URL to the browser bundle (Phase 7).
  env: {
    NEXT_PUBLIC_SOCKET_URL:
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
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
