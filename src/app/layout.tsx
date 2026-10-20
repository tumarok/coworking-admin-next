import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { connection } from 'next/server';
import { headers } from 'next/headers';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Coworking Admin', template: '%s · Coworking Admin' },
  description: 'Admin panel for a network of coworking spaces',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Render per request: the CSP nonce is made for each one and a prerendered page would not have it.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    // The theme script sets the `dark` class on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning className={cn('h-full antialiased', geist.variable)}>
      <body className="min-h-full font-sans">
        <Providers {...(nonce && { nonce })}>{children}</Providers>
      </body>
    </html>
  );
}
