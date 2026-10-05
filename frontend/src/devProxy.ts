import type { ProxyOptions } from 'vite';

/**
 * The Vite dev server's API proxy.
 *
 * `vite.config.ts` is excluded from the TypeScript program (tsconfig includes
 * `vite.config.js`, not `.ts`), so the wiring lives here where it is typechecked
 * and testable.
 *
 * The `Origin` header is the subtle part. A browser sends its own origin to the
 * dev server and the proxy forwards it untouched — `changeOrigin` only rewrites
 * `Host`. The API's CORS filter refuses any origin it was not configured for,
 * with a bare `403` and no body, which is indistinguishable in the UI from a
 * permissions failure. That breaks login as soon as the dev server is not on the
 * exact host:port in `CORS_ALLOWED_ORIGINS`: a second instance on `:5174`, or the
 * LAN address Vite prints on startup. The request is same-origin from the
 * browser's point of view, so the header is dropped rather than forged, and the
 * API then treats it as the non-CORS request it is.
 */

/** The two values the proxy is built from, already read out of the env files. */
export interface DevProxyEnv {
  /** Path the client prefixes to every request, e.g. `/api/v1`. */
  apiBase?: string;
  /** Where that path is forwarded, e.g. `http://localhost:8080`. */
  target?: string;
}

export const DEFAULT_API_BASE = '/api/v1';
export const DEFAULT_PROXY_TARGET = 'http://localhost:8080';

export function devApiProxy(env: DevProxyEnv = {}): Record<string, ProxyOptions> {
  const apiBase = env.apiBase?.trim() || DEFAULT_API_BASE;

  return {
    [apiBase]: {
      target: env.target?.trim() || DEFAULT_PROXY_TARGET,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
      }
    }
  };
}
