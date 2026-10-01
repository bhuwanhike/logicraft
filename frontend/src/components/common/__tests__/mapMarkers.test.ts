/**
 * Tests for the pure Google Maps helpers.
 *
 * Two things are being protected here. The popup body is built as an HTML
 * string and handed to an InfoWindow, so it reaches innerHTML and every
 * API-supplied value has to be escaped. And the icon builder reads a symbol
 * enum off the SDK: when that lookup was wrong the exception escaped the effect,
 * unmounted the panel, and produced a blank map. Both are testable with no
 * browser and no API key.
 */
import { describe, expect, it } from "vitest";

import {
  buildMarkerIcon,
  escapeHtml,
  hasCoordinates,
  markerKey,
  pinColour,
  popupHtml
} from "../mapMarkers";
import type { FleetMarker } from "../FleetMap";
import type { GoogleMapsWindow } from "../../../services/googleMaps";

/** The only symbol enum that exists on the maps library. */
const google = {
  maps: { SymbolPath: { FORWARD_CLOSED_ARROW: "FORWARD_CLOSED_ARROW" } }
} as unknown as GoogleMapsWindow;

/** The SDK before importLibrary resolves, i.e. the blank-map case. */
const googleWithoutEnum = { maps: {} } as unknown as GoogleMapsWindow;

function marker(patch: Partial<FleetMarker> = {}): FleetMarker {
  return { id: "1", lat: 1, lng: 2, label: "TRIP-1", ...patch };
}

type Icon = { rotation?: number; fillColor?: string };

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"')).toBe("&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("escapes ampersand before anything that can itself contain one", () => {
    // Order matters: escaping & last would double-escape the entities above.
    expect(escapeHtml("a&b")).toBe("a&amp;b");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text alone", () => {
    expect(escapeHtml("TRK-8801")).toBe("TRK-8801");
  });
});

describe("popupHtml", () => {
  it("renders the label", () => {
    expect(popupHtml(marker())).toContain("<b>TRIP-1</b>");
  });

  it("escapes a label carrying markup", () => {
    const html = popupHtml(marker({ label: '<img src=x onerror="alert(1)">' }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes a detail carrying a script tag", () => {
    const html = popupHtml(marker({ details: ["Plate: <script>alert(2)</script>"] }));
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("leaves no live onerror attribute behind", () => {
    expect(popupHtml(marker({ label: '<img src=x onerror="alert(1)">' }))).not.toMatch(/onerror="alert/);
  });

  it("splits a detail on its colon into label and value", () => {
    const html = popupHtml(marker({ details: ["Vehicle: TRK-8801"] }));
    expect(html).toContain("<span>Vehicle</span><b>TRK-8801</b>");
  });

  it("drops the space the caller wrote after the colon", () => {
    // The separator is consumed, so a leading space would indent every value.
    expect(popupHtml(marker({ details: ["Driver: Ada"] }))).toContain("<b>Ada</b>");
  });

  it("emits an empty label cell for a detail that has no colon, to keep the grid aligned", () => {
    const html = popupHtml(marker({ details: ["solo"] }));
    expect(html).toContain("<span></span><b>solo</b>");
  });

  it("does not leave an empty label cell when every detail has a colon", () => {
    const html = popupHtml(marker({ details: ["Vehicle: TRK-8801", "Driver: Ada"] }));
    expect(html).not.toContain("<span></span>");
  });

  it("shows a finite speed rounded to a whole km/h", () => {
    expect(popupHtml(marker({ speedKph: 72.4 }))).toContain("72 km/h");
  });

  it("rounds a half up, as Math.round does", () => {
    expect(popupHtml(marker({ speedKph: 72.5 }))).toContain("73 km/h");
  });

  it("shows an exact integer speed", () => {
    expect(popupHtml(marker({ speedKph: 50 }))).toContain("50 km/h");
  });

  it("omits the speed row when speed is absent or not finite", () => {
    expect(popupHtml(marker())).not.toContain("km/h");
    expect(popupHtml(marker({ speedKph: null }))).not.toContain("km/h");
    expect(popupHtml(marker({ speedKph: Number.NaN }))).not.toContain("km/h");
  });

  it("omits the row container when there is nothing to show", () => {
    expect(popupHtml(marker())).not.toContain("gm-popup-rows");
  });

  it("still escapes when a label is the only field", () => {
    expect(popupHtml(marker({ label: "<i>" }))).toContain("&lt;i&gt;");
  });
});

describe("pinColour", () => {
  it("colours a delayed trip red", () => {
    expect(pinColour("warn")).toBe("#c0392b");
  });

  it("colours a running trip with the accent", () => {
    expect(pinColour("live")).toBe("#2f6ada");
  });

  it("defaults to the accent for an unknown or missing tone", () => {
    expect(pinColour()).toBe("#2f6ada");
    expect(pinColour("something-else")).toBe("#2f6ada");
  });
});

describe("buildMarkerIcon", () => {
  it("uses the heading as the symbol rotation, with no conversion", () => {
    // heading is a compass bearing and Symbol.rotation is degrees, so 47 is 47.
    expect((buildMarkerIcon(google, marker({ heading: 47 })) as Icon).rotation).toBe(47);
  });

  it("keeps a heading of 0, which means due north", () => {
    // Treating 0 as absent would point every heading-less truck north and imply
    // a direction it does not have.
    expect((buildMarkerIcon(google, marker({ heading: 0 })) as Icon).rotation).toBe(0);
  });

  it("applies the tone colour", () => {
    expect((buildMarkerIcon(google, marker({ heading: 10 })) as Icon).fillColor).toBe("#2f6ada");
    expect(
      (buildMarkerIcon(google, marker({ heading: 10, tone: "warn" })) as Icon).fillColor
    ).toBe("#c0392b");
  });

  it("returns undefined when there is no heading, so the default pin is used", () => {
    expect(buildMarkerIcon(google, marker())).toBeUndefined();
    expect(buildMarkerIcon(google, marker({ heading: null }))).toBeUndefined();
    expect(buildMarkerIcon(google, marker({ heading: Number.NaN }))).toBeUndefined();
  });

  it("degrades to the default pin when the symbol enum is missing", () => {
    // The regression: a wrong namespace made this throw, the throw escaped the
    // effect, and the whole map panel unmounted. It must return, not throw.
    expect(() => buildMarkerIcon(googleWithoutEnum, marker({ heading: 12 }))).not.toThrow();
    expect(buildMarkerIcon(googleWithoutEnum, marker({ heading: 12 }))).toBeUndefined();
  });
});

describe("markerKey", () => {
  it("uses the id", () => {
    expect(markerKey(marker({ id: "7" }))).toBe("7");
  });

  it("falls back to coordinates when there is no id", () => {
    expect(markerKey({ lat: 41.5, lng: -87.6, label: "x" })).toBe("41.5,-87.6");
  });

  it("is stable as a vehicle moves, so a poll updates the pin in place", () => {
    // A key that changed with position would destroy and rebuild the marker,
    // closing an open popup mid-interaction.
    expect(markerKey(marker({ id: "7", lat: 1, lng: 2 }))).toBe(
      markerKey(marker({ id: "7", lat: 9, lng: 9 }))
    );
  });
});

describe("hasCoordinates", () => {
  it("accepts finite coordinates", () => {
    expect(hasCoordinates(marker({ lat: 41.5, lng: -87.6 }))).toBe(true);
  });

  it("accepts 0,0, which is a real coordinate", () => {
    expect(hasCoordinates(marker({ lat: 0, lng: 0 }))).toBe(true);
  });

  it("rejects non-finite coordinates", () => {
    expect(hasCoordinates(marker({ lat: Number.NaN, lng: -87.6 }))).toBe(false);
    expect(hasCoordinates(marker({ lat: 41.5, lng: Number.NaN }))).toBe(false);
    expect(hasCoordinates(marker({ lat: null as unknown as number, lng: 1 }))).toBe(false);
    expect(hasCoordinates(marker({ lat: undefined as unknown as number, lng: 1 }))).toBe(false);
  });
});
