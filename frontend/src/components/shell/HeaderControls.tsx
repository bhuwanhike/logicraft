import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Moon, Package, Plus, Sun, Truck, UserCheck, Warehouse } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CreateAction } from '../../types';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useClickOutside } from '../../hooks/useUi';
import { useTheme } from '../../hooks/useTheme';

const ACTION_ICONS: Record<string, LucideIcon> = {
  shipments: Package,
  drivers: UserCheck,
  warehouses: Warehouse,
  vehicles: Truck
};

/**
 * Header "+ Create" menu.
 *
 * Actions are contributed by the pages themselves via the workspace modal
 * registry, so this menu stays a dispatcher and never has to know how a
 * shipment form works. An action whose page is not mounted is disabled rather
 * than silently doing nothing.
 */
export function CreateMenu() {
  const { createActions, modals, openModal, notify } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), { enabled: open });

  const run = (action: CreateAction) => {
    setOpen(false);
    if (modals[action.id]) {
      openModal(action.id);
      return;
    }
    // The owning page is not mounted, so send the user there to create the
    // record instead of opening a dialog that is not in the tree.
    notify(`Open ${action.entity} to create this record.`, 'info');
    navigate(`/${action.entity === 'inventory' ? 'warehouses' : action.entity}`);
  };

  return (
    <div className="create-menu" ref={ref}>
      <button
        type="button"
        className="button primary"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={16} /> Create
      </button>

      {open && (
        <div className="menu-popover" role="menu">
          {createActions.map((action) => {
            const Icon = ACTION_ICONS[action.entity] ?? Plus;
            const available = Boolean(modals[action.id]);
            return (
              <button key={action.id} type="button" role="menuitem" onClick={() => run(action)}>
                <Icon size={15} aria-hidden="true" />
                <span>
                  {action.label}
                  {!available && <small>Opens the module</small>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Header notification bell.
 *
 * The badge is the unread count from WorkspaceContext, which is derived from
 * the notification rows themselves — so it is 0, not a placeholder, until a
 * source is connected.
 */
export function NotificationBell() {
  const { counts } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), { enabled: open });

  const unread = counts.notificationsUnread;

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="icon-button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={17} />
        {unread > 0 && <i className="bell-badge">{unread > 99 ? '99+' : unread}</i>}
      </button>

      {open && (
        <div className="menu-popover bell-popover">
          <div className="popover-head">
            <b>Notifications</b>
            <button type="button" onClick={() => navigate('/notifications')}>
              View all
            </button>
          </div>
          <NotificationPreview />
        </div>
      )}
    </div>
  );
}

/**
 * Header light/dark toggle.
 *
 * Sits beside the bell and matches its markup, so the two read as one control
 * group. The icon shows the theme you would get by pressing it rather than the
 * current one, which is the same convention the sidebar toggle uses.
 */
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

function NotificationPreview() {
  const { counts, notify } = useWorkspace();

  if (counts.notifications === 0) {
    return (
      <div className="popover-empty">
        <Bell size={18} aria-hidden="true" />
        <b>Nothing to review</b>
        <span>Alerts appear here the moment an event stream is connected.</span>
        <button
          type="button"
          className="link"
          onClick={() => notify('Mark-all-read needs a connected event stream.', 'info')}
        >
          <CheckCheck size={13} /> Mark all as read
        </button>
      </div>
    );
  }

  return (
    <div className="popover-empty">
      <b>{counts.notificationsUnread} unread of {counts.notifications}</b>
      <button type="button" className="link" onClick={() => notify('Mark-all-read needs a connected event stream.', 'info')}>
        <CheckCheck size={13} /> Mark all as read
      </button>
    </div>
  );
}
