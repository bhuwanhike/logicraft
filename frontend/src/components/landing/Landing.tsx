import { LandingHero } from '../hero/LandingHero';
import { LandingNav } from './LandingNav';
import { Capabilities, Metrics, Workflow } from './LandingSections';
import { LandingFooter } from './LandingFooter';
import './landing.css';

/**
 * The marketing page: hero, then the scroll that gives the hero's story some
 * context, then the footer.
 *
 * The hero is deliberately a full viewport with no surrounding chrome, so
 * everything below it reads as a separate, calmer document.
 */
/** Props for {@link Landing}. */
export interface LandingProps {
  onEnterApp: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onViewPlans: () => void;
}

export function Landing({ onEnterApp, onSignIn, onSignUp, onViewPlans }: LandingProps) {
  return (
    <div className="landing-page" id="top">
      <LandingNav onEnterApp={onEnterApp} onSignIn={onSignIn} onSignUp={onSignUp} />

      <main>
        <LandingHero onEnterApp={onEnterApp} onSignUp={onSignUp} onViewPlans={onViewPlans} />

        <div className="landing-body">
          <Workflow />
          <Capabilities />
          <Metrics />
        </div>
      </main>

      <LandingFooter onEnterApp={onEnterApp} />
    </div>
  );
}
