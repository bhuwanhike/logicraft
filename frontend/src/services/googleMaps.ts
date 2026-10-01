/**
 * Google Maps JavaScript API loader.
 *
 * The script is injected once per document and every caller awaits the same
 * promise. The dashboard and the Tracking Center can mount in the same session
 * (and a route change unmounts one while mounting the other), so a per-component
 * loader would race two script tags and hand some callers an unready `google`.
 *
 * No npm dependency is used. The Maps SDK is a global `window.google` rather
 * than a module, and wrapping it in a thin loader keeps the dependency list
 * unchanged while still typing the surface this app actually touches.
 */

const SRC = 'https://maps.googleapis.com/maps/api/js';

/**
 * The library names this app requests from `google.maps.importLibrary`.
 *
 * Only `maps` is requested, because that is all the classic overlay path needs:
 * Map, Marker, InfoWindow, LatLng and LatLngBounds. The `marker` library is
 * deliberately not requested — it backs AdvancedMarkerElement/PinElement, which
 * additionally require a cloud map ID, and asking for it while using the classic
 * marker fails with "Loader.provide not called by module 'marker'".
 */
const LIBRARIES = ['maps'] as const;

/** Subset of the SDK surface this app uses, so call sites stay type-safe. */
export interface GoogleMapsWindow {
  maps: {
    Map: new (element: HTMLElement, options: unknown) => GoogleMap;
    Marker: new (options: unknown) => GoogleMarker;
    InfoWindow: new (options?: unknown) => GoogleInfoWindow;
    LatLngBounds: new () => GoogleLatLngBounds;
    LatLng: new (lat: number, lng: number) => GoogleLatLng;
    /**
     * Legacy symbol path enum, used to draw the truck arrow. Present on the
     * `maps` library. There is no `google.maps.symbol` namespace and no
     * `SymbolAnchor` on this loader — both were assumed and neither exists.
     */
    SymbolPath?: Record<string, number | string>;
    event: {
      clearInstanceListeners: (instance: unknown) => void;
    };
    importLibrary?: (name: string) => Promise<unknown>;
  };
}

export interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

export interface GoogleLatLngBounds {
  extend: (point: GoogleLatLng) => void;
  isEmpty: () => boolean;
}

export interface GoogleMap {
  setCenter: (center: GoogleLatLng) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  getZoom: () => number | undefined;
  getCenter: () => GoogleLatLng | undefined;
  setOptions: (options: unknown) => void;
}

export interface GoogleMarker {
  setPosition: (position: GoogleLatLng) => void;
  setMap: (map: GoogleMap | null) => void;
  setIcon?: (icon: unknown) => void;
  setTitle?: (title: string) => void;
  /** Passing `undefined`/`null` returns the marker to the SDK's default order. */
  setZIndex?: (z: number | null | undefined) => void;
  addEventListener?: (event: string, handler: () => void) => void;
}

export interface GoogleInfoWindow {
  open: (options: unknown) => void;
  close: () => void;
  setContent: (content: unknown) => void;
}

/** Why the map could not be created. Drives the message the operator sees. */
export type MapsLoadFailure =
  | 'no-api-key'
  | 'not-activated'
  | 'referrer-blocked'
  | 'invalid-key'
  | 'load-failed'
  | 'maps-unavailable';

/**
 * Set by the SDK through the `gm_authfailure` script parameter when the key is
 * rejected. Google documents the hook but not the exact reason strings, so the
 * value is normalised to a coarse reason rather than shown verbatim.
 */
let authFailure: MapsLoadFailure | null = null;

/** The reason the SDK reported for an auth failure, if any. */
export function mapsAuthFailure(): MapsLoadFailure | null {
  return authFailure;
}

let pending: Promise<GoogleMapsWindow | null> | null = null;

/**
 * Global the SDK calls when it rejects the key. Declared on `window` because the
 * SDK invokes it as a bare global, not as a property of `google`.
 */
declare global {
  interface Window {
    logicraftAuthFailure?: (reason: string) => void;
  }
}

if (typeof window !== 'undefined') {
  window.logicraftAuthFailure = (reason: string) => {
    authFailure = classifyAuthFailure(reason ?? '');
  };
}

/** The configured key, or '' when unset. */
export function mapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
}

/** Optional cloud map ID; '' when unset. */
export function mapsMapId(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim();
}

/** True when a key is present, i.e. a real map can be attempted. */
export function hasMapsKey(): boolean {
  return mapsApiKey().length > 0;
}

/**
 * True when the SDK is genuinely usable, not merely present as a namespace.
 *
 * Deliberately a plain boolean rather than a type predicate: inside the polling
 * loop the negative branch would be narrowed to `never`, which is wrong there
 * because the namespace is expected to be incomplete and then become complete.
 */
function isReady(candidate: GoogleMapsWindow | undefined): boolean {
  return Boolean(candidate?.maps?.Map && candidate.maps.Marker && candidate.maps.LatLng);
}

/** Maps the SDK's auth-failure reason strings onto a coarse reason. */
function classifyAuthFailure(reason: string): MapsLoadFailure {
  const value = reason.toLowerCase();
  if (value.includes('referernotallowed')) return 'referrer-blocked';
  if (value.includes('invalidkey')) return 'invalid-key';
  if (value.includes('notactivated')) return 'not-activated';
  return 'maps-unavailable';
}

/** How long to wait for the SDK to become usable before giving up. */
const READY_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 50;

/**
 * Waits until the SDK's classes actually exist.
 *
 * The ordering here is the whole point. Under `loading=async` the bootstrap
 * seeds an empty `google.maps` and the real classes arrive from a second script,
 * so a readiness check run immediately after the `load` event is a race — it
 * passes or fails depending on network timing. `importLibrary` is the documented
 * way to await that load, and calling it is also what causes the SDK to fetch
 * the libraries, so it has to be attempted before any "not ready" conclusion.
 */
async function waitForSdk(globals: {
  google?: GoogleMapsWindow;
}): Promise<GoogleMapsWindow | null> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let importAttempted = false;

  while (Date.now() < deadline) {
    const google = globals.google;

    if (isReady(google)) return google ?? null;

    if (!importAttempted && typeof google?.maps?.importLibrary === 'function') {
      importAttempted = true;
      try {
        await Promise.all(LIBRARIES.map((name) => google?.maps?.importLibrary?.(name)));
      } catch {
        // A rejected import still may leave the classes present, so fall
        // through and let the isReady() check decide.
      }
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return null;
}

/**
 * Injects the Maps script and resolves once the SDK is genuinely usable.
 *
 * `loading=async` is deliberate: the bootstrap script it fetches only seeds an
 * empty `google.maps` namespace and then loads the real SDK from a second URL.
 * Its `load` event therefore fires while `google.maps.Map` is still undefined,
 * so treating that event as readiness resolves too early and the caller's
 * `new google.maps.Map(...)` throws. `importLibrary` is the documented way to
 * await the async loader and resolves only once the requested libraries exist.
 *
 * Resolves to `null` rather than rejecting when no key is configured or the SDK
 * cannot be reached: "no credentials" is a normal local state, not an error
 * worth an unhandled rejection. The caller renders its existing empty state.
 */
export function loadGoogleMaps(): Promise<GoogleMapsWindow | null> {
  const key = mapsApiKey();
  if (!key) return Promise.resolve(null);

  const globals = window as unknown as { google?: GoogleMapsWindow };
  if (isReady(globals.google)) return Promise.resolve(globals.google as GoogleMapsWindow);

  if (pending) return pending;

  pending = (async () => {
    if (!document.querySelector('script[data-logicraft-maps]')) {
      await new Promise<void>((resolve) => {
        const script = document.createElement('script');
        // `gm_authfailure` is the SDK's own auth-rejection hook. Without it a
        // rejected key and a blocked key are indistinguishable, and the UI can
        // only say "something went wrong" — which is exactly the situation that
        // made an unactivated API look like an app bug.
        const params = new URLSearchParams({
          key,
          loading: 'async',
          gm_authfailure: 'logicraftAuthFailure'
        });
        script.src = `${SRC}?${params.toString()}`;
        script.async = true;
        script.defer = true;
        script.dataset.logicraftMaps = 'true';
        // Both outcomes are handled below, so the promise must not hang.
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => resolve(), { once: true });
        document.head.appendChild(script);
      });
    }

    // The bootstrap's `load` event is not a readiness signal, and neither is
    // the mere presence of `google.maps`. Under `loading=async` the namespace
    // is still empty at that point, and the real classes only appear once the
    // SDK's own chunks (main.js, common.js, util.js) land. So wait for the SDK
    // itself, requesting the libraries as soon as `importLibrary` is reachable
    // — calling it is what makes the SDK load them, so it must be attempted
    // *before* concluding that anything is wrong.
    const google = await waitForSdk(globals);
    if (!google) {
      // Genuinely never became usable: blocked request, revoked key, or the
      // SDK erroring during initialisation. `authFailure` distinguishes these.
      return null;
    }
    return google;
  })();

  return pending;
}
