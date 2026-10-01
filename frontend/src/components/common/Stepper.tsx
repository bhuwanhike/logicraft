import { AlertTriangle, Check, Clock, MapPin, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** The standard shipment flow, in order. */
type FlowStep = 'created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered';

/** Any status the API may report, including the out-of-flow `exception`. */
type MilestoneStatus = FlowStep | 'exception';

/** A milestone as it arrives on the shipment record. */
export interface Milestone {
  status?: string;
  at?: string;
  timestamp?: string;
  location?: string;
  note?: string;
}


const MILESTONE_ICONS: Record<MilestoneStatus, LucideIcon> = {
  created: Package,
  picked_up: MapPin,
  in_transit: Clock,
  out_for_delivery: MapPin,
  delivered: Check,
  exception: AlertTriangle
};

/**
 * Vertical consignment timeline.
 *
 * Milestones come from the shipment record. Which of the standard set have been
 * reached is inferred from the status, so a partially-progressed shipment shows
 * a real stepper rather than a single completed tick.
 */
const FLOW: FlowStep[] = ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

const LABELS: Record<MilestoneStatus, string> = {
  created: 'Created',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Exception'
};

/** Props for {@link ShipmentStepper}. */
export interface ShipmentStepperProps {
  status?: string | null;
  milestones?: Milestone[];
}

export function ShipmentStepper({ status, milestones = [] }: ShipmentStepperProps) {
  const hasException = status === 'exception';
  const reachedIndex = hasException
    ? 1
    : Math.max(0, FLOW.indexOf(normaliseStatus(status) as FlowStep));

  // Server-provided milestones win; anything they do not cover is filled in
  // positionally so the stepper is never shorter than the flow it represents.
  const byStatus = new Map(milestones.map((m) => [normaliseStatus(m?.status), m]));

  return (
    <ol className="stepper">
      {FLOW.map((step, index) => {
        const milestone = byStatus.get(step);
        const done = index <= reachedIndex;
        const current = index === reachedIndex;
        const Icon = MILESTONE_ICONS[step];
        const stamp = milestone?.at ?? milestone?.timestamp ?? null;

        return (
          <li key={step} className={`stepper-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`.trim()}>
            <i aria-hidden="true">
              <Icon size={13} />
            </i>
            <div>
              <b>{LABELS[step]}</b>
              {stamp ? (
                <small>{formatStamp(stamp)}</small>
              ) : (
                <small className="stepper-pending">{current ? 'Awaiting update' : 'Not reached'}</small>
              )}
              {milestone?.location && <small className="stepper-where">{milestone.location}</small>}
            </div>
          </li>
        );
      })}

      {hasException && (
        <li className="stepper-step is-exception is-current">
          <i aria-hidden="true">
            <AlertTriangle size={13} />
          </i>
          <div>
            <b>Exception recorded</b>
            <small>{milestones.find((m) => normaliseStatus(m?.status) === 'exception')?.note ?? 'Under review'}</small>
          </div>
        </li>
      )}
    </ol>
  );
}

function normaliseStatus(status: unknown): string {
  return String(status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

function formatStamp(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Severity levels the API may report. */
export type SeverityLevel = 'critical' | 'warning' | 'info';

/** Props for {@link SeverityBadge}. */
export interface SeverityBadgeProps {
  level?: SeverityLevel | string | null;
}

/** Severity badge. Tones are explicit rather than inferred from wording. */
export function SeverityBadge({ level }: SeverityBadgeProps) {
  const key = String(level ?? 'info');
  const tone = { critical: 'red', warning: 'amber', info: 'blue' }[key] ?? 'blue';
  const label = { critical: 'Critical', warning: 'Warning', info: 'Info' }[key] ?? 'Info';
  return <span className={`pill ${tone}`}>{label}</span>;
}
