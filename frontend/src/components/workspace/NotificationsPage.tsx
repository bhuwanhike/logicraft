import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, CheckCheck, Info } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { useDebouncedValue } from '../../hooks/useUi';
import { DataPanel } from '../common/DataPanel';
import { ResourceState } from '../common/ResourceState';
import { useWorkspace } from '../../state/WorkspaceContext';
import {flag, formatDate, text} from './format';
import type { LucideIcon } from 'lucide-react';
import type { Row } from '../../types';
import type { TabDescriptor } from '../common/DataPanel';

/** Notification levels the API may report. */
type Level = 'critical' | 'warning' | 'info';

const TABS: TabDescriptor[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' }
];

/** Notifications deep-link into the module that raised them. */
/** Routes a notification deep-links into, keyed by the entity that raised it. */
const DEEP_LINKS: Record<string, (n: Row) => string> = {
  shipment: (n) => `/shipments?ref=${encodeURIComponent(text(n.reference, ''))}`,
  vehicle: () => '/vehicles',
  driver: () => '/drivers',
  warehouse: () => '/warehouses',
  trip: () => '/tracking'
};

const LEVEL_ICONS: Record<Level, LucideIcon> = { critical: AlertTriangle, warning: AlertTriangle, info: Info };

/**
 * Notification centre.
 *
 * Unread is a client-side filter over the fetched rows rather than a separate
 * endpoint, which keeps the tab counters consistent with the list by
 * construction.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const { notify } = useWorkspace();

  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);

  const state = useCollection(api.notifications.list, { q: debouncedQuery });

  const all = state.data;

  const filtered = useMemo(() => {
    let rows = all;
    if (tab === 'unread') rows = rows.filter((n: Row) => n.read === false);
    else if (tab !== 'all') rows = rows.filter((n: Row) => (n.level ?? 'info') === tab);
    return rows;
  }, [all, tab]);

  // One counter per tab id, so adding a tab cannot silently lose its count.
  const counts = useMemo<Record<string, number>>(
    () => ({
      all: all.length,
      unread: all.filter((n: Row) => n.read === false).length,
      critical: all.filter((n: Row) => n.level === 'critical').length,
      warning: all.filter((n: Row) => n.level === 'warning').length,
      info: all.filter((n: Row) => (n.level ?? 'info') === 'info').length
    }),
    [all]
  );

  const tabs = TABS.map((t) => ({ ...t, count: counts[t.id] ?? 0 }));

  const open = (n: Row) => {
    const href = DEEP_LINKS[text(n.entityType, '')]?.(n);
    if (href) navigate(href);
    else notify('This notification has no linked record.', 'info');
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Inbox</div>
          <h1>Notifications</h1>
          <p>Exceptions, assignment updates, and system events in one stream.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button"
            disabled={counts.unread === 0}
            onClick={() => notify('Mark-all-read needs a writable event stream.', 'info')}
          >
            <CheckCheck size={16} /> Mark all as read
          </button>
        </div>
      </div>

      <DataPanel
        title="Activity"
        count={filtered.length}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search notifications"
      >
        <ResourceState
          state={state}
          noun="notifications"
          onRetry={state.refetch}
          cta={
            <button type="button" className="button" onClick={() => notify('Alert rules are configured in Settings.', 'info')}>
              Configure alert rules
            </button>
          }
        >
          {filtered.length === 0 ? (
            <div className="inline-state">
              <Check size={15} aria-hidden="true" />
              <span>Nothing in this category</span>
            </div>
          ) : (
            <ul className="notification-list">
              {filtered.map((n) => {
                const Icon = LEVEL_ICONS[n.level as Level] ?? Info;
                return (
                  <li key={text(n.id, '')} className={`level-${text(n.level, 'info')} ${n.read === false ? 'is-unread' : 'is-read'}`}>
                    <i className="notif-icon" aria-hidden="true">
                      <Icon size={15} />
                    </i>
                    <div className="notif-body">
                      <b>{text(n.title ?? n.message, 'Event')}</b>
                      <p>{text(n.detail ?? n.summary ?? n.message, ' ')}</p>
                      <small>
                        {formatDate(n.at ?? n.createdAt)}
                          {flag(n.entityType) && (
                          <>
                            {' '}
                            &middot; {text(n.entityType, '')}
                            {n.reference ? ` ${text(n.reference)}` : ''}
                          </>
                        )}
                      </small>
                    </div>
                    <div className="notif-actions">
                      <button type="button" className="link" onClick={() => open(n)}>
                        View
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={n.read === false ? 'Mark as read' : 'Mark as unread'}
                        onClick={() => notify('Read state needs a writable event stream.', 'info')}
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ResourceState>
      </DataPanel>
    </>
  );
}
