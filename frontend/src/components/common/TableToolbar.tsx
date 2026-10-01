import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A filter option. Plain strings are still accepted and are treated as their own
 * value, so older call sites keep working.
 */
/** A filter option with explicit copy, as pages that build their own list use. */
export interface FilterOption {
  value: string;
  label: string;
}

/** A filter entry is a bare value, or a { value, label } pair. */
export type FilterEntry = string | FilterOption;

/** Normalises a filter entry that may be a string or a { value, label } pair. */
function optionValue(entry: FilterEntry): string {
  return typeof entry === 'string' ? entry : entry.value;
}

function optionLabel(entry: FilterEntry): string {
  return typeof entry === 'string' ? entry : entry.label;
}

function Option({ entry }: { entry: FilterEntry }) {
  return (
    <option value={optionValue(entry)}>
      {optionLabel(entry)}
    </option>
  );
}

/** Props for TableToolbar. */
export interface TableToolbarProps {
  value?: string;
  setValue?: (next: string) => void;
  placeholder?: string;
  filters?: FilterEntry[];
  filter?: string;
  setFilter?: (next: string) => void;
  secondaryFilters?: FilterEntry[];
  secondaryFilter?: string;
  setSecondaryFilter?: (next: string) => void;
  secondaryLabel?: string;
  action?: ReactNode;
}

/**
 * Search + filter row shared by every list module.
 *
 * Filters are `{ value, label }` pairs so the machine value can stay stable and
 * machine-readable ("out_of_service") while the label stays readable ("Out of
 * service"). Plain strings are still accepted and are treated as their own
 * value, so older call sites keep working.
 *
 * The "all" entry is supplied by the caller as part of the filter list rather
 * than being injected here, so the option label can be module-specific and
 * there is exactly one source of truth for what "no filter" means.
 */
export function TableToolbar({
  value,
  setValue,
  placeholder = 'Search anything...',
  filters,
  filter,
  setFilter,
  secondaryFilters,
  secondaryFilter,
  setSecondaryFilter,
  secondaryLabel = 'All types',
  action
}: TableToolbarProps) {
  // `secondaryLabel` is accepted (and forwarded by DataPanel) but has never been
  // rendered — the secondary select is labelled with aria-label instead. Kept in
  // the signature so callers do not break; the read is here so the unused
  // destructuring is intentional rather than an oversight.
  void secondaryLabel;

  return (
    <div className="table-toolbar">
      <label className="table-search">
        <Search size={16} />
        <input
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => setValue?.(e.target.value)}
        />
      </label>

      {filters && (
        <select
          aria-label="Filter by status"
          value={filter ?? ''}
          onChange={(e) => setFilter?.(e.target.value)}
        >
          {filters.map((entry) => (
            <Option key={optionValue(entry)} entry={entry} />
          ))}
        </select>
      )}

      {secondaryFilters && (
        <select
          aria-label="Secondary filter"
          value={secondaryFilter ?? ''}
          onChange={(e) => setSecondaryFilter?.(e.target.value)}
        >
          {secondaryFilters.map((entry) => (
            <Option key={optionValue(entry)} entry={entry} />
          ))}
        </select>
      )}

      {action}
    </div>
  );
}

export default TableToolbar;
