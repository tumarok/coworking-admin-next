import { ThemeToggle } from '@/components/theme-toggle';

/** Page banner. `children` is the account area, shown after the theme toggle. */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b bg-card px-4 md:px-8">
      <ThemeToggle />
      {children}
    </header>
  );
}
