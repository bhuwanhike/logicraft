/**
 * Tests for the workspace UI hooks.
 *
 * The sorting hook decides what order a 200-row table is read in, so its two
 * non-obvious rules are pinned: numbers sort numerically rather than
 * lexicographically, and rows with no value stay at the bottom. The event hooks
 * are tested through real DOM events rather than mocked listeners, because the
 * bug they are prone to is a stale closure or a missing cleanup, neither of
 * which a mock can show.
 */
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useClickOutside,
  useDebouncedValue,
  useDisclosure,
  useHotkey,
  useSortedRows
} from "../useUi";
import type { Row } from "../../types";

const rows: Row[] = [
  { plate: "TRK-1", fuel: 100 },
  { plate: "TRK-2", fuel: 30 },
  { plate: "TRK-3", fuel: null }
];

const plates = (list: Row[]) => list.map((r) => r.plate);

describe("useSortedRows", () => {
  it("returns the rows untouched when no column is chosen", () => {
    const { result } = renderHook(() => useSortedRows(rows));
    expect(plates(result.current.sorted)).toEqual(["TRK-1", "TRK-2", "TRK-3"]);
  });

  it("sorts numbers numerically, not as strings", () => {
    // Lexicographically "100" precedes "30", which would put the fuller tank
    // first. The comparator subtracts, so the real order wins.
    const { result } = renderHook(() => useSortedRows(rows, "fuel", "asc"));
    expect(plates(result.current.sorted)).toEqual(["TRK-2", "TRK-1", "TRK-3"]);
  });

  it("sorts strings in numeric-aware order", () => {
    const input: Row[] = [{ n: "item 10" }, { n: "item 2" }];
    const { result } = renderHook(() => useSortedRows(input, "n", "asc"));
    expect(result.current.sorted.map((r) => r.n)).toEqual(["item 2", "item 10"]);
  });

  it("keeps rows with no value at the bottom in both directions", () => {
    const asc = renderHook(() => useSortedRows(rows, "fuel", "asc"));
    const desc = renderHook(() => useSortedRows(rows, "fuel", "desc"));
    expect(plates(asc.result.current.sorted).at(-1)).toBe("TRK-3");
    expect(plates(desc.result.current.sorted).at(-1)).toBe("TRK-3");
  });

  it("reverses the order on the same key", () => {
    const { result } = renderHook(() => useSortedRows(rows, "fuel", "asc"));
    act(() => result.current.toggle("fuel"));
    expect(result.current.sort.direction).toBe("desc");
    expect(plates(result.current.sorted)).toEqual(["TRK-1", "TRK-2", "TRK-3"]);
  });

  it("starts ascending when a different column is chosen", () => {
    const { result } = renderHook(() => useSortedRows(rows, "fuel", "desc"));
    act(() => result.current.toggle("plate"));
    expect(result.current.sort).toEqual({ key: "plate", direction: "asc" });
    expect(plates(result.current.sorted)).toEqual(["TRK-1", "TRK-2", "TRK-3"]);
  });

  it("leaves the caller's array untouched", () => {
    const original = [...rows];
    const { result } = renderHook(() => useSortedRows(rows, "fuel", "asc"));
    void result.current.sorted;
    expect(rows).toEqual(original);
  });

  it("leaves rows with equal keys in their original order", () => {
    const input: Row[] = [
      { id: 1, group: "x" },
      { id: 2, group: "x" },
      { id: 3, group: "x" }
    ];
    const { result } = renderHook(() => useSortedRows(input, "group", "asc"));
    expect(result.current.sorted.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("sorts a column whose values are a mix of numbers and strings", () => {
    const input: Row[] = [{ v: 10 }, { v: "9" }, { v: 2 }];
    const { result } = renderHook(() => useSortedRows(input, "v", "asc"));
    expect(result.current.sorted.map((r) => r.v)).toEqual([2, "9", 10]);
  });
});

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a"));
    expect(result.current).toBe("a");
  });

  it("waits for the delay before reporting a change", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: "a" }
    });
    rerender({ v: "ab" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe("ab");
  });

  it("reports only the last value from a burst of keystrokes", () => {
    // This is the point of the hook: one request per pause, not per character.
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: "a" }
    });
    for (const v of ["ab", "abc", "abcd"]) {
      rerender({ v });
      act(() => vi.advanceTimersByTime(100));
    }
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe("abcd");
  });

  it("honours a custom delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 1000), {
      initialProps: { v: "a" }
    });
    rerender({ v: "b" });
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe("b");
  });
});

describe("useDisclosure", () => {
  it("starts closed and opens", () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it("can start open", () => {
    const { result } = renderHook(() => useDisclosure(true));
    expect(result.current.isOpen).toBe(true);
  });

  it("toggles and closes", () => {
    const { result } = renderHook(() => useDisclosure());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it("closes on Escape", () => {
    const { result } = renderHook(() => useDisclosure(true));
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("stays open for other keys", () => {
    const { result } = renderHook(() => useDisclosure(true));
    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("locks page scrolling while open and restores it on close", () => {
    const { result, unmount } = renderHook(() => useDisclosure(false));
    expect(document.body.style.overflow).toBe("");
    act(() => result.current.open());
    expect(document.body.style.overflow).toBe("hidden");
    act(() => result.current.close());
    expect(document.body.style.overflow).toBe("");
    unmount();
  });

  it("restores scroll on unmount while open, so a stray hidden body cannot persist", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = renderHook(() => useDisclosure(true));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });
});

describe("useHotkey", () => {
  it("fires on the modifier chord", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("mod+k", handler));
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts ctrl as the modifier", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("mod+k", handler));
    act(() => {
      fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores the key without the modifier", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("mod+k", handler));
    act(() => {
      fireEvent.keyDown(document, { key: "k" });
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores the modifier with a different key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("mod+k", handler));
    act(() => {
      fireEvent.keyDown(document, { key: "j", metaKey: true });
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("is case-insensitive on the key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("mod+k", handler));
    act(() => {
      fireEvent.keyDown(document, { key: "K", metaKey: true });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires on a bare key when the combo has no modifier", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("/", handler));
    act(() => {
      fireEvent.keyDown(document, { key: "/" });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("mod+k", handler, { enabled: false }));
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the newest handler, not the one captured on mount", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ h }) => useHotkey("mod+k", h), {
      initialProps: { h: first }
    });
    rerender({ h: second });
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes its listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useHotkey("mod+k", handler));
    unmount();
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("useClickOutside", () => {
  function harness(handler: () => void, enabled = true) {
    const ref = { current: document.createElement("div") };
    document.body.appendChild(ref.current);
    const hook = renderHook(() => useClickOutside(ref, handler, { enabled }));
    return { ref, unmount: hook.unmount };
  }

  it("fires when the pointer goes down outside the element", () => {
    const handler = vi.fn();
    harness(handler);
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire for a press inside the element", () => {
    const handler = vi.fn();
    const { ref } = harness(handler);
    act(() => {
      fireEvent.mouseDown(ref.current!);
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires for a press on a descendant of the element", () => {
    const handler = vi.fn();
    const { ref } = harness(handler);
    const child = document.createElement("span");
    ref.current!.appendChild(child);
    act(() => {
      fireEvent.mouseDown(child);
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const handler = vi.fn();
    harness(handler, false);
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes its listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = harness(handler);
    unmount();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
