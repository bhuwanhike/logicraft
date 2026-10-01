/**
 * Shared display helpers for the workspace tables.
 *
 * These live here rather than in a page module because every module renders
 * status pills and dates from API payloads; keeping them in a leaf module stops
 * pages from importing each other for formatting concerns.
 */

/** Pill modifier classes, keyed by the lowercased status the API returns. */
const STATUS_TONES: Record<string, string> = {
  active: 'green',
  in_transit: 'blue',
  idle: 'slate',
  maintenance: 'amber',
  in_maintenance: 'amber',
  out_of_service: 'red'
};

/** Props for {@link StatusPill}. */
export interface StatusPillProps {
  status?: unknown;
}

export function StatusPill({ status }: StatusPillProps) {
  if (!status) return <span className="pill">Unknown</span>;
  return <span className={`pill ${STATUS_TONES[String(status).toLowerCase()] ?? 'slate'}`}>{humanise(status)}</span>;
}

/** Props for {@link Meter}. */
export interface MeterProps {
  value: unknown;
  max?: number;
}

export function Meter({ value, max = 100 }: MeterProps) {
  const pct = Math.min(100, Math.max(0, (Number(value) / max) * 100));
  return (
    <span className="meter" title={`${value} of ${max}`}>
      <i style={{ width: `${pct}%` }} className={pct < 20 ? 'low' : pct < 45 ? 'mid' : 'ok'} />
    </span>
  );
}

export function humanise(value: unknown): string {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(value: unknown): string {
  if (!value) return '—';
  // The API sends ISO strings, but an already-parsed Date can reach here too.
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatKm(value: unknown): string {
  if (value === undefined || value === null) return '—';
  return `${Number(value).toLocaleString()} km`;
}

/** Narrows an API value to a number, or null when it is not numeric. */
export function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Renders any API value as display text.
 *
 * Every record is `Record<string, unknown>`, so a field read straight off a row
 * is `unknown` and cannot be handed to React. Pages use this at the point of
 * display rather than casting each field, which keeps the API boundary honest:
 * anything the API can return is renderable, and anything missing shows the
 * caller's fallback.
 */
export function text(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return formatDate(value);
  if (Array.isArray(value)) {
    if (!value.length) return fallback;
    return value
      .map((entry) => text(entry, ''))
      .filter(Boolean)
      .join(', ') || fallback;
  }
  // A nested object has no flat text form. `String(value)` would emit
  // "[object Object]", so a named field is preferred and a shallow key summary
  // is the last resort.
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['label', 'name', 'title', 'reference', 'value']) {
      const hit = text(record[key], '');
      if (hit) return hit;
    }
    const keys = Object.keys(record);
    if (!keys.length) return fallback;
    return keys
      .slice(0, 3)
      .map((key) => `${key}: ${text(record[key], '—')}`)
      .join(', ');
  }
  return String(value);
}

/** Reads a field off a record, or undefined when absent. */
export function field(row: Record<string, unknown> | null | undefined, key: string): unknown {
  return row?.[key];
}

/** Boolean reading of an API value, for DetailField `of` guards. */
export function flag(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}
