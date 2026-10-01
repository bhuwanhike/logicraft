import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSortedRows } from '../../hooks/useUi';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import type { Row, Rows, SortState } from '../../types';
import { text } from '../workspace/format';

/**
 * Sortable table body.
 *
 * Columns are declared as descriptors so the header and body cannot drift:
 *
 *   { key: 'plate', label: 'Identifier', sortable: true, render: (row) => … }
 *
 * A column may supply `render` (formatted/composed output), `accessor` (a
 * different field than `key`), or neither — in which case it reads `key`
 * straight off the row. That default matters: requiring one of the two made it
 * trivially easy to declare a column that silently rendered an em-dash for
 * every row, which is how several tables ended up blank.
 *
 * `render` wins over `accessor`, and `accessor` defaults to `key`.
 */
/**
 * One column of a {@link SortableTable}.
 *
 * `render` wins over `accessor`, and `accessor` defaults to `key`, so a column
 * may declare neither and still read `key` straight off the row.
 */
export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  /** A field other than `key`, used when no `render` is supplied. */
  accessor?: string;
  render?: (row: Row) => ReactNode;
  className?: string;
  width?: string;
}

/** Props for {@link SortableTable}. */
export interface SortableTableProps {
  columns: Column[];
  rows: Rows;
  sort: SortState;
  onSort: (key: string) => void;
  /** Row field used as the React key; falls back to the row index. */
  rowKey?: string;
  onRowClick?: (row: Row) => void;
  /** Shown for null/undefined/empty cells. */
  emptyCell?: ReactNode;
}

export function SortableTable({
  columns,
  rows,
  sort,
  onSort,
  rowKey = 'id',
  onRowClick,
  emptyCell = '—'
}: SortableTableProps) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              style={column.width ? { width: column.width } : undefined}
              aria-sort={
                sort.key === column.key
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : column.sortable
                    ? 'none'
                    : undefined
              }
            >
              {column.sortable ? (
                <button type="button" className="th-sort" onClick={() => onSort(column.key)}>
                  {column.label}
                  {sort.key === column.key &&
                    (sort.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </button>
              ) : (
                column.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={rowKeyOf(row, rowKey) ?? index}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            {columns.map((column) => (
              <td key={column.key} className={column.className}>
                {asNode(renderCell(column, row, emptyCell))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderCell(column: Column, row: Row, emptyCell: ReactNode): ReactNode {
  if (typeof column.render === 'function') return column.render(row);
  return format(row?.[column.accessor ?? column.key], emptyCell);
}

/**
 * Passes a rendered cell through to React.
 *
 * `column.render` returns a ReactNode, and a React element has `typeof
 * "object"`. Coercing one with `String(value)` therefore yields the literal
 * "[object Object]", which silently replaced every cell whose render function
 * returned JSX — badges, pills, meters, links. Cells that returned a plain
 * string rendered correctly, so the bug was partial per column rather than
 * per table.
 *
 * Elements are valid children, so they are returned as-is. Only genuinely
 * unrenderable values fall through to a text form.
 */
function asNode(value: unknown): ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map((entry) => asNode(entry));
  if (typeof value === 'object') return text(value);
  return String(value);
}

/** Reads the React key for a row, or null when the field is absent. */
function rowKeyOf(row: Row, rowKey: string): string | number | null {
  const value = row?.[rowKey];
  if (typeof value === 'string' || typeof value === 'number') return value;
  return null;
}

/**
 * Formats a raw cell value for a column that declares no `render`.
 *
 * A nested object or array has no sensible flat rendering, so it is described
 * rather than coerced — `String(value)` here is what produced "[object Object]"
 * for list-shaped fields such as a driver's certifications.
 *
 * Arrays are joined rather than handed to React as a child list. React
 * concatenates sibling children with no separator, so a TEXT[] column read
 * straight off the row rendered as "CDL-ATanker"; `text()` is what inserts the
 * comma. `asNode` still maps arrays verbatim, because a `render` function that
 * returns an array means an array of nodes, not a list to be formatted.
 */
function format(value: unknown, fallback: ReactNode): ReactNode {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return text(value);
  return asNode(value);
}

/** Props for {@link SortableTableView}. */
export interface SortableTableViewProps {
  columns: Column[];
  rows: Rows;
  initialSortKey?: string;
  onRowClick?: (row: Row) => void;
  rowKey?: string;
  emptyCell?: ReactNode;
}

/** Convenience wrapper that owns the sort state for a column set. */
export function SortableTableView({ columns, rows, initialSortKey, onRowClick, rowKey, emptyCell }: SortableTableViewProps) {
  const { sorted, sort, toggle } = useSortedRows(rows, initialSortKey ?? null, 'asc');
  return (
    <SortableTable
      columns={columns}
      rows={sorted}
      sort={sort}
      onSort={toggle}
      onRowClick={onRowClick}
      rowKey={rowKey}
      emptyCell={emptyCell}
    />
  );
}

/**
 * Pagination that renders only when it has work to do. A single page of results
 * shows a count, not a pager with dead buttons.
 */
/** Props for {@link Pagination}. */
export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Plural label after the count. */
  noun?: string;
}

export function Pagination({ page, pageCount, total, onPageChange, noun = 'records' }: PaginationProps) {
  if (total === 0) return null;

  if (pageCount <= 1) {
    return (
      <div className="table-footer">
        <span>
          Showing <b>{total}</b> {noun}
        </span>
      </div>
    );
  }

  const pages = pageWindow(page, pageCount);

  return (
    <div className="table-footer">
      <span>
        Page <b>{page}</b> of <b>{pageCount}</b> &middot; <b>{total}</b> {noun}
      </span>
      <div className="pagination">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" type="button">
          <ChevronLeft size={13} />
        </button>
        {pages.map((entry, i) =>
          entry === '…' ? (
            <span key={`gap-${i}`}>&hellip;</span>
          ) : (
            <button
              key={entry}
              type="button"
              className={entry === page ? 'current' : ''}
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
            >
              {entry}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          type="button"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/** First, last, and a window around the current page, with ellipsis gaps. */
function pageWindow(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const out: (number | '…')[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push('…');
    out.push(p);
    previous = p;
  }
  return out;
}
