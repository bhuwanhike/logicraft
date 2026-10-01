import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Row, SortDirection, SortState, UseDisclosureResult } from '../types';

/** Debounces a value; used so typing in a search box does not fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** open/close pair for a drawer or modal, with Escape-to-close and scroll locking. */
export function useDisclosure(initial = false): UseDisclosureResult {
  const [isOpen, setIsOpen] = useState(initial);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((v) => !v);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return { isOpen, open, close, toggle };
}

/** Registers a global key chord, e.g. the Cmd+K command palette. */
export function useHotkey(
  combo: string,
  handler: () => void,
  { enabled = true }: { enabled?: boolean } = {}
): void {
  const saved = useRef(handler);
  saved.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;

    const parts = combo.toLowerCase().split('+');
    const wantsMeta = parts.includes('mod');
    const key = parts[parts.length - 1];

    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (wantsMeta !== meta) return;
      if (event.key.toLowerCase() !== key) return;
      event.preventDefault();
      saved.current?.();
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [combo, enabled]);
}

/** Closes a popover when the pointer goes down outside of it. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  { enabled = true }: { enabled?: boolean } = {}
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, handler, enabled]);
}

/** Sorted view of a list, with a stable tiebreak so equal keys do not jump rows. */
export function useSortedRows(
  rows: Row[],
  initialKey: string | null = null,
  initialDirection: SortDirection = 'asc'
): { sorted: Row[]; sort: SortState; toggle: (key: string) => void } {
  const [sort, setSort] = useState<SortState>({ key: initialKey, direction: initialDirection });

  const toggle = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const sorted = sort.key ? sortRows(rows, sort.key, sort.direction) : rows;

  return { sorted, sort, toggle };
}

function sortRows(rows: Row[], key: string, direction: SortDirection): Row[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a?.[key];
    const right = b?.[key];
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
  });
}
