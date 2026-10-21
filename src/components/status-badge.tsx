import { cva } from 'class-variance-authority';
import type { BookingStatus } from '@/lib/contract/booking';
import type { LocationStatus } from '@/lib/contract/location';
import { humanize } from '@/lib/humanize';

/** Colour family of a badge. The badge always spells the status out, colour is only a hint. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'contrast';

const badge = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral',
        info: 'border-status-info-border bg-status-info-bg text-status-info',
        success: 'border-status-success-border bg-status-success-bg text-status-success',
        warning: 'border-status-warning-border bg-status-warning-bg text-status-warning',
        danger: 'border-status-danger-border bg-status-danger-bg text-status-danger',
        contrast: 'border-status-contrast-border bg-status-contrast-bg text-status-contrast',
      },
    },
  },
);

export function StatusBadge({ status, tone }: { status: string; tone: StatusTone }) {
  return <span className={badge({ tone })}>{humanize(status)}</span>;
}

const BOOKING_TONES: Record<BookingStatus, StatusTone> = {
  pending: 'warning',
  confirmed: 'info',
  checked_in: 'success',
  completed: 'contrast',
  cancelled: 'neutral',
  no_show: 'danger',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <StatusBadge status={status} tone={BOOKING_TONES[status]} />;
}

const LOCATION_TONES: Record<LocationStatus, StatusTone> = {
  active: 'success',
  inactive: 'neutral',
};

export function LocationStatusBadge({ status }: { status: LocationStatus }) {
  return <StatusBadge status={status} tone={LOCATION_TONES[status]} />;
}
