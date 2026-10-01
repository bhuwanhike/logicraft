/**
 * Tests for the two route guards in App.tsx.
 *
 * These matter because getting them wrong is invisible in the happy path: an
 * ungated workspace renders for anyone who types a URL, and a guard that trusts
 * a session without a token is the same bug wearing a hat. The guards are
 * therefore rendered directly against a MemoryRouter, with the workspace stub
 * to a marker element so the assertion cannot pass by accident.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthRoute, RequireAuth } from "../App";

const SESSION_KEY = "logicraft.auth.session.v1";
const tokenSession = { email: "ada@example.com", name: "Ada Lovelace", token: "jwt-token" };

/**
 * Renders the guarded tree at `path`. Only `/login` is defined as a concrete
 * route: anything else falls through to the splat, which is where the guard
 * sits — defining a `/dashboard` route here would shadow the guard entirely.
 */
function renderGuarded(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login form</p>} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <p>workspace</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("RequireAuth", () => {
  it("sends a signed-out visitor from the dashboard to the login form", () => {
    renderGuarded("/dashboard");

    expect(screen.getByText("login form")).toBeTruthy();
    expect(screen.queryByText("workspace")).toBeNull();
  });

  it("keeps a signed-in visitor in the workspace", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(tokenSession));

    renderGuarded("/dashboard");

    expect(screen.getByText("workspace")).toBeTruthy();
    expect(screen.queryByText("login form")).toBeNull();
  });

  it("gates every module route, not just the dashboard", () => {
    renderGuarded("/shipments");

    expect(screen.getByText("login form")).toBeTruthy();
    expect(screen.queryByText("workspace")).toBeNull();
  });

  it("does not treat a token-less legacy entry as signed in", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: "demo@logicraft.io", name: "Demo" }));

    renderGuarded("/dashboard");

    expect(screen.getByText("login form")).toBeTruthy();
  });
});

describe("AuthRoute", () => {
  it("keeps a signed-out visitor on the form", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthRoute>
                <p>login form</p>
              </AuthRoute>
            }
          />
          <Route path="/dashboard" element={<p>dashboard</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("login form")).toBeTruthy();
  });

  it("bounces a signed-in visitor to the dashboard instead of the form", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(tokenSession));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthRoute>
                <p>login form</p>
              </AuthRoute>
            }
          />
          <Route path="/dashboard" element={<p>dashboard</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("dashboard")).toBeTruthy();
    expect(screen.queryByText("login form")).toBeNull();
  });
});
