import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useHotkey } from '../../hooks/useUi';
import { NAV_GROUPS } from './navConfig';
import { GlobalSearch } from './GlobalSearch';
import { CreateMenu, AccountMenu, NotificationBell, ThemeToggle } from './HeaderControls';

const SIDEBAR_KEY = 'logicraft.sidebar';

/**
 * Application shell: collapsible sidebar + topbar + routed content.
 *
 * The brand block below is intentionally untouched. Its markup, the
 * BrandLogo variant, and the "LogiCraft / LOGISTICS OS" lockup are fixed.
 * It lives in the sidebar, which is toggled from the topbar button rather than
 * from a control inside the panel: a toggle placed in the sidebar would be
 * unreachable whenever the panel is closed on small screens, and squeezed out
 * of view when the sidebar is collapsed to an icon rail. The breadcrumb that
 * used to sit beside this is gone.
 */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // A real boolean, not a '0'/'1' string: '0' is truthy, so a string here
  // silently inverted every truth test. Below 980px the sidebar has always
  // been an icon rail, so default to collapsed there unless the user has
  // already chosen.
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) return saved === '1';
    return window.matchMedia('(max-width: 980px)').matches;
  });
  const { pathname } = useLocation();
  const { counts } = useWorkspace();

  useHotkey('mod+k', () => setSearchOpen(true));

  // Any navigation closes the mobile drawer; without this it stays open over
  // the page the user just chose.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'), [collapsed]);

  // Escape closes the mobile drawer now that it has no close button of its own.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  /**
   * One button, two behaviours. Off-canvas below 700px there is nothing to
   * collapse, so the same control opens and closes the drawer; wider than that
   * it collapses the sidebar to an icon rail. The icon shows what the button
   * will do, not the current state.
   */
  const isDrawer = () => window.matchMedia('(max-width: 700px)').matches;
  const toggleSidebar = () => {
    if (isDrawer()) {
      setMenuOpen((open) => !open);
      return;
    }
    setCollapsed((value) => !value);
  };

  return (
    <div className={`app-shell ${collapsed ? 'shell-collapsed' : ''}`.trim()}>
      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${menuOpen ? 'mobile-open' : ''}`.trim()}
        aria-label="Primary navigation"
        id="workspace-sidebar"
      >
        <div className="brand">
          <BrandLogo variant="framed" />
          <b>
            LogiCraft
            <small>LOGISTICS OS</small>
          </b>
        </div>

        <nav>
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.id}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(({ to, label, icon: Icon, countKey, hideBadgeAtZero }) => {
                const count = countKey ? counts[countKey] : undefined;
                const showBadge = count !== undefined && (count > 0 || !hideBadgeAtZero);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    // The rail hides the label, so keep an accessible name and
                    // a tooltip for it.
                    title={label}
                    aria-label={label}
                    className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`.trim()}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {showBadge && <em className="nav-count">{count}</em>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Tapping outside dismisses the off-canvas drawer, which no longer has
          its own close button. Hidden above 700px where there is no drawer. */}
      {menuOpen && (
        <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />
      )}

      <main className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle mobile-menu"
              onClick={toggleSidebar}
              aria-expanded={isDrawer() ? menuOpen : !collapsed}
              aria-controls="workspace-sidebar"
              aria-label={isDrawer()
                ? menuOpen
                  ? 'Close navigation'
                  : 'Open navigation'
                : collapsed
                  ? 'Expand navigation'
                  : 'Collapse navigation'}
            >
              {isDrawer() || collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the workspace"
            >
              <Search size={15} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <NotificationBell />
            <ThemeToggle />
            <CreateMenu />
            <AccountMenu />
          </div>
        </header>

        <section className="main-content">
          <Outlet />
        </section>
      </main>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ToastLayer />
    </div>
  );
}

/** Renders the transient message from WorkspaceContext, then clears it. */
function ToastLayer() {
  const { toast, dismissToast } = useWorkspace();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(dismissToast, 3800);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      {toast.message}
    </div>
  );
}

export default AppShell;
