/**
 * Tests for the dev-server API proxy.
 *
 * The behaviour that matters is not the proxy itself but the `Origin` header the
 * API ends up seeing. A browser sends its own origin, `changeOrigin` only
 * rewrites `Host`, and the API's CORS filter answers an unlisted origin with a
 * bare 403 and no body — indistinguishable in the UI from a permissions
 * failure. It appears the moment the dev server is not on the exact host:port in
 * `CORS_ALLOWED_ORIGINS`: a second dev server on :5174, or the LAN address Vite
 * prints on startup. So the header is dropped, and these assertions keep it so.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_API_BASE, DEFAULT_PROXY_TARGET, devApiProxy } from "../devProxy";

/** Invokes the proxy's `configure` hook and returns the proxyReq handler it registers. */
function proxyReqHandler(env?: Parameters<typeof devApiProxy>[0]) {
  const key = env?.apiBase?.trim() || DEFAULT_API_BASE;
  const options = devApiProxy(env)[key];
  // A plain closure, not a mock: vitest.config.ts sets restoreMocks, which
  // strips a vi.fn implementation before the test body runs.
  const registered = new Map<string, (req: { removeHeader: (name: string) => void }) => void>();
  const server = {
    on: (event: string, fn: (req: { removeHeader: (name: string) => void }) => void) => {
      registered.set(event, fn);
    }
  };

  // `configure` receives http-proxy's server, which is not what the test cares
  // about; only the event registration is exercised.
  options.configure?.(server as never, {} as never);
  const handler = registered.get("proxyReq");
  if (!handler) throw new Error("configure() did not register a proxyReq handler");
  return handler;
}

describe("devApiProxy", () => {
  it("keys the proxy on the API base and points it at the backend", () => {
    const options = devApiProxy({ apiBase: "/api/v1", target: "http://localhost:9000" });

    expect(Object.keys(options)).toEqual(["/api/v1"]);
    expect(options["/api/v1"].target).toBe("http://localhost:9000");
    expect(options["/api/v1"].changeOrigin).toBe(true);
  });

  it("falls back to the documented defaults", () => {
    const options = devApiProxy();

    expect(Object.keys(options)).toEqual([DEFAULT_API_BASE]);
    expect(options[DEFAULT_API_BASE].target).toBe(DEFAULT_PROXY_TARGET);
  });

  it("honours a custom API base", () => {
    expect(Object.keys(devApiProxy({ apiBase: " /api/v2 " }))).toEqual(["/api/v2"]);
  });

  it("drops the Origin header so the API cannot refuse a same-origin call", () => {
    const dropped: string[] = [];

    proxyReqHandler()({ removeHeader: (name) => void dropped.push(name) });

    expect(dropped).toEqual(["origin"]);
  });
});
