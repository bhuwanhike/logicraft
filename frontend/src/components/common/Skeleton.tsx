import type { CSSProperties } from 'react';

/** Props for the single-block skeleton. */
export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  /** Merged over the generated style, so a caller can override any part. */
  style?: CSSProperties;
}

/** Props for the table-shaped skeleton. */
export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  className = '',
  style = {}
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-pulse ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #edf1f7 25%, #e2e8f2 37%, #edf1f7 63%)',
        backgroundSize: '400% 100%',
        animation: 'skeleton-loading 1.4s ease infinite',
        ...style
      }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: TableSkeletonProps) {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              width={c === 0 ? '90px' : c === 1 ? '160px' : '100%'}
              height="20px"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
