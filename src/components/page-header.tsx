import type { Route } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  titleRef,
}: {
  title: string;
  subtitle?: string;
  /** Link to the list a details page belongs to, shown above the title. */
  back?: { href: Route; label: string };
  /** Buttons and controls shown on the right. */
  actions?: React.ReactNode;
  /** Lets a screen move focus to the title when the control the user pressed disappears. */
  titleRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1
          ref={titleRef}
          tabIndex={titleRef ? -1 : undefined}
          className="text-2xl font-bold tracking-tight outline-none"
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
