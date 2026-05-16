import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Settings, 
  LogOut, 
  Sun, 
  Moon,
  Flame,
  MenuSquare,
  ClipboardList,
  Store,
  ChefHat,
  ShoppingBag,
  Palmtree,
  Network,
  Settings2,
  Package,
  UtensilsCrossed,
  Database
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const entityMatch = location.pathname.match(/^\/entity\/([^/]+)/);
  const activeEntityId = entityMatch ? entityMatch[1] : null;

  const navTo = (globalPath: string, entitySubPath: string) => {
    if (activeEntityId) {
      navigate(`/entity/${activeEntityId}/${entitySubPath}`);
    } else {
      navigate(globalPath);
    }
  };

  const isActive = (globalPath: string, entitySubPath: string) => {
    if (activeEntityId) {
      return location.pathname === `/entity/${activeEntityId}/${entitySubPath}` ||
             location.pathname === `/entity/${activeEntityId}`;
    }
    return location.pathname === globalPath;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isStore = user?.role === 'STORE';
  const isPartner = user?.role === 'PARTNER';

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="brand-logo">
              <Flame size={18} fill="white" />
            </div>
            <span>FORGE PLATFORM</span>
          </div>
          {activeEntityId && (
            <div className="entity-scope-banner">
              <Building2 size={11} />
              <span>ENTITY SCOPE</span>
              <button className="scope-clear" onClick={() => navigate('/dashboard')} title="Back to global">✕</button>
            </div>
          )}
        </div>
        
        {/* STORE role: minimal sidebar */}
        {isStore ? (
          <div className="sidebar-scrollable">
            <div className="sidebar-section">
              <p className="section-title">Store Manager</p>
              <nav className="sidebar-nav">
                <button className={`nav-item ${location.pathname === '/store-dashboard' ? 'active' : ''}`} onClick={() => navigate('/store-dashboard')}>
                  <Package size={18} /><span>Stock Dashboard</span>
                </button>
                <button className={`nav-item ${location.pathname === '/store-requests' ? 'active' : ''}`} onClick={() => navigate('/store-requests')}>
                  <UtensilsCrossed size={18} /><span>Food Requests</span>
                </button>
                <button className={`nav-item ${location.pathname === '/master-database' ? 'active' : ''}`} onClick={() => navigate('/master-database')}>
                  <Database size={18} /><span>Master Database</span>
                </button>
              </nav>
            </div>
          </div>

        /* SUPER_ADMIN: restricted sidebar — Dashboard + System only */
        ) : isSuperAdmin ? (
          <div className="sidebar-scrollable">
            <div className="sidebar-section">
              <p className="section-title">Administration</p>
              <nav className="sidebar-nav">
                <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard size={18} /><span>Dashboard</span>
                </button>
              </nav>
            </div>
            <div className="sidebar-section">
              <p className="section-title">System</p>
              <nav className="sidebar-nav">
                <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
                <button className="nav-item theme-toggle-btn" onClick={toggleTheme}>
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  <span>{theme === 'light' ? 'Night Mode' : 'Day Mode'}</span>
                </button>
              </nav>
            </div>
          </div>

        /* PARTNER: dashboard only */
        ) : isPartner ? (
          <div className="sidebar-scrollable">
            <div className="sidebar-section">
              <p className="section-title">Partner</p>
              <nav className="sidebar-nav">
                <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard size={18} /><span>Dashboard</span>
                </button>
              </nav>
            </div>
            <div className="sidebar-section">
              <p className="section-title">System</p>
              <nav className="sidebar-nav">
                <button className="nav-item theme-toggle-btn" onClick={toggleTheme}>
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  <span>{theme === 'light' ? 'Night Mode' : 'Day Mode'}</span>
                </button>
              </nav>
            </div>
          </div>

        /* ADMIN and all other roles: full sidebar */
        ) : (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <p className="section-title">Operations</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={18} /><span>Dashboard</span>
              </button>
              <button className={`nav-item ${isActive('/users', 'users') ? 'active' : ''}`} onClick={() => navTo('/users', 'users')}>
                <Users size={18} /><span>Users</span>
              </button>
              <button className={`nav-item ${isActive('/menu', 'menu') ? 'active' : ''}`} onClick={() => navTo('/menu', 'menu')}>
                <MenuSquare size={18} /><span>Menu</span>
              </button>
              <button className={`nav-item ${isActive('/bom', 'bom') ? 'active' : ''}`} onClick={() => navTo('/bom', 'bom')}>
                <ClipboardList size={18} /><span>BOM</span>
              </button>
              <button className={`nav-item ${isActive('/item-config', 'item-config') ? 'active' : ''}`} onClick={() => navTo('/item-config', 'item-config')}>
                <Settings2 size={18} /><span>Item Config</span>
              </button>
              <button className={`nav-item ${isActive('/food-requests', 'food-requests') ? 'active' : ''}`} onClick={() => navTo('/food-requests', 'food-requests')}>
                <UtensilsCrossed size={18} /><span>Food Requests</span>
              </button>
              <button className={`nav-item ${isActive('/master-database', 'master-database') ? 'active' : ''}`} onClick={() => navTo('/master-database', 'master-database')}>
                <Database size={18} /><span>Master Database</span>
              </button>
              <button className={`nav-item ${isActive('/purchase', 'purchase') ? 'active' : ''}`} onClick={() => navTo('/purchase', 'purchase')}>
                <ShoppingBag size={18} /><span>Purchase</span>
              </button>
              <button className={`nav-item ${isActive('/centers', 'centers') ? 'active' : ''}`} onClick={() => navTo('/centers', 'centers')}>
                <Store size={18} /><span>Centers</span>
              </button>
              <button className={`nav-item ${isActive('/kitchens', 'kitchens') ? 'active' : ''}`} onClick={() => navTo('/kitchens', 'kitchens')}>
                <ChefHat size={18} /><span>Kitchen</span>
              </button>
              <button className={`nav-item ${isActive('/stores', 'stores') ? 'active' : ''}`} onClick={() => navTo('/stores', 'stores')}>
                <ShoppingBag size={18} /><span>Store</span>
              </button>
              <button className={`nav-item ${isActive('/resorts', 'resorts') ? 'active' : ''}`} onClick={() => navTo('/resorts', 'resorts')}>
                <Palmtree size={18} /><span>Resort</span>
              </button>
              <button className={`nav-item ${isActive('/aggregates', 'aggregates') ? 'active' : ''}`} onClick={() => navTo('/aggregates', 'aggregates')}>
                <Network size={18} /><span>Aggregate</span>
              </button>
            </nav>
          </div>
          <div className="sidebar-section">
            <p className="section-title">System</p>
            <nav className="sidebar-nav">
              <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
              <button className="nav-item theme-toggle-btn" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                <span>{theme === 'light' ? 'Night Mode' : 'Day Mode'}</span>
              </button>
            </nav>
          </div>
        </div>
        )}
      </aside>

      <div className="dashboard-content">
        <header className="top-bar">
          <div className="top-bar-right">
            <div className="user-profile-top">
              <div className="user-text">
                <p className="user-name">{user?.name || 'Session User'}</p>
                <p className="user-role">{user?.role?.replace('_', ' ') || 'Personnel'}</p>
              </div>
              <div className="user-avatar">{getInitials(user?.name || 'User')}</div>
              <button onClick={handleLogout} className="top-logout-btn" title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        <main className="dashboard-main">
          {children}
        </main>
      </div>

      <style>{`
        .dashboard-layout {
          display: flex;
          min-height: 100vh;
          width: 100%;
          background: var(--bg-main);
        }
        .sidebar {
          width: 240px;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-main);
          display: flex;
          flex-direction: column;
          padding: 0;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 10;
          overflow: hidden;
          flex-shrink: 0;
        }
        .sidebar-header {
          padding: 24px 0 0;
          background: var(--bg-sidebar);
          flex-shrink: 0;
        }
        .entity-scope-banner {
          margin: 0 12px 12px;
          padding: 6px 10px;
          background: rgba(249,115,22,0.08);
          border: 1px solid rgba(249,115,22,0.2);
          border-radius: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.6rem;
          font-weight: 800;
          color: var(--primary);
          letter-spacing: 0.5px;
        }
        .entity-scope-banner span { flex: 1; }
        .scope-clear { background: none; border: none; color: var(--primary); cursor: pointer; font-size: 0.75rem; padding: 0; line-height: 1; opacity: 0.7; }
        .scope-clear:hover { opacity: 1; }
        .sidebar-brand {
          padding: 0 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .brand-logo {
          background: var(--primary);
          color: white;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sidebar-brand span {
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 1px;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
        }
        .sidebar-scrollable {
          flex: 1;
          overflow-y: auto;
          padding: 12px 0 24px;
        }
        .sidebar-scrollable::-webkit-scrollbar { width: 4px; }
        .sidebar-scrollable::-webkit-scrollbar-thumb { background: var(--border-main); }
        .dashboard-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .top-bar {
          height: 64px;
          background: var(--bg-main);
          border-bottom: 1px solid var(--border-main);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 32px;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 9;
        }
        .user-profile-top { display: flex; align-items: center; gap: 16px; }
        .user-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--border-strong); color: var(--text-main);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; font-weight: 700; flex-shrink: 0;
        }
        .user-text { text-align: right; min-width: 0; }
        .user-name { font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 2px; }
        .user-role { font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .top-logout-btn {
          background: none; border: 1px solid var(--border-main); color: var(--text-dim);
          cursor: pointer; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s; margin-left: 8px;
        }
        .top-logout-btn:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
        .sidebar-section { margin-bottom: 24px; padding: 0 12px; }
        .section-title {
          font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim);
          letter-spacing: 1px; margin-bottom: 8px; padding-left: 8px; font-weight: 700;
        }
        .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
        .nav-item {
          display: flex; align-items: center; gap: 12px; padding: 8px 12px;
          color: var(--text-muted); text-decoration: none;
          font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
          background: none; border: none; width: 100%; cursor: pointer; text-align: left;
        }
        .nav-item:hover { color: var(--text-main); background: var(--row-hover); }
        .nav-item.active {
          color: var(--primary); background: var(--row-hover);
          border-left: 2px solid var(--primary); padding-left: 10px;
        }
        .dashboard-main { padding: 32px; background: var(--bg-main); flex: 1; overflow-y: auto; }
      `}</style>
    </div>
  );
};

export default MainLayout;
