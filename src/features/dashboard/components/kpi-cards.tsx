import { CalendarDaysIcon, EuroIcon, PercentIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Dashboard } from '@/lib/contract/dashboard';
import { formatMoney } from '@/lib/money';
import { occupancyPercent } from '@/features/dashboard/constants';

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        {/* The label comes first for readers, the figure first for the eye. */}
        <dl className="flex flex-col-reverse gap-1">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-2xl leading-none font-bold tabular-nums">{value}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

/** The four headline figures of the day. */
export function KpiCards({ kpis }: { kpis: Dashboard['kpis'] }) {
  return (
    <section
      aria-label="Key figures"
      className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4"
    >
      <Kpi icon={CalendarDaysIcon} label="Bookings" value={String(kpis.bookingsToday)} />
      <Kpi
        icon={PercentIcon}
        label="Occupancy"
        value={`${occupancyPercent(kpis.occupancyRate, 1)}%`}
      />
      <Kpi icon={EuroIcon} label="Revenue this month" value={formatMoney(kpis.revenueMonth)} />
      <Kpi icon={UsersIcon} label="Active members" value={String(kpis.activeMembers)} />
    </section>
  );
}
