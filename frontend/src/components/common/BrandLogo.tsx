/**
 * The LogiCraft mark, shared by the landing nav, the app shell sidebar and the
 * auth pages so the artwork and its sizing are defined once.
 *
 * The source is a dark-background square (public/logo2.png) with no alpha, so
 * on a light surface it reads as a dark tile. `variant` sets the tile
 * treatment: 'plain' sits directly on the background, 'framed' adds a hairline
 * so the edge looks intentional on white.
 *
 * Rendered as a bare <span>: the caller supplies the surrounding link or router
 * link, so navigation stays the caller's decision.
 */
import './brand-logo.css';

const MARK_SRC = '/logo.png';

export function BrandLogo({ variant = 'plain', className = '' }) {
  return (
    <span className={`brand-logo brand-logo-${variant} ${className}`.trim()}>
      <img className="brand-logo-mark" src={MARK_SRC} alt="" width="54" height="54" />
    </span>
  );
}
