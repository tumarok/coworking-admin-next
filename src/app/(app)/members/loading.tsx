import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
