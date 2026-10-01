import * as THREE from 'three';
import { ALERT, BRAND, STATUS_FLOW } from '../hero.constants';

const W = 1024;
const H = 640;

/** A point in normalised route space, or in pixel space once `toPx` runs. */
type Pt = [number, number];

/** A map pin: [label, normalised x, normalised y, colour]. */
type Pin = [string, number, number, string];

/** A shipment row in the status column: [id, status text, colour]. */
type StatusRow = [string, string, string];

/** A KPI tile in the top strip. `value` is numeric on the count tile. */
interface Kpi {
  label: string;
  value: string | number;
  accent: string;
}

/**
 * Every animated property is a plain number the GSAP timeline writes into.
 * All of them are 0..1 progress values except `clock` (a second-of-day counter).
 */
interface DashboardState {
  wake: number;
  flash: number;
  toast: number;
  actions: number;
  badge: number;
  reroute: number;
  live: number;
  clock: number;
  noise: number;
}

const MAP = { x: 24, y: 76, w: 596, h: 388 };
const COL = { x: 644, y: 76, w: 356 };

/**
 * Paints the LogiCraft control-tower UI onto a 2D canvas that is used as the
 * laptop's screen texture.
 *
 * Every animated property (toast slide, badge swap, route recalculation, idle
 * ticks) is driven by a plain number that the GSAP timeline writes into
 * `state`. Nothing here re-renders React.
 */
export class DashboardScreen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastDraw: number;
  state: DashboardState;
  baseRoute: Pt[];
  fixedRoute: Pt[];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('DashboardScreen: 2D canvas context unavailable');
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.lastDraw = 0;
    this.state = {
      wake: 0,
      flash: 0,
      toast: 0,
      actions: 0,
      badge: 0,
      reroute: 0,
      live: 0,
      clock: 0,
      noise: 0
    };

    this.baseRoute = [
      [0.06, 0.78], [0.2, 0.71], [0.33, 0.66], [0.45, 0.52],
      [0.58, 0.44], [0.7, 0.34], [0.84, 0.22], [0.95, 0.14]
    ];
    this.fixedRoute = [
      [0.45, 0.52], [0.53, 0.36], [0.62, 0.29], [0.72, 0.3], [0.84, 0.22], [0.95, 0.14]
    ];

    this.render(0, true);
  }

  dispose(): void {
    this.texture.dispose();
  }

  /** Called every frame; internally throttled so idle still costs almost nothing. */
  render(time: number, force = false): void {
    const live = this.state.live > 0.01;
    const budget = live ? 1000 / 12 : 1000 / 30;
    if (!force && time - this.lastDraw < budget) return;
    this.lastDraw = time;

    const s = this.state;
    const c = this.ctx;
    c.clearRect(0, 0, W, H);

    if (s.wake <= 0.001) {
      this.texture.needsUpdate = true;
      return;
    }

    c.save();
    c.globalAlpha = Math.min(1, s.wake * 1.4);
    this.drawChrome(c, s);
    this.drawMap(c, s, time);
    this.drawColumn(c, s, time);
    if (s.toast > 0.001) this.drawToast(c, s);
    c.restore();

    if (s.flash > 0.001) {
      c.fillStyle = `rgba(229, 72, 77, ${0.55 * s.flash})`;
      c.fillRect(0, 0, W, H);
    }
    if (s.noise > 0.001) this.drawNoise(c, s);

    this.texture.needsUpdate = true;
  }

  drawChrome(c: CanvasRenderingContext2D, s: DashboardState): void {
    c.fillStyle = '#0b1220';
    c.fillRect(0, 0, W, H);

    c.fillStyle = '#111c30';
    c.fillRect(0, 0, W, 52);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(0, 52, W, 1);

    // Brand mark
    c.save();
    c.translate(26, 16);
    c.rotate(-0.07);
    c.fillStyle = BRAND.blueDeep;
    roundRect(c, 0, 0, 21, 21, 5);
    c.fill();
    c.fillStyle = '#fff';
    c.fillRect(5, 11, 3, 5);
    c.fillRect(9.5, 6, 3, 10);
    c.fillRect(14, 8.5, 3, 7.5);
    c.restore();

    c.fillStyle = '#e6edf8';
    c.font = '700 15px Manrope, sans-serif';
    c.fillText('LogiCraft', 58, 31);
    c.fillStyle = '#64748b';
    c.font = '600 11px DM Sans, sans-serif';
    c.fillText('Control Tower', 140, 31);

    const tabs = ['Overview', 'Fleet', 'Shipments', 'Warehouse', 'Transport'];
    let x = 330;
    c.font = '600 11px DM Sans, sans-serif';
    tabs.forEach((tab, i) => {
      const active = i === 0;
      c.fillStyle = active ? 'rgba(59,130,246,0.16)' : 'transparent';
      if (active) roundRect(c, x - 10, 13, 66, 26, 13), c.fill();
      c.fillStyle = active ? BRAND.blueBright : '#54637a';
      c.fillText(tab, x, 30);
      x += 78;
    });

    this.drawBadge(c, s, W - 150, 14, 136, 24);
  }

  drawBadge(c: CanvasRenderingContext2D, s: DashboardState, x: number, y: number, w: number, h: number): void {
    const idx = Math.min(STATUS_FLOW.length - 1, Math.max(0, Math.round(s.badge)));
    const flow = STATUS_FLOW[idx];
    const next = STATUS_FLOW[Math.min(STATUS_FLOW.length - 1, idx + 1)];
    const frac = Math.min(1, Math.max(0, s.badge - idx));

    roundRect(c, x, y, w, h, 12);
    c.fillStyle = hexA(flow.color, 0.14);
    c.fill();
    c.strokeStyle = hexA(flow.color, 0.5);
    c.lineWidth = 1;
    c.stroke();

    c.beginPath();
    c.arc(x + 16, y + h / 2, 3.4, 0, Math.PI * 2);
    c.fillStyle = flow.color;
    c.fill();

    c.fillStyle = flow.color;
    c.font = '700 10.5px DM Sans, sans-serif';
    c.textAlign = 'center';
    c.fillText(flow.label.toUpperCase(), x + w / 2 + 8, y + h / 2 + 3.5);
    c.textAlign = 'left';

    if (idx < STATUS_FLOW.length - 1 && frac > 0) {
      c.strokeStyle = hexA(next.color, 0.85);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y + h + 3);
      c.lineTo(x + w * frac, y + h + 3);
      c.stroke();
    }
  }

  drawMap(c: CanvasRenderingContext2D, s: DashboardState, time: number): void {
    const { x, y, w, h } = MAP;
    panel(c, x, y, w, h);

    c.save();
    c.beginPath();
    roundRect(c, x, y, w, h, 12);
    c.clip();

    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#0d1728');
    g.addColorStop(1, '#0a1220');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);

    // Street grid
    c.strokeStyle = 'rgba(120, 150, 200, 0.09)';
    c.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const gy = y + 24 + i * ((h - 48) / 8);
      c.beginPath();
      c.moveTo(x, gy);
      c.lineTo(x + w, gy + (i % 2 ? 14 : -9));
      c.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const gx = x + 20 + i * ((w - 40) / 11);
      c.beginPath();
      c.moveTo(gx, y);
      c.lineTo(gx + (i % 3 ? 12 : -8), y + h);
      c.stroke();
    }

    const toPx = ([u, v]: Pt): Pt => [x + u * w, y + v * h];

    // Original route
    strokePath(c, this.baseRoute.map(toPx), 'rgba(96, 165, 250, 0.45)', 3, [6, 7]);

    // Recalculated route
    if (s.reroute > 0.001) {
      const pts = this.fixedRoute.map(toPx);
      strokePath(c, slicePath(pts, easeOutCubic(s.reroute)), BRAND.blueBright, 3.5, null, 'round');
      if (s.reroute > 0.55) {
        const head = slicePath(pts, easeOutCubic((s.reroute - 0.55) / 0.45));
        if (head.length > 1) {
          c.save();
          c.shadowColor = BRAND.blueBright;
          c.shadowBlur = 14;
          strokePath(c, head, '#dbeafe', 2, null, 'round');
          c.restore();
        }
      }
    }

    // Incident marker
    if (s.badge < 2.5) {
      const [ix, iy] = toPx([0.45, 0.52]);
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
      c.beginPath();
      c.arc(ix, iy, 8 + pulse * 7, 0, Math.PI * 2);
      c.strokeStyle = `rgba(229, 72, 77, ${0.5 - pulse * 0.28})`;
      c.lineWidth = 1.5;
      c.stroke();
      c.beginPath();
      c.arc(ix, iy, 4.5, 0, Math.PI * 2);
      c.fillStyle = BRAND.red;
      c.fill();
    }

    // Live vehicle dot
    const prog = s.reroute > 0.02
      ? lerp(0.45, 1, easeInOutCubic(Math.min(1, s.reroute * 1.05)))
      : 0.45;
    const jitter = s.live > 0.5 ? Math.sin(time * 0.0012) * 0.012 : 0;
    const pathPoint = pointOnPath(this.baseRoute.map(toPx), Math.min(1, prog) + jitter * 0.2);
    c.save();
    c.shadowColor = BRAND.blueBright;
    c.shadowBlur = 12 + s.live * 8;
    c.beginPath();
    c.arc(pathPoint[0], pathPoint[1], 4.5, 0, Math.PI * 2);
    c.fillStyle = '#dbeafe';
    c.fill();
    c.restore();

    // Warehouse pins — the "cross-domain awareness" beat
    const pins: Pin[] = [
      ['Warehouse B', 0.72, 0.3, BRAND.green],
      ['Depot A', 0.2, 0.71, BRAND.cool]
    ];
    pins.forEach(([label, u, v, col], i) => {
      const [px, py] = toPx([u, v]);
      const lit = s.actions > (i ? 0.5 : 0.2);
      c.beginPath();
      c.arc(px, py, 3, 0, Math.PI * 2);
      c.fillStyle = lit ? col : 'rgba(120,150,200,0.35)';
      c.fill();
      c.font = '600 9.5px DM Sans, sans-serif';
      c.fillStyle = lit ? 'rgba(226, 236, 250, 0.85)' : 'rgba(120, 150, 200, 0.4)';
      c.fillText(label, px + 8, py + 3);
    });

    c.restore();

    c.fillStyle = 'rgba(226, 236, 250, 0.55)';
    c.font = '600 10px DM Sans, sans-serif';
    c.fillText('LIVE MAP', x + 16, y + 22);
    this.drawBadge(c, s, x + w - 150, y + 10, 136, 22);
  }

  drawColumn(c: CanvasRenderingContext2D, s: DashboardState, time: number): void {
    const { x, y, w } = COL;
    const drift = s.live > 0.5 ? Math.sin(time * 0.0007) : 0;

    // KPI row
    const kpis: Kpi[] = [
      { label: 'ACTIVE FLEET', value: Math.round(128 + drift * 2), accent: BRAND.blueBright },
      { label: 'ON TIME', value: `${(96.4 + drift * 0.3).toFixed(1)}%`, accent: BRAND.green },
      { label: 'OPEN ALERTS', value: String(Math.max(0, Math.round(3 + s.badge * 0 - (s.badge > 2 ? 3 : 0)))), accent: s.badge > 2 ? BRAND.green : BRAND.red }
    ];
    const kw = (w - 16) / 3;
    kpis.forEach((kpi, i) => {
      const kx = x + i * (kw + 8);
      panel(c, kx, y, kw, 76);
      c.fillStyle = '#6b7c96';
      c.font = '600 8.5px DM Sans, sans-serif';
      c.fillText(kpi.label, kx + 12, y + 20);
      c.fillStyle = kpi.accent;
      c.font = '800 21px Manrope, sans-serif';
      c.fillText(String(kpi.value), kx + 12, y + 50);
      c.fillStyle = hexA(kpi.accent, 0.9);
      c.fillRect(kx + 12, y + 60, 18, 2);
    });

    // Shipment status
    const sy = y + 88;
    panel(c, x, sy, w, 150);
    c.fillStyle = 'rgba(226, 236, 250, 0.55)';
    c.font = '600 10px DM Sans, sans-serif';
    c.fillText('SHIPMENT STATUS', x + 14, sy + 22);

    const rows: StatusRow[] = [
      ['SHP-8821', 'En route', BRAND.blueBright],
      ['SHP-8820', 'At Warehouse B', BRAND.green],
      ['SHP-8819', 'Rerouting', s.badge > 0 ? BRAND.amber : BRAND.coolDim]
    ];
    rows.forEach(([id, status, col], i) => {
      const ry = sy + 40 + i * 34;
      c.fillStyle = 'rgba(255,255,255,0.03)';
      roundRect(c, x + 12, ry - 12, w - 24, 26, 7);
      c.fill();
      c.fillStyle = '#cbd8ea';
      c.font = '600 10.5px Manrope, sans-serif';
      c.fillText(id, x + 22, ry + 4);
      c.fillStyle = col;
      c.font = '600 10px DM Sans, sans-serif';
      c.textAlign = 'right';
      c.fillText(status, x + w - 22, ry + 4);
      c.textAlign = 'left';
    });

    // Warehouse widget
    const wy = sy + 162;
    panel(c, x, wy, w, 152);
    c.fillStyle = 'rgba(226, 236, 250, 0.55)';
    c.font = '600 10px DM Sans, sans-serif';
    c.fillText('WAREHOUSE', x + 14, wy + 22);

    const bars = [0.82, 0.64, 0.91, 0.47, 0.73];
    bars.forEach((v, i) => {
      const bx = x + 14 + i * 66;
      const bh = 62 * v;
      c.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(c, bx, wy + 34, 42, 62, 6);
      c.fill();
      const g = c.createLinearGradient(0, wy + 96 - bh, 0, wy + 96);
      g.addColorStop(0, hexA(BRAND.blueBright, 0.95));
      g.addColorStop(1, hexA(BRAND.indigo, 0.5));
      c.fillStyle = g;
      roundRect(c, bx, wy + 96 - bh, 42, bh, 6);
      c.fill();
    });

    c.fillStyle = s.badge > 2 ? BRAND.green : '#6b7c96';
    c.font = '600 9.5px DM Sans, sans-serif';
    c.fillText(s.badge > 2 ? 'Dock 4 reassigned · 6 tasks queued' : 'Dock 4 idle · awaiting dispatch', x + 14, wy + 132);
  }

  drawToast(c: CanvasRenderingContext2D, s: DashboardState): void {
    const t = easeOutBack(Math.min(1, s.toast));
    const w = 400;
    const h = 84;
    const x = (W - w) / 2;
    const y = H - h - 40 + (1 - t) * 40;
    if (t <= 0.001) return;

    c.save();
    c.globalAlpha = Math.min(1, s.toast * 1.6);
    c.shadowColor = 'rgba(0, 0, 0, 0.55)';
    c.shadowBlur = 26;
    c.shadowOffsetY = 10;
    roundRect(c, x, y, w, h, 14);
    c.fillStyle = '#131f33';
    c.fill();
    c.restore();

    c.strokeStyle = hexA(BRAND.red, 0.55 * t);
    c.lineWidth = 1.2;
    roundRect(c, x, y, w, h, 14);
    c.stroke();

    c.fillStyle = BRAND.red;
    c.beginPath();
    c.arc(x + 28, y + 30, 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.font = '800 13px DM Sans, sans-serif';
    c.textAlign = 'center';
    c.fillText('!', x + 28, y + 35);
    c.textAlign = 'left';

    c.fillStyle = '#fff';
    c.font = '800 14px Manrope, sans-serif';
    c.fillText(ALERT.title, x + 48, y + 28);

    c.fillStyle = '#9fb0c8';
    c.font = '500 11.5px DM Sans, sans-serif';
    c.fillText(`${ALERT.vehicle} · ${ALERT.route}`, x + 48, y + 46);

    const aw = c.measureText(ALERT.notified).width + 18;
    c.fillStyle = hexA(BRAND.green, 0.16);
    roundRect(c, x + 48, y + 56, aw, 18, 9);
    c.fill();
    c.fillStyle = BRAND.green;
    c.font = '600 10px DM Sans, sans-serif';
    c.fillText(ALERT.notified, x + 57, y + 69);
  }

  drawNoise(c: CanvasRenderingContext2D, s: DashboardState): void {
    const n = Math.floor(s.noise * 26);
    for (let i = 0; i < n; i++) {
      const y = Math.random() * H;
      c.fillStyle = `rgba(150, 190, 255, ${Math.random() * 0.16 * s.noise})`;
      c.fillRect(0, y, W, Math.random() * 3);
    }
  }
}

/* ---------- drawing helpers ---------- */

function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  c.fillStyle = 'rgba(255,255,255,0.035)';
  roundRect(c, x, y, w, h, 12);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.07)';
  c.lineWidth = 1;
  c.stroke();
}

function strokePath(
  c: CanvasRenderingContext2D,
  pts: Pt[],
  color: string,
  width: number,
  dash?: number[] | null,
  cap?: CanvasLineCap | null
): void {
  if (pts.length < 2) return;
  c.save();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineJoin = 'round';
  c.lineCap = cap || 'butt';
  if (dash) c.setLineDash(dash);
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
  c.restore();
}

function slicePath(pts: Pt[], t: number): Pt[] {
  if (t >= 1) return pts;
  if (t <= 0) return [];
  const segs = pts.slice(0, -1);
  let total = 0;
  const lens = segs.map((p, i) => {
    const l = Math.hypot(pts[i + 1][0] - p[0], pts[i + 1][1] - p[1]);
    total += l;
    return l;
  });
  let want = total * t;
  const out = [pts[0]];
  for (let i = 0; i < segs.length; i++) {
    if (want <= lens[i]) {
      const k = lens[i] ? want / lens[i] : 0;
      out.push([lerp(segs[i][0], pts[i + 1][0], k), lerp(segs[i][1], pts[i + 1][1], k)]);
      return out;
    }
    want -= lens[i];
    out.push(pts[i + 1]);
  }
  return out;
}

function pointOnPath(pts: Pt[], t: number): Pt {
  if (pts.length < 2) return pts[0] || [0, 0];
  const at = Math.min(0.999, Math.max(0, t));
  const idx = Math.floor(at * (pts.length - 1));
  const local = at * (pts.length - 1) - idx;
  return [lerp(pts[idx][0], pts[idx + 1][0], local), lerp(pts[idx][1], pts[idx + 1][1], local)];
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  if (c.roundRect) {
    c.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
