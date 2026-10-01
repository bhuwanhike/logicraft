import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Package,
  Radio,
  RefreshCw,
  Route,
  Truck
} from 'lucide-react';
import { api } from '../../services/api';
import { useCollection, useResource } from '../../hooks/useCollection';
import { useDebouncedValue, useSortedRows } from '../../hooks/useUi';
import { FleetMap } from '../common/FleetMap';
import { ResourceState, InlineResourceState } from '../common/ResourceState';
import { SortableTable, Pagination } from '../common/SortableTable';
import { SeverityBadge } from '../common/Stepper';
import { StatusPill, formatDate, num, text } from './format';
import type { LucideIcon } from 'lucide-react';
import type { Row, Rows, UseResourceResult } from '../../types';
import type { Column } from '../common/SortableTable';
import type { FleetMarker } from '../common/FleetMap';
import type { SeverityLevel } from '../common/Stepper';

/** One selectable date range. */
interface RangeOption {
  value: string;
  label: string;
}

/** A KPI tile: which summary field it reads, and which direction is good. */
interface KpiCard {
  key: string;
  label: string;
  suffix?: string;
  icon: LucideIcon;
  good?: 'up' | 'down';
}
import { useWorkspace } from '../../state/WorkspaceContext';

const PAGE_SIZE = 8;

const RANGES: RangeOption[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' }
];

const SEARCHABLE = ['reference', 'origin', 'destination', 'driverName', 'vehiclePlate', 'status'];

/**
 * Operations dashboard.
 *
 * Layout: a KPI row, then a 65/35 split of live map to exception feed, then
 * the dispatch table.
 *
 * Each panel owns its own request and its own retry, so one failing source
 * degrades a single card instead of blanking the page. With no API connected
 * that is exactly what happens: four independent failures, four independent
 * "no source" messages, and every control still doing something real.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { notify } = useWorkspace();

  const [range, setRange] = useState<string>('7d');
  const [query, setQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const debouncedQuery = useDebouncedValue(query);

  // useResource, not useCollection: /metrics/summary resolves a single object,
  // and useCollection coerces any non-array payload to []. Fetching it as a
  // collection is what made every KPI tile render "No metric source" while the
  // endpoint was returning data perfectly well.
  const summary = useResource(() => api.metrics.summary({ range }), { range });
  const shipments = useCollection(api.shipments.list, { status: 'in_transit' });
  const exceptions = useCollection(api.notifications.list, { level: 'critical,warning', read: false });
  const trips = useCollection(api.trips.list, { status: 'active' });

  // Sort before paginate, not after: sorting only the current page would make
  // the sort order depend on which page you happened to be looking at.
  const filtered = useMemo(() => filterRows(shipments.data, debouncedQuery), [shipments.data, debouncedQuery]);
  const { sorted, sort, toggle } = useSortedRows(filtered, 'eta', 'asc');
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Keep the page in range when a filter or a new response shrinks the list.
  const safePage = Math.min(page, pageCount);

  // Markers carry raw WGS84 degrees for the real map. They used to be written
  // into `x`/`y`, which MapCanvas treats as *already-projected* percentages and
  // re-projects: a longitude of -86.9 became 1.7% from the left edge, pinning
  // the whole US fleet into a sliver.
  const markers = useMemo<FleetMarker[]>(
    () =>
      trips.data
        .map((trip: Row): FleetMarker | null => {
          const lat = num(trip.lat);
          const lng = num(trip.lng);
          if (lat === null || lng === null) return null;
          return {
            id: text(trip.id, ''),
            lat,
            lng,
            label: text(trip.reference ?? trip.plate, 'Trip'),
            heading: num(trip.headingDeg),
            speedKph: num(trip.speedKph),
            tone: trip.status === 'delayed' ? 'warn' : 'live',
            details: [
              `Vehicle: ${text(trip.vehiclePlate, 'Unassigned')}`,
              `Driver: ${text(trip.driverName, 'Unassigned')}`,
              trip.lastReportedAt ? `Reported: ${formatDate(trip.lastReportedAt)}` : ''
            ].filter(Boolean)
          };
        })
        .filter((marker): marker is FleetMarker => marker !== null),
    [trips.data]
  );

  const exportDispatch = async () => {
    try {
      const blob = await api.export.report('dispatch', { range });
      downloadBlob(blob, `logicraft-dispatch-${range}.csv`);
      notify('Dispatch report downloaded.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export needs a connected reporting service.', 'info');
    }
  };

  const openShipment = (row: Row) => {
    if (!row?.reference) {
      notify('This record has no reference to open.', 'info');
      return;
    }
      navigate(`/shipments?ref=${encodeURIComponent(text(row.reference, ''))}`);
  };

  const trackShipment = (row: Row) => {
    if (!row?.reference) {
      notify('This record has no reference to track.', 'info');
      return;
    }
      navigate(`/tracking?ref=${encodeURIComponent(text(row.reference, ''))}`);
  };

  // Rebuilt per render so each row action closes over its own row.
  const columns: Column[] = [
    { key: 'reference', label: 'Shipment', sortable: true, render: (row: Row) => <b>{text(row.reference)}</b> },
    {
      key: 'origin',
      label: 'Route',
      sortable: true,
      render: (row: Row) => (
        <span className="route-cell">
          {text(row.origin)} <i>to</i> {text(row.destination)}
        </span>
      )
    },
    { key: 'driverName', label: 'Driver', sortable: true },
    { key: 'vehiclePlate', label: 'Vehicle', sortable: true },
    { key: 'eta', label: 'ETA', sortable: true, render: (row: Row) => formatDate(row.eta) },
    { key: 'status', label: 'Status', sortable: true, render: (row: Row) => <StatusPill status={row.status} /> },
    {
      key: '_actions',
      label: '',
      render: (row: Row) => (
        <button
          type="button"
          className="link"
          onClick={(event) => {
            // The row itself is clickable; don't let this bubble into a
            // double navigation.
            event.stopPropagation();
            trackShipment(row);
          }}
        >
          Track <ArrowUpRight size={12} />
        </button>
      )
    }
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operations</div>
          <h1>Dashboard</h1>
          <p>Live fleet, shipment, and exception state across your network.</p>
        </div>
        <div className="heading-actions">
          <label className="field inline">
            <span className="sr-only">Date range</span>
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            onClick={() => {
              summary.refetch();
              shipments.refetch();
              exceptions.refetch();
              trips.refetch();
              notify('Dashboard refreshed.', 'success');
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="button" onClick={exportDispatch}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <KpiRow summary={summary} />

      <div className="split-65-35">
        <section className="panel map-panel">
          <div className="panel-head">
            <h2>Fleet positions</h2>
            <span className="panel-meta">
              {trips.isLoading ? (
                'loading…'
              ) : markers.length > 0 ? (
                `${markers.length} reporting`
              ) : (
                <>
                  <Radio size={12} /> awaiting telemetry
                </>
              )}
            </span>
          </div>
          <FleetMap
            markers={markers}
            height={330}
            emptyTitle={trips.isError ? 'Fleet positions unavailable' : 'No live positions'}
            emptyText={
              trips.isError && !trips.missingSource
                ? trips.error?.message
                : 'Active trip telemetry will plot here once a location feed is connected.'
            }
            emptyAction={
              <div className="button-row">
                <button type="button" className="button primary" onClick={() => navigate('/tracking')}>
                  Open Tracking Center
                </button>
                {trips.isError && (
                  <button type="button" className="button" onClick={trips.refetch}>
                    <RefreshCw size={14} /> Retry
                  </button>
                )}
              </div>
            }
          />
        </section>

        <section className="panel exception-panel">
          <div className="panel-head">
            <h2>Exception feed</h2>
            <span className="panel-meta">{exceptions.data.length} open</span>
          </div>
          <InlineResourceState state={exceptions} noun="exceptions" onRetry={exceptions.refetch}>
            <ul className="exception-list">
              {exceptions.data.slice(0, 6).map((item: Row) => (
                <li key={text(item.id, '')}>
                  <AlertTriangle size={14} aria-hidden="true" />
                  <div>
                    <b>{text(item.title ?? item.message, 'Exception')}</b>
                    <small>{text(item.detail ?? item.summary, '')}</small>
                  </div>
                  <SeverityBadge level={text(item.level, 'info') as SeverityLevel} />
                </li>
              ))}
            </ul>
          </InlineResourceState>
        </section>
      </div>

      <section className="panel data-panel">
        <div className="data-heading">
          <div>
            <h2>
              Active dispatch <small>{shipments.data.length}</small>
            </h2>
            <p>Shipments currently moving through the network.</p>
          </div>
          <div className="heading-actions">
            <button type="button" className="button" onClick={() => navigate('/vehicles')}>
              <Truck size={15} /> Fleet
            </button>
            <button type="button" className="button primary" onClick={() => navigate('/shipments')}>
              <Package size={15} /> All shipments
            </button>
          </div>
        </div>

        <div className="table-toolbar">
          <input
            className="table-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by reference, route, or driver"
            aria-label="Filter dispatch table"
          />
          {query && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="table-wrap">
          <ResourceState
            state={shipments}
            noun="in-transit shipments"
            onRetry={shipments.refetch}
            cta={
              <button type="button" className="button primary" onClick={() => navigate('/shipments')}>
                <Route size={15} /> Go to Shipments
              </button>
            }
          >
            <SortableTable
              columns={columns}
              rows={visible}
              sort={sort}
              onSort={toggle}
              onRowClick={openShipment}
            />
          </ResourceState>
        </div>

        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={sorted.length}
          noun="in-transit shipments"
          onPageChange={setPage}
        />
      </section>
    </>
  );
}

/** Props for {@link KpiRow}. */
interface KpiRowProps {
  summary: UseResourceResult;
}

function KpiRow({ summary }: KpiRowProps) {
  const cards: KpiCard[] = [
    { key: 'onTimeRate', label: 'On-time delivery', suffix: '%', icon: Package, good: 'up' },
    { key: 'activeVehicles', label: 'Active vehicles', icon: Truck },
    { key: 'openExceptions', label: 'Open exceptions', icon: AlertTriangle, good: 'down' },
    { key: 'avgTransitHours', label: 'Avg transit time', suffix: 'h', icon: Route, good: 'down' }
  ];

  return (
    <div className="kpi-row">
      {cards.map(({ key, label, suffix, icon: Icon, good }) => {
          const value = readMetric(summary.data, key);
        // num(null) is 0, not null — Number(null) === 0 — so a metric the API
        // deliberately reports no delta for would render a confident "+0".
        // The null check has to happen before num() sees the value.
        const rawDelta = readMetric(summary.data, `${key}Delta`);
        const deltaValue = rawDelta === null || rawDelta === undefined ? null : num(rawDelta);

        if (summary.isLoading) {
          return (
            <div className="panel kpi-card" key={key} aria-busy="true">
              <span className="skeleton skeleton-line" style={{ width: '55%' }} />
              <span className="skeleton skeleton-block" style={{ height: 22 }} />
            </div>
          );
        }

        // "Good" direction is per-card: up for on-time rate, down for
        // exceptions and transit time.
        const isGood = deltaValue !== null && (deltaValue >= 0) === (good === 'up');

        return (
          <div className="panel kpi-card" key={key}>
            <div className="kpi-top">
              <span>{label}</span>
              <Icon size={15} aria-hidden="true" />
            </div>
            {value === undefined || value === null ? (
              <>
                <strong className="kpi-empty">&mdash;</strong>
                <small className="kpi-sub">
                  {summary.isError && !summary.missingSource
                    ? 'Metric unavailable'
                    : 'No metric source'}
                </small>
              </>
            ) : (
              <>
                <strong>
                  {text(value)}
                  {suffix}
                </strong>
                {deltaValue !== null && (
                  <small className={isGood ? 'kpi-up' : 'kpi-down'}>
                    {deltaValue >= 0 ? '+' : ''}
                    {text(deltaValue)}
                    {suffix}
                  </small>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Reads a KPI field off the summary payload.
 *
 * The payload is one object rather than a list, so a missing key means the
 * metric is genuinely absent from the response — not that a row was missing.
 */
function readMetric(data: unknown, key: string): unknown {
  if (!data || typeof data !== 'object') return undefined;
  return (data as Record<string, unknown>)[key];
}

function filterRows(rows: Rows, term: string): Rows {
  if (!term) return rows;
  const needle = term.toLowerCase();
  return rows.filter((row: Row) =>
    SEARCHABLE.some((field) => String(row?.[field] ?? '').toLowerCase().includes(needle))
  );
}

/** Saves a returned Blob to disk without leaving a stale object URL behind. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default DashboardPage;
