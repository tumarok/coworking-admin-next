import { ThemeToggle } from '@/components/theme-toggle';

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b bg-card px-4 md:px-8">
      <ThemeToggle />
    </header>
  );
}
