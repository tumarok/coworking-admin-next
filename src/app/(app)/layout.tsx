import { UserMenu } from '@/features/auth/components/user-menu';
import { AppHeader } from '@/components/app-header';
import { Sidebar } from '@/components/sidebar';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/skip-link';
import { getCurrentUser } from '@/lib/server/session';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  // The real session check: `proxy.ts` only looks for a cookie.
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SkipLink />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader>
          <UserMenu user={user} />
        </AppHeader>
        <main id={MAIN_CONTENT_ID} className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
