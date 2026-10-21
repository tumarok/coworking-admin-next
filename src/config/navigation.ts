import type { Route } from 'next';
import { DoorOpenIcon, LayoutDashboardIcon, MapPinIcon, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface NavItem {
  label: string;
  href: Route;
  icon: LucideIcon;
}

/** Sidebar entries, in display order. Only routes that exist are listed. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: ROUTES.dashboard, icon: LayoutDashboardIcon },
  { label: 'Locations', href: ROUTES.locations, icon: MapPinIcon },
  { label: 'Rooms', href: ROUTES.rooms, icon: DoorOpenIcon },
];
