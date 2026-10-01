/**
 * Global test setup.
 *
 * Two things live here that would otherwise be repeated in every suite:
 * jest-dom's matchers, and a fetch stub. jsdom ships no fetch, so an api.ts
 * suite that forgets to mock it fails with "fetch is not defined" instead of
 * the assertion it was written for; the stub is deliberately inert and throws
 * if a test reaches it without saying what the response should be.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  if (!("fetch" in globalThis)) {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("fetch was called without a stub; see src/test/setup.ts");
      })
    );
  }
});

afterEach(() => {
  cleanup();
});
