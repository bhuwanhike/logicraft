import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-server settings come from the environment so the port and the backend
 * address are not hardcoded.
 *
 * VITE_DEV_PORT        — port the dev server listens on (default 5173)
 * VITE_DEV_API_TARGET  — where /api/v1 is proxied in development (default
 *                        http://localhost:8080). In production the dashboard
 *                        talks to the API directly, so this is a dev-only knob.
 * VITE_API_BASE        — path the client prefixes, and the proxy key (default
 *                        /api/v1)
 *
 * These are read here in Node, not through import.meta.env. Runtime overrides
 * for a built bundle live in public/config.js.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const apiBase = env.VITE_API_BASE?.trim() || "/api/v1";

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: {
        [apiBase]: {
          target: env.VITE_DEV_API_TARGET?.trim() || "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
  };
});
