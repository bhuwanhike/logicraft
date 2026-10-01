import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Test config, kept separate from vite.config.ts so the dev server config is
 * not carrying a test-only dependency.
 *
 * It deliberately does not merge vite.config.ts: that file now exports a
 * function so its dev port and proxy target can come from the environment, and
 * `mergeConfig` cannot merge a callback. Tests do not use the dev server or its
 * proxy anyway, so the only thing worth reusing is the React plugin.
 *
 * The suites are mostly pure-module unit tests, but SortableTable, format.tsx's
 * components and the hooks all need a DOM, so jsdom is the default environment
 * rather than a per-file opt-in.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // The workspace tables are the regression this suite exists for, so a test
    // that logs a React key or an act() warning is a real signal, not noise.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/config.ts",
        "src/components/workspace/format.tsx",
        "src/components/common/SortableTable.tsx",
        "src/components/common/mapMarkers.ts",
        "src/components/auth/auth.constants.ts",
        "src/hooks/useUi.ts",
        "src/services/api.ts",
        "src/services/googleMaps.ts"
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75
      }
    }
  }
});
