import React, { useState, useEffect } from 'react';
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
  ChefHat,
  ShoppingBag,
  Settings2,
  Package,
  UtensilsCrossed,
  Database,
  CreditCard,
  DollarSign,
  Landmark,
  Calendar,
  Plus,
  Layers
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { userApi, employeeApi } from '../services/api';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [financeLocations, setFinanceLocations] = useState<any[]>([]);
  const [hrYears, setHrYears] = useState<any[]>([]);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    const entityId = user?.entity?._id || user?.entity;
    if (user?.role === 'FINANCE') {
      userApi.getLocations(entityId)
        .then(res => {
          const allLocs = res.data.data || [];
          const saleLocs = allLocs.filter((l: any) => 
            ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(l.role)
          );
          setFinanceLocations(saleLocs);
        })
        .catch(err => console.error('Failed to load locations in sidebar', err));
    } else if (user?.role === 'HR' || user?.role === 'ADMIN') {
      employeeApi.getYearViews(entityId)
        .then(res => {
          setHrYears(res.data.data || []);
        })
        .catch(err => console.error('Failed to load HR year views in sidebar', err));
    }
  }, [user?.role]);

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

  const isActiveWithQuery = (path: string, requireViewOnly: boolean) => {
    const searchParams = new URLSearchParams(location.search);
    const hasViewOnly = searchParams.get('viewOnly') === 'true';
    let pathMatches = location.pathname === path;
    if (activeEntityId) {
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      pathMatches = location.pathname === `/entity/${activeEntityId}/${cleanPath}`;
    }
    return pathMatches && (hasViewOnly === requireViewOnly);
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
  const isCOO = user?.role === 'COO';
  const isResort = user?.role === 'RESORT';
  const isFinance = user?.role === 'FINANCE';
  const isHR = user?.role === 'HR';
  const isCenters = user?.role === 'CENTERS' || user?.role === 'KITCHEN' || user?.role === 'RESTAURANT' || user?.role === 'AGGREGATE';

  const handleAddYearView = async () => {
    const yearStr = prompt('Enter Calendar Year (e.g., 2026):');
    if (!yearStr) return;
    const yearNum = parseInt(yearStr);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      alert('Please enter a valid 4-digit calendar year.');
      return;
    }

    try {
      const entityId = user?.entity?._id || user?.entity;
      await employeeApi.addYearView({ year: yearNum, entity: entityId });
      // Refresh list
      const res = await employeeApi.getYearViews(entityId);
      setHrYears(res.data.data || []);
      // Navigate to the newly created year view
      navTo(`/hr/year-view/${yearNum}`, `hr/year-view/${yearNum}`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add year view');
    }
  };

  const searchParams = new URLSearchParams(location.search);
  const activeTabQuery = searchParams.get('tab') || 'location';
  const activeLocIdQuery = searchParams.get('locationId') || '';

  const renderSidebar = () => {
    if (isResort) {
      return (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <p className="section-title">Resort Manager</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={18} /><span>Dashboard</span>
              </button>
              <button className={`nav-item ${location.pathname === '/finance' ? 'active' : ''}`} onClick={() => navigate('/finance')}>
                <DollarSign size={18} /><span>Finance</span>
              </button>
            </nav>
          </div>
        </div>
      );
    }

    if (isFinance) {
      return (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <p className="section-title">Stock Payments</p>
            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${location.pathname === '/finance' && activeTabQuery === 'stock_purchases' ? 'active' : ''}`} 
                onClick={() => navigate('/finance?tab=stock_purchases')}
              >
                <DollarSign size={18} /><span>Stock Purchases</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-section">
            <p className="section-title">Sales Reconciliation</p>
            <nav className="sidebar-nav">
              {financeLocations.map(loc => (
                <button 
                  key={loc._id}
                  className={`nav-item ${location.pathname === '/finance' && activeTabQuery === 'location' && activeLocIdQuery === loc._id ? 'active' : ''}`} 
                  onClick={() => navigate(`/finance?tab=location&locationId=${loc._id}`)}
                >
                  <Building2 size={18} /><span>{loc.name.toUpperCase()}</span>
                </button>
              ))}
              {financeLocations.length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No sale locations
                </div>
              )}
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
      );
    }

    if (isStore) {
      return (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <p className="section-title">Store Manager</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${location.pathname === '/store-dashboard' ? 'active' : ''}`} onClick={() => navigate('/store-dashboard')}>
                <Package size={18} /><span>Stock Dashboard</span>
              </button>
              <button className={`nav-item ${location.pathname === '/store-requests' ? 'active' : ''}`} onClick={() => navigate('/store-requests')}>
                <UtensilsCrossed size={18} /><span>Stock Requests</span>
                <span className="nav-notification-dot"></span>
              </button>
              <button className={`nav-item ${location.pathname === '/inventory' ? 'active' : ''}`} onClick={() => navigate('/inventory')}>
                <Package size={18} /><span>Inventory</span>
              </button>
              <button className={`nav-item ${location.pathname === '/purchase' ? 'active' : ''}`} onClick={() => navigate('/purchase')}>
                <ShoppingBag size={18} /><span>New Purchase</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/vendors') ? 'active' : ''}`} onClick={() => navigate('/master-database/vendors')}>
                <Database size={18} /><span>Vendor Database</span>
              </button>
            </nav>
          </div>
        </div>
      );
    }

    if (isSuperAdmin) {
      return (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <p className="section-title">Administration</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={18} /><span>Dashboard</span>
              </button>
              <button className={`nav-item ${location.pathname === '/users' ? 'active' : ''}`} onClick={() => navigate('/users')}>
                <Users size={18} /><span>Entities & Users</span>
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
      );
    }

    if (isCOO) {
      return (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <nav className="sidebar-nav">
              <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={18} /><span>Dashboard</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-section">
            <p className="section-title">Approvals</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${isActiveWithQuery('/food-requests', false) ? 'active' : ''}`} onClick={() => navTo('/food-requests', 'food-requests')}>
                <Package size={18} /><span>Food Requests</span>
                <span className="nav-notification-dot"></span>
              </button>
              <button className={`nav-item ${isActiveWithQuery('/store-requests', false) ? 'active' : ''}`} onClick={() => navTo('/store-requests', 'store-requests')}>
                <UtensilsCrossed size={18} /><span>Stock Requests</span>
                <span className="nav-notification-dot"></span>
              </button>
              <button className={`nav-item ${location.pathname === '/expense-approvals' ? 'active' : ''}`} onClick={() => navigate('/expense-approvals')}>
                <DollarSign size={18} /><span>Finance Approval</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-section" style={{ margin: '12px -12px 12px', padding: '0 0 12px', borderBottom: '1px solid var(--border-main)' }}>
            <p className="section-title" style={{ fontSize: '0.65rem', paddingLeft: '20px', marginBottom: '8px' }}>Master Database</p>
            <nav className="sidebar-nav" style={{ paddingLeft: '8px' }}>
              <button className={`nav-item ${isActive('/users', 'users') ? 'active' : ''}`} onClick={() => navTo('/users', 'users')}>
                <Users size={16} /><span>Users</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/vendors') ? 'active' : ''}`} onClick={() => navTo('/master-database/vendors', 'master-database/vendors')}>
                <Building2 size={16} /><span>Vendors</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/banks') ? 'active' : ''}`} onClick={() => navTo('/master-database/banks', 'master-database/banks')}>
                <Landmark size={16} /><span>Banks</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/employees') ? 'active' : ''}`} onClick={() => navTo('/master-database/employees', 'master-database/employees')}>
                <Users size={16} /><span>Employees</span>
              </button>
              <button className={`nav-item ${isActive('/item-config', 'item-config') ? 'active' : ''}`} onClick={() => navTo('/item-config', 'item-config')}>
                <Settings2 size={16} /><span>Raw Materials</span>
              </button>
              <button className={`nav-item ${isActive('/bom', 'bom') ? 'active' : ''}`} onClick={() => navTo('/bom', 'bom')}>
                <ClipboardList size={16} /><span>BOM</span>
              </button>
              <button className={`nav-item ${isActive('/menu', 'menu') ? 'active' : ''}`} onClick={() => navTo('/menu', 'menu')}>
                <MenuSquare size={16} /><span>Menu</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/special-days') ? 'active' : ''}`} onClick={() => navTo('/master-database/special-days', 'master-database/special-days')}>
                <Calendar size={16} /><span>Special Days</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/expenses') ? 'active' : ''}`} onClick={() => navTo('/master-database/expenses', 'master-database/expenses')}>
                <Layers size={16} /><span>Expenses</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-section">
            <p className="section-title">Operational Data</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${isActiveWithQuery('/food-requests', true) ? 'active' : ''}`} onClick={() => navTo('/food-requests?viewOnly=true', 'food-requests?viewOnly=true')}>
                <Package size={18} /><span>Food Requests</span>
              </button>
              <button className={`nav-item ${isActiveWithQuery('/store-requests', true) ? 'active' : ''}`} onClick={() => navTo('/store-requests?viewOnly=true', 'store-requests?viewOnly=true')}>
                <UtensilsCrossed size={18} /><span>Stock Requests</span>
              </button>
              <button className={`nav-item ${isActive('/function-bookings', 'function-bookings') ? 'active' : ''}`} onClick={() => navTo('/function-bookings?viewOnly=true', 'function-bookings?viewOnly=true')}>
                <ClipboardList size={18} /><span>Function Bookings</span>
              </button>
              <button className={`nav-item ${isActive('/inventory', 'inventory') ? 'active' : ''}`} onClick={() => navTo('/inventory?viewOnly=true', 'inventory?viewOnly=true')}>
                <Package size={18} /><span>Inventory</span>
              </button>
              <button className={`nav-item ${isActive('/purchase', 'purchase') ? 'active' : ''}`} onClick={() => navTo('/purchase?viewOnly=true', 'purchase?viewOnly=true')}>
                <ShoppingBag size={18} /><span>Purchase</span>
              </button>
              <button className={`nav-item ${isActive('/production', 'production') ? 'active' : ''}`} onClick={() => navTo('/production?viewOnly=true', 'production?viewOnly=true')}>
                <ChefHat size={18} /><span>Production</span>
              </button>
              <button className={`nav-item ${isActive('/payment-settings', 'payment-settings') ? 'active' : ''}`} onClick={() => navTo('/payment-settings', 'payment-settings')}>
                <CreditCard size={18} /><span>Pricing Console</span>
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
      );
    }

    if (isPartner) {
      return (
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
      );
    }

    if (isHR) {
      return (
        <div className="sidebar-scrollable">
          <div className="sidebar-section">
            <p className="section-title">HR Management</p>
            <nav className="sidebar-nav">
              <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={18} /><span>HR Dashboard</span>
              </button>
              <button className={`nav-item ${location.pathname.includes('/master-database/employees') ? 'active' : ''}`} onClick={() => navTo('/master-database/employees', 'master-database/employees')}>
                <Users size={18} /><span>Employee Master</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-section">
            <p className="section-title">Calendar Year Views</p>
            <nav className="sidebar-nav">
              {hrYears.map(y => (
                <button 
                  key={y._id}
                  className={`nav-item ${location.pathname.includes(`/hr/year-view/${y.year}`) ? 'active' : ''}`} 
                  onClick={() => navTo(`/hr/year-view/${y.year}`, `hr/year-view/${y.year}`)}
                >
                  <Calendar size={18} /><span>{y.year} Console</span>
                </button>
              ))}
              
              <button className="nav-item" onClick={handleAddYearView} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                <Plus size={18} /><span>Add Year View</span>
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
      );
    }

    // Default corporate / ADMIN roles
    return (
      <div className="sidebar-scrollable">
        <div className="sidebar-section">
          <nav className="sidebar-nav">
            <button className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
              <LayoutDashboard size={18} /><span>Dashboard</span>
            </button>
            {isCenters && (
              <>
                {user?.role !== 'KITCHEN' && (
                  <button className={`nav-item ${isActive('/menu', 'menu') ? 'active' : ''}`} onClick={() => navTo('/menu', 'menu')}>
                    <MenuSquare size={18} /><span>New Request</span>
                  </button>
                )}
                {user?.role !== 'AGGREGATE' && user?.role !== 'KITCHEN' && (
                  <button className={`nav-item ${isActive('/function-bookings', 'function-bookings') ? 'active' : ''}`} onClick={() => navTo('/function-bookings', 'function-bookings')}>
                    <ClipboardList size={18} /><span>Function Bookings</span>
                  </button>
                )}
                {user?.role !== 'KITCHEN' && (
                  <button className={`nav-item ${isActive('/food-requests', 'food-requests') ? 'active' : ''}`} onClick={() => navTo('/food-requests', 'food-requests')}>
                    <UtensilsCrossed size={18} /><span>My Requests</span>
                  </button>
                )}
                <button className={`nav-item ${isActive('/inventory', 'inventory') ? 'active' : ''}`} onClick={() => navTo('/inventory', 'inventory')}>
                  <Package size={18} /><span>Inventory</span>
                </button>
                <button className={`nav-item ${isActive('/production', 'production') ? 'active' : ''}`} onClick={() => navTo('/production', 'production')}>
                  <ChefHat size={18} /><span>Production</span>
                </button>
                <button className={`nav-item ${isActive('/purchase', 'purchase') ? 'active' : ''}`} onClick={() => navTo('/purchase', 'purchase')}>
                  <ShoppingBag size={18} /><span>Purchases</span>
                </button>
                <button className={`nav-item ${isActive('/revenue', 'revenue') ? 'active' : ''}`} onClick={() => navTo('/revenue', 'revenue')}>
                  <DollarSign size={18} /><span>Revenue Console</span>
                </button>
                <button className={`nav-item ${isActive('/pricing', 'pricing') ? 'active' : ''}`} onClick={() => navTo('/pricing', 'pricing')}>
                  <CreditCard size={18} /><span>Pricing Rates</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {!isCenters && (
          <>
            <div className="sidebar-section" style={{ margin: '12px -12px 12px', padding: '0 0 12px', borderBottom: '1px solid var(--border-main)' }}>
              <p className="section-title" style={{ fontSize: '0.65rem', paddingLeft: '20px', marginBottom: '8px' }}>Master Database</p>
              <nav className="sidebar-nav" style={{ paddingLeft: '8px' }}>
                <button className={`nav-item ${isActive('/users', 'users') ? 'active' : ''}`} onClick={() => navTo('/users', 'users')}>
                  <Users size={16} /><span>Users</span>
                </button>
                <button className={`nav-item ${location.pathname.includes('/master-database/vendors') ? 'active' : ''}`} onClick={() => navTo('/master-database/vendors', 'master-database/vendors')}>
                  <Building2 size={16} /><span>Vendors</span>
                </button>
                <button className={`nav-item ${location.pathname.includes('/master-database/banks') ? 'active' : ''}`} onClick={() => navTo('/master-database/banks', 'master-database/banks')}>
                  <Landmark size={16} /><span>Banks</span>
                </button>
                <button className={`nav-item ${location.pathname.includes('/master-database/employees') ? 'active' : ''}`} onClick={() => navTo('/master-database/employees', 'master-database/employees')}>
                  <Users size={16} /><span>Employees</span>
                </button>
                <button className={`nav-item ${isActive('/item-config', 'item-config') ? 'active' : ''}`} onClick={() => navTo('/item-config', 'item-config')}>
                  <Settings2 size={16} /><span>Raw Materials</span>
                </button>
                <button className={`nav-item ${isActive('/bom', 'bom') ? 'active' : ''}`} onClick={() => navTo('/bom', 'bom')}>
                  <ClipboardList size={16} /><span>BOM</span>
                </button>
                <button className={`nav-item ${isActive('/menu', 'menu') ? 'active' : ''}`} onClick={() => navTo('/menu', 'menu')}>
                  <MenuSquare size={16} /><span>Menu</span>
                </button>
                <button className={`nav-item ${location.pathname.includes('/master-database/special-days') ? 'active' : ''}`} onClick={() => navTo('/master-database/special-days', 'master-database/special-days')}>
                  <Calendar size={16} /><span>Special Days</span>
                </button>
                <button className={`nav-item ${location.pathname.includes('/master-database/expenses') ? 'active' : ''}`} onClick={() => navTo('/master-database/expenses', 'master-database/expenses')}>
                  <Layers size={16} /><span>Expenses</span>
                </button>
              </nav>
            </div>

            <div className="sidebar-section">
              <p className="section-title">Operational Data</p>
              <nav className="sidebar-nav">
                <button className={`nav-item ${isActiveWithQuery('/food-requests', true) ? 'active' : ''}`} onClick={() => navTo('/food-requests?viewOnly=true', 'food-requests?viewOnly=true')}>
                  <Package size={18} /><span>Food Requests</span>
                </button>
                <button className={`nav-item ${isActiveWithQuery('/store-requests', true) ? 'active' : ''}`} onClick={() => navTo('/store-requests?viewOnly=true', 'store-requests?viewOnly=true')}>
                  <UtensilsCrossed size={18} /><span>Stock Requests</span>
                </button>
                <button className={`nav-item ${isActive('/function-bookings', 'function-bookings') ? 'active' : ''}`} onClick={() => navTo('/function-bookings?viewOnly=true', 'function-bookings?viewOnly=true')}>
                  <ClipboardList size={18} /><span>Function Bookings</span>
                </button>
                <button className={`nav-item ${isActive('/inventory', 'inventory') ? 'active' : ''}`} onClick={() => navTo('/inventory?viewOnly=true', 'inventory?viewOnly=true')}>
                  <Package size={18} /><span>Inventory</span>
                </button>
                <button className={`nav-item ${isActive('/purchase', 'purchase') ? 'active' : ''}`} onClick={() => navTo('/purchase?viewOnly=true', 'purchase?viewOnly=true')}>
                  <ShoppingBag size={18} /><span>Purchase</span>
                </button>
                <button className={`nav-item ${isActive('/production', 'production') ? 'active' : ''}`} onClick={() => navTo('/production?viewOnly=true', 'production?viewOnly=true')}>
                  <ChefHat size={18} /><span>Production</span>
                </button>
                <button className={`nav-item ${isActive('/payment-settings', 'payment-settings') ? 'active' : ''}`} onClick={() => navTo('/payment-settings', 'payment-settings')}>
                  <CreditCard size={18} /><span>Pricing Console</span>
                </button>
              </nav>
            </div>
          </>
        )}

        {user?.role !== 'CENTERS' && (
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
        )}
      </div>
    );
  };

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
        
        {renderSidebar()}
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
        .nav-notification-dot {
          width: 6px;
          height: 6px;
          background: #ef4444;
          border-radius: 50%;
          margin-left: auto;
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
        }
        .dashboard-main { padding: 32px; background: var(--bg-main); flex: 1; overflow-y: auto; }
      `}</style>
    </div>
  );
};

export default MainLayout;
