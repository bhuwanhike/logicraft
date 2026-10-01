import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ALERT, BEATS, SILOS } from '../hero.constants';

const VW = 800;
const VH = 500;

/** Props for the top-level fallback picker. */
export interface HeroFallbackProps {
  mode: 'static' | 'animated';
  replayToken?: number;
  onCopy?: () => void;
  onIncident?: () => void;
}

/** Props shared by the two fallback renderers. */
interface FallbackProps {
  replayToken?: number;
  onCopy?: () => void;
  onIncident?: () => void;
}

/** A silo panel's box in the 2D fallback layout. */
interface SiloBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SILO_BOX: SiloBox[] = [
  { x: 40, y: 46, w: 168, h: 78 },
  { x: 228, y: 30, w: 168, h: 78 },
  { x: 416, y: 52, w: 168, h: 78 },
  { x: 604, y: 34, w: 168, h: 78 }
];

/**
 * The 2D fallback.
 *
 *   mode="static"   — prefers-reduced-motion. A frozen split illustration:
 *                     disconnected systems on the left, one dashboard on the
 *                     right. No rAF loop, no transitions, no timers.
 *   mode="animated" — low-power devices. Plays the same five-act story with GSAP
 *                     driving plain SVG nodes. No WebGL, no external assets.
 */
export function HeroFallback({ mode, replayToken, onCopy, onIncident }: HeroFallbackProps) {
  if (mode === 'static') {
    return <StaticFallback onIncident={onIncident} />;
  }
  return <AnimatedFallback replayToken={replayToken} onCopy={onCopy} onIncident={onIncident} />;
}

/* ------------------------------------------------------------- animated --- */

function AnimatedFallback({ replayToken, onCopy, onIncident }: FallbackProps) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ paused: true, onComplete: () => onCopy?.() });
      timeline.current = tl;

      const panels = q('[data-silo]');
      const truck = q('[data-truck]');
      const wheels = q('[data-wheels]');
      const hazards = q('[data-hazard]');
      const wave = q('[data-wave]');
      const rings = q('[data-ring]');
      const trail = q('[data-trail]');
      const head = q('[data-trail-head]');
      const screen = q('[data-screen]');
      const flash = q('[data-flash]');
      const toast = q('[data-toast]');
      const halo = q('[data-halo]');
      const reroute = q('[data-reroute]');
      const statuses = q('[data-status]');
      const ambient = q('[data-ambient]');
      const grade = q('[data-grade]');
      const skyline = q('[data-skyline]');

      /* ------------------------------------------------- act 1 · fragmented */
      tl.fromTo(truck, { x: -150 }, { x: 258, duration: 1.6, ease: 'none' }, 0);
      tl.fromTo(wheels, { rotation: 0 }, { rotation: 700, duration: 1.6, ease: 'none', transformOrigin: '50% 50%' }, 0);
      // Each panel's amber dot breathes on its own period (SMIL), so the four
      // systems never look synchronised. The timeline owns panel opacity.
      panels.forEach((panel) => tl.set(panel, { opacity: 0.95 }, 0));

      /* --------------------------------------------------- act 2 · blind spot */
      const hit = BEATS.incident;
      tl.call(() => onIncident?.(), [], hit);
      tl.add(() => truck.forEach((t) => gsap.set(t, { x: 262 })), hit);
      tl.to(truck, { y: -13, rotation: 7, duration: 0.09, ease: 'power3.out' }, hit);
      tl.to(truck, { y: 0, rotation: -3, duration: 0.39, ease: 'elastic.out(1, 0.45)' }, hit + 0.09);
      tl.to(hazards, { opacity: 1, duration: 0.04 }, hit + 0.04);
      tl.to(hazards, { opacity: 0.12, duration: 0.14, repeat: 5, yoyo: true, ease: 'steps(1)' }, hit + 0.12);
      tl.to(hazards, { opacity: 0, duration: 0.31, ease: 'power2.inOut' }, BEATS.lightsClear);

      panels.forEach((panel, i) => {
        const at = SILOS[i].glitchAt;
        tl.to(panel, { opacity: 0.14, duration: 0.23, ease: 'power2.in' }, at);
        tl.to(panel, { x: '+=8', duration: 0.04, repeat: 3, yoyo: true, ease: 'steps(1)' }, at);
        tl.set(panel, { opacity: 0, x: 0 }, at + 0.39);
      });
      tl.to(grade, { opacity: 0.85, duration: 0.31 }, BEATS.blindBeat - 0.16);

      /* ------------------------------------------------------- act 3 · signal */
      const sig = BEATS.signal;
      tl.to(grade, { opacity: 0, duration: 0.43 }, sig);
      tl.to(ambient, { opacity: 0.45, duration: 1.09 }, sig + 0.1);
      tl.fromTo(wave, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 2.4, duration: 0.97, ease: 'power1.in' }, sig);
      tl.to(wave, { opacity: 0, duration: 0.31 }, BEATS.converge);

      // Rings pulse outward.
      rings.forEach((ring, i) => {
        tl.fromTo(
          ring,
          { r: 8, opacity: 0.9 },
          { r: 70 + i * 25, opacity: 0, duration: 0.7, ease: 'power2.out' },
          sig + 0.12 + i * 0.14
        );
      });

      // Silos dissolve.
      panels.forEach((panel, i) => {
        tl.to(panel, { opacity: 0, duration: 0.31, ease: 'power2.in' }, sig + 0.16 + i * 0.1);
      });

      // Trail streams to the screen.
      tl.fromTo(trail, { strokeDashoffset: 420 }, { strokeDashoffset: 0, duration: 0.74, ease: 'power2.inOut' }, BEATS.converge);
      tl.fromTo(head, { opacity: 0 }, { opacity: 1, duration: 0.15 }, BEATS.converge);
      tl.to(head, { cx: 588, cy: 300, duration: 0.74, ease: 'power2.inOut' }, BEATS.converge);
      tl.to(trail, { opacity: 0, duration: 0.31 }, BEATS.toastIn + 0.1);
      tl.to(head, { opacity: 0, duration: 0.23 }, BEATS.toastIn + 0.1);

      /* ---------------------------------------------------- act 4 · dashboard */
      tl.to(screen, { opacity: 1, duration: 0.47, ease: 'power2.out' }, BEATS.laptopWake);
      tl.to(flash, { opacity: 0.55, duration: 0.06, ease: 'power2.out' }, BEATS.alertFlash);
      tl.to(flash, { opacity: 0, duration: 0.31, ease: 'power2.inOut' }, BEATS.alertFlash + 0.06);
      tl.fromTo(halo, { opacity: 0.85 }, { opacity: 0.3, duration: 0.31, ease: 'power2.out' }, BEATS.alertFlash + 0.08);
      tl.to(halo, { opacity: 0, duration: 0.62 }, BEATS.lightsClear);
      tl.fromTo(toast, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.5)' }, BEATS.toastIn);

      /* ------------------------------------------------ act 5 · orchestration */
      tl.fromTo(reroute, { strokeDashoffset: 160, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.78 }, BEATS.reroute);
      tl.to(truck, { rotation: 0, duration: 0.47, ease: 'power2.out' }, BEATS.resolvedBadge + 0.1);
      tl.to(ambient, { opacity: 0.8, duration: 0.78, ease: 'power2.inOut' }, BEATS.resolvedBadge + 0.25);
      tl.to(skyline, { opacity: 0.55, duration: 0.93 }, BEATS.resolvedBadge + 0.25);

      // Status pill transition.
      statuses.forEach((pill, i) => {
        tl.set(pill, { opacity: i === 0 ? 1 : 0 }, 0);
        if (i === 1) tl.set(pill, { opacity: 1 }, BEATS.dispatchBadge);
        if (i === 2) tl.set(pill, { opacity: 1 }, BEATS.resolvedBadge);
        if (i < 2) {
          tl.set(pill, { opacity: 0 }, i === 0 ? BEATS.dispatchBadge : BEATS.resolvedBadge);
        }
      });
    }, root);

    const tl = timeline.current;
    if (tl) {
      tl.play(0);
    }

    return () => ctx.revert();
  }, [onCopy, onIncident]);

  useEffect(() => {
    if (replayToken !== undefined && replayToken > 0 && timeline.current) {
      timeline.current.restart();
    }
  }, [replayToken]);

  return (
    <div className="hero-fallback-svg" ref={root}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="fb-vignette" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#0f1a2e" stopOpacity="0" />
            <stop offset="65%" stopColor="#080d18" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#050810" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id="fb-road" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a273b" />
            <stop offset="48%" stopColor="#22334d" />
            <stop offset="100%" stopColor="#162234" />
          </linearGradient>
          <linearGradient id="fb-truck-cab" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="fb-truck-box" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <filter id="fb-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={VW} height={VH} fill="#080d18" />

        {/* Ambient background bloom */}
        <ellipse cx="600" cy="280" rx="260" ry="180" fill="#2563eb" opacity="0.1" data-ambient />
        <ellipse cx="260" cy="330" rx="140" ry="70" fill="#e5484d" opacity="0" data-halo />

        {/* Skyline backdrop */}
        <g opacity="0.32" data-skyline>
          <rect x="40" y="160" width="44" height="180" fill="#0f1a2e" />
          <rect x="92" y="120" width="56" height="220" fill="#132038" />
          <rect x="156" y="190" width="38" height="150" fill="#0d1728" />
          <rect x="202" y="140" width="68" height="200" fill="#14233c" />
          <rect x="620" y="110" width="52" height="230" fill="#132038" />
          <rect x="680" y="170" width="46" height="170" fill="#0f1a2e" />
          <rect x="734" y="130" width="60" height="210" fill="#14233c" />
        </g>

        {/* Silos (Act 1 fragments) */}
        {SILO_BOX.map((box, i) => {
          const silo = SILOS[i];
          return (
            <g key={silo.id} data-silo transform={`translate(${box.x}, ${box.y})`}>
              <rect
                width={box.w}
                height={box.h}
                rx="8"
                fill="#0b1424"
                stroke="#1f2d44"
                strokeWidth="1"
                opacity="0.95"
              />
              <circle cx="16" cy="18" r="4.5" fill="#f2a93b">
                <animate
                  attributeName="opacity"
                  values="0.4;1;0.4"
                  dur={`${2.2 + i * 0.4}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <text x="28" y="21" fill="#cbd5e1" fontSize="11" fontWeight="700" fontFamily="DM Sans, sans-serif">
                {silo.label}
              </text>
              <text x="16" y="42" fill="#64748b" fontSize="9" fontFamily="DM Sans, sans-serif">
                STATUS: DISCONNECTED
              </text>
              <rect x="16" y="52" width={box.w - 32} height="3" rx="1.5" fill="#1e293b" />
              <rect x="16" y="52" width={(box.w - 32) * 0.45} height="3" rx="1.5" fill="#f2a93b" opacity="0.6" />
            </g>
          );
        })}

        {/* Road */}
        <rect x="0" y="340" width={VW} height="120" fill="url(#fb-road)" />
        <line x1="0" y1="398" x2={VW} y2="398" stroke="#334155" strokeWidth="2" strokeDasharray="24 18" />

        {/* Pothole / incident zone marker */}
        <ellipse cx="262" cy="402" rx="22" ry="6" fill="#050810" />

        {/* Shockwave + rings */}
        <circle cx="262" cy="385" r="30" fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0" data-wave />
        <circle cx="262" cy="385" r="8" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity="0" data-ring />
        <circle cx="262" cy="385" r="8" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0" data-ring />
        <circle cx="262" cy="385" r="8" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0" data-ring />

        {/* Truck */}
        <g data-truck>
          {/* Shadow */}
          <ellipse cx="80" cy="405" rx="72" ry="7" fill="#04060c" opacity="0.75" />
          {/* Box */}
          <rect x="10" y="328" width="98" height="58" rx="4" fill="url(#fb-truck-box)" stroke="#475569" strokeWidth="1" />
          <line x1="28" y1="332" x2="28" y2="382" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="58" y1="332" x2="58" y2="382" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="88" y1="332" x2="88" y2="382" stroke="#cbd5e1" strokeWidth="1" />
          <text x="20" y="362" fill="#0f172a" fontSize="11" fontWeight="800" fontFamily="DM Sans, sans-serif">
            LOGICRAFT
          </text>
          {/* Cab */}
          <path d="M108 344 L132 344 L144 362 L144 386 L108 386 Z" fill="url(#fb-truck-cab)" />
          {/* Windshield */}
          <path d="M116 348 L130 348 L139 362 L116 362 Z" fill="#93c5fd" opacity="0.85" />
          {/* Headlight */}
          <rect x="142" y="374" width="3" height="6" rx="1" fill="#fef08a" />
          {/* Hazard blinkers */}
          <circle cx="14" cy="334" r="3" fill="#f2a93b" opacity="0" data-hazard />
          <circle cx="142" cy="377" r="3" fill="#f2a93b" opacity="0" data-hazard />
          {/* Wheels */}
          <g data-wheels transform="translate(34, 394)">
            <circle r="12" fill="#0f172a" stroke="#475569" strokeWidth="3" />
            <circle r="4" fill="#94a3b8" />
          </g>
          <g data-wheels transform="translate(86, 394)">
            <circle r="12" fill="#0f172a" stroke="#475569" strokeWidth="3" />
            <circle r="4" fill="#94a3b8" />
          </g>
          <g data-wheels transform="translate(130, 394)">
            <circle r="12" fill="#0f172a" stroke="#475569" strokeWidth="3" />
            <circle r="4" fill="#94a3b8" />
          </g>
        </g>

        {/* Signal stream */}
        <path
          d="M 262 385 C 340 370, 430 320, 588 300"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="3"
          strokeDasharray="420"
          strokeDashoffset="420"
          filter="url(#fb-glow)"
          data-trail
        />
        <circle cx="262" cy="385" r="5" fill="#93c5fd" opacity="0" data-trail-head />

        {/* Act 4 Single Pane of Glass: The unified dashboard */}
        <g data-screen opacity="0" transform="translate(500, 160)">
          {/* Desk glow */}
          <rect x="-16" y="160" width="280" height="8" rx="4" fill="#050810" opacity="0.6" />
          {/* Laptop base */}
          <rect x="12" y="152" width="224" height="8" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          {/* Screen frame */}
          <rect x="22" y="10" width="204" height="142" rx="8" fill="#0b1220" stroke="#334155" strokeWidth="1.5" />
          {/* Screen content */}
          <rect x="28" y="16" width="192" height="130" rx="5" fill="#070c16" />

          {/* Top bar */}
          <rect x="34" y="22" width="180" height="14" rx="3" fill="#0f1a2e" />
          <circle cx="42" cy="29" r="2.5" fill="#3b82f6" />
          <text x="50" y="32" fill="#93c5fd" fontSize="7.5" fontWeight="700" fontFamily="DM Sans, sans-serif">
            LOGICRAFT CONTROL TOWER
          </text>
          <text x="180" y="32" fill="#64748b" fontSize="6.5" fontFamily="DM Sans, sans-serif">
            10:42 UTC
          </text>

          {/* Map canvas with route */}
          <rect x="34" y="40" width="112" height="74" rx="4" fill="#0a1424" stroke="#17263d" strokeWidth="1" />
          {/* Route path original (dashed) */}
          <path d="M 44 96 Q 74 68 104 74 T 136 54" fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 2" />
          {/* Reroute path (drawn in green) */}
          <path
            d="M 44 96 Q 70 88 96 90 T 136 54"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="160"
            strokeDashoffset="160"
            filter="url(#fb-glow)"
            data-reroute
          />
          <circle cx="44" cy="96" r="3" fill="#e5484d" />
          <circle cx="136" cy="54" r="3" fill="#10b981" />

          {/* Right-hand side telemetry */}
          <rect x="150" y="40" width="64" height="74" rx="4" fill="#0d182b" />
          <text x="156" y="52" fill="#64748b" fontSize="6" fontWeight="700" fontFamily="DM Sans, sans-serif">
            INCIDENT RESOLUTION
          </text>

          {/* Status pills (animated switch) */}
          <g data-status opacity="1">
            <rect x="156" y="58" width="52" height="12" rx="3" fill="#e5484d" fillOpacity="0.2" />
            <text x="162" y="66" fill="#fca5a5" fontSize="6.5" fontWeight="700" fontFamily="DM Sans, sans-serif">
              BLIND SPOT
            </text>
          </g>
          <g data-status opacity="0">
            <rect x="156" y="58" width="52" height="12" rx="3" fill="#3b82f6" fillOpacity="0.2" />
            <text x="162" y="66" fill="#93c5fd" fontSize="6.5" fontWeight="700" fontFamily="DM Sans, sans-serif">
              DISPATCHED
            </text>
          </g>
          <g data-status opacity="0">
            <rect x="156" y="58" width="52" height="12" rx="3" fill="#10b981" fillOpacity="0.2" />
            <text x="162" y="66" fill="#86efac" fontSize="6.5" fontWeight="700" fontFamily="DM Sans, sans-serif">
              RESOLVED
            </text>
          </g>

          <text x="156" y="82" fill="#94a3b8" fontSize="6" fontFamily="DM Sans, sans-serif">
            Warehouse B
          </text>
          <text x="156" y="91" fill="#34d399" fontSize="6.5" fontWeight="700" fontFamily="DM Sans, sans-serif">
            +14 min ETA saved
          </text>
          <text x="156" y="103" fill="#64748b" fontSize="5.5" fontFamily="DM Sans, sans-serif">
            Driver ack: OK
          </text>

          {/* Alert toast appearing on top of the dashboard */}
          <g data-toast transform="translate(34, 118)">
            <rect width="180" height="22" rx="4" fill="#0b1426" stroke="#e5484d" strokeWidth="1" />
            <circle cx="11" cy="11" r="5" fill="#e5484d" />
            <text x="11" y="14" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">
              !
            </text>
            <text x="22" y="10" fill="#f8fafc" fontSize="7" fontWeight="700" fontFamily="DM Sans, sans-serif">
              {ALERT.title}
            </text>
            <text x="22" y="18" fill="#94a3b8" fontSize="6" fontFamily="DM Sans, sans-serif">
              {ALERT.vehicle} · {ALERT.notified}
            </text>
          </g>

          {/* Flash layer */}
          <rect x="28" y="16" width="192" height="130" rx="5" fill="#e5484d" opacity="0" data-flash />
        </g>

        {/* Global dim/grade layer for Act 2 */}
        <rect width={VW} height={VH} fill="#050812" opacity="0" data-grade pointerEvents="none" />

        {/* Vignette */}
        <rect width={VW} height={VH} fill="url(#fb-vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- static --- */

function StaticFallback({ onIncident }: FallbackProps) {
  // Nothing animates in this mode, so the alert is released on the same beat the
  // animated renderers use rather than slamming on during the first paint.
  useEffect(() => {
    const timer = setTimeout(() => onIncident?.(), BEATS.incident * 1000);
    return () => clearTimeout(timer);
  }, [onIncident]);

  return (
    <div className="hero-fallback-static">
      <div className="fb-split">
        {/* Left: Disconnected Silos */}
        <div className="fb-side fb-side-before">
          <span className="fb-side-label">Before LogiCraft</span>
          <div className="fb-card fb-card-dead">
            <span className="fb-dot fb-dot-dead" />
            <b>Fleet Telematics</b>
            <small>Isolated sensor stream</small>
          </div>
          <div className="fb-card fb-card-dead">
            <span className="fb-dot fb-dot-dead" />
            <b>Warehouse ERP</b>
            <small>Batch sync every 4h</small>
          </div>
          <div className="fb-card fb-card-dead">
            <span className="fb-dot fb-dot-dead" />
            <b>Dispatch Radio</b>
            <small>Unlogged driver phone calls</small>
          </div>
          <div className="fb-blindspot">
            <i /> Incident occurred: Nobody notified
          </div>
        </div>

        <div className="fb-bridge">
          <svg viewBox="0 0 120 24" fill="none">
            <path d="M 0 12 L 120 12" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 4" />
            <path d="M 112 6 L 120 12 L 112 18" stroke="#3b82f6" strokeWidth="2" fill="none" />
          </svg>
          <span>Unified into one</span>
        </div>

        {/* Right: Unified Control Tower */}
        <div className="fb-side fb-side-after">
          <span className="fb-side-label">With LogiCraft</span>
          <div className="fb-dash">
            <div className="fb-dash-head">
              <span className="fb-mark" />
              <b>Control Tower</b>
              <i className="fb-resolved">Resolved</i>
            </div>
            <div className="fb-dash-body">
              <div className="fb-dash-map">
                <svg viewBox="0 0 140 80">
                  <path d="M 10 70 Q 50 20 80 40 T 130 15" stroke="#334155" strokeWidth="2" fill="none" strokeDasharray="3 3" />
                  <path d="M 10 70 Q 40 60 80 65 T 130 15" stroke="#10b981" strokeWidth="2.5" fill="none" />
                  <circle cx="10" cy="70" r="4" fill="#e5484d" />
                  <circle cx="130" cy="15" r="4" fill="#10b981" />
                </svg>
              </div>
              <div className="fb-dash-kpis">
                <span>Reroute: +14m saved</span>
                <span>Driver: Acknowledged</span>
                <span>Warehouse B: Notified</span>
              </div>
            </div>
            <div className="fb-dash-actions">
              {ALERT.actions.map((action) => (
                <span key={action}>{action}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
