/**
 * Tests for the Google Maps loader.
 *
 * This module owns a race that made the map render as a black rectangle. Under
 * `loading=async` the bootstrap script only seeds an empty `google.maps`
 * namespace, so treating the script's `load` event — or the mere presence of
 * `google.maps` — as readiness resolves before `Map`, `Marker` and `LatLng`
 * exist, and the caller's constructor throws. The tests below drive the SDK
 * through exactly that sequence: namespace first, classes later, with
 * `importLibrary` in between.
 *
 * The module keeps a `pending` promise and reads import.meta.env at call time,
 * so each test takes a fresh copy via resetModules.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleMapsWindow } from "../googleMaps";

/** A namespace the SDK has seeded but not yet populated. */
function namespace(importLibrary?: (name: string) => Promise<unknown>) {
  return {
    maps: {
      event: { clearInstanceListeners: () => {} },
      ...(importLibrary ? { importLibrary } : {})
    }
  } as unknown as GoogleMapsWindow;
}

/** A namespace with the classes the loader insists on. */
function readySdk(importLibrary?: (name: string) => Promise<unknown>) {
  return {
    maps: {
      Map: class {},
      Marker: class {},
      InfoWindow: class {},
      LatLngBounds: class {},
      LatLng: class {},
      event: { clearInstanceListeners: () => {} },
      ...(importLibrary ? { importLibrary } : {})
    }
  } as unknown as GoogleMapsWindow;
}

/** Fresh module instance, so `pending` and `authFailure` start clean. */
async function loadModule() {
  vi.resetModules();
  return import("../googleMaps");
}

const googleWindow = () => window as unknown as { google?: GoogleMapsWindow };
const injectedScript = () =>
  document.querySelector<HTMLScriptElement>("script[data-logicraft-maps]");

beforeEach(() => {
  document.head.querySelectorAll("script[data-logicraft-maps]").forEach((n) => n.remove());
  delete googleWindow().google;
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
});

afterEach(() => {
  document.head.querySelectorAll("script[data-logicraft-maps]").forEach((n) => n.remove());
  delete googleWindow().google;
  vi.useRealTimers();
});

describe("configuration", () => {
  it("reads the key from the environment", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "  abc123  ");
    const { mapsApiKey } = await loadModule();
    expect(mapsApiKey()).toBe("abc123");
  });

  it("treats a missing key as empty", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const { mapsApiKey, hasMapsKey } = await loadModule();
    expect(mapsApiKey()).toBe("");
    expect(hasMapsKey()).toBe(false);
  });

  it("reports a key as present", async () => {
    const { hasMapsKey } = await loadModule();
    expect(hasMapsKey()).toBe(true);
  });

  it("reads the optional map id as empty when unset", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID", "");
    const { mapsMapId } = await loadModule();
    expect(mapsMapId()).toBe("");
  });

  it("reads the map id when configured", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_MAP_ID", "cloud-map");
    const { mapsMapId } = await loadModule();
    expect(mapsMapId()).toBe("cloud-map");
  });
});

describe("loadGoogleMaps", () => {
  it("resolves to null without injecting anything when no key is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const { loadGoogleMaps } = await loadModule();
    await expect(loadGoogleMaps()).resolves.toBeNull();
    expect(injectedScript()).toBeNull();
  });

  it("resolves immediately when the SDK is already usable", async () => {
    const { loadGoogleMaps } = await loadModule();
    const sdk = readySdk();
    googleWindow().google = sdk;
    await expect(loadGoogleMaps()).resolves.toBe(sdk);
    expect(injectedScript()).toBeNull();
  });

  it("injects the script with the key and the async loader", async () => {
    const { loadGoogleMaps } = await loadModule();
    void loadGoogleMaps();
    const script = injectedScript();
    expect(script).not.toBeNull();
    const url = new URL(script!.src);
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/js");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.searchParams.get("loading")).toBe("async");
  });

  it("registers the auth-failure hook so a rejected key is distinguishable", async () => {
    const { loadGoogleMaps } = await loadModule();
    void loadGoogleMaps();
    const url = new URL(injectedScript()!.src);
    // Without this parameter a revoked key and a blocked referrer look alike,
    // which is how an unactivated API read as an application bug.
    expect(url.searchParams.get("gm_authfailure")).toBe("logicraftAuthFailure");
  });

  it("injects exactly one script for concurrent callers", async () => {
    const { loadGoogleMaps } = await loadModule();
    const first = loadGoogleMaps();
    const second = loadGoogleMaps();
    expect(document.head.querySelectorAll("script[data-logicraft-maps]")).toHaveLength(1);
    injectedScript()!.dispatchEvent(new Event("load"));
    googleWindow().google = readySdk();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it("waits for the classes rather than trusting the load event", async () => {
    const { loadGoogleMaps } = await loadModule();
    const promise = loadGoogleMaps();
    // The load event fires here, but the namespace is still empty. This is the
    // exact sequence that produced a blank map.
    injectedScript()!.dispatchEvent(new Event("load"));
    googleWindow().google = readySdk();
    await expect(promise).resolves.toBe(googleWindow().google);
  });

  it("calls importLibrary before concluding the SDK is not ready", async () => {
    const { loadGoogleMaps } = await loadModule();
    const importLibrary = vi.fn(async (name: string) => {
      // Importing the library is what makes the SDK populate its classes.
      Object.assign(googleWindow().google!.maps, {
        Map: class {},
        Marker: class {},
        LatLng: class {}
      });
      return { name };
    });
    googleWindow().google = namespace(importLibrary);

    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("load"));

    await expect(promise).resolves.toBe(googleWindow().google);
    expect(importLibrary).toHaveBeenCalledWith("maps");
  });

  it("requests only the maps library, not marker", async () => {
    const { loadGoogleMaps } = await loadModule();
    const importLibrary = vi.fn(async (name: string) => {
      Object.assign(googleWindow().google!.maps, {
        Map: class {},
        Marker: class {},
        LatLng: class {}
      });
      return { name };
    });
    googleWindow().google = namespace(importLibrary);

    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("load"));
    await promise;

    const requested = importLibrary.mock.calls.map(([name]) => name);
    expect(requested).toContain("maps");
    // Asking for `marker` alongside the classic overlay fails with
    // "Loader.provide not called by module 'marker'".
    expect(requested).not.toContain("marker");
  });

  it("calls importLibrary once, not on every poll", async () => {
    const { loadGoogleMaps } = await loadModule();
    const importLibrary = vi.fn(async () => ({}));
    googleWindow().google = namespace(importLibrary);

    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Still no classes: the loader must keep polling without re-requesting.
    expect(importLibrary).toHaveBeenCalledTimes(1);
    expect(injectedScript()).not.toBeNull();

    Object.assign(googleWindow().google!.maps, {
      Map: class {},
      Marker: class {},
      LatLng: class {}
    });
    await expect(promise).resolves.toBe(googleWindow().google);
  });

  it("keeps polling when importLibrary rejects", async () => {
    // A rejected import can still leave the classes present, so the failure is
    // swallowed and readiness is decided by what is actually on the namespace.
    const { loadGoogleMaps } = await loadModule();
    const importLibrary = vi.fn(async () => {
      throw new Error("Loader.provide not called by module 'maps'");
    });
    googleWindow().google = namespace(importLibrary);

    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("load"));
    Object.assign(googleWindow().google!.maps, {
      Map: class {},
      Marker: class {},
      LatLng: class {}
    });

    await expect(promise).resolves.toBe(googleWindow().google);
  });

  it("resolves to null when the SDK never becomes usable", async () => {
    vi.useFakeTimers();
    const { loadGoogleMaps } = await loadModule();
    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("load"));
    googleWindow().google = namespace();

    const settled = vi.fn();
    void promise.then(settled);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(settled).toHaveBeenCalledWith(null);
  });

  it("does not hang when the script itself fails to load", async () => {
    vi.useFakeTimers();
    const { loadGoogleMaps } = await loadModule();
    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("error"));

    const settled = vi.fn();
    void promise.then(settled);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(settled).toHaveBeenCalledWith(null);
  });

  it("treats a namespace without all three classes as not ready", async () => {
    vi.useFakeTimers();
    const { loadGoogleMaps } = await loadModule();
    const promise = loadGoogleMaps();
    injectedScript()!.dispatchEvent(new Event("load"));
    // Map present but LatLng missing: isReady() requires all three.
    googleWindow().google = {
      maps: { Map: class {}, Marker: class {} }
    } as unknown as GoogleMapsWindow;

    const settled = vi.fn();
    void promise.then(settled);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(settled).toHaveBeenCalledWith(null);
  });
});

describe("auth failure classification", () => {
  it("reports no failure before the SDK says anything", async () => {
    const { mapsAuthFailure } = await loadModule();
    expect(mapsAuthFailure()).toBeNull();
  });

  it("classifies a referrer restriction", async () => {
    const { mapsAuthFailure } = await loadModule();
    window.logicraftAuthFailure?.("RefererNotAllowedMapError");
    expect(mapsAuthFailure()).toBe("referrer-blocked");
  });

  it("classifies an invalid key", async () => {
    const { mapsAuthFailure } = await loadModule();
    window.logicraftAuthFailure?.("InvalidKeyMapError");
    expect(mapsAuthFailure()).toBe("invalid-key");
  });

  it("classifies an unactivated API", async () => {
    const { mapsAuthFailure } = await loadModule();
    window.logicraftAuthFailure?.("ApiNotActivatedMapError");
    expect(mapsAuthFailure()).toBe("not-activated");
  });

  it("falls back to a coarse reason for an unrecognised string", async () => {
    const { mapsAuthFailure } = await loadModule();
    window.logicraftAuthFailure?.("SomethingNewMapError");
    expect(mapsAuthFailure()).toBe("maps-unavailable");
  });

  it("is case-insensitive", async () => {
    const { mapsAuthFailure } = await loadModule();
    window.logicraftAuthFailure?.("referernotallowedmaperror");
    expect(mapsAuthFailure()).toBe("referrer-blocked");
  });

  it("tolerates a missing reason", async () => {
    const { mapsAuthFailure } = await loadModule();
    window.logicraftAuthFailure?.(undefined as unknown as string);
    expect(mapsAuthFailure()).toBe("maps-unavailable");
  });

  it("installs the global the SDK script parameter points at", async () => {
    await loadModule();
    expect(typeof window.logicraftAuthFailure).toBe("function");
  });
});
