import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { ReactNode } from 'react';
import type { Row } from '../../types';

/** One plotted series: a field on each row, plus optional display overrides. */
export interface Series {
  /** Row field to plot; also the Recharts `dataKey`. */
  key: string;
  /** Legend/name text; defaults to `key`. */
  label?: string;
  /** Overrides the built-in palette entry for this series. */
  color?: string;
}

/** Which Recharts family renders the data. */
export type ChartKind = 'line' | 'area' | 'bar' | 'pie';

/** Props for {@link TrendChart}. */
export interface TrendChartProps {
  data?: Row[];
  /** Row field used for the x/category axis. */
  xKey?: string;
  series?: Series[];
  kind?: ChartKind;
  height?: number;
  stacked?: boolean;
  emptyTitle?: string;
  emptyText?: string;
  emptyAction?: ReactNode;
}


/**
 * Chart wrapper around Recharts.
 *
 * Renders nothing but an explanatory panel when there are no rows, rather than
 * an empty axis frame. A chart with invented series is exactly the failure this
 * codebase is not allowed to have, and an empty grid is close enough to it to
 * be worth avoiding.
 */
export function TrendChart({
  data = [],
  xKey,
  series = [],
  kind = 'line',
  height = 260,
  stacked = false,
  emptyTitle = 'No data to chart',
  emptyText = 'Series appear once a reporting source is connected.',
  emptyAction
}: TrendChartProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="chart-empty" style={{ height }}>
        <b>{emptyTitle}</b>
        <span>{emptyText}</span>
        {emptyAction}
      </div>
    );
  }

  const palette = useMemo(
    () => ['#3978ec', '#17a579', '#efa73b', '#8265d5', '#d96157', '#1b9fb1'],
    []
  );

  const shared = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: -18 }
  };

  const axes = (
    <>
      <CartesianGrid stroke="#eef1f5" vertical={false} />
      <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#97a1ae' }} tickLine={false} axisLine={{ stroke: '#e7ebf1' }} />
      <YAxis tick={{ fontSize: 10, fill: '#97a1ae' }} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontSize: 11, fontWeight: 600 }} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />}
    </>
  );

  if (kind === 'bar') {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...shared} barGap={2}>
            {axes}
            {series.map((s: Series, i: number) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                stackId={stacked ? 'stack' : undefined}
                fill={s.color ?? palette[i % palette.length]}
                radius={stacked ? 0 : [3, 3, 0, 0]}
                maxBarSize={stacked ? 22 : 34}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (kind === 'pie') {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={xKey ?? ''}
              nameKey="name"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (kind === 'area') {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart {...shared}>
            <defs>
              {series.map((s: Series, i: number) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color ?? palette[i % palette.length]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color ?? palette[i % palette.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {series.map((s: Series, i: number) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stackId={stacked ? 'stack' : undefined}
                stroke={s.color ?? palette[i % palette.length]}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...shared}>
          {axes}
          {series.map((s: Series, i: number) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={s.color ?? palette[i % palette.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  fontSize: 11,
  borderRadius: 7,
  border: '1px solid #e4e9f0',
  boxShadow: '0 8px 22px rgba(30,49,74,.12)'
};
