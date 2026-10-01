/**
 * Tests for the HTTP client.
 *
 * The client owns the boundary between the workspace and the API, and the
 * behaviour worth protecting is what it does with answers it does not expect. A
 * dev server that is not proxying /api answers 200 with index.html, so the
 * content type is checked and reported as a missing data source rather than a
 * SyntaxError. The error codes are what the empty states key off, so they are
 * asserted individually rather than lumped into "throws".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, toList } from "../api";

/**
 * A minimal Response stand-in. Only the members api.ts touches are provided,
 * and `headers` is a plain object with `get` so the suite does not depend on
 * whether the environment exposes the fetch classes.
 */
function respond(
  body: unknown,
  { status = 200, contentType = "application/json" }: { status?: number; contentType?: string } = {}
): Response {
  return {
    ok: status < 400,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null)
    },
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)])
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The URL the client actually requested. */
const requested = (index = 0) => String(fetchMock.mock.calls[index][0]);

describe("toList", () => {
  it("passes a bare array through", () => {
    expect(toList([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it("unwraps a data envelope", () => {
    expect(toList({ data: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });

  it("unwraps the other envelope names", () => {
    expect(toList({ items: [1] })).toEqual([1]);
    expect(toList({ results: [1] })).toEqual([1]);
    expect(toList({ content: [1] })).toEqual([1]);
  });

  it("prefers data over items when both are present", () => {
    expect(toList({ data: ["d"], items: ["i"] })).toEqual(["d"]);
  });

  it("returns an empty list for anything else", () => {
    expect(toList(null)).toEqual([]);
    expect(toList(undefined)).toEqual([]);
    expect(toList({ count: 3 })).toEqual([]);
    expect(toList("nope")).toEqual([]);
    expect(toList({ data: "not an array" })).toEqual([]);
  });
});

describe("query building", () => {
  it("keeps the parameters that matter", async () => {
    fetchMock.mockResolvedValue(respond([]));
    await api.vehicles.list({ status: "active", q: "TRK" });
    expect(requested()).toBe("/api/v1/vehicles?status=active&q=TRK");
  });

  it("drops a filter the user has not touched", async () => {
    // Sending status=all would narrow nothing but also would not be dropped by
    // the server, so the client removes it.
    fetchMock.mockResolvedValue(respond([]));
    await api.vehicles.list({ status: "all", type: undefined, q: null, level: "" });
    expect(requested()).toBe("/api/v1/vehicles");
  });

  it("encodes a value that needs escaping", async () => {
    fetchMock.mockResolvedValue(respond([]));
    await api.vehicles.list({ q: "a b&c" });
    expect(requested()).toBe("/api/v1/vehicles?q=a+b%26c");
  });

  it("converts numbers and booleans", async () => {
    fetchMock.mockResolvedValue(respond([]));
    await api.trips.list({ page: 2, size: 50, active: true });
    expect(requested()).toBe("/api/v1/trips?page=2&size=50&active=true");
  });
});

describe("list", () => {
  it("requests the resource path under the API base", async () => {
    fetchMock.mockResolvedValue(respond([{ id: 1 }]));
    await api.drivers.list();
    expect(requested()).toBe("/api/v1/drivers");
  });

  it("normalises the payload to rows", async () => {
    fetchMock.mockResolvedValue(respond({ data: [{ id: 1 }, { id: 2 }] }));
    await expect(api.drivers.list()).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("uses the hyphenated path for audit logs", async () => {
    fetchMock.mockResolvedValue(respond([]));
    await api.auditLogs.list();
    expect(requested()).toBe("/api/v1/audit-logs");
  });

  it("sends an Accept header", async () => {
    fetchMock.mockResolvedValue(respond([]));
    await api.vehicles.list();
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Accept: "application/json" });
  });

  it("does not send a Content-Type on a read", async () => {
    fetchMock.mockResolvedValue(respond([]));
    await api.vehicles.list();
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
  });

  it("passes an abort signal through", async () => {
    fetchMock.mockResolvedValue(respond([]));
    const controller = new AbortController();
    await api.vehicles.list({}, { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe("count", () => {
  it("reads the count from the envelope", async () => {
    fetchMock.mockResolvedValue(respond({ count: 42 }));
    await expect(api.vehicles.count()).resolves.toBe(42);
    expect(requested()).toBe("/api/v1/vehicles/count");
  });

  it("falls back to the array length when there is no count", async () => {
    fetchMock.mockResolvedValue(respond([{ id: 1 }, { id: 2 }]));
    await expect(api.vehicles.count()).resolves.toBe(2);
  });

  it("reports zero rather than NaN for an empty envelope", async () => {
    fetchMock.mockResolvedValue(respond({}));
    await expect(api.vehicles.count()).resolves.toBe(0);
  });

  it("coerces a string count", async () => {
    fetchMock.mockResolvedValue(respond({ count: "7" }));
    await expect(api.vehicles.count()).resolves.toBe(7);
  });
});

describe("error handling", () => {
  it("reports a non-JSON response as a missing data source", async () => {
    // The dev server answering index.html with a 200 is the case this exists for.
    fetchMock.mockResolvedValue(respond("<!doctype html>", { contentType: "text/html" }));
    const error = await api.vehicles.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("no-source");
  });

  it("treats a JSON content type with a charset as JSON", async () => {
    fetchMock.mockResolvedValue(respond([], { contentType: "application/json; charset=utf-8" }));
    await expect(api.vehicles.list()).resolves.toEqual([]);
  });

  it("reports a network failure as a missing data source", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await api.vehicles.list().catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("no-source");
    expect((error as ApiError).message).toBe("Cannot reach the LogiCraft API.");
  });

  it("rethrows an abort instead of dressing it up as a data-source error", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abort);
    await expect(api.vehicles.list()).rejects.toBe(abort);
  });

  it("carries the status on a failed request", async () => {
    fetchMock.mockResolvedValue(respond({ error: "Unknown resource: nope" }, { status: 404 }));
    const error = await api.vehicles.list().catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("request-failed");
    expect((error as ApiError).status).toBe(404);
  });

  it("names itself so a caller can distinguish it from a plain Error", async () => {
    fetchMock.mockResolvedValue(respond({}, { status: 500 }));
    const error = await api.vehicles.list().catch((e: unknown) => e);
    expect((error as ApiError).name).toBe("ApiError");
    expect(error).toBeInstanceOf(Error);
  });

  it("defaults the code to unknown when none is given", () => {
    expect(new ApiError("boom").code).toBe("unknown");
  });
});

describe("metrics", () => {
  it("returns the summary as one object, not a list", async () => {
    // KpiRow reads named fields off it, so an array here would blank every tile.
    fetchMock.mockResolvedValue(respond({ onTimeRate: 96.4, activeVehicles: 2 }));
    await expect(api.metrics.summary({ range: "7d" })).resolves.toEqual({
      onTimeRate: 96.4,
      activeVehicles: 2
    });
    expect(requested()).toBe("/api/v1/metrics/summary?range=7d");
  });

  it("returns a series as rows for the chart to map over", async () => {
    fetchMock.mockResolvedValue(respond({ data: [{ date: "2024-01-01" }] }));
    await expect(api.metrics.series("throughput", { range: "30d" })).resolves.toEqual([
      { date: "2024-01-01" }
    ]);
    expect(requested()).toBe("/api/v1/metrics/series/throughput?range=30d");
  });
});

describe("export", () => {
  it("returns a blob for a JSON-typed report", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    const blob = await api.export.report("trips", { range: "30d" });
    expect(blob).toBeInstanceOf(Blob);
    expect(requested()).toBe("/api/v1/reports/trips?range=30d");
  });

  it("reports a non-JSON export endpoint as a missing service", async () => {
    fetchMock.mockResolvedValue(respond("", { contentType: "text/csv" }));
    const error = await api.export.report("trips").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("no-source");
  });

  it("carries the status on a failed export", async () => {
    fetchMock.mockResolvedValue(respond({}, { status: 500 }));
    const error = await api.export.report("trips").catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("request-failed");
    expect((error as ApiError).status).toBe(500);
  });
});

describe("resource coverage", () => {
  it("exposes a list and count for every resource the workspace pages read", () => {
    for (const resource of [
      api.vehicles,
      api.drivers,
      api.shipments,
      api.warehouses,
      api.inventory,
      api.zones,
      api.trips,
      api.notifications,
      api.auditLogs,
      api.users
    ]) {
      expect(typeof resource.list).toBe("function");
      expect(typeof resource.count).toBe("function");
    }
  });
});
