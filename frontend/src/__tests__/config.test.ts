/**
 * Tests for the runtime configuration resolver.
 *
 * Vite compiles `import.meta.env.VITE_*` into the bundle, so on its own it
 * cannot be changed after a build. `window.__LOGICRAFT_CONFIG__`, set by
 * public/config.js before the bundle runs, is what makes one artifact deployable
 * to several environments. The precedence between the two, and the fallbacks
 * that keep the app running when neither is set, is the behaviour worth
 * protecting.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiBase, googleMapsApiKey, googleMapsMapId } from "../config";

afterEach(() => {
  delete window.__LOGICRAFT_CONFIG__;
  vi.unstubAllEnvs();
});

describe("apiBase", () => {
  it("falls back to /api/v1 when nothing is configured", () => {
    // Vitest loads .env, so the literal fallback is only reached once the
    // build-time value is blanked too.
    vi.stubEnv("VITE_API_BASE", "");
    expect(apiBase()).toBe("/api/v1");
  });

  it("uses the build-time value when only VITE_API_BASE is set", () => {
    vi.stubEnv("VITE_API_BASE", "/build-time");
    expect(apiBase()).toBe("/build-time");
  });

  it("prefers the runtime override over the build-time value", () => {
    vi.stubEnv("VITE_API_BASE", "/build-time");
    window.__LOGICRAFT_CONFIG__ = { apiBase: "https://api.example.com/api/v1" };
    expect(apiBase()).toBe("https://api.example.com/api/v1");
  });

  it("ignores a blank runtime override", () => {
    vi.stubEnv("VITE_API_BASE", "/build-time");
    window.__LOGICRAFT_CONFIG__ = { apiBase: "   " };
    expect(apiBase()).toBe("/build-time");
  });

  it("trims surrounding whitespace", () => {
    window.__LOGICRAFT_CONFIG__ = { apiBase: "  /trimmed  " };
    expect(apiBase()).toBe("/trimmed");
  });
});

describe("googleMapsApiKey", () => {
  it("is empty when nothing is configured", () => {
    // .env carries a real key in local development, so blank it explicitly.
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    expect(googleMapsApiKey()).toBe("");
  });

  it("uses the build-time value when only VITE_GOOGLE_MAPS_API_KEY is set", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "build-key");
    expect(googleMapsApiKey()).toBe("build-key");
  });

  it("prefers the runtime override", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "build-key");
    window.__LOGICRAFT_CONFIG__ = { googleMapsApiKey: "runtime-key" };
    expect(googleMapsApiKey()).toBe("runtime-key");
  });
});

describe("googleMapsMapId", () => {
  it("is empty when nothing is configured", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID", "");
    expect(googleMapsMapId()).toBe("");
  });

  it("prefers the runtime override", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID", "build-map");
    window.__LOGICRAFT_CONFIG__ = { googleMapsMapId: "runtime-map" };
    expect(googleMapsMapId()).toBe("runtime-map");
  });

  it("does not leak the map ID into the API base", () => {
    window.__LOGICRAFT_CONFIG__ = { googleMapsMapId: "runtime-map" };
    expect(apiBase()).toBe("/api/v1");
  });
});
