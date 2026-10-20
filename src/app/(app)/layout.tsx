import { AppHeader } from '@/components/app-header';
import { Sidebar } from '@/components/sidebar';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/skip-link';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SkipLink />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main id={MAIN_CONTENT_ID} className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
