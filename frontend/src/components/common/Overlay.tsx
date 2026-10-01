import { useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';

/** Props shared by Modal and Drawer. */
export interface DialogProps {
  title?: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  /** Maps to a `dialog-*` / `drawer-*` class; empty means the default width. */
  size?: string;
}

/**
 * Focus trap and Escape handling shared by Modal and Drawer.
 * Returns a ref to attach to the panel and a close handler.
 */
function useDialogBehaviour(close: () => void, panelRef: RefObject<HTMLElement | null>): void {
  const previouslyFocused = useRef<Element | null>(null);

  // `close` is a fresh arrow function on every parent render. Depending on it
  // directly would tear down and re-run the effect each time, which re-focuses
  // the first field and yanks the caret out of whatever the user was typing
  // into. Hold it in a ref so the effect only re-runs when the panel changes.
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    // Move focus into the panel so keyboard users are not left behind it.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      // Cycle focus so Tab cannot escape the dialog into the page behind it.
      const items = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]), select, textarea, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [panelRef]);
}

export function Modal({ title, description, onClose, children, footer, size = '' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(onClose, panelRef);

  return (
    <div
      className="overlay"
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`dialog ${size ? `dialog-${size}` : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
      >
        <button className="dialog-close" onClick={onClose} aria-label="Close dialog" type="button">
          <X size={17} />
        </button>
        {title && <h2>{title}</h2>}
        {description && <p>{description}</p>}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-actions">{footer}</div>}
      </div>
    </div>
  );
}

export interface DrawerProps extends DialogProps {
  /** Maps to a `drawer-*` class; empty means the default width. */
  width?: string;
}

export function Drawer({ title, description, onClose, children, footer, width = '' }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  useDialogBehaviour(onClose, panelRef);

  return (
    <div
      className="overlay overlay-drawer"
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className={`drawer ${width ? `drawer-${width}` : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
      >
        <header className="drawer-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          <button className="dialog-close" onClick={onClose} aria-label="Close panel" type="button">
            <X size={17} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
}
