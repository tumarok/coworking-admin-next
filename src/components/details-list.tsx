export interface DetailItem {
  label: string;
  /** Empty values are shown as a dash. */
  value: React.ReactNode;
}

/** Label/value pairs of a record, in a responsive grid. */
export function DetailsList({ items }: { items: readonly DetailItem[] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-6 gap-y-4">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {value === null || value === undefined || value === '' ? '—' : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
