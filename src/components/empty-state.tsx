import { InboxIcon } from 'lucide-react';

export function EmptyState({
  title,
  children,
}: {
  title: string;
  /** Hint or a call to action under the title. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
