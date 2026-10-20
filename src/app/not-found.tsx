import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href={ROUTES.dashboard} className={cn(buttonVariants(), 'mt-2')}>
        Back to dashboard
      </Link>
    </main>
  );
}
