'use client';

// Keep this import first: it configures Zod before any schema runs in the browser.
import '@/lib/zod-config';
import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { getQueryClient } from '@/lib/query-client';

/**
 * `nonce` goes to the inline script that sets the theme class before the first paint; the CSP only
 * runs scripts that carry the nonce of the request.
 */
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...(nonce && { nonce })}
    >
      <QueryClientProvider client={getQueryClient()}>
        <NuqsAdapter>
          {children}
          <Toaster position="top-right" />
        </NuqsAdapter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
