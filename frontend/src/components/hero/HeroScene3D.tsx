import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Scene } from './scene/Scene';
import { buildHeroTimeline, createHeroState, resetHeroState } from './heroTimeline';
import { killSilo, reviveSilos } from './textures/panels';
import type { SiloPanel } from './textures/panels';

/** Render quality tier, which decides the DPR range and the initial frame cap. */
export type HeroQuality = 'high' | 'lite';

/** Props for the 3D hero. All callbacks are optional. */
export interface HeroScene3DProps {
  quality: HeroQuality;
  onReady?: () => void;
  onCopy?: () => void;
  onFinish?: () => void;
  /** Bumped by the parent to restart the sequence from the first frame. */
  replayToken?: number;
  onIncident?: () => void;
}

/**
 * The 3D hero. Owns the GSAP timeline, the shared animation state and the frame
 * governor. Mounts lazily behind the poster frame, begins playing on first tick
 * and when the hero re-enters the viewport. Freezes completely when scrolled
 * out of view.
 */
export function HeroScene3D({
  quality,
  onReady,
  onCopy,
  onFinish,
  replayToken = 0,
  onIncident
}: HeroScene3DProps) {
  const state = useMemo(() => createHeroState(), []);
  const panelsRef = useRef<SiloPanel[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const replay = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    resetHeroState(state);
    reviveSilos(panelsRef.current);
    timeline.pause(0);
    timeline.play(0);
  }, [state]);

  /* -------------------------------------------------------------- timeline */
  useEffect(() => {
    const timeline = buildHeroTimeline(state, {
      onSiloGlitch: (i) => killSilo(panelsRef.current[i]),
      onSiloRevive: () => reviveSilos(panelsRef.current),
      onCopy: () => onCopy?.(),
      onComplete: () => onFinish?.(),
      onIncident: () => onIncident?.()
    });
    timelineRef.current = timeline;

    const start = setTimeout(() => timeline.play(0), 140);
    onReady?.();

    return () => {
      clearTimeout(start);
      timeline.kill();
      timelineRef.current = null;
    };
  }, [state, onCopy, onFinish, onReady, onIncident]);

  /* ---------------------------------------------------------------- replay */
  useEffect(() => {
    if (replayToken > 0) replay();
  }, [replayToken, replay]);

  const registerPanels = useCallback((panels: SiloPanel[]) => {
    panelsRef.current = panels;
  }, []);

  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
      frameloop="always"
      gl={{
        antialias: quality === 'high',
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false
      }}
      camera={{ fov: 42, near: 0.1, far: 320, position: [1.6, 5.4, 16.5] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        scene.background = new THREE.Color('#080d18');
      }}
    >
      <FrameGovernor quality={quality} />
      <Scene state={state} quality={quality} registerPanels={registerPanels} />
    </Canvas>
  );
}

/**
 * Hard 60fps cap with an automatic step down to 30fps when frames start running
 * long, and a hard stop whenever the hero is off-screen or the tab is hidden.
 *
 * R3F's own loop is switched off (`frameloop="never"`) and frames are driven
 * manually — the only way to actually *cap* rather than merely chase the
 * refresh rate.
 */
function FrameGovernor({ quality }: { quality: HeroQuality }) {
  const advance = useThree((s) => s.advance);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFrameloop('demand');
      invalidate();
      return undefined;
    }

    let hz = quality === 'high' ? 60 : 30;
    let interval = 1000 / hz;
    let frames = 0;
    let strikes = 0;
    let cost = 16;
    let last = 0;
    let raf = 0;

    setFrameloop('never');

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || !isHeroVisible()) return;
      if (ts - last < interval - 1.5) return;
      last = ts - ((ts - last) % interval);

      const start = performance.now();
      advance(ts);
      cost = cost * 0.9 + (performance.now() - start) * 0.1;

      // Two seconds of consistently long frames and we drop to 30fps instead of
      // letting the whole hero stutter.
      if (++frames % 120 === 0) {
        if (cost > 20 && hz > 30) {
          if (++strikes >= 2) {
            hz = 30;
            interval = 1000 / hz;
            strikes = 0;
          }
        } else {
          strikes = 0;
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFrameloop('always');
    };
  }, [advance, setFrameloop, invalidate, quality]);

  return null;
}

/* Lazily-created, shared visibility probe for the hero section. */
let heroVisible = true;
let probe: IntersectionObserver | null = null;

function isHeroVisible(): boolean {
  if (typeof IntersectionObserver === 'undefined') return true;
  if (!probe) {
    const el = document.querySelector('.landing-hero');
    if (!el) return true;
    heroVisible = false;
    probe = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        heroVisible = entry.isIntersecting;
      },
      { threshold: 0.01 }
    );
    probe.observe(el);
  }
  return heroVisible;
}
