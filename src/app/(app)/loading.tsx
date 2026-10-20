import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
      <Spinner />
      <span>Loading…</span>
    </div>
  );
}
