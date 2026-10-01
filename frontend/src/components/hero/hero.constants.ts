/**
 * Shared configuration for the LogiCraft hero experience.
 * The 3D scene, the GSAP timeline and the SVG fallback all read from here so the
 * three renderers can never drift out of sync.
 */

/** A position in 3D scene space: [x, y, z]. */
export type Vec3 = [number, number, number];
/** A panel size in 3D scene space: [width, height]. */
export type Vec2 = [number, number];

/** One of the four disconnected systems shown before the incident. */
export interface Silo {
  id: string;
  label: string;
  sub: string;
  position: Vec3;
  rotation: number;
  size: Vec2;
  pulsePeriod: number;
  phase: number;
  glitchAt: number;
}

export const BRAND = {
  blue: '#3b82f6',
  blueBright: '#60a5fa',
  blueDeep: '#2563eb',
  indigo: '#7c3aed',
  navy: '#0f172a',
  ink: '#0b1220',
  cool: '#7c93b4',
  coolDim: '#4a5f7d',
  amber: '#f2a93b',
  red: '#e5484d',
  green: '#17a579',
  paper: '#f8fafc'
};

/** Total runtime of the five-act sequence, in seconds. */
export const SEQUENCE_DURATION = 7;

/**
 * The hero copy is not part of the story — it must be readable the moment the
 * visitor lands, so it reveals itself on its own short delay instead of waiting
 * for the last act to hand it over.
 */
export const COPY_REVEAL_DELAY = 0.6;

/** Beat names, in the order the sequence plays them. */
export type BeatName =
  | 'fragmented' | 'driveIn' | 'incident' | 'silosGoDark' | 'blindBeat' | 'signal'
  | 'converge' | 'laptopWake' | 'alertFlash' | 'toastIn' | 'actionsIn' | 'reroute'
  | 'dispatchBadge' | 'resolvedBadge' | 'lightsClear' | 'copyIn';

/** Beats used by the GSAP timeline, the copy reveal and the fallback loop. */
export const BEATS: Record<BeatName, number> = {
  fragmented: 0,
  driveIn: 0.3,
  incident: 1.6,
  silosGoDark: 1.78,
  blindBeat: 2.45,
  signal: 2.7,
  converge: 3.15,
  laptopWake: 3.8,
  alertFlash: 4.05,
  toastIn: 4.25,
  actionsIn: 4.55,
  reroute: 5.3,
  dispatchBadge: 5.65,
  resolvedBadge: 6.2,
  lightsClear: 6.4,
  copyIn: 6.6
};

/**
 * The four disconnected systems. Each floats in the background, pulses on its
 * own offset period so nothing feels synchronised, and dies one at a time once
 * the incident occurs — the whole point of the "before" act.
 */
export const SILOS: Silo[] = [
  {
    id: 'fleet',
    label: 'Fleet Tracker',
    sub: 'Last sync 4h ago',
    position: [-7.4, 5.4, -13.5],
    rotation: -0.14,
    size: [4.5, 2.7],
    pulsePeriod: 2.1,
    phase: 0.0,
    glitchAt: 1.8
  },
  {
    id: 'warehouse',
    label: 'Warehouse System',
    sub: 'No API connection',
    position: [-1.9, 7.1, -16.5],
    rotation: 0.09,
    size: [5.0, 2.9],
    pulsePeriod: 2.7,
    phase: 1.3,
    glitchAt: 2.0
  },
  {
    id: 'ticketing',
    label: 'Ticketing Tool',
    sub: 'Manual entry required',
    position: [3.9, 5.8, -14.2],
    rotation: -0.07,
    size: [4.4, 2.6],
    pulsePeriod: 3.3,
    phase: 2.6,
    glitchAt: 2.2
  },
  {
    id: 'spreadsheets',
    label: 'Spreadsheets',
    sub: 'Manual entry required',
    position: [8.6, 7.4, -17.6],
    rotation: 0.13,
    size: [4.2, 2.5],
    pulsePeriod: 2.4,
    phase: 3.9,
    glitchAt: 2.4
  }
];

/** A labelled dot in the converging signal trail. */
export interface Domain {
  label: string;
  color: string;
}

/** Domains that the converging signal gathers up, in trail order. */
export const DOMAINS: Domain[] = [
  { label: 'Fleet', color: BRAND.blueBright },
  { label: 'Shipment', color: '#38bdf8' },
  { label: 'Warehouse', color: BRAND.indigo },
  { label: 'Transport', color: '#22d3ee' }
];

/** The alert copy, kept in one place so canvas + DOM fallbacks never disagree. */
export const ALERT: { title: string; vehicle: string; route: string; notified: string; actions: string[] } = {
  title: 'Incident Detected',
  vehicle: 'Vehicle #LC-204',
  route: 'Route 12',
  notified: 'Warehouse B Notified',
  actions: ['Reassign Route', 'Notify Customer', 'Dispatch Backup']
};

/** One step in the incident status ladder. */
export interface StatusFlowStep {
  label: string;
  color: string;
  at: number;
}

export const STATUS_FLOW: StatusFlowStep[] = [
  { label: 'Incident', color: BRAND.red, at: BEATS.alertFlash },
  { label: 'Response Dispatched', color: BRAND.amber, at: BEATS.dispatchBadge },
  { label: 'Resolved', color: BRAND.green, at: BEATS.resolvedBadge }
];
