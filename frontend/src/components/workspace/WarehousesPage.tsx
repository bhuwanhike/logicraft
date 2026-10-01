import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ScanLine, SlidersHorizontal, Warehouse as WarehouseIcon } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { DataPanel } from '../common/DataPanel';
import { ResourceState } from '../common/ResourceState';
import { SortableTableView, Pagination } from '../common/SortableTable';
import { Drawer, Modal } from '../common/Overlay';
import { useWorkspace } from '../../state/WorkspaceContext';
import type { LucideIcon } from 'lucide-react';
import { DetailList } from './DetailList';
import {StatusPill, flag, formatDate, humanise, num, text} from './format';
import type { Row } from '../../types';
import type { Column } from '../common/SortableTable';
import type { UseCollectionResult } from '../../types';

/** The stock-action modal this page can open, plus the row it applies to. */
interface StockAction {
  kind: 'receive' | 'dispatch' | 'adjust';
  row?: Row;
}

const COLUMNS: Column[] = [
    { key: 'sku', label: 'SKU', sortable: true, render: (row: Row) => <b>{text(row.sku)}</b> },
  { key: 'name', label: 'Item', sortable: true },
  { key: 'zone', label: 'Zone', sortable: true, render: (row) => humanise(row.zone) },
  { key: 'quantity', label: 'On hand', sortable: true, render: (row) => formatQty(row.quantity) },
  { key: 'reorderPoint', label: 'Reorder at', sortable: true, render: (row) => formatQty(row.reorderPoint) },
  {
    key: 'health',
    label: 'Health',
    sortable: true,
      render: (row: Row) => <StockHealth quantity={num(row.quantity)} reorderPoint={num(row.reorderPoint)} />
  },
  { key: 'lastMovementAt', label: 'Last movement', sortable: true, render: (row) => formatDate(row.lastMovementAt) },
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

export function WarehousesPage() {
  const { notify } = useWorkspace();

  const [selected, setSelected] = useState<Row | null>(null);
  const [tab, setTab] = useState<string>('inventory');
  const [action, setAction] = useState<StockAction | null>(null);

  const facilities = useCollection(api.warehouses.list);
  const zones = useCollection(api.zones.list, {}, { enabled: tab === 'zones' });
  const inventory = useCollection(api.inventory.list, {}, { enabled: tab === 'inventory' });

  const facility = facilities.data[0] ?? null;

  const tabs = [
    { id: 'inventory', label: 'Inventory' },
    { id: 'zones', label: 'Zones' },
    { id: 'movements', label: 'Stock movements' }
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Warehouse Operations</div>
          <h1>Warehouses</h1>
          <p>Facility capacity, stock levels, and inbound and dispatch workflows.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button" onClick={() => setAction({ kind: 'receive' })}>
            <ArrowDownToLine size={16} /> Receive
          </button>
          <button type="button" className="button" onClick={() => setAction({ kind: 'dispatch' })}>
            <ArrowUpFromLine size={16} /> Dispatch
          </button>
          <button type="button" className="button primary" onClick={() => setAction({ kind: 'adjust' })}>
            <SlidersHorizontal size={16} /> Adjust
          </button>
        </div>
      </div>

      <FacilityStrip facilities={facilities} />

      <DataPanel
        title={facility ? `${facility.name} — inventory` : 'Inventory'}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        query=""
        setQuery={undefined}
      >
        {tab === 'inventory' && (
          <ResourceState
            state={inventory}
            noun="inventory lines"
            onRetry={inventory.refetch}
            cta={
              <button type="button" className="button primary" onClick={() => setAction({ kind: 'receive' })}>
                <ScanLine size={15} /> Receive stock
              </button>
            }
          >
            <SortableTableView columns={COLUMNS} rows={inventory.data} onRowClick={setSelected} />
            <Pagination
              page={1}
              pageCount={1}
              total={inventory.data.length}
              noun="inventory lines"
              onPageChange={() => {}}
            />
          </ResourceState>
        )}

        {tab === 'zones' && (
          <ResourceState state={zones} noun="zones" onRetry={zones.refetch}>
            <div className="zone-grid">
              {zones.data.map((zone) => (
                <article className="panel zone-card" key={text(zone.id, '')}>
                  <header>
                    <h3>{text(zone.name)}</h3>
                    <StatusPill status={zone.status} />
                  </header>
                    <p>{text(zone.description)}</p>
                  <dl>
                    <div>
                      <dt>Capacity</dt>
                      <dd>{text(zone.usedCapacity)}</dd>
                    </div>
                    <div>
                      <dt>Dock doors</dt>
                      <dd>{text(zone.dockDoors)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </ResourceState>
        )}

        {tab === 'movements' && <MovementsPanel />}
      </DataPanel>

      {selected && (
        <Drawer
          title={text(selected.name ?? selected.sku, 'Inventory line')}
          description={text(selected.sku, '')}
          onClose={() => setSelected(null)}
          footer={
            <div className="drawer-actions">
              <button type="button" className="button" onClick={() => setAction({ kind: 'adjust', row: selected })}>
                <SlidersHorizontal size={15} /> Adjust
              </button>
              <button type="button" className="button primary" onClick={() => setAction({ kind: 'dispatch', row: selected })}>
                <ArrowUpFromLine size={15} /> Dispatch
              </button>
            </div>
          }
        >
          <DetailList
            record={selected}
            fields={[
              { key: 'zone', label: 'Zone', of: (r) => flag(r.zone), render: (r) => humanise(r.zone) },
              { key: 'qty', label: 'On hand', of: (r) => flag(r.quantity), render: (r) => formatQty(r.quantity) },
              { key: 'reserved', label: 'Reserved', of: (r) => flag(r.reservedQuantity), render: (r) => formatQty(r.reservedQuantity) },
              { key: 'reorder', label: 'Reorder point', of: (r) => flag(r.reorderPoint), render: (r) => formatQty(r.reorderPoint) },
              { key: 'bin', label: 'Bin location', of: (r) => flag(r.binLocation), render: (r) => text(r.binLocation) },
              { key: 'last', label: 'Last movement', of: (r) => flag(r.lastMovementAt), render: (r) => formatDate(r.lastMovementAt) }
            ]}
          />
        </Drawer>
      )}

      <StockActionModal action={action} onClose={() => setAction(null)} onConfirm={() => notify('Stock changes need a writable API.', 'info')} />
    </>
  );
}

/** Props for {@link FacilityStrip}. */
interface FacilityStripProps {
  facilities: UseCollectionResult;
}

/** Horizontal capacity strip for each facility. */
function FacilityStrip({ facilities }: FacilityStripProps) {
  if (facilities.isLoading) {
    return (
      <div className="facility-strip" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div className="panel facility-card" key={i}>
            <span className="skeleton skeleton-line" style={{ width: '45%' }} />
            <span className="skeleton skeleton-block" style={{ height: 18 }} />
          </div>
        ))}
      </div>
    );
  }

  if (facilities.isError || facilities.isEmpty) {
    return (
      <div className="panel empty-state is-inline" aria-live="polite">
        <WarehouseIcon size={18} aria-hidden="true" />
        <b>{facilities.isError ? 'No warehouse service connected' : 'No facilities registered'}</b>
        <span>
          {facilities.isError
            ? 'Capacity and inventory panels need the warehouse API.'
            : 'Register a facility to start receiving and dispatching stock.'}
        </span>
      </div>
    );
  }

  return (
    <div className="facility-strip">
      {facilities.data.map((f) => (
        <article className="panel facility-card" key={text(f.id, '')}>
          <header>
            <h3>{text(f.name)}</h3>
            <StatusPill status={f.status} />
          </header>
          <div className="capacity">
            <div className="capacity-bar">
              <i style={{ width: `${clampPct(f.usedCapacity, f.totalCapacity)}%` }} />
            </div>
            <small>
              {text(f.usedCapacity, '0')} / {text(f.totalCapacity, '0')} units
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Stock movement log. Append-only and read-only — corrections go through the
 * adjust flow so the history stays trustworthy.
 */
function MovementsPanel() {
  const movements = useCollection(() => api.inventory.list({ movements: true }), { movements: true });

  return (
    <ResourceState state={movements} noun="stock movements" onRetry={movements.refetch}>
      <ul className="movement-list">
        {movements.data.map((m) => (
          <li key={text(m.id, '')}>
            <Boxes size={14} aria-hidden="true" />
            <div>
              <b>{text(m.description, humanise(m.kind))}</b>
              <small>{text(m.sku)} — {formatDate(m.at ?? m.createdAt)}</small>
            </div>
            <span className={(num(m.delta) ?? 0) >= 0 ? 'delta-up' : 'delta-down'}>
              {(num(m.delta) ?? 0) > 0 ? '+' : ''}
              {text(m.delta)}
            </span>
          </li>
        ))}
      </ul>
    </ResourceState>
  );
}

/** Per-action copy and icon for the stock modal. */
const ACTION_META: Record<StockAction['kind'], { title: string; verb: string; icon: LucideIcon }> = {
  receive: { title: 'Receive stock', verb: 'Receive', icon: ArrowDownToLine },
  dispatch: { title: 'Dispatch stock', verb: 'Dispatch', icon: ArrowUpFromLine },
  adjust: { title: 'Adjust stock', verb: 'Save adjustment', icon: SlidersHorizontal }
};

/** Props for {@link StockActionModal}. */
interface StockActionModalProps {
  action: StockAction | null;
  onClose: () => void;
  onConfirm: () => void;
}

function StockActionModal({ action, onClose, onConfirm }: StockActionModalProps) {
  if (!action) return null;
  const meta = ACTION_META[action.kind];
  const ActionIcon = meta.icon;

  return (
    <Modal
      title={meta.title}
      description={action.row ? `${text(action.row.sku, '')} — ${text(action.row.name, '')}` : 'Applies to the selected facility.'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button primary" onClick={onConfirm}>
            <ActionIcon size={15} /> {meta.verb}
          </button>
        </>
      }
    >
      <p className="form-note">
        Every movement is written to an append-only stock ledger, so an adjustment is auditable rather than
        an edit that erases history.
      </p>
      <label className="field">
        <span>SKU</span>
        <input type="text" placeholder="Search or scan a SKU" />
      </label>
      <label className="field">
        <span>Quantity</span>
        <input type="number" inputMode="numeric" placeholder="0" />
      </label>
      {action.kind === 'receive' && (
        <label className="field">
          <span>Dock door</span>
          <select defaultValue="">
            <option value="" disabled>
              Select a dock
            </option>
          </select>
        </label>
      )}
    </Modal>
  );
}

/** Props for {@link StockHealth}. */
interface StockHealthProps {
  quantity: number | null | undefined;
  reorderPoint: number | null | undefined;
}

function StockHealth({ quantity, reorderPoint }: StockHealthProps) {
  if (quantity === undefined || quantity === null) return <span className="pill slate">Unknown</span>;
  if (reorderPoint !== undefined && reorderPoint !== null && quantity <= reorderPoint) {
    return <span className="pill red">Reorder</span>;
  }
  return <span className="pill green">Healthy</span>;
}

function clampPct(used: unknown, total: unknown): number {
  const u = num(used);
  const t = num(total);
  if (!u || !t) return 0;
  return Math.min(100, Math.max(0, (u / t) * 100));
}

function formatQty(value: unknown): string {
  if (value === undefined || value === null) return '—';
  return Number(value).toLocaleString();
}
