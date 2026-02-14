import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  ListChecks,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Power,
  Settings2,
  Sparkles,
  UserCog,
  UsersRound,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketEvents } from '../context/SocketContext';
import api from '../api/client';
import { formatSmartDateTime } from '../utils/dateFormat';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: UsersRound },
  { to: '/clients', label: 'Clients', icon: CircleUserRound },
  { to: '/projects', label: 'Projects', icon: ListChecks },
  { to: '/users', label: 'Users', icon: UserCog, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings2, adminOnly: true }
];

const titleMap = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/users': 'Users',
  '/settings': 'Settings'
};

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { events, lastEvent, requestBrowserNotificationPermission } = useSocketEvents();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [canViewLiveActivity, setCanViewLiveActivity] = useState(Boolean(isAdmin));
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const headerTitle =
    Object.keys(titleMap).find((key) => (key === '/' ? location.pathname === '/' : location.pathname.startsWith(key))) || '/';

  const panelEvents = useMemo(
    () => events.filter((event) => event?.showInLiveActivity !== false),
    [events]
  );
  const unreadEvents = panelEvents.length;

  const breadcrumb = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return ['Dashboard'];
    return ['Dashboard', ...parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1))];
  }, [location.pathname]);

  const loadMySettings = useCallback(async () => {
    if (isAdmin) {
      setCanViewLiveActivity(true);
      setSettingsLoaded(true);
      return;
    }

    try {
      const { data } = await api.get('/settings/me');
      setCanViewLiveActivity(Boolean(data?.settings?.canViewLiveActivity));
    } catch (_error) {
      setCanViewLiveActivity(false);
    } finally {
      setSettingsLoaded(true);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!user?._id) return;
    loadMySettings();
  }, [user?._id, loadMySettings]);

  useEffect(() => {
    if (lastEvent?.type !== 'SETTINGS_UPDATED') return;
    loadMySettings();
  }, [lastEvent?.id, lastEvent?.type, loadMySettings]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`crm-shell ${activityCollapsed || !canViewLiveActivity ? 'activity-collapsed' : ''}`}>
      <aside className={`crm-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-wrap">
          <Link to="/" className="brand-link">
            Amplus CRM
          </Link>
          <p>Operations Console</p>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter((item) => (item.adminOnly ? isAdmin : true))
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-head">
              <CircleUserRound size={18} />
              <div>
                <strong>{user?.name}</strong>
                <small>{user?.email}</small>
              </div>
            </div>
            <span className="role-tag">{user?.role}</span>
          </div>
          <button className="btn btn-ghost sidebar-logout" onClick={handleLogout}>
            <Power size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {mobileOpen ? <div className="mobile-overlay" onClick={() => setMobileOpen(false)} /> : null}

      <div className="crm-main">
        <header className="crm-topbar">
          <div className="toolbar-left">
            <button className="icon-btn mobile-toggle" onClick={() => setMobileOpen((prev) => !prev)}>
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          <div>
              <h2>{titleMap[headerTitle]}</h2>
              <div className="breadcrumb-line">
                {breadcrumb.map((item, index) => (
                  <span key={`${item}-${index}`}>
                    {item}
                    {index < breadcrumb.length - 1 ? <ChevronRight size={12} /> : null}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="toolbar-actions">
            {canViewLiveActivity ? (
              <button className="btn btn-secondary" onClick={() => setActivityCollapsed((prev) => !prev)}>
                {activityCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                {activityCollapsed ? 'Show Activity' : 'Hide Activity'}
              </button>
            ) : null}
            <button className="btn btn-secondary" onClick={requestBrowserNotificationPermission}>
              <Bell size={14} />
              Alerts
            </button>
            {canViewLiveActivity ? (
              <button className="btn btn-secondary" disabled={!settingsLoaded}>
                <Sparkles size={14} />
                {unreadEvents} updates
              </button>
            ) : null}
          </div>
        </header>

        <main className="crm-content">
          <Outlet />
        </main>
      </div>

      {canViewLiveActivity ? (
        <aside className={`activity-panel ${activityCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-head">
            <h3>Live Activity</h3>
            <div className="toolbar-row">
              <span className="pulse-dot" />
              <button className="icon-btn" onClick={() => setActivityCollapsed(true)} aria-label="Collapse activity panel">
                <PanelRightClose size={14} />
              </button>
            </div>
          </div>
          {panelEvents.length === 0 ? <p className="muted-text">No recent events.</p> : null}
          {panelEvents.map((event) => (
            <div key={event.id} className="activity-item">
              <div className="activity-title">{event.title}</div>
              <p>{event.message}</p>
              <small>{formatSmartDateTime(event.createdAt)}</small>
            </div>
          ))}
        </aside>
      ) : null}
    </div>
  );
}

export default Layout;
