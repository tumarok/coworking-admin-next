'use client';

import { useEffect } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { IS_DEVELOPMENT } from '@/config/runtime';
import { Button } from '@/components/ui/button';

/**
 * Body of an error page. Development shows the message; production shows only the digest, a code
 * that finds the failure in the server logs without leaking its details.
 */
export function ErrorView({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <TriangleAlertIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {IS_DEVELOPMENT
          ? error.message
          : error.digest
            ? `Error code: ${error.digest}`
            : 'An unexpected error occurred.'}
      </p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
