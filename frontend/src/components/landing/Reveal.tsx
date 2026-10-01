import { createElement, useEffect, useRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/**
 * Reveals its children once when they scroll into view.
 *
 * The landing page is a long scroll and the hero already owns the viewer's
 * attention for seven seconds — section content arriving as it is scrolled to
 * keeps the two from competing. Falls back to plain visible content when
 * IntersectionObserver is unavailable or motion is reduced.
 */
/** Props for {@link Reveal}. Any extra props are forwarded to the rendered element. */
export interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, 'className'> {
  as?: ElementType;
  delay?: number;
  className?: string;
  children?: ReactNode;
}

export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.add('is-revealed');
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.classList.add('is-revealed');
        observer.disconnect();
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // createElement keeps the polymorphic tag typed; JSX inference would otherwise
  // collapse the element props to `never`.
  return createElement(
    Tag,
    {
      ref,
      className: `reveal ${className}`.trim(),
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
      ...rest
    },
    children
  );
}
