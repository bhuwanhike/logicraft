import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

import { DEFAULT_API_BASE, devApiProxy } from "./src/devProxy";

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
 * for a built bundle live in public/config.js. The proxy itself, including the
 * Origin handling, is in src/devProxy.ts so it can be typechecked and tested.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: devApiProxy({
        apiBase: env.VITE_API_BASE || DEFAULT_API_BASE,
        target: env.VITE_DEV_API_TARGET,
      }),
    },
  };
});
