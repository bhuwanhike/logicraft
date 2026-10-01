import {
  Activity,
  Bell,
  LayoutDashboard,
  Navigation,
  Package,
  Settings,
  Truck,
  Users,
  Warehouse
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspaceCounts } from '../../types';

/**
 * Sidebar navigation, grouped the way the operations team thinks about the
 * product: day-to-day movement, the physical supply chain, then oversight.
 *
 * `countKey` points at a key in WorkspaceContext.counts. A module with no
 * countKey renders no badge rather than a zero, so an empty-looking nav item
 * never implies a tracked collection that does not exist.
 */

/** A single sidebar entry. */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Key into WorkspaceContext.counts; omitted means the item never badges. */
  countKey?: keyof WorkspaceCounts;
  /** Hide the badge when the count is zero, e.g. unread notifications. */
  hideBadgeAtZero?: boolean;
}

/** A labelled cluster of sidebar entries. */
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/tracking', label: 'Tracking Center', icon: Navigation },
      { to: '/vehicles', label: 'Vehicles', icon: Truck, countKey: 'vehicles' },
      { to: '/drivers', label: 'Drivers', icon: Users }
    ]
  },
  {
    id: 'supply-chain',
    label: 'Supply Chain',
    items: [
      { to: '/shipments', label: 'Shipments', icon: Package, countKey: 'shipments' },
      { to: '/warehouses', label: 'Warehouses', icon: Warehouse }
    ]
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { to: '/analytics', label: 'Analytics', icon: Activity },
      {
        to: '/notifications',
        label: 'Notifications',
        icon: Bell,
        countKey: 'notificationsUnread',
        // Only surface the bell badge for genuinely unread items.
        hideBadgeAtZero: true
      },
      { to: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

/** Flat lookup, used by the breadcrumb to resolve the current page title. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  // Longest prefix wins so /tracking never matches a future /tracking/xyz
  // incorrectly and so nested routes still resolve to their section.
  return NAV_ITEMS.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort(
    (a, b) => b.to.length - a.to.length
  )[0];
}
