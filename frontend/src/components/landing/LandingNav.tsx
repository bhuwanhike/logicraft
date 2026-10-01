import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { NAV_LINKS } from './landing.constants';

/**
 * Sticky top bar, shared by the landing page and the dedicated pricing page.
 *
 * `variant`:
 *   'overlay' — transparent over the landing hero so the two read as one
 *               surface, then takes a background once scrolled past.
 *   'solid'   — always has a background and border, for pages that are not a
 *               full-bleed hero and so have nothing to blend into.
 *   'compact' — as 'solid', but no section links: brand and the two auth
 *               buttons only. Used on the pricing page, which is a single
 *               self-contained read with nowhere to scroll to.
 *
 * NAV_LINKS mixes in-page sections ({ id }) with a real route ({ path }), so
 * section entries scroll and route entries navigate.
 */
/** Props for {@link LandingNav}. Callbacks are optional so the nav degrades to plain anchors. */
export interface LandingNavProps {
  onEnterApp?: () => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
  variant?: 'overlay' | 'solid' | 'compact';
}

export function LandingNav({ onEnterApp, onSignIn, onSignUp, variant = 'overlay' }: LandingNavProps) {
  const [open, setOpen] = useState(false);
  const [raised, setRaised] = useState(variant === 'solid');

  useEffect(() => {
    if (variant === 'solid') return undefined;
    const onScroll = () => setRaised(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [variant]);

  // A link behind the sheet is not reachable, so close on navigation.
  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => setOpen(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // Undefined ids are possible in the link table; the lookup simply misses and
  // the browser handles the anchor natively, matching the previous behaviour.
  const go = (id: string | undefined) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setOpen(false);
    if (id === undefined) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const compact = variant === 'compact';

  const links = NAV_LINKS.map((link) =>
    link.path ? (
      <Link key={link.path} to={link.path} onClick={() => setOpen(false)}>
        {link.label}
      </Link>
    ) : (
      <a key={link.id} href={`#${link.id}`} onClick={go(link.id)}>
        {link.label}
      </a>
    )
  );

  return (
    <header className={`landing-nav ${raised ? 'is-raised' : ''} is-${variant}`}>
      <a className="landing-brand" href="#top" onClick={go('top')}>
        <BrandLogo />
        <b>
          LogiCraft
          <small>LOGISTICS OS</small>
        </b>
      </a>

      {!compact && (
        <nav className="landing-nav-links" aria-label="Primary">
          {links}
        </nav>
      )}

      <div className="landing-nav-actions">
        <button className="landing-btn landing-btn-ghost" type="button" onClick={onSignIn || onEnterApp}>
          Sign In
        </button>
        <button className="landing-btn landing-btn-primary" type="button" onClick={onSignUp || onEnterApp}>
          Sign up
        </button>
      </div>

      {/* Nothing to put in a sheet on the compact nav, and the auth buttons are
          already visible there, so the toggle is dropped entirely. */}
      {!compact && (
        <>
          <button
            className="landing-nav-toggle"
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>

          {open && (
            <div className="landing-nav-sheet">
              {links}
              <button className="landing-btn landing-btn-primary" type="button" onClick={onSignUp || onEnterApp}>
                Sign up
              </button>
            </div>
          )}
        </>
      )}
    </header>
  );
}
