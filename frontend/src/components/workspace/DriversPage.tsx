import { useState } from "react";
import {
  Ban,
  Calendar,
  IdCard,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";
import { api } from "../../services/api";
import { useCollection } from "../../hooks/useCollection";
import { DataPanel } from "../common/DataPanel";
import { ResourceState } from "../common/ResourceState";
import { SortableTableView, Pagination } from "../common/SortableTable";
import { Drawer, Modal } from "../common/Overlay";
import { useWorkspace } from "../../state/WorkspaceContext";
import { DetailList } from "./DetailList";
import { StatusPill, flag, formatDate, num, text } from "./format";
import type { Row } from "../../types";
import type { Column } from "../common/SortableTable";
import type { FilterOption } from "../common/TableToolbar";

const PAGE_SIZE = 10;

const STATUS_FILTERS: FilterOption[] = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "on_route", label: "On route" },
  { value: "off_duty", label: "Off duty" },
  { value: "suspended", label: "Suspended" },
];

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Driver",
    sortable: true,
    render: (row: Row) => <b>{text(row.name)}</b>,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row: Row) => <StatusPill status={row.status} />,
  },
  {
    key: "licenseNumber",
    label: "Licence",
    sortable: true,
    render: (row: Row) => text(row.licenseNumber),
  },
  {
    key: "safetyScore",
    label: "Safety score",
    sortable: true,
    render: (row: Row) =>
      num(row.safetyScore) === null ? "—" : <Score value={row.safetyScore} />,
  },
  {
    key: "rating",
    label: "Rating",
    sortable: true,
    render: (row: Row) => (row.rating ? <Stars value={row.rating} /> : "—"),
  },
  {
    key: "tripsCompleted",
    label: "Trips",
    sortable: true,
    render: (row: Row) => formatNumber(row.tripsCompleted),
  },
  {
    key: "licenseExpiry",
    label: "Licence expiry",
    sortable: true,
    render: (row: Row) => formatDate(row.licenseExpiry),
  },
  {
    key: "_actions",
    label: "",
    render: () => (
      <button
        type="button"
        className="link"
        onClick={(e) => e.stopPropagation()}
      >
        Open
      </button>
    ),
  },
];

export function DriversPage() {
  const { notify } = useWorkspace();

  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [assigning, setAssigning] = useState<Row | null>(null);
  const [disqualifying, setDisqualifying] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const state = useCollection(api.drivers.list, { q: query, status });
  const shipments = useCollection(
    api.shipments.list,
    { unassigned: true },
    { enabled: Boolean(assigning) },
  );

  const pageCount = Math.max(1, Math.ceil(state.data.length / PAGE_SIZE));
  const visible = state.data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">People &amp; Performance</div>
          <h1>Drivers</h1>
          <p>Driver profiles, compliance, assignments, and performance.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => setAdding(true)}
          >
            <Plus size={16} /> Add driver
          </button>
        </div>
      </div>

      <DataPanel
        title="Driver roster"
        count={state.data.length}
        query={query}
        setQuery={setQuery}
        searchPlaceholder="Search by name, licence, or email"
        filter={status}
        setFilter={setStatus}
        filters={STATUS_FILTERS}
      >
        <ResourceState
          state={state}
          noun="drivers"
          onRetry={state.refetch}
          cta={
            <button
              type="button"
              className="button primary"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} /> Add the first driver
            </button>
          }
        >
          <SortableTableView
            columns={COLUMNS}
            rows={visible}
            onRowClick={setSelected}
          />
        </ResourceState>

        <Pagination
          page={page}
          pageCount={pageCount}
          total={state.data.length}
          noun="drivers"
          onPageChange={setPage}
        />
      </DataPanel>

      {selected && (
        <Drawer
          title={text(selected.name, "Driver")}
          description={text(selected.email, "")}
          onClose={() => setSelected(null)}
          footer={
            <div className="drawer-actions">
              <button
                type="button"
                className="button"
                onClick={() => setAssigning(selected)}
              >
                <UserCheck size={15} /> Assign shipment
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => notify("Editing needs a writable API.", "info")}
              >
                Edit profile
              </button>
            </div>
          }
        >
          <DetailList
            record={selected}
            fields={[
              {
                key: "status",
                label: "Status",
                of: (r) => flag(r.status),
                render: (r) => <StatusPill status={r.status} />,
              },
              {
                key: "phone",
                label: "Phone",
                of: (r) => flag(r.phone),
                render: (r) => (
                  <>
                    <Phone size={12} /> {text(r.phone)}
                  </>
                ),
              },
              {
                key: "email",
                label: "Email",
                of: (r) => flag(r.email),
                render: (r) => (
                  <>
                    <Mail size={12} /> {text(r.email)}
                  </>
                ),
              },
              {
                key: "licence",
                label: "Licence number",
                of: (r) => flag(r.licenseNumber),
                render: (r) => (
                  <>
                    <IdCard size={12} /> {text(r.licenseNumber)}
                  </>
                ),
              },
              {
                key: "expiry",
                label: "Licence expiry",
                of: (r) => flag(r.licenseExpiry),
                render: (r) => formatDate(r.licenseExpiry),
              },
              {
                key: "safety",
                label: "Safety score",
                of: (r) => flag(r.safetyScore),
                render: (r) => <Score value={r.safetyScore} />,
              },
              {
                key: "trips",
                label: "Trips completed",
                of: (r) => flag(r.tripsCompleted),
                render: (r) => formatNumber(r.tripsCompleted),
              },
              {
                key: "hours",
                label: "Hours this week",
                of: (r) => flag(r.weeklyHours),
                render: (r) => `${text(r.weeklyHours)} h`,
              },
              {
                key: "cert",
                label: "Certifications",
                of: (r) =>
                  Array.isArray(r.certifications)
                    ? r.certifications.length > 0
                    : false,
                render: (r) => (
                  <>
                    <ShieldCheck size={12} /> {text(r.certifications, "")}
                  </>
                ),
              },
              {
                key: "joined",
                label: "Joined",
                of: (r) => flag(r.joinedAt),
                render: (r) => (
                  <>
                    <Calendar size={12} /> {formatDate(r.joinedAt)}
                  </>
                ),
              },
            ]}
          />

          <div className="drawer-section">
            <h3>Actions</h3>
            <div className="button-row">
              <button
                type="button"
                className="button danger-ghost"
                onClick={() => {
                  setDisqualifying(selected);
                  setSelected(null);
                }}
              >
                <Ban size={15} /> Disqualify driver
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {assigning && (
        <Modal
          title="Assign shipment"
          description={
            assigning
              ? `Choose an unassigned shipment for ${text(assigning.name, "this driver")}.`
              : ""
          }
          onClose={() => setAssigning(null)}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="button"
                onClick={() => setAssigning(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify("Assignment needs a writable API.", "info");
                  setAssigning(null);
                }}
              >
                Assign
              </button>
            </>
          }
        >
          <ResourceState
            state={shipments}
            noun="unassigned shipments"
            onRetry={shipments.refetch}
          >
            <label className="field">
              <span>Shipment</span>
              <select defaultValue="">
                <option value="" disabled>
                  Select a shipment
                </option>
                {shipments.data.map((s: Row) => (
                  <option key={text(s.id, "")} value={text(s.id, "")}>
                    {text(s.reference)} — {text(s.origin)} to{" "}
                    {text(s.destination)}
                  </option>
                ))}
              </select>
            </label>
          </ResourceState>
        </Modal>
      )}

      {disqualifying && (
        <Modal
          title="Disqualify driver"
          onClose={() => setDisqualifying(null)}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="button"
                onClick={() => setDisqualifying(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => {
                  notify("Disqualification needs a writable API.", "info");
                  setDisqualifying(null);
                }}
              >
                Disqualify
              </button>
            </>
          }
        >
          <p className="confirm-body">
            {text(disqualifying.name, "This driver")} will be removed from the
            dispatch pool. Completed trips are retained for audit.
          </p>
        </Modal>
      )}

      {adding && (
        <Modal
          title="Add driver"
          description="Create a driver profile."
          onClose={() => setAdding(false)}
          footer={
            <>
              <button
                type="button"
                className="button"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  notify("Driver creation needs a writable API.", "info");
                  setAdding(false);
                }}
              >
                Create driver
              </button>
            </>
          }
        >
          <p className="form-note">
            Profile fields persist once the driver service is available.
          </p>
          <label className="field">
            <span>Full name</span>
            <input type="text" placeholder="Driver's legal name" />
          </label>
          <label className="field">
            <span>Licence number</span>
            <input type="text" placeholder="Licence identifier" />
          </label>
          <label className="field">
            <span>Licence expiry</span>
            <input type="date" />
          </label>
          <label className="field">
            <span>Status</span>
            <select defaultValue="available">
              {STATUS_FILTERS.filter((f) => f.value !== "all").map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}

/** Props for {@link Score}. */
interface ScoreProps {
  value: unknown;
}

function Score({ value }: ScoreProps) {
  const pct = Math.min(100, Math.max(0, Number(value)));
  return (
    <span
      className={`score ${pct >= 90 ? "good" : pct >= 70 ? "mid" : "poor"}`}
    >
      <b>{pct}</b>/100
    </span>
  );
}

/** Props for {@link Stars}. */
interface StarsProps {
  value: unknown;
}

function Stars({ value }: StarsProps) {
  return (
    <span className="stars" title={`${text(value)} of 5`}>
      <Star size={12} fill="currentColor" /> {Number(value).toFixed(1)}
    </span>
  );
}

function formatNumber(value: unknown): string {
  if (value === undefined || value === null) return "—";
  return Number(value).toLocaleString();
}
