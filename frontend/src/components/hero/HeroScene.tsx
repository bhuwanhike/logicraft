import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useHeroMode } from './useHeroMode';
import { HeroFallback } from './fallback/HeroFallback';
import { HeroErrorBoundary } from './HeroErrorBoundary';
import { PosterFrame } from './PosterFrame';
import type { HeroMode } from './useHeroMode';
import './hero.css';

/** Props for HeroScene. All callbacks are optional. */
export interface HeroSceneProps {
  onCopy?: () => void;
  onModeChange?: (mode: HeroMode) => void;
  onIncident?: () => void;
}

// The 3D bundle (three + r3f + postprocessing) is only fetched once the poster
// frame is on screen and the device has been cleared for it.
const HeroScene3D = lazy(() => import('./HeroScene3D').then((m) => ({ default: m.HeroScene3D })));

/**
 * Picks a renderer and drives its lifecycle.
 *
 *   static — prefers-reduced-motion: inert split illustration.
 *   lite   — low-power device: animated SVG playback of the same story.
 *   full   — React Three Fiber scene, lazy-loaded behind the poster frame.
 *
 * Replay is driven by a single `replayToken` counter so the timeline can only
 * ever be restarted from one place.
 */
export function HeroScene({ onCopy, onModeChange, onIncident }: HeroSceneProps) {
  const mode = useHeroMode();
  const [replayToken, setReplayToken] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneCrashed, setSceneCrashed] = useState(false);
  const copyFired = useRef(false);
  const wasHidden = useRef(false);

  useEffect(() => {
    if (mode !== 'pending') onModeChange?.(mode);
  }, [mode, onModeChange]);

  // A crash sends us down the GPU-free path and tells the parent, so the copy
  // and the alert still appear exactly as they do in lite mode.
  useEffect(() => {
    if (sceneCrashed) onModeChange?.('lite');
  }, [sceneCrashed, onModeChange]);

  useEffect(() => {
    const handler = () => {
      copyFired.current = false;
      setReplayToken((n) => n + 1);
    };
    window.addEventListener('hero-replay', handler);
    return () => window.removeEventListener('hero-replay', handler);
  }, []);

  // Replay when the hero comes back into view — but only after it has actually
  // left, so the observer's first tick cannot restart a scene still playing.
  useEffect(() => {
    if (mode !== 'full' || typeof IntersectionObserver === 'undefined') return undefined;
    const el = document.querySelector('.landing-hero');
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        if (!entry.isIntersecting) {
          wasHidden.current = true;
          return;
        }
        if (wasHidden.current) {
          wasHidden.current = false;
          copyFired.current = false;
          setReplayToken((n) => n + 1);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  const revealCopy = useCallback(() => {
    if (copyFired.current) return;
    copyFired.current = true;
    onCopy?.();
  }, [onCopy]);

  const handleSceneCrash = useCallback(() => {
    setSceneReady(true);
    setSceneCrashed(true);
  }, []);

  if (mode === 'pending') return <PosterFrame />;

  if (mode === 'static') {
    // Nothing to reveal — LandingHero shows the copy as soon as it hears the mode.
    return <HeroFallback mode="static" onIncident={onIncident} />;
  }

  const lite = <HeroFallback mode="animated" replayToken={replayToken} onCopy={revealCopy} onIncident={onIncident} />;

  if (mode === 'lite' || sceneCrashed) return lite;

  return (
    <div className="hero-canvas">
      <HeroErrorBoundary onError={handleSceneCrash} fallback={lite}>
        <Suspense fallback={<PosterFrame />}>
          <HeroScene3D
            quality="high"
            replayToken={replayToken}
            onReady={() => setSceneReady(true)}
            onCopy={revealCopy}
            onIncident={onIncident}
          />
        </Suspense>
      </HeroErrorBoundary>
      <PosterFrame hidden={sceneReady} />
    </div>
  );
}
