import type { ReactNode } from 'react';
import { TableToolbar } from './TableToolbar';
import type { FilterEntry } from './TableToolbar';

/** A tab in the panel header. May be a bare string or an object with a count. */
/** A tab descriptor with a visible count, as pages that filter client-side use. */
export interface TabDescriptor {
  id: string;
  label?: string;
  count?: number;
}

/** DataPanel accepts a bare id for simple tabs, or a descriptor for counted ones. */
export type Tab = string | TabDescriptor;

/**
 * Props for DataPanel.
 *
 * `setQuery` being defined is what turns the search row on, which is why the
 * panel takes the whole toolbar's state rather than a `showToolbar` flag.
 */
export interface DataPanelProps {
  title?: string;
  count?: number;
  description?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  query?: string;
  setQuery?: (next: string) => void;
  searchPlaceholder?: string;
  filter?: string;
  setFilter?: (next: string) => void;
  filters?: FilterEntry[];
  secondaryFilters?: FilterEntry[];
  secondaryFilter?: string;
  setSecondaryFilter?: (next: string) => void;
  secondaryLabel?: string;
  action?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Resolves a tab to its id, whether it is a string or an object. */
function tabId(tab: Tab): string {
  return typeof tab === 'string' ? tab : tab.id;
}

/**
 * Panel wrapper for a data table: heading, optional tabs, optional toolbar,
 * the table body, and a footer that only appears when there is genuinely
 * something to page through.
 *
 * The footer takes its numbers from props. It does not default to a row count,
 * a total, or a page count, because a table that says "Showing 8 of 96" when
 * nothing has been fetched is a lie the user acts on.
 */
export function DataPanel({
  title,
  count,
  description,
  tabs,
  activeTab,
  onTabChange,
  query,
  setQuery,
  searchPlaceholder,
  filter,
  setFilter,
  filters,
  secondaryFilters,
  secondaryFilter,
  setSecondaryFilter,
  secondaryLabel,
  action,
  children,
  footer
}: DataPanelProps) {
  return (
    <section className="panel data-panel">
      {(title || tabs) && (
        <div className="data-heading">
          {title && (
            <div>
              <h2>
                {title} {count !== undefined && <small>{count}</small>}
              </h2>
              {description && <p>{description}</p>}
            </div>
          )}

          {tabs && (
            <div className="data-tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tabId(tab)}
                  role="tab"
                  type="button"
                  aria-selected={activeTab === tabId(tab)}
                  className={activeTab === tabId(tab) ? 'active' : ''}
                  onClick={() => onTabChange?.(tabId(tab))}
                >
                  {typeof tab === 'string' ? tab : (tab.label ?? tab.id)}
                  {typeof tab !== 'string' && tab.count !== undefined && (
                    <em className="tab-count">{tab.count}</em>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {setQuery !== undefined && (
        <TableToolbar
          value={query}
          setValue={setQuery}
          placeholder={searchPlaceholder}
          filters={filters}
          filter={filter}
          setFilter={setFilter}
          secondaryFilters={secondaryFilters}
          secondaryFilter={secondaryFilter}
          setSecondaryFilter={setSecondaryFilter}
          secondaryLabel={secondaryLabel}
          action={action}
        />
      )}

      <div className="table-wrap">{children}</div>

      {footer}
    </section>
  );
}

export default DataPanel;
