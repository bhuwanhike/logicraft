import gsap from 'gsap';
import { BEATS, SEQUENCE_DURATION, SILOS } from './hero.constants';

/** Per-silo animation state, one entry per SILOS entry. */
export interface SiloAnim {
  glitch: number;
  dissolve: number;
  opacity: number;
  pulse: number;
}

/** Truck transform + effect intensities, written by the timeline each frame. */
export interface TruckAnim {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  roll: number;
  wheelSpin: number;
  bounce: number;
  hazard: number;
  rattle: number;
  brake: number;
}

/** The laptop screen's own state, separate from the painted screen texture. */
export interface LaptopAnim {
  screenOn: number;
  glowRed: number;
  tone: number;
}

/** The canvas screen texture's animated properties. Mirrors DashboardScreen.state. */
export interface ScreenAnim {
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

/** Camera position, its look-at target, and the field of view. */
export interface CameraAnim {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
}

/**
 * A single mutable bag of numbers describing the whole frame. GSAP writes to it,
 * the `useFrame` loops read from it, and React never re-renders during playback.
 * Keeping it flat (no nested class instances) is what makes the 3D, the poster
 * and the SVG fallback able to share one description of the story.
 */
export interface HeroState {
  t: number;
  /** 0 = fragmented/cool, 1 = unified/warm. The whole visual thesis. */
  tone: number;
  /** The dim, glitchy "nobody knows yet" beat. */
  dim: number;
  ambient: number;
  shake: number;
  /** 0 -> 1 as the signal wavefront expands out of the truck. */
  signal: number;
  signalOpacity: number;
  trail: number;
  trailOpacity: number;
  truck: TruckAnim;
  silos: SiloAnim[];
  laptop: LaptopAnim;
  screen: ScreenAnim;
  camera: CameraAnim;
  finished: boolean;
}

/** Callbacks the timeline fires at named beats. All optional. */
export interface HeroTimelineCallbacks {
  onSiloGlitch?: (index: number) => void;
  onSiloRevive?: () => void;
  onCopy?: () => void;
  onComplete?: () => void;
  onIncident?: () => void;
}

export function createHeroState(): HeroState {
  return {
    t: 0,
    /** 0 = fragmented/cool, 1 = unified/warm. The whole visual thesis. */
    tone: 0,
    /** The dim, glitchy "nobody knows yet" beat. */
    dim: 0,
    ambient: 0,
    shake: 0,
    /** 0 -> 1 as the signal wavefront expands out of the truck. */
    signal: 0,
    signalOpacity: 0,
    trail: 0,
    trailOpacity: 0,
    truck: {
      x: -15,
      y: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
      wheelSpin: 0,
      bounce: 0,
      hazard: 0,
      rattle: 0,
      brake: 0
    },
    silos: SILOS.map(() => ({ glitch: 0, dissolve: 0, opacity: 1, pulse: 0 })),
    laptop: {
      screenOn: 0,
      glowRed: 0,
      tone: 0
    },
    screen: {
      wake: 0,
      flash: 0,
      toast: 0,
      actions: 0,
      badge: 0,
      reroute: 0,
      live: 0,
      clock: 0,
      noise: 0
    },
    camera: { x: 1.6, y: 5.4, z: 16.5, tx: -1.2, ty: 2.9, tz: -1.5, fov: 42 },
    finished: false
  };
}

/** Snap everything back to the opening frame without rebuilding the state object. */
export function resetHeroState(s: HeroState): void {
  s.t = 0;
  s.tone = 0;
  s.dim = 0;
  s.ambient = 0;
  s.shake = 0;
  s.signal = 0;
  s.signalOpacity = 0;
  s.trail = 0;
  s.trailOpacity = 0;
  s.finished = false;
  Object.assign(s.truck, {
    x: -15, y: 0, yaw: 0, pitch: 0, roll: 0,
    wheelSpin: 0, bounce: 0, hazard: 0, rattle: 0, brake: 0
  });
  s.silos.forEach((silo) => Object.assign(silo, { glitch: 0, dissolve: 0, opacity: 1, pulse: 0 }));
  Object.assign(s.laptop, { screenOn: 0, glowRed: 0, tone: 0 });
  Object.assign(s.screen, { wake: 0, flash: 0, toast: 0, actions: 0, badge: 0, reroute: 0, live: 0, clock: 0, noise: 0 });
  Object.assign(s.camera, { x: 1.6, y: 5.4, z: 16.5, tx: -1.2, ty: 2.9, tz: -1.5, fov: 42 });
}

/**
 * The five-act score. Positions are seconds on a single master timeline, so a
 * beat can be retimed in `hero.constants.js` without rewriting any tweens.
 */
export function buildHeroTimeline(
  state: HeroState,
  {
    onSiloGlitch,
    onSiloRevive,
    onCopy,
    onComplete,
    onIncident
  }: HeroTimelineCallbacks = {}
): gsap.core.Timeline {
  const tl = gsap.timeline({
    paused: true,
    onComplete: () => {
      state.finished = true;
      onComplete?.();
    }
  });
  const s = state;

  tl.set(s.screen, { clock: 0 }, 0);

  /* ---------------------------------------------------------------- act 1
     0 – 1.6s  The fragmented world. Wide, slow, nobody talking to anybody. */
  tl.to(s.camera, { z: 15.6, duration: SEQUENCE_DURATION, ease: 'none' }, 0);
  tl.to(s.camera, { x: 1.1, y: 5.1, duration: 1.55, ease: 'sine.inOut' }, 0);
  tl.to(s.camera, { tx: -0.4, ty: 2.7, duration: 1.55, ease: 'sine.inOut' }, 0);

  tl.to(s.truck, { x: 0.6, duration: 1.6, ease: 'none' }, 0);
  tl.to(s.truck, { wheelSpin: 34, duration: 1.6, ease: 'none' }, 0);
  tl.fromTo(s.screen, { noise: 0.35 }, { noise: 0.12, duration: 1.55, ease: 'sine.inOut' }, 0);

  /* ---------------------------------------------------------------- act 2
     1.6 – 2.7s  The blind spot. Hit, then silence while every silo goes dark. */
  const hit = BEATS.incident;

  tl.call(() => onIncident?.(), [], hit);
  tl.set(s, { shake: 1 }, hit);
  tl.to(s, { shake: 0, duration: 0.74, ease: 'power2.out' }, hit);

  // Front end dives, chassis torques, the whole thing rocks back level-ish.
  tl.to(s.truck, { pitch: 0.17, duration: 0.09, ease: 'power3.out' }, hit);
  tl.to(s.truck, { pitch: -0.06, duration: 0.26, ease: 'elastic.out(1, 0.45)' }, hit + 0.09);
  tl.to(s.truck, { roll: 0.12, duration: 0.11, ease: 'power2.out' }, hit + 0.02);
  tl.to(s.truck, { roll: -0.07, duration: 0.33, ease: 'elastic.out(1, 0.5)' }, hit + 0.12);
  tl.to(s.truck, { y: 0.3, duration: 0.08, ease: 'power2.out' }, hit);
  tl.to(s.truck, { y: 0, duration: 0.43, ease: 'bounce.out' }, hit + 0.08);
  tl.to(s.truck, { yaw: 0.1, duration: 0.23, ease: 'power2.out' }, hit + 0.04);
  tl.to(s.truck, { brake: 1, duration: 0.12, ease: 'power2.out' }, hit);

  // Cargo rattles inside the box, then keeps shivering — nobody is coming.
  tl.to(s.truck, { rattle: 1, duration: 0.07, ease: 'none' }, hit);
  tl.to(s.truck, { rattle: 0.22, duration: 0.54, ease: 'power2.out' }, hit + 0.07);

  tl.to(s.truck, { hazard: 1, duration: 0.09, ease: 'steps(1)' }, hit + 0.05);

  // Silo panels glitch and blank, one at a time, in a stagger.
  s.silos.forEach((_, i) => {
    const at = SILOS[i].glitchAt;
    tl.to(s.silos[i], { glitch: 1, duration: 0.11, ease: 'steps(3)' }, at);
    tl.call(() => onSiloGlitch?.(i), [], at + 0.12);
    tl.to(s.silos[i], { glitch: 0, duration: 0.16, ease: 'power2.out' }, at + 0.18);
    tl.to(s.silos[i], { opacity: 0.16, duration: 0.39, ease: 'power2.inOut' }, at + 0.23);
  });

  // The dim, glitchy beat: this is what "nobody knows yet" looks like.
  tl.to(s, { dim: 1, duration: 0.35, ease: 'power2.in' }, BEATS.blindBeat - 0.16);
  tl.to(s.screen, { noise: 0.55, duration: 0.35, ease: 'power2.in' }, BEATS.blindBeat - 0.16);
  tl.to(s.camera, { fov: 39, duration: 0.47, ease: 'sine.inOut' }, hit);

  /* ---------------------------------------------------------------- act 3
     2.7 – 3.8s  The signal. Detection, then four systems collapse into one. */
  const sig = BEATS.signal;

  tl.to(s, { dim: 0, duration: 0.43, ease: 'power2.out' }, sig);
  tl.to(s.screen, { noise: 0, duration: 0.47, ease: 'power2.out' }, sig);
  tl.to(s, { tone: 1, duration: 1.09, ease: 'power2.inOut' }, sig + 0.1);
  tl.to(s, { ambient: 1, duration: 1.09, ease: 'power2.inOut' }, sig + 0.1);
  tl.to(s.camera, { fov: 42.5, duration: 0.7, ease: 'power2.out' }, sig);

  // Heartbeat: three pings, each a full expansion of the wavefront.
  tl.fromTo(s, { signal: 0 }, { signal: 1, duration: 0.97, ease: 'power1.in' }, sig + 0.08);
  tl.to(s, { signalOpacity: 1, duration: 0.09, ease: 'power2.out' }, sig + 0.05);
  tl.to(s, { signalOpacity: 0, duration: 0.7, ease: 'power2.in' }, BEATS.converge);

  // The wavefront sweeps the fragments away as it passes them.
  s.silos.forEach((_, i) => {
    tl.to(s.silos[i], { dissolve: 1, duration: 0.43, ease: 'power2.in' }, sig + 0.16 + i * 0.1);
    tl.to(s.silos[i], { opacity: 0, duration: 0.43, ease: 'power2.in' }, sig + 0.16 + i * 0.1);
  });

  // One signal, streaming right toward the dispatch desk.
  tl.fromTo(s, { trail: 0 }, { trail: 1, duration: 0.74, ease: 'power2.inOut' }, BEATS.converge);
  tl.to(s, { trailOpacity: 1, duration: 0.19, ease: 'power2.out' }, BEATS.converge - 0.08);
  tl.to(s, { trailOpacity: 0.25, duration: 0.47, ease: 'power2.in' }, BEATS.toastIn);

  /* ---------------------------------------------------------------- act 4
     3.8 – 5.0s  The single pane of glass lights up. */
  tl.to(s.laptop, { screenOn: 1, duration: 0.43, ease: 'power2.out' }, BEATS.laptopWake);
  tl.to(s.screen, { wake: 1, duration: 0.47, ease: 'power2.out' }, BEATS.laptopWake);
  tl.to(
    s.camera,
    { x: 2.6, y: 5.0, z: 14.2, tx: 3.2, ty: 2.5, tz: 0.5, duration: 1.17, ease: 'power2.inOut' },
    BEATS.laptopWake - 1.13
  );

  // Red is spent exactly once, briefly.
  tl.to(s.screen, { flash: 1, duration: 0.07, ease: 'power2.out' }, BEATS.alertFlash);
  tl.to(s.screen, { flash: 0, duration: 0.31, ease: 'power2.inOut' }, BEATS.alertFlash + 0.07);
  tl.to(s.laptop, { glowRed: 1, duration: 0.23, ease: 'power2.out' }, BEATS.alertFlash + 0.08);
  tl.to(s.laptop, { glowRed: 0.38, duration: 0.86, ease: 'power2.out' }, BEATS.alertFlash + 0.31);
  tl.to(s.laptop, { glowRed: 0, duration: 0.54, ease: 'power2.inOut' }, BEATS.lightsClear);

  tl.to(s.screen, { toast: 1, duration: 0.39, ease: 'back.out(1.5)' }, BEATS.toastIn);
  tl.to(s.screen, { actions: 1, duration: 0.66, ease: 'power2.out' }, BEATS.actionsIn);

  /* ---------------------------------------------------------------- act 5
     5.0 – 7.0s  Control restored. Reroute, dispatch, resolve. */
  tl.to(s.screen, { reroute: 1, duration: 0.86, ease: 'power2.inOut' }, BEATS.reroute);
  tl.to(s.screen, { badge: 1, duration: 0.27, ease: 'power2.inOut' }, BEATS.dispatchBadge);
  tl.to(s.screen, { badge: 2, duration: 0.31, ease: 'power2.inOut' }, BEATS.resolvedBadge);

  tl.to(s.truck, { hazard: 0, duration: 0.43, ease: 'power2.inOut' }, BEATS.lightsClear);
  tl.to(
    s.truck,
    { pitch: 0, roll: 0, yaw: 0.04, duration: 0.62, ease: 'elastic.out(1, 0.6)' },
    BEATS.resolvedBadge + 0.25
  );
  tl.to(s, { ambient: 1.25, duration: 0.78, ease: 'power2.inOut' }, BEATS.resolvedBadge + 0.25);
  tl.to(s.camera, { z: 14.9, x: 2.3, y: 5.2, duration: 1.09, ease: 'sine.inOut' }, BEATS.reroute - 0.1);

  /* ---------------------------------------------------------------- idle */
  tl.to(s.screen, { live: 1, duration: 0.47, ease: 'power2.out' }, SEQUENCE_DURATION - 0.35);
  tl.call(() => onCopy?.(), [], BEATS.copyIn);
  tl.call(() => onSiloRevive?.(), [], SEQUENCE_DURATION - 0.2);

  return tl;
}

export { SEQUENCE_DURATION };
