/**
 * HTTP client for the LogiCraft workspace API.
 *
 * IMPORTANT &mdash; there is no server yet. The Spring Boot modules under
 * `backend/` (fleet, shipment, warehouse, transport, notifications, auth)
 * contain no `@RestController`, so every request in this file will fail until
 * one is written. That failure is deliberate and is surfaced to the UI as the
 * `no-source` code, which is what drives the empty states across the workspace.
 *
 * The point of routing everything through here is that when the API lands, no
 * component has to change &mdash; only the base URL and, at most, the shape
 * normalisers at the bottom of this file.
 */

import type { ApiErrorCode, QueryParams, RequestOptions, Rows } from "../types";

const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api/v1";

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;

  constructor(
    message: string,
    { code, status }: { code?: ApiErrorCode; status?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code ?? "unknown";
    this.status = status;
  }
}

/**
 * Resolves to parsed JSON, or throws ApiError('no-source') when the endpoint is
 * not a real API.
 *
 * A dev server that is not proxying /api will answer with `index.html` and a
 * 200. Left alone, `res.json()` would throw a SyntaxError that reads like a
 * bug, so the content type is checked first and reported as a missing data
 * source instead.
 */
async function request(
  path: string,
  { signal, method = "GET", body }: RequestOptions = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal,
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") throw error;
    // Network-level failure: nothing is listening.
    throw new ApiError("Cannot reach the LogiCraft API.", {
      code: "no-source",
    });
  }

  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new ApiError("No API is connected at this address.", {
      code: "no-source",
    });
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}.`, {
      code: "request-failed",
      status: response.status,
    });
  }

  return response.json();
}

/**
 * Builds a query string, dropping empty values so a filter the user has not
 * touched does not narrow the request.
 */
function query(params: QueryParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "all"
    )
      continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Coerces a response into an array. A backend that returns a bare array, an
 * envelope like `{ data: [] }`, or a paged `{ items: [] }` all normalise here,
 * so a list view never has to guess.
 */
function toList(payload: unknown): Rows {
  if (Array.isArray(payload)) return payload as Rows;
  const envelope = payload as Record<string, unknown> | null | undefined;
  for (const key of ["data", "items", "results", "content"]) {
    const candidate = envelope?.[key];
    if (Array.isArray(candidate)) return candidate as Rows;
  }
  return [];
}

const collection = (resource: string) => ({
  list: (params?: QueryParams, options?: RequestOptions) =>
    request(`/${resource}${query(params)}`, options).then(toList),
  count: (options?: RequestOptions) =>
    request(`/${resource}/count`, options).then((p) => {
      const payload = p as { count?: unknown } | null;
      return Number(payload?.count ?? toList(p).length);
    }),
});

export const api = {
  vehicles: collection("vehicles"),
  drivers: collection("drivers"),
  shipments: collection("shipments"),
  warehouses: collection("warehouses"),
  inventory: collection("inventory"),
  zones: collection("zones"),
  trips: collection("trips"),
  notifications: collection("notifications"),
  auditLogs: collection("audit-logs"),
  users: collection("users"),
  metrics: {
    /**
     * Dashboard KPI row. Returns a single object, not a list, so it is not
     * run through toList.
     */
    summary: (params?: QueryParams, options?: RequestOptions) =>
      request(`/metrics/summary${query(params)}`, options),
    series: (key: string, params?: QueryParams, options?: RequestOptions) =>
      request(`/metrics/series/${key}${query(params)}`, options).then(toList),
  },
  export: {
    /** Resolves to a Blob. Kept separate because it is not JSON. */
    report: async (key: string, params: QueryParams = {}): Promise<Blob> => {
      const res = await fetch(`${API_BASE}/reports/${key}${query(params)}`);
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("json")) {
        throw new ApiError("Exports need a connected reporting service.", {
          code: "no-source",
        });
      }
      if (!res.ok) {
        throw new ApiError(`Export failed with status ${res.status}.`, {
          code: "request-failed",
          status: res.status,
        });
      }
      return res.blob();
    },
  },
};

export { toList };
