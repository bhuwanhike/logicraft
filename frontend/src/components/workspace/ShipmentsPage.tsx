import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Download, Plus, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { useDebouncedValue } from '../../hooks/useUi';
import { DataPanel } from '../common/DataPanel';
import { ResourceState } from '../common/ResourceState';
import { SortableTableView, Pagination } from '../common/SortableTable';
import { Drawer, Modal } from '../common/Overlay';
import { ShipmentStepper } from '../common/Stepper';
import { useWorkspace } from '../../state/WorkspaceContext';
import {StatusPill, flag, formatDate, humanise, num, text} from './format';
import type { Row } from '../../types';
import type { LoadStatus } from '../../types';
import type { Column } from '../common/SortableTable';
import type { TabDescriptor } from '../common/DataPanel';
import type { FilterOption } from '../common/TableToolbar';
import type { Milestone } from '../common/Stepper';

const PAGE_SIZE = 10;

/** Status tabs. Counts are live and 0 rather than absent when a source is connected. */
const TABS: TabDescriptor[] = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Created' },
  { id: 'picked_up', label: 'Picked up' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'exception', label: 'Exception' }
];

const MODE_FILTERS: FilterOption[] = [
  { value: 'all', label: 'All modes' },
  { value: 'road', label: 'Road' },
  { value: 'air', label: 'Air' },
  { value: 'sea', label: 'Sea' }
];

const COLUMNS: Column[] = [
  { key: 'reference', label: 'Shipment', sortable: true, render: (row: Row) => <b>{text(row.reference)}</b> },
  {
    key: 'route',
    label: 'Route',
    sortable: true,
    render: (row: Row) => (
      <span className="route-cell">
        {text(row.origin)} <i>to</i> {text(row.destination)}
      </span>
    )
  },
  { key: 'mode', label: 'Mode', sortable: true, render: (row: Row) => humanise(row.mode) },
  { key: 'status', label: 'Status', sortable: true, render: (row: Row) => <StatusPill status={row.status} /> },
  { key: 'driverName', label: 'Driver', sortable: true },
  { key: 'weightKg', label: 'Weight', sortable: true, render: (row: Row) => (num(row.weightKg) ? `${text(row.weightKg)} kg` : '—') },
  { key: 'eta', label: 'ETA', sortable: true, render: (row: Row) => formatDate(row.eta) },
  {
    key: '_actions',
    label: '',
    render: () => (
      <button type="button" className="link" onClick={(e) => e.stopPropagation()}>
        Open
      </button>
    )
  }
];

export function ShipmentsPage() {
  const { notify } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  // A deep link from the dashboard arrives as ?ref=<reference>. Seeding the
  // search box from it is what makes the link land on the record it promised,
  // rather than on an unfiltered list that quietly ignores the parameter.
  const deepLinkRef = searchParams.get('ref') ?? '';

  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState<string>(deepLinkRef);
  const [mode, setMode] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [exception, setException] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const debouncedQuery = useDebouncedValue(query);

  useEffect(() => setPage(1), [tab, debouncedQuery, mode]);

  // Keep the URL honest: clear the ?ref= once the user edits the filter, so a
  // refresh does not silently re-apply a filter they removed.
  const clearDeepLink = () => {
    if (deepLinkRef && searchParams.has('ref')) {
      const next = new URLSearchParams(searchParams);
      next.delete('ref');
      setSearchParams(next, { replace: true });
    }
  };

  // One request for the filtered list…
  const list = useCollection(api.shipments.list, {
    status: tab === 'all' ? 'all' : tab,
    mode,
    q: debouncedQuery
  });

  // …and one per tab, purely to populate the tab counters. Disabled unless a
  // source responds, since six extra requests per keystroke is not acceptable.
  const counts = useTabCounts(list.status);

  const pageCount = Math.max(1, Math.ceil(list.data.length / PAGE_SIZE));
  const visible = list.data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs = useMemo(
    () => TABS.map((t) => ({ ...t, ...(counts[t.id] !== undefined ? { count: counts[t.id] } : {}) })),
    [counts]
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Shipment Operations</div>
          <h1>Shipments</h1>
          <p>Track consignments from creation through proof of delivery.</p>
          {deepLinkRef && (
            <p className="deep-link-hint">
              Filtered to <b>{deepLinkRef}</b> from the dashboard.
            </p>
          )}
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button"
            onClick={() => notify('Export needs a connected reporting service.', 'info')}
          >
            <Download size={16} /> Export
          </button>
          <button type="button" className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> New shipment
          </button>
        </div>
      </div>

      <DataPanel
        title="Consignments"
        count={list.data.length}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        query={query}
        setQuery={(value) => {
          setQuery(value);
          clearDeepLink();
        }}
        searchPlaceholder="Search by reference, route, or driver"
        filter={mode}
        setFilter={setMode}
        filters={MODE_FILTERS}
      >
        <ResourceState
          state={list}
          noun="shipments"
          onRetry={list.refetch}
          cta={
            <button type="button" className="button primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Create the first shipment
            </button>
          }
        >
          <SortableTableView columns={COLUMNS} rows={visible} onRowClick={setSelected} />
        </ResourceState>

        <Pagination
          page={page}
          pageCount={pageCount}
          total={list.data.length}
          noun="shipments"
          onPageChange={setPage}
        />
      </DataPanel>

      {selected && (
        <Drawer
          title={text(selected.reference, 'Shipment')}
          description={[selected.origin, selected.destination].map((v) => text(v, '')).filter(Boolean).join(' → ')}
          onClose={() => setSelected(null)}
          footer={
            <div className="drawer-actions">
              <button type="button" className="button" onClick={() => setAssigning(true)}>
                <Truck size={15} /> Assign
              </button>
              <button type="button" className="button" onClick={() => notify('Editing needs a writable API.', 'info')}>
                Edit
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => notify('Marking delivered needs a writable API.', 'info')}
              >
                <Check size={15} /> Mark delivered
              </button>
            </div>
          }
        >
          <div className="drawer-section first">
            <h3>Progress</h3>
            <ShipmentStepper status={text(selected.status, '')} milestones={selected.milestones as Milestone[]} />
          </div>

          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusPill status={selected.status} />
              </dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{humanise(selected.mode)}</dd>
            </div>
            {flag(selected.driverName) && (
              <div>
                <dt>Driver</dt>
                <dd>{text(selected.driverName)}</dd>
              </div>
            )}
            {flag(selected.eta) && (
              <div>
                <dt>ETA</dt>
                <dd>{formatDate(selected.eta)}</dd>
              </div>
            )}
          </dl>
        </Drawer>
      )}

      {exception && (
        <Drawer
          title="Report an exception"
          description={text(exception.reference, '')}
          onClose={() => setException(null)}
          width="narrow"
          footer={
            <div className="drawer-actions">
              <button type="button" className="button" onClick={() => setException(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify('Exception reporting needs a writable API.', 'info');
                  setException(null);
                }}
              >
                Log exception
              </button>
            </div>
          }
        >
          <div className="button-row">
            {['Damaged', 'Delayed', 'Lost', 'Refused'].map((kind) => (
              <button key={kind} type="button" className="chip">
                <AlertTriangle size={12} /> {kind}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea rows={4} placeholder="What happened, and what is needed to resolve it?" />
          </label>
        </Drawer>
      )}

      {assigning && (
        <Modal
          title="Assign shipment"
          description="Match this consignment to a driver and vehicle."
          onClose={() => setAssigning(false)}
          size="sm"
          footer={
            <>
              <button type="button" className="button" onClick={() => setAssigning(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify('Assignment needs a writable API.', 'info');
                  setAssigning(false);
                }}
              >
                Assign
              </button>
            </>
          }
        >
          <label className="field">
            <span>Driver</span>
            <select defaultValue="">
              <option value="" disabled>
                Select a driver
              </option>
            </select>
          </label>
          <label className="field">
            <span>Vehicle</span>
            <select defaultValue="">
              <option value="" disabled>
                Select a vehicle
              </option>
            </select>
          </label>
        </Modal>
      )}

      {adding && (
        <Modal
          title="New shipment"
          description="Create a consignment record."
          onClose={() => setAdding(false)}
          footer={
            <>
              <button type="button" className="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify('Shipment creation needs a writable API.', 'info');
                  setAdding(false);
                }}
              >
                Create shipment
              </button>
            </>
          }
        >
          <p className="form-note">Reference numbers are issued by the shipment service, not typed by hand.</p>
          <label className="field">
            <span>Origin</span>
            <input type="text" placeholder="Origin facility or address" />
          </label>
          <label className="field">
            <span>Destination</span>
            <input type="text" placeholder="Destination facility or address" />
          </label>
          <label className="field">
            <span>Mode</span>
            <select defaultValue="road">
              {MODE_FILTERS.filter((m) => m.value !== 'all').map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}

/**
 * Tab counters.
 *
 * They stay absent (so the tab renders with no badge at all) unless the
 * shipment service answers, because six speculative requests that all fail
 * would just delay the page for no information.
 */
function useTabCounts(listStatus: LoadStatus): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (listStatus !== 'ready') {
      setCounts({});
      return undefined;
    }
    const controller = new AbortController();
    Promise.all(
      TABS.map(async (t) => {
        const rows = await api.shipments.list({ status: t.id === 'all' ? 'all' : t.id }, { signal: controller.signal });
        return [t.id, rows.length] as const;
      })
    )
      .then((entries) => {
        if (!controller.signal.aborted) setCounts(Object.fromEntries(entries));
      })
      .catch(() => {});

    return () => controller.abort();
  }, [listStatus]);

  return counts;
}
