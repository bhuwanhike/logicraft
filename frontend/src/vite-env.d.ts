/// <reference types="vite/client" />

/**
 * Build-time environment variables.
 *
 * Vite only exposes variables prefixed with `VITE_` to the client bundle, and
 * anything exposed this way ends up in shipped JavaScript. That is acceptable
 * for a browser Maps key only because Google's own guidance is to restrict such
 * a key by HTTP referrer, which the same page documents.
 */
interface ImportMetaEnv {
  /** Base path for the LogiCraft API, e.g. `/api/v1`. */
  readonly VITE_API_BASE?: string;
  /**
   * Dev-server port. Read by vite.config.ts in Node, never reaches the bundle.
   */
  readonly VITE_DEV_PORT?: string;
  /**
   * Where the dev server proxies VITE_API_BASE in development, e.g.
   * `http://localhost:8080`. Dev only; production calls the API directly.
   */
  readonly VITE_DEV_API_TARGET?: string;
  /**
   * Google Maps JavaScript API browser key. Absent in local development and in
   * CI until it is supplied; the map degrades to its coordinate-less empty
   * state rather than rendering a grey tile void.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /**
   * Optional Google Maps map ID, required only for AdvancedMarkerElement and
   * styled markers. When absent, markers fall back to the classic overlay
   * which needs no cloud configuration.
   */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Ambient declarations for non-JS assets and untyped third-party modules.
 *
 * Vite resolves these imports at build time; TypeScript just needs to be told
 * they are valid and what shape they have.
 */

// Stylesheets imported for their side effect.
declare module '*.css';
declare module '*.scss';
declare module '*.sass';

// Media and other assets served out of `public/` or imported from `src/`.
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.mp4' {
  const src: string;
  export default src;
}
declare module '*.webm' {
  const src: string;
  export default src;
}
declare module '*.woff2' {
  const src: string;
  export default src;
}

// JSON is enabled in tsconfig via `resolveJsonModule`, but this keeps the
// import working if that flag is ever turned off.
declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}

/**
 * `navigator.deviceMemory` is shipped by Chromium and Firefox but is not in
 * TypeScript's DOM lib, so the hero's low-power check declares it here. It stays
 * optional because Safari and Firefox ESR do not implement it.
 */
interface Navigator {
  readonly deviceMemory?: number;
}
