import { useEffect, useState } from 'react';

/** Which of the three hero renderers to mount. */
export type HeroMode = 'pending' | 'static' | 'lite' | 'full';

/**
 * Decides which of the three hero renderers to mount:
 *
 *   'static' — prefers-reduced-motion. A frozen split illustration, no rAF loop.
 *   'lite'   — low-power device or no WebGL. A hand-rolled SVG playback of the
 *              same silo-collapse → dashboard narrative.
 *   'full'   — the React Three Fiber scene.
 *
 * The check runs after mount (never during render) so the server/first paint
 * always shows the lightweight poster instead of guessing wrong.
 */
export function useHeroMode(): HeroMode {
  const [mode, setMode] = useState<HeroMode>('pending');

  useEffect(() => {
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarseQuery = window.matchMedia('(pointer: coarse)');

    const evaluate = () => {
      if (reduceQuery.matches) {
        setMode('static');
        return;
      }
      if (!hasWebGL()) {
        setMode('lite');
        return;
      }
      if (isLowPower() || (coarseQuery.matches && window.innerWidth < 900)) {
        setMode('lite');
        return;
      }
      setMode('full');
    };

    evaluate();
    reduceQuery.addEventListener('change', evaluate);
    return () => reduceQuery.removeEventListener('change', evaluate);
  }, []);

  return mode;
}

function isLowPower(): boolean {
  if (typeof navigator === 'undefined') return false;

  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  if (cores <= 4 || memory <= 4) return true;

  return false;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}
