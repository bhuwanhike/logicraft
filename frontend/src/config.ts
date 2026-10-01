/**
 * Runtime-resolved configuration.
 *
 * Vite replaces `import.meta.env.VITE_*` with literals at build time, so a
 * bundle built for one environment cannot be pointed at another without a
 * rebuild. That is fine for CI and local development but awkward for a static
 * deployment, where the same artifact usually moves between staging and
 * production.
 *
 * This module adds a runtime layer on top. `public/config.js` is loaded by
 * index.html before the app bundle and may set `window.__LOGICRAFT_CONFIG__`;
 * values set there win over the build-time ones. The deployed `dist/config.js`
 * can therefore be edited in place without rebuilding.
 *
 * Precedence, highest first:
 *   1. window.__LOGICRAFT_CONFIG__   (runtime, per-deployment)
 *   2. import.meta.env.VITE_*        (build time, baked into the bundle)
 *   3. the literal fallback below    (so the app still runs unconfigured)
 *
 * Only values that are not secrets belong here: anything in this file, or in
 * config.js, is public because it reaches the browser.
 */

export interface LogicraftRuntimeConfig {
  /** Base path or URL of the API, e.g. `/api/v1` or `https://api.example.com/api/v1`. */
  apiBase?: string;
  /** Google Maps JavaScript API browser key. */
  googleMapsApiKey?: string;
  /** Optional Google Maps map ID for AdvancedMarkerElement / styled markers. */
  googleMapsMapId?: string;
}

declare global {
  interface Window {
    __LOGICRAFT_CONFIG__?: LogicraftRuntimeConfig;
  }
}

function runtimeConfig(): LogicraftRuntimeConfig {
  if (typeof window === 'undefined') return {};
  return window.__LOGICRAFT_CONFIG__ ?? {};
}

/** First non-blank of runtime override, build-time value, then fallback. */
function resolve(
  runtimeValue: string | undefined,
  buildValue: string | undefined,
  fallback: string
): string {
  for (const candidate of [runtimeValue, buildValue]) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

/** Base path or URL the API client prefixes to every request. */
export function apiBase(): string {
  return resolve(runtimeConfig().apiBase, import.meta.env.VITE_API_BASE, '/api/v1');
}

/** The configured Maps key, or '' when unset. */
export function googleMapsApiKey(): string {
  return resolve(runtimeConfig().googleMapsApiKey, import.meta.env.VITE_GOOGLE_MAPS_API_KEY, '');
}

/** Optional cloud map ID; '' when unset. */
export function googleMapsMapId(): string {
  return resolve(runtimeConfig().googleMapsMapId, import.meta.env.VITE_GOOGLE_MAPS_MAP_ID, '');
}
