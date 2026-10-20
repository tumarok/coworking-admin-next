'use client';

// Replaces the root layout when it fails, so there is no stylesheet or provider here.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center' }} role="alert">
          <h1>Something went wrong</h1>
          {error.digest && <p>Error code: {error.digest}</p>}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
