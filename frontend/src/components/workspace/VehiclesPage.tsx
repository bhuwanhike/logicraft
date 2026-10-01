import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, MapPin, Pencil, Plus, Route, Trash2, Wrench } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { DataPanel } from '../common/DataPanel';
import { ResourceState } from '../common/ResourceState';
import { SortableTableView, Pagination } from '../common/SortableTable';
import { Drawer, Modal } from '../common/Overlay';
import { useWorkspace } from '../../state/WorkspaceContext';
import { DetailList } from './DetailList';
import { StatusPill, Meter, flag, formatDate, formatKm, num, text } from './format';
import type { Row } from '../../types';
import type { UseCollectionResult } from '../../types';
import type { Column } from '../common/SortableTable';
import type { FilterOption } from '../common/TableToolbar';

const PAGE_SIZE = 10;

const STATUS_FILTERS: FilterOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'maintenance', label: 'In maintenance' },
  { value: 'out_of_service', label: 'Out of service' }
];

const TYPE_FILTERS: FilterOption[] = [
  { value: 'all', label: 'All types' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'reefer', label: 'Refrigerated' }
];

const COLUMNS: Column[] = [
  { key: 'plate', label: 'Vehicle', sortable: true, render: (row: Row) => <b>{text(row.plate)}</b> },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'status', label: 'Status', sortable: true, render: (row: Row) => <StatusPill status={row.status} /> },
  { key: 'currentDriverName', label: 'Assigned driver', sortable: true },
  {
    key: 'fuelLevel',
    label: 'Fuel',
    sortable: true,
    render: (row: Row) => (num(row.fuelLevel) === null ? '—' : <Meter value={row.fuelLevel} max={100} />)
  },
  { key: 'odometerKm', label: 'Odometer', sortable: true, render: (row: Row) => formatKm(row.odometerKm) },
  { key: 'lastServiceAt', label: 'Last service', sortable: true, render: (row: Row) => formatDate(row.lastServiceAt) },
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

export function VehiclesPage() {
  const navigate = useNavigate();
  const { notify } = useWorkspace();

  const [query, setQuery] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [assigning, setAssigning] = useState<Row | null>(null);
  const [servicing, setServicing] = useState<Row | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const state = useCollection(api.vehicles.list, { q: query, status, type });
  const drivers = useCollection(api.drivers.list, { status: 'available' }, { enabled: Boolean(assigning) });

  const pageCount = Math.max(1, Math.ceil(state.data.length / PAGE_SIZE));
  const visible = state.data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Fleet Management</div>
          <h1>Vehicles</h1>
          <p>Register fleet assets, assign drivers, and schedule maintenance.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add vehicle
          </button>
        </div>
      </div>

      <DataPanel
        title="Fleet"
        count={state.data.length}
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search by plate, VIN, or make"
        filter={status}
        setFilter={setStatus}
        filters={STATUS_FILTERS}
        secondaryFilter={type}
        setSecondaryFilter={setType}
        secondaryFilters={TYPE_FILTERS}
        secondaryLabel="Type"
      >
        <ResourceState
          state={state}
          noun="vehicles"
          onRetry={state.refetch}
          cta={
            <button type="button" className="button primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Register the first vehicle
            </button>
          }
        >
          <SortableTableView columns={COLUMNS} rows={visible} onRowClick={setSelected} />
        </ResourceState>

        <Pagination page={page} pageCount={pageCount} total={state.data.length} noun="vehicles" onPageChange={setPage} />
      </DataPanel>

      {selected && (
        <Drawer
          title={text(selected.plate, 'Vehicle')}
          description={[selected.make, selected.model, selected.year].map((v) => text(v, '')).filter(Boolean).join(' ') || 'Vehicle record'}
          onClose={() => setSelected(null)}
          footer={
            <div className="drawer-actions">
              <button type="button" className="button" onClick={() => setServicing(selected)}>
                <Wrench size={15} /> Log service
              </button>
              <button type="button" className="button" onClick={() => setAssigning(selected)}>
                <Route size={15} /> Assign driver
              </button>
              <button type="button" className="button primary" onClick={() => notify('Editing needs a writable API.', 'info')}>
                <Pencil size={15} /> Edit
              </button>
            </div>
          }
        >
          <DetailList
            record={selected}
            fields={[
              { key: 'status', label: 'Status', of: (r) => flag(r.status), render: (r) => <StatusPill status={r.status} /> },
              { key: 'driver', label: 'Driver', of: (r) => flag(r.currentDriverName), render: (r) => text(r.currentDriverName) },
              { key: 'vin', label: 'VIN', of: (r) => flag(r.vin), render: (r) => text(r.vin) },
              { key: 'fuel', label: 'Fuel level', of: (r) => flag(r.fuelLevel), render: (r) => <Meter value={r.fuelLevel} max={100} /> },
              { key: 'odometer', label: 'Odometer', of: (r) => flag(r.odometerKm), render: (r) => formatKm(r.odometerKm) },
              { key: 'service', label: 'Last service', of: (r) => flag(r.lastServiceAt), render: (r) => formatDate(r.lastServiceAt) },
              { key: 'next', label: 'Next service due', of: (r) => flag(r.nextServiceAt), render: (r) => formatDate(r.nextServiceAt) },
              { key: 'loc', label: 'Last known position', of: (r) => flag(r.locationLabel), render: (r) => <><MapPin size={12} /> {text(r.locationLabel)}</> },
              { key: 'docs', label: 'Documents', of: (r) => (num(r.documentCount) ?? 0) > 0, render: (r) => <><FileText size={12} /> {text(r.documentCount)} on file</> }
            ]}
          />

          <div className="drawer-section">
            <h3>Actions</h3>
            <div className="button-row">
              <button
                type="button"
                className="button danger-ghost"
                onClick={() => {
                  setRemoving(selected);
                  setSelected(null);
                }}
              >
                <Trash2 size={15} /> Remove from fleet
              </button>
            </div>
          </div>
        </Drawer>
      )}

      <AssignDriverModal
        vehicle={assigning}
        drivers={drivers}
        onClose={() => setAssigning(null)}
        onConfirm={() => notify('Assignment needs a writable API.', 'info')}
      />

      {servicing && (
        <Modal
          title="Log maintenance"
          description={`${text(servicing.plate, '')} — record a service event`}
          onClose={() => setServicing(null)}
          size="sm"
          footer={
            <>
              <button type="button" className="button" onClick={() => setServicing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify('Service log needs a writable API.', 'info');
                  setServicing(null);
                }}
              >
                Save service record
              </button>
            </>
          }
        >
          <p className="form-note">
            Service events post to the fleet maintenance endpoint. Until that endpoint exists this form is
            inert by design rather than writing to local storage and pretending to persist.
          </p>
          <label className="field">
            <span>Service type</span>
            <select defaultValue="">
              <option value="" disabled>
                Choose a service type
              </option>
            </select>
          </label>
        </Modal>
      )}

      {removing && (
        <Modal
          title="Remove vehicle"
          onClose={() => setRemoving(null)}
          size="sm"
          footer={
            <>
              <button type="button" className="button" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => {
                  notify('Removal needs a writable API.', 'info');
                  setRemoving(null);
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p className="confirm-body">
            {flag(removing.plate) ? `${text(removing.plate)} will be taken out of service.` : 'This vehicle will be taken out of service.'}{' '}
            Historic trips are retained for audit.
          </p>
        </Modal>
      )}

      {adding && (
        <Modal
          title="Add vehicle"
          description="Register a new asset in the fleet."
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
                  notify('Vehicle creation needs a writable API.', 'info');
                  setAdding(false);
                }}
              >
                Create vehicle
              </button>
            </>
          }
        >
          <p className="form-note">Fields persist once the fleet service is available.</p>
          <label className="field">
            <span>Registration plate</span>
            <input type="text" placeholder="e.g. format used by your region" />
          </label>
          <label className="field">
            <span>Type</span>
            <select defaultValue="">
              <option value="" disabled>
                Choose a type
              </option>
              {TYPE_FILTERS.filter((t) => t.value !== 'all').map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="link" onClick={() => navigate('/settings')}>
            Configure fleet fields in Settings
          </button>
        </Modal>
      )}
    </>
  );
}

/** Props for {@link AssignDriverModal}. */
interface AssignDriverModalProps {
  vehicle: Row | null;
  drivers: UseCollectionResult;
  onClose: () => void;
  onConfirm: () => void;
}

function AssignDriverModal({ vehicle, drivers, onClose, onConfirm }: AssignDriverModalProps) {
  if (!vehicle) return null;
  return (
    <Modal
      title="Assign driver"
      description={`${text(vehicle.plate, 'Vehicle')} — choose an available driver.`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button primary" onClick={onConfirm}>
            Confirm assignment
          </button>
        </>
      }
    >
      <ResourceState state={drivers} noun="available drivers" skeleton="panel" onRetry={drivers.refetch}>
        <label className="field">
          <span>Driver</span>
          <select defaultValue="">
            <option value="" disabled>
              Select a driver
            </option>
            {drivers.data.map((driver: Row) => (
              <option key={text(driver.id, '')} value={text(driver.id, '')}>
                {text(driver.name)}
              </option>
            ))}
          </select>
        </label>
      </ResourceState>
    </Modal>
  );
}
