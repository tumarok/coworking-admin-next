import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { connection } from 'next/server';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Coworking Admin',
  description: 'Admin panel for a network of coworking spaces',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // The CSP nonce is made per request, so no page may be prerendered at build time.
  await connection();
  return (
    <html lang="en" className={cn('h-full antialiased', 'font-sans', geist.variable)}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
