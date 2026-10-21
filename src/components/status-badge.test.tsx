import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '@/lib/contract/booking';
import {
  BookingStatusBadge,
  LocationStatusBadge,
  RoomStatusBadge,
  StatusBadge,
} from './status-badge';

describe('StatusBadge', () => {
  it('spells the status out as text', () => {
    render(<StatusBadge status="checked_in" tone="success" />);

    expect(screen.getByText('Checked in')).toBeInTheDocument();
  });

  it('takes its colours from the tone', () => {
    render(<StatusBadge status="pending" tone="warning" />);

    expect(screen.getByText('Pending')).toHaveClass('text-status-warning', 'bg-status-warning-bg');
  });
});

// A Record, so a status added to the contract without a label here fails to compile.
const LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

describe('BookingStatusBadge', () => {
  it.each(Object.entries(LABELS))('spells %s as "%s"', (status, label) => {
    render(<BookingStatusBadge status={status as BookingStatus} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ['pending', 'text-status-warning'],
    ['confirmed', 'text-status-info'],
    ['checked_in', 'text-status-success'],
    ['completed', 'text-status-contrast'],
    ['cancelled', 'text-status-neutral'],
    ['no_show', 'text-status-danger'],
  ] as const)('shows %s in %s', (status, className) => {
    render(<BookingStatusBadge status={status} />);

    expect(screen.getByText(LABELS[status])).toHaveClass(className);
  });

  it('follows a change of status and renders the same output again', () => {
    const { rerender } = render(<BookingStatusBadge status="pending" />);

    rerender(<BookingStatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(<BookingStatusBadge status="no_show" />);
    expect(screen.getByText('No show')).toHaveClass('text-status-danger');
  });
});

describe('LocationStatusBadge', () => {
  it.each([
    ['active', 'Active', 'text-status-success'],
    ['inactive', 'Inactive', 'text-status-neutral'],
  ] as const)('shows %s as "%s" in %s', (status, label, className) => {
    render(<LocationStatusBadge status={status} />);

    expect(screen.getByText(label)).toHaveClass(className);
  });
});

describe('RoomStatusBadge', () => {
  it.each([
    ['available', 'Available', 'text-status-success'],
    ['maintenance', 'Maintenance', 'text-status-warning'],
    ['retired', 'Retired', 'text-status-neutral'],
  ] as const)('shows %s as "%s" in %s', (status, label, className) => {
    render(<RoomStatusBadge status={status} />);

    expect(screen.getByText(label)).toHaveClass(className);
  });
});
