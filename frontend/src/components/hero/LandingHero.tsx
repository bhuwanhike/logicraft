import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { HeroScene } from './HeroScene';
import { ALERT, BEATS, COPY_REVEAL_DELAY } from './hero.constants';
import './hero.css';

const EYEBROW = 'Real-time Logistics OS';

/** Callbacks the landing page hands down to the hero. */
export interface LandingHeroProps {
  onEnterApp: () => void;
  onSignUp: () => void;
  onViewPlans: () => void;
}

export function LandingHero({ onEnterApp, onSignUp, onViewPlans }: LandingHeroProps) {
  const [showCopy, setShowCopy] = useState(false);
  const [mode, setMode] = useState('pending');
  const [incidentFired, setIncidentFired] = useState(false);
  const incidentDone = useRef(false);

  const revealCopy = useCallback(() => setShowCopy(true), []);

  // The alert belongs to the crash, so it is only ever released by the renderers
  // reaching the incident beat. This ref makes that a one-way door.
  const handleIncident = useCallback(() => {
    if (incidentDone.current) return;
    incidentDone.current = true;
    setIncidentFired(true);
  }, []);

  const handleModeChange = useCallback((next: string) => {
    setMode(next);
    // No 3D and no timeline, so the copy is on screen as soon as the mode is
    // known. The toast is left to the incident, not to this callback.
    if (next === 'static' || next === 'lite') setShowCopy(true);
  }, []);

  // The headline is the first thing a visitor reads, so it reveals itself a beat
  // after landing rather than waiting on the story to hand it over.
  useEffect(() => {
    const timer = setTimeout(() => setShowCopy(true), COPY_REVEAL_DELAY * 1000);
    return () => clearTimeout(timer);
  }, []);

  // Watchdog: if no renderer ever reaches the crash (a WebGL context that dies
  // before the first frame, a tab restored from bfcache) the alert still shows,
  // but only well after the beat it is supposed to belong to.
  useEffect(() => {
    const timer = setTimeout(handleIncident, (BEATS.incident + 2.5) * 1000);
    return () => clearTimeout(timer);
  }, [handleIncident]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      setMode((current) => (current === 'static' ? 'full' : current));
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const isStatic = mode === 'static';
  const interactive = showCopy || isStatic;

  return (
    <section className="landing-hero">
      <HeroScene onCopy={revealCopy} onModeChange={handleModeChange} onIncident={handleIncident} />

      <div className={`hero-overlay ${interactive ? 'visible' : ''} ${isStatic ? 'hero-overlay-static' : ''}`}>
        <div className="hero-copy">
          <div className="eyebrow hero-reveal">
            <span className="pulse-dot" />
            {EYEBROW}
          </div>

          <h1>
            <span className="hero-line hero-reveal">One blind spot is all it takes.</span>
            <span className="hero-line hero-line-accent hero-reveal">One dashboard is all you need.</span>
          </h1>

          <p className="hero-reveal">
            LogiCraft unifies fleet, shipments, warehousing, and transport into a single real-time control tower — so
            incidents get caught and resolved before they cascade.
          </p>

          <div className="hero-actions hero-reveal">
            <button className="btn-primary" onClick={onSignUp || onEnterApp}>
              Sign up
            </button>
            <button className="btn-secondary" onClick={onViewPlans}>
              View plans
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating incident alert toast anchored on top right with crash shivering and slow zoom pulse */}
      <div className={`hero-toast-anchor ${incidentFired ? 'active' : ''}`}>
        <div className="hero-toast-shiver">
          <div className="hero-alert-preview" aria-label="Example alert">
            <span className="hero-alert-icon" aria-hidden="true">
              !
            </span>
            <span className="hero-alert-body">
              <b>{ALERT.title}</b>
              <small>
                {ALERT.vehicle} · {ALERT.route}
              </small>
            </span>
            <span className="hero-alert-notified">{ALERT.notified}</span>
          </div>
        </div>
      </div>

      {!isStatic && <div className={`hero-scroll-cue ${showCopy ? 'hidden' : ''}`} aria-hidden="true" />}
    </section>
  );
}
