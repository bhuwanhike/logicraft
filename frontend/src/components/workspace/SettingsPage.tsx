import { useState } from 'react';
import { Building2, Lock, Plus, ScrollText, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useCollection } from '../../hooks/useCollection';
import { DataPanel } from '../common/DataPanel';
import { ResourceState } from '../common/ResourceState';
import { SortableTableView } from '../common/SortableTable';
import { Modal } from '../common/Overlay';
import { useWorkspace } from '../../state/WorkspaceContext';
import {StatusPill, formatDate, text} from './format';
import type { Row } from '../../types';
import type { UseCollectionResult } from '../../types';
import type { Column } from '../common/SortableTable';
import type { TabDescriptor } from '../common/DataPanel';
import type { ToastTone } from '../../types';

const TABS: TabDescriptor[] = [

  { id: 'organisation', label: 'Organisation' },
  { id: 'users', label: 'Users & roles' },
  { id: 'audit', label: 'Audit log' }
];

/** Permission matrix. Rows are capabilities, not users, so it reads as a policy. */
const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'view', label: 'View data' },
  { key: 'create', label: 'Create records' },
  { key: 'edit', label: 'Edit records' },
  { key: 'dispatch', label: 'Dispatch & assign' },
  { key: 'admin', label: 'Workspace admin' }
];

const USER_COLUMNS: Column[] = [
  { key: 'name', label: 'User', sortable: true, render: (row: Row) => <b>{text(row.name)}</b> },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: true, render: (row: Row) => <span className="pill blue">{text(row.role)}</span> },
  { key: 'status', label: 'Status', sortable: true, render: (row: Row) => <StatusPill status={row.status} /> },
  { key: 'lastActiveAt', label: 'Last active', sortable: true, render: (row: Row) => formatDate(row.lastActiveAt) }
];

const AUDIT_COLUMNS: Column[] = [
  { key: 'at', label: 'When', sortable: true, render: (row: Row) => formatDate(row.at ?? row.createdAt) },
  { key: 'actor', label: 'Actor', sortable: true, render: (row: Row) => <b>{text(row.actorName ?? row.actor)}</b> },
  { key: 'action', label: 'Action', sortable: true },
  { key: 'entityType', label: 'Entity', sortable: true },
  { key: 'entityId', label: 'Reference', sortable: true },
  { key: 'ip', label: 'Source IP', sortable: true }
];

/**
 * Workspace settings.
 *
 * Three concerns, three very different read patterns. The audit log is the
 * important one: it is strictly read-only, and there is deliberately no edit or
 * delete affordance anywhere in this component, because an audit trail that
 * can be edited is not one.
 */
export function SettingsPage() {
  const { notify } = useWorkspace();
  const [tab, setTab] = useState<string>('organisation');
  const [inviting, setInviting] = useState(false);

  const users = useCollection(api.users.list, {}, { enabled: tab === 'users' });
  const audit = useCollection(api.auditLogs.list, {}, { enabled: tab === 'audit' });
  const vehicles = useCollection(api.vehicles.list, {}, { enabled: tab === 'organisation' });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>Settings</h1>
          <p>Organisation profile, access control, and the audit trail.</p>
        </div>
        {tab === 'users' && (
          <div className="heading-actions">
            <button type="button" className="button primary" onClick={() => setInviting(true)}>
              <Plus size={16} /> Invite user
            </button>
          </div>
        )}
      </div>

      <DataPanel title="Workspace settings" tabs={TABS} activeTab={tab} onTabChange={setTab} query="" setQuery={undefined}>
        {tab === 'organisation' && <Organisation vehicles={vehicles} onNotify={notify} />}
        {tab === 'users' && <UsersPanel users={users} onNotify={notify} />}
        {tab === 'audit' && <AuditPanel audit={audit} />}
      </DataPanel>

      {inviting && (
        <Modal
          title="Invite user"
          description="Grant access to this workspace."
          onClose={() => setInviting(false)}
          size="sm"
          footer={
            <>
              <button type="button" className="button" onClick={() => setInviting(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify('Invites need a writable identity service.', 'info');
                  setInviting(false);
                }}
              >
                Send invite
              </button>
            </>
          }
        >
          <label className="field">
            <span>Email</span>
            <input type="email" placeholder="colleague@company.com" />
          </label>
          <label className="field">
            <span>Role</span>
            <select defaultValue="">
              <option value="" disabled>
                Select a role
              </option>
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}

/** Props for {@link Organisation}. */
interface OrganisationProps {
  vehicles: UseCollectionResult;
  onNotify: (message: string, tone?: ToastTone) => void;
}

function Organisation({ vehicles, onNotify }: OrganisationProps) {
  const connected = vehicles.status;

  return (
    <div className="settings-grid">
      <section className="panel settings-card">
        <header>
          <Building2 size={16} aria-hidden="true" />
          <h2>Organisation profile</h2>
        </header>
        <label className="field">
          <span>Organisation name</span>
          <input type="text" placeholder="Registered organisation name" />
        </label>
        <label className="field">
          <span>Primary timezone</span>
          <select defaultValue="">
            <option value="" disabled>
              Select a timezone
            </option>
          </select>
        </label>
        <label className="field">
          <span>Distance unit</span>
          <select defaultValue="km">
            <option value="km">Kilometres</option>
            <option value="mi">Miles</option>
          </select>
        </label>
        <button
          type="button"
          className="button primary"
          onClick={() => onNotify('Organisation changes need a writable API.', 'info')}
        >
          Save changes
        </button>
      </section>

      <section className="panel settings-card">
        <header>
          <ShieldCheck size={16} aria-hidden="true" />
          <h2>Data connections</h2>
        </header>
        <p className="card-note">
          Every module in this workspace reads from a service. Until a service is connected its module shows
          an empty state rather than sample data.
        </p>
        <ul className="connection-list">
          <li>
            <span>Fleet &amp; telemetry</span>
            <em className={connected === 'ready' ? 'ok' : 'off'}>
              {connected === 'ready' ? 'Connected' : 'Not connected'}
            </em>
          </li>
          <li>
            <span>Shipments</span>
            <em className="off">Not connected</em>
          </li>
          <li>
            <span>Warehouse</span>
            <em className="off">Not connected</em>
          </li>
          <li>
            <span>Identity &amp; roles</span>
            <em className="off">Not connected</em>
          </li>
        </ul>
      </section>

      <section className="panel settings-card">
        <header>
          <Lock size={16} aria-hidden="true" />
          <h2>Access policy</h2>
        </header>
        <p className="card-note">Capabilities granted to each role in this workspace.</p>
        <table className="permission-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Viewer</th>
              <th>Operator</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.key}>
                <td>{p.label}</td>
                <td>{p.key === 'view' ? <CheckMark /> : <Dash />}</td>
                <td>{p.key === 'admin' ? <Dash /> : <CheckMark />}</td>
                <td><CheckMark /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** Props for {@link UsersPanel}. */
interface UsersPanelProps {
  users: UseCollectionResult;
  onNotify: (message: string, tone?: ToastTone) => void;
}

function UsersPanel({ users, onNotify }: UsersPanelProps) {
  return (
    <ResourceState
      state={users}
      noun="users"
      onRetry={users.refetch}
      cta={
        <button type="button" className="button primary" onClick={() => onNotify('Invites need a writable identity service.', 'info')}>
          <Plus size={15} /> Invite the first user
        </button>
      }
    >
      <SortableTableView columns={USER_COLUMNS} rows={users.data} initialSortKey="name" />
    </ResourceState>
  );
}

/** Props for {@link AuditPanel}. */
interface AuditPanelProps {
  audit: UseCollectionResult;
}

function AuditPanel({ audit }: AuditPanelProps) {
  return (
    <div className="audit-wrap">
      <p className="audit-note">
        <ScrollText size={13} aria-hidden="true" />
        Append-only. Entries cannot be edited or deleted, by design.
      </p>
      <ResourceState
        state={audit}
        noun="audit entries"
        onRetry={audit.refetch}
        cta={
          <button type="button" className="button" onClick={() => window.print()}>
            Print current view
          </button>
        }
      >
        <SortableTableView columns={AUDIT_COLUMNS} rows={audit.data} initialSortKey="at" />
      </ResourceState>
    </div>
  );
}

function CheckMark() {
  return (
    <span className="perm yes" aria-label="Granted">
      ✓
    </span>
  );
}

function Dash() {
  return (
    <span className="perm no" aria-label="Not granted">
      —
    </span>
  );
}
