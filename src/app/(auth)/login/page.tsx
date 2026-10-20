import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { from, expired } = await searchParams;
  // A repeated parameter arrives as an array; only a single value is a page to return to.
  return <LoginForm from={typeof from === 'string' ? from : undefined} expired={expired === '1'} />;
}
