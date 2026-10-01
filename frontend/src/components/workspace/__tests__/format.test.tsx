/**
 * Tests for the shared table formatters.
 *
 * The regression this file exists for: every API row is
 * `Record<string, unknown>`, so a column can hand the formatter a nested object.
 * `String(value)` on one produces "[object Object]", which is how a
 * half-populated table shipped. `text()` is therefore asserted against every
 * shape the API can return, and the last test asserts the string can never
 * appear at all.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Meter,
  StatusPill,
  field,
  flag,
  formatDate,
  formatKm,
  humanise,
  num,
  text
} from "../format";

describe("humanise", () => {
  it("turns an API status into a title", () => {
    expect(humanise("active")).toBe("Active");
  });

  it("splits snake_case", () => {
    expect(humanise("in_transit")).toBe("In Transit");
  });

  it("splits kebab-case", () => {
    expect(humanise("out-of-service")).toBe("Out Of Service");
  });

  it("collapses a run of separators into one space", () => {
    expect(humanise("a__b--c")).toBe("A B C");
  });

  it("renders null and undefined as an empty string", () => {
    expect(humanise(null)).toBe("");
    expect(humanise(undefined)).toBe("");
  });

  it("accepts non-strings", () => {
    expect(humanise(42)).toBe("42");
    expect(humanise(true)).toBe("True");
  });
});

describe("formatDate", () => {
  const options = { day: "2-digit", month: "short", year: "numeric" } as const;

  it("formats an ISO timestamp from the API", () => {
    const value = "2024-03-15T10:30:00Z";
    expect(formatDate(value)).toBe(new Date(value).toLocaleDateString(undefined, options));
  });

  it("accepts a Date that has already been parsed", () => {
    const value = new Date("2024-03-15T10:30:00Z");
    expect(formatDate(value)).toBe(value.toLocaleDateString(undefined, options));
  });

  it("uses an em-dash for absent values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("treats a zero timestamp as absent rather than 1970", () => {
    // 0 is falsy, so this returns the fallback. Pinned because the alternative
    // is silently showing 1 Jan 1970 for a missing date.
    expect(formatDate(0)).toBe("—");
  });

  it("echoes an unparseable value instead of printing 'Invalid Date'", () => {
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("echoes a numeric timestamp, which String() cannot parse as a date", () => {
    // new Date(String(1700000000000)) is Invalid Date, so the raw digits are
    // returned. The API serialises timestamptz as ISO strings, so this is a
    // contract note rather than a live path.
    expect(formatDate(1700000000000)).toBe("1700000000000");
  });
});

describe("formatKm", () => {
  it("appends km to a number", () => {
    expect(formatKm(1234.5)).toBe(`${(1234.5).toLocaleString()} km`);
  });

  it("keeps the value exact rather than rounding", () => {
    expect(formatKm(87)).toBe("87 km");
  });

  it("uses an em-dash for absent values", () => {
    expect(formatKm(null)).toBe("—");
    expect(formatKm(undefined)).toBe("—");
  });

  it("formats zero rather than treating it as absent", () => {
    expect(formatKm(0)).toBe("0 km");
  });

  it("documents the current NaN behaviour for non-numeric input", () => {
    // Characterisation test, not an endorsement. Callers guard with num() first
    // (VehiclesPage does), so this path is unreachable from the workspace today.
    expect(formatKm("abc")).toBe("NaN km");
  });
});

describe("num", () => {
  it("parses numeric strings from a JSON API", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("87")).toBe(87);
  });

  it("keeps real numbers", () => {
    expect(num(42)).toBe(42);
    expect(num(0)).toBe(0);
  });

  it("rejects values that are not numeric", () => {
    expect(num(undefined)).toBeNull();
    expect(num("abc")).toBeNull();
    expect(num(Number.NaN)).toBeNull();
    expect(num(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("rejects a numeric string with trailing junk, which parseFloat would accept", () => {
    // Number() is stricter than parseFloat on purpose: "12.5 km" is a
    // formatting artefact, not a measurement.
    expect(num("12.5abc")).toBeNull();
    expect(num("12.5 km")).toBeNull();
  });

  it("returns 0 for null, which is Number(null) and not an absence", () => {
    // DashboardPage works around this: it null-checks a metric before calling
    // num(), because a missing KPI must not read as a real zero.
    expect(num(null)).toBe(0);
  });

  it("coerces booleans and empty collections the way Number does", () => {
    expect(num(true)).toBe(1);
    expect(num([])).toBe(0);
  });
});

describe("text", () => {
  it("returns strings unchanged", () => {
    expect(text("TRK-8801")).toBe("TRK-8801");
    expect(text("  padded  ")).toBe("  padded  ");
  });

  it("uses the fallback for absent values", () => {
    expect(text(null)).toBe("—");
    expect(text(undefined)).toBe("—");
    expect(text("")).toBe("—");
  });

  it("uses a caller-supplied fallback", () => {
    expect(text(null, "Unknown")).toBe("Unknown");
  });

  it("localises numbers", () => {
    expect(text(1234.5)).toBe((1234.5).toLocaleString());
  });

  it("uses the fallback for non-finite numbers", () => {
    expect(text(Number.NaN)).toBe("—");
    expect(text(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("renders a zero rather than the fallback", () => {
    expect(text(0)).toBe("0");
  });

  it("renders booleans as words", () => {
    expect(text(true)).toBe("Yes");
    expect(text(false)).toBe("No");
  });

  it("formats a Date", () => {
    const value = new Date("2024-03-15T10:30:00Z");
    expect(text(value)).toBe(
      value.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    );
  });

  it("joins arrays", () => {
    expect(text(["A", "B"])).toBe("A, B");
  });

  it("uses the fallback for an empty array", () => {
    expect(text([])).toBe("—");
  });

  it("drops empty entries inside an array", () => {
    expect(text([null, "A", undefined, ""])).toBe("A");
  });

  it("flattens nested arrays", () => {
    expect(text([["A", "B"], ["C"]])).toBe("A, B, C");
  });

  it("prefers a named field on an object", () => {
    expect(text({ name: "Chicago DC" })).toBe("Chicago DC");
    expect(text({ label: "Priority" })).toBe("Priority");
    expect(text({ title: "Delay" })).toBe("Delay");
    expect(text({ reference: "SHP-1" })).toBe("SHP-1");
    expect(text({ value: 7 })).toBe("7");
  });

  it("prefers the first named field it finds, in label-first order", () => {
    // The lookup order is label, name, title, reference, value, so an object
    // carrying both resolves to the label.
    expect(text({ name: "N", label: "L" })).toBe("L");
    expect(text({ title: "T", reference: "R" })).toBe("T");
    expect(text({ reference: "R", value: 3 })).toBe("R");
  });

  it("resolves a named field that is itself an object", () => {
    expect(text({ name: { name: "Nested" } })).toBe("Nested");
  });

  it("skips a named field that renders empty and falls through", () => {
    expect(text({ label: "", reference: "SHP-9" })).toBe("SHP-9");
  });

  it("summarises an object by key when it has no name", () => {
    expect(text({ lat: 41.5, lng: -87.6 })).toBe("lat: 41.5, lng: -87.6");
  });

  it("caps the key summary at three entries", () => {
    expect(text({ a: 1, b: 2, c: 3, d: 4 })).toBe("a: 1, b: 2, c: 3");
  });

  it("marks an unnamed value inside a key summary", () => {
    expect(text({ a: null })).toBe("a: —");
  });

  it("uses the fallback for an empty object", () => {
    expect(text({})).toBe("—");
  });

  it("handles a bigint, which React cannot render on its own", () => {
    expect(text(10n)).toBe("10");
  });

  it("never produces [object Object] for any shape", () => {
    const values: unknown[] = [
      { a: 1 },
      { nested: { deeper: { deepest: true } } },
      [{ inner: { x: 1 } }],
      new Date("invalid"),
      Object.create(null),
      { toString: () => "custom" }
    ];
    for (const value of values) {
      expect(text(value)).not.toContain("[object Object]");
    }
  });
});

describe("field", () => {
  it("reads a present key", () => {
    expect(field({ plate: "TRK-8801" }, "plate")).toBe("TRK-8801");
  });

  it("returns undefined for a missing row or key", () => {
    expect(field({ a: 1 }, "b")).toBeUndefined();
    expect(field(null, "a")).toBeUndefined();
    expect(field(undefined, "a")).toBeUndefined();
  });

  it("returns a null value as null, not undefined", () => {
    // DetailList hides a field on `of()` guards, which distinguish the two.
    expect(field({ currentDriverName: null }, "currentDriverName")).toBeNull();
  });
});

describe("flag", () => {
  it("is false for absent values", () => {
    expect(flag(null)).toBe(false);
    expect(flag(undefined)).toBe(false);
    expect(flag("")).toBe(false);
  });

  it("is a presence check, not a truthiness check", () => {
    // VehiclesPage uses this to decide whether to draw a detail row. A vehicle
    // at 0% fuel and one explicitly marked false both have something to show.
    expect(flag(0)).toBe(true);
    expect(flag(false)).toBe(true);
  });
});

describe("StatusPill", () => {
  it("renders a known status with its tone", () => {
    render(<StatusPill status="active" />);
    expect(screen.getByText("Active")).toHaveClass("pill", "green");
  });

  it("maps a snake_case status from the API", () => {
    render(<StatusPill status="in_transit" />);
    expect(screen.getByText("In Transit")).toHaveClass("pill", "blue");
  });

  it("resolves the tone case-insensitively but echoes the raw label", () => {
    // Characterisation test. The class lookup lowercases the status, while
    // humanise() reads the original string, so the pill is toned correctly but
    // the text keeps the API's casing. The API sends lowercase snake_case, so
    // the two agree in the workspace today.
    render(<StatusPill status="MAINTENANCE" />);
    expect(screen.getByText("MAINTENANCE")).toHaveClass("pill", "amber");
  });

  it("falls back to slate for an unknown status", () => {
    render(<StatusPill status="quantum_flux" />);
    expect(screen.getByText("Quantum Flux")).toHaveClass("pill", "slate");
  });

  it("says Unknown for an absent status", () => {
    render(<StatusPill status={null} />);
    expect(screen.getByText("Unknown")).toHaveClass("pill");
  });

  it("does not crash on a non-string status", () => {
    render(<StatusPill status={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

describe("Meter", () => {
  const bar = (container: HTMLElement) => container.querySelector("i") as HTMLElement;

  it("scales to the max", () => {
    const { container } = render(<Meter value={50} max={100} />);
    expect(bar(container)).toHaveStyle({ width: "50%" });
  });

  it("is green above 45%", () => {
    const { container } = render(<Meter value={80} />);
    expect(bar(container)).toHaveClass("ok");
  });

  it("is amber between 20 and 45%", () => {
    const { container } = render(<Meter value={30} />);
    expect(bar(container)).toHaveClass("mid");
  });

  it("is red below 20%", () => {
    const { container } = render(<Meter value={10} />);
    expect(bar(container)).toHaveClass("low");
  });

  it("clamps above the max", () => {
    const { container } = render(<Meter value={250} max={100} />);
    expect(bar(container)).toHaveStyle({ width: "100%" });
  });

  it("clamps a negative value to zero", () => {
    const { container } = render(<Meter value={-20} />);
    expect(bar(container)).toHaveStyle({ width: "0%" });
  });

  it("labels the raw value and max for the tooltip", () => {
    const { container } = render(<Meter value={50} max={200} />);
    expect(container.querySelector(".meter")).toHaveAttribute("title", "50 of 200");
  });

  it("documents the current behaviour for a non-numeric value", () => {
    // Characterisation test. VehiclesPage guards with num() before rendering, so
    // this path is unreachable there; see formatKm's NaN note for the same gap.
    const { container } = render(<Meter value="abc" />);
    expect(bar(container)).toHaveClass("ok");
  });
});
