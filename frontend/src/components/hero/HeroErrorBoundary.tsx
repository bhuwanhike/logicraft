import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/** Props for the boundary. */
export interface HeroErrorBoundaryProps {
  children?: ReactNode;
  /** Rendered in place of the children once a crash has been caught. */
  fallback?: ReactNode;
  /** Called with the thrown error so the parent can switch renderers. */
  onError?: (error: Error) => void;
}

interface HeroErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a failure inside the 3D hero from taking down the whole tree.
 *
 * WebGL contexts get lost, drivers reject the requested limits, shader
 * compilation fails on older GPUs — none of those should blank the page. On a
 * crash we hand the story to the 2D SVG renderer, which needs no GPU at all.
 */
export class HeroErrorBoundary extends Component<HeroErrorBoundaryProps, HeroErrorBoundaryState> {
  constructor(props: HeroErrorBoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): HeroErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[hero] 3D scene failed, falling back to 2D', error, info?.componentStack);
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
