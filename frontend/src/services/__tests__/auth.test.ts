/**
 * Tests for the auth client.
 *
 * The point of these is the contract with the two auth pages: the request that
 * leaves the browser, the session that is kept, and the `code` on every failure.
 * The codes are what the forms are written against, so an existing account, a
 * wrong password and an unreachable API are asserted individually rather than
 * lumped into "throws".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_ACCOUNT,
  getSession,
  getToken,
  hasSession,
  signIn,
  signOut,
  signUp
} from "../auth";

interface AuthFailure extends Error {
  code: string;
}

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
    json: async () => body
  } as unknown as Response;
}

const sessionBody = (overrides: Record<string, unknown> = {}) => ({
  token: "jwt-token",
  tokenType: "Bearer",
  id: "42",
  username: "ada",
  email: "ada@example.com",
  name: "Ada Lovelace",
  company: "Engines",
  role: "Operations Manager",
  ...overrides
});

const ACCOUNT = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  company: "Engines",
  role: "Data Analyst",
  password: "correct-horse"
};

/** Runs a call expected to reject and hands back the error. */
async function failure(promise: Promise<unknown>): Promise<AuthFailure> {
  try {
    await promise;
    throw new Error("Expected the call to reject, but it resolved.");
  } catch (error) {
    return error as AuthFailure;
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("signUp", () => {
  it("posts the trimmed account to /auth/signup", async () => {
    fetchMock.mockResolvedValue(respond(sessionBody()));

    await signUp({ ...ACCOUNT, name: "  Ada Lovelace  ", company: " Engines " });

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/signup");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Engines",
      role: "Data Analyst",
      password: "correct-horse"
    });
  });

  it("keeps the returned session and token", async () => {
    fetchMock.mockResolvedValue(respond(sessionBody()));

    const session = await signUp(ACCOUNT);

    expect(session.id).toBe("42");
    expect(session.token).toBe("jwt-token");
    expect(getSession()).toMatchObject({ email: "ada@example.com", role: "Operations Manager" });
    expect(getToken()).toBe("jwt-token");
    expect(hasSession()).toBe(true);
  });

  it("maps a 409 to duplicate-email", async () => {
    fetchMock.mockResolvedValue(
      respond({ error: "An account with that email already exists.", code: "duplicate-email" }, { status: 409 })
    );

    const error = await failure(signUp(ACCOUNT));
    expect(error.code).toBe("duplicate-email");
    expect(error.message).toBe("An account with that email already exists.");
  });

  it("reports an unreachable API as unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await failure(signUp(ACCOUNT));
    expect(error.code).toBe("unavailable");
  });

  it("reports a non-JSON response as unavailable", async () => {
    fetchMock.mockResolvedValue(respond("<!doctype html>", { contentType: "text/html" }));

    const error = await failure(signUp(ACCOUNT));
    expect(error.code).toBe("unavailable");
    expect(error.message).toContain("/api/v1/auth/signup");
    expect(error.message).toContain("VITE_API_BASE");
  });

  it("blames a down backend when the proxy answers 5xx", async () => {
    // What the Vite dev proxy returns when nothing is listening on 8080.
    fetchMock.mockResolvedValue(respond("Error occurred while trying to proxy", {
      status: 500,
      contentType: "text/plain"
    }));

    const error = await failure(signIn(DEMO_ACCOUNT));
    expect(error.code).toBe("unavailable");
    expect(error.message).toContain("Is the backend running?");
  });

  it("names the exact URL when the security filter answers 403 with no body", async () => {
    // What any Spring denial looks like: status only, no content-type, no body.
    fetchMock.mockResolvedValue(respond("", { status: 403, contentType: "" }));

    const error = await failure(signIn(DEMO_ACCOUNT));
    expect(error.code).toBe("unavailable");
    // The URL has to be in the message: a 403 with an empty body is
    // indistinguishable between a stale deployment and an unpermitted path, and
    // which one it is only shows up in the address that was called.
    expect(error.message).toContain("POST /api/v1/auth/login");
  });

  it("still maps a 401 with a JSON body to invalid-credentials", async () => {
    // The API's own failures stay distinguishable from the two cases above.
    fetchMock.mockResolvedValue(respond({ error: "nope", code: "invalid-credentials" }, { status: 401 }));

    const error = await failure(signIn(DEMO_ACCOUNT));
    expect(error.code).toBe("invalid-credentials");
  });

  it("rejects a response that carries no token", async () => {
    fetchMock.mockResolvedValue(respond({ email: "ada@example.com" }));

    const error = await failure(signUp(ACCOUNT));
    expect(error.code).toBe("request-failed");
  });
});

describe("signIn", () => {
  it("posts the credentials to /auth/login", async () => {
    fetchMock.mockResolvedValue(respond(sessionBody()));

    await signIn({ email: " ada@example.com ", password: "correct-horse" });

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/login");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "ada@example.com",
      password: "correct-horse"
    });
  });

  it("maps a 401 to invalid-credentials and does not start a session", async () => {
    fetchMock.mockResolvedValue(respond({ error: "nope", code: "invalid-credentials" }, { status: 401 }));

    const error = await failure(signIn(DEMO_ACCOUNT));
    expect(error.code).toBe("invalid-credentials");
    expect(hasSession()).toBe(false);
  });

  it("falls back to a generic message when the server sends none", async () => {
    fetchMock.mockResolvedValue(respond({}, { status: 401 }));

    const error = await failure(signIn(DEMO_ACCOUNT));
    expect(error.message).toBe("That email and password combination does not match an account.");
  });

  it("remembers the session by default and scopes it to the tab otherwise", async () => {
    fetchMock.mockResolvedValue(respond(sessionBody()));
    await signIn(DEMO_ACCOUNT);
    expect(localStorage.length).toBe(1);
    expect(sessionStorage.length).toBe(0);

    signOut();
    fetchMock.mockResolvedValue(respond(sessionBody()));
    await signIn({ ...DEMO_ACCOUNT, remember: false });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
  });
});

describe("getSession", () => {
  it("ignores a legacy session that carries no bearer token", () => {
    // The pre-API build kept accounts in localStorage with no token. Such an
    // entry must not shadow /login or open the workspace to a stranger.
    localStorage.setItem(
      "logicraft.auth.session.v1",
      JSON.stringify({
        id: "42",
        name: "Demo",
        email: "demo@logicraft.io",
        role: "Operations Manager",
        startedAt: "2026-01-01T00:00:00.000Z"
      })
    );

    expect(getSession()).toBeNull();
    expect(hasSession()).toBe(false);
    expect(getToken()).toBeNull();
  });

  it("skips a token-less entry and still returns a real session", () => {
    localStorage.setItem("logicraft.auth.session.v1", JSON.stringify({ email: "stale@logicraft.io" }));
    sessionStorage.setItem(
      "logicraft.auth.session.v1",
      JSON.stringify({ email: "ada@example.com", token: "jwt-token" })
    );

    expect(getSession()?.email).toBe("ada@example.com");
  });

  it("ignores a corrupt entry instead of throwing", () => {
    localStorage.setItem("logicraft.auth.session.v1", "{not json");

    expect(getSession()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});

describe("signOut", () => {
  it("clears the session from both stores", async () => {
    fetchMock.mockResolvedValue(respond(sessionBody()));
    await signIn(DEMO_ACCOUNT);
    expect(hasSession()).toBe(true);

    signOut();

    expect(hasSession()).toBe(false);
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
  });
});
