'use client';

import { ErrorView } from '@/components/error-view';

// Catches what the `(app)` layout throws (for example the API being down while the session is
// checked). Errors of a page are caught by `(app)/error.tsx`, which keeps the shell.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorView error={error} retry={retry} />;
}
