'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BuildingIcon } from 'lucide-react';
import { NAV_ITEMS } from '@/config/navigation';
import { cn } from '@/lib/utils';

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

/** Side navigation on wide screens; a scrolling top bar below the `md` breakpoint. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Sidebar"
      className="flex shrink-0 items-center gap-4 bg-sidebar px-4 py-2 text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-60 md:flex-col md:items-stretch md:gap-6 md:px-3 md:py-5"
    >
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-md px-2 text-base font-semibold text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <BuildingIcon className="size-5 text-sidebar-primary" aria-hidden />
        Coworking Admin
      </Link>
      <nav aria-label="Main" className="min-w-0 flex-1 overflow-x-auto md:overflow-visible">
        <ul className="flex gap-1 md:flex-col">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
