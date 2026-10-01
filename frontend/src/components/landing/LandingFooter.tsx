import type { ReactNode } from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { FOOTER_COLUMNS, FOOTER_LEGAL } from './landing.constants';

/* These destinations are not built yet. They stay focusable for accessibility
   but must not yank the reader back to the top of the page when clicked. */
/** Props for {@link PlaceholderLink}. */
interface PlaceholderLinkProps {
  children: ReactNode;
}

function PlaceholderLink({ children }: PlaceholderLinkProps) {
  return (
    <a href="#top" onClick={(event) => event.preventDefault()}>
      {children}
    </a>
  );
}

/** Props for {@link LandingFooter}. */
export interface LandingFooterProps {
  onEnterApp?: () => void;
}

export function LandingFooter({ onEnterApp }: LandingFooterProps) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <div className="lp-footer-brand">
          <BrandLogo />
          <b>
            LogiCraft
            <small>LOGISTICS OS</small>
          </b>
          <p>
            One real-time control tower for fleet, shipments, warehousing and transport &mdash; so incidents get caught
            and resolved before they cascade.
          </p>
          <button className="lp-btn lp-btn-primary lp-btn-sm" type="button" onClick={onEnterApp}>
            Open the dashboard
          </button>
        </div>

        <div className="lp-footer-columns">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="lp-footer-column">
              <h3>{column.title}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link}>
                    <PlaceholderLink>{link}</PlaceholderLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-footer-bottom">
        <span>&copy; {new Date().getFullYear()} LogiCraft, Inc. All rights reserved.</span>
        <ul className="lp-footer-legal">
          {FOOTER_LEGAL.map((item) => (
            <li key={item}>
              <PlaceholderLink>{item}</PlaceholderLink>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
