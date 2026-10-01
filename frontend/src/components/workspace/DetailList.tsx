import type { ReactNode } from 'react';

/**
 * Definition list for record drawers.
 *
 * Fields are descriptors with an `of(record)` guard so a drawer can describe
 * the full shape of a record while only rendering the parts the API actually
 * returned. Without the guard every optional field would print an em-dash.
 */
/** A record as the drawer receives it: the API may return any subset of fields. */
export type DetailRecord = Record<string, unknown>;

/** One labelled row, with guards for both presence and rendering. */
export interface DetailField<T = DetailRecord> {
  key: string;
  label: string;
  /** True when the API actually returned this field, so no em-dashes. */
  of: (record: T) => boolean;
  render: (record: T) => ReactNode;
}

/** Props for {@link DetailList}. */
export interface DetailListProps<T = DetailRecord> {
  record: T;
  fields: DetailField<T>[];
}

export function DetailList<T = DetailRecord>({ record, fields }: DetailListProps<T>) {
  return (
    <dl className="detail-list">
      {fields
        .filter((field) => field.of(record))
        .map((field) => (
          <div key={field.key}>
            <dt>{field.label}</dt>
            <dd>{field.render(record)}</dd>
          </div>
        ))}
    </dl>
  );
}

export default DetailList;
