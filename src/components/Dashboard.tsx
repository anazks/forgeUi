import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  ChevronRight, 
  Loader2,
  Search,
  Building,
  DollarSign,
  Activity,
  ArrowUpRight,
  Users,
  Bell,
  Info
} from 'lucide-react';
import { entityApi, paymentApi, eventApi } from '../services/api';
import MainLayout from '../layouts/MainLayout';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [entities, setEntities] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, recentPayments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newEntity, setNewEntity] = useState({ username: '', name: '', location: '', password: 'password123' });
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  const [adminPersonnel, setAdminPersonnel] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      setUser(userData);

      const eventRes = await eventApi.getUpcoming();
      setUpcomingEvents(eventRes.data.data || []);

      if (userData?.role === 'SUPER_ADMIN') {
        const [entityRes, paymentRes] = await Promise.all([
          entityApi.getAll(),
          paymentApi.getStats()
        ]);
        setEntities(entityRes.data.data);
        setStats(paymentRes.data);
      } else if (userData?.entity) {
        // Use populated entity from user data if available
        const userEntity = userData.entity;
        setEntities([userEntity]);
        
        // Still need to fetch personnel for the unit
        const personnelRes = await entityApi.getAdmins(userEntity._id || userEntity);
        setAdminPersonnel(personnelRes.data.data);
        setStats({ totalRevenue: 0, recentPayments: [] });
      }
    } catch (err: any) {
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    // STORE managers have their own dedicated dashboard
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    if (userData?.role === 'STORE') {
      navigate('/store-dashboard');
      return;
    }
    fetchData();
  }, []);

  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await entityApi.create(newEntity);
      setNewEntity({ username: '', name: '', location: '', password: 'password123' });
      setIsAdding(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create entity');
    }
  };

  if (isLoading) {
    return <MainLayout><div className="loading-container"><Loader2 className="animate-spin" /></div></MainLayout>;
  }

  return (
    <MainLayout>
        <header className="main-header">
          <div className="header-title">
            <h1>OPERATIONAL OVERVIEW</h1>
            <p className="subtitle">Enterprise resource management and financial monitoring</p>
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <button className="btn-primary" onClick={() => setIsAdding(true)}>
              <Plus size={16} /> REGISTER UNIT
            </button>
          )}
        </header>

        {/* Upcoming Event Notifications */}
        {upcomingEvents.length > 0 && (
          <div className="event-notification-bar">
            {upcomingEvents.map(ev => (
              <div key={ev._id} className="event-alert-card">
                <div className="alert-icon-wrap">
                  <Bell className="bell-pulse" size={18} />
                </div>
                <div className="alert-text">
                  <p className="alert-label">UPCOMING TOMORROW</p>
                  <h3 className="alert-title">{ev.eventName.toUpperCase()}</h3>
                  <p className="alert-desc">{ev.description || 'No additional details provided.'}</p>
                </div>
                <div className="alert-type-badge">
                  {ev.type}
                </div>
              </div>
            ))}
          </div>
        )}

        {user?.role === 'SUPER_ADMIN' ? (
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><DollarSign size={20} /></div>
              <div className="stat-info">
                <label>TOTAL REVENUE (INR)</label>
                <h3>₹{stats.totalRevenue.toLocaleString()}</h3>
              </div>
              <div className="stat-trend up"><ArrowUpRight size={14} /> 12%</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Building size={20} /></div>
              <div className="stat-info">
                <label>ACTIVE UNITS</label>
                <h3>{entities.length}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Activity size={20} /></div>
              <div className="stat-info">
                <label>SYSTEM STATUS</label>
                <h3>OPERATIONAL</h3>
              </div>
            </div>
          </section>
        ) : (
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><Building size={20} /></div>
              <div className="stat-info">
                <label>MY BUSINESS UNIT</label>
                <h3>{entities[0]?.name?.toUpperCase() || 'UNLINKED'}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Users size={20} /></div>
              <div className="stat-info">
                <label>ACTIVE PERSONNEL</label>
                <h3>{adminPersonnel.length}</h3>
              </div>
            </div>
            <div className="stat-card clickable" onClick={() => navigate(`/entity/${user?.entity}`)}>
              <div className="stat-icon"><Activity size={20} /></div>
              <div className="stat-info">
                <label>OPERATIONAL STATUS</label>
                <h3>ACTIVE</h3>
              </div>
              <div className="stat-trend"><ChevronRight size={14} /></div>
            </div>
          </section>
        )}

      <div className="main-grid full-width">
        {user?.role === 'SUPER_ADMIN' && (
          <div className="data-panel entities-panel">
            <div className="panel-header">
              <h2>BUSINESS UNITS</h2>
              <div className="search-box">
                <Search size={14} />
                <input type="text" placeholder="Filter entities..." />
              </div>
            </div>
            
            <div className="table-wrapper">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>ENTITY NAME</th>
                    <th>LOCATION</th>
                    <th>IDENTIFIER</th>
                    <th>PERSONNEL</th>
                    <th className="text-right">MANAGEMENT</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity) => (
                    <tr key={entity?._id}>
                      <td>
                        <div className="entity-cell">
                          <div className="entity-avatar">{entity?.name?.[0] || 'E'}</div>
                          <span className="entity-name">{entity?.name?.toUpperCase()}</span>
                        </div>
                      </td>
                      <td>{entity?.location}</td>
                      <td><code className="u-code">#{entity?.username}</code></td>
                      <td>
                        <div className="user-count">
                          <Users size={12} /> {entity?.admins?.length || 0}
                        </div>
                      </td>
                      <td className="text-right">
                        <button className="manage-btn" onClick={() => navigate(`/entity/${entity?._id}`)}>
                          CONSOLE <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {user?.role === 'SUPER_ADMIN' && (
          <div className="data-panel payments-panel">
            <div className="panel-header">
              <h2>RECENT REVENUE</h2>
            </div>
            <div className="payment-list">
              {stats.recentPayments.map((payment: any) => (
                <div className="payment-item" key={payment._id}>
                  <div className="payment-main">
                    <p className="pay-user">{payment.admin?.name}</p>
                    <p className="pay-meta">{payment.admin?.licenseNumber}</p>
                  </div>
                  <div className="payment-amount text-right">
                    <p className="amt">₹{payment.amount}</p>
                    <p className="pay-date">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {stats.recentPayments.length === 0 && <p className="empty-msg">No transactions found</p>}
            </div>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>PROVISION NEW UNIT</h2></div>
            <form onSubmit={handleAddEntity}>
              <div className="provision-grid">
                <div className="input-group"><label>ENTITY NAME</label><input className="input-field" value={newEntity.name} onChange={e => setNewEntity({...newEntity, name: e.target.value})} required /></div>
                <div className="input-group"><label>LOCATION</label><input className="input-field" value={newEntity.location} onChange={e => setNewEntity({...newEntity, location: e.target.value})} required /></div>
                <div className="input-group"><label>IDENTIFIER (USERNAME)</label><input className="input-field" value={newEntity.username} onChange={e => setNewEntity({...newEntity, username: e.target.value})} required /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAdding(false)}>CANCEL</button>
                <button type="submit" className="btn-primary">CREATE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .main-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
        .header-title h1 { font-size: 1.5rem; letter-spacing: 2px; }
        .subtitle { color: var(--text-dim); font-size: 0.8rem; font-weight: 700; margin-top: 4px; }

        .event-notification-bar { margin-bottom: 32px; display: flex; flex-direction: column; gap: 12px; }
        .event-alert-card { background: rgba(249, 115, 22, 0.03); border: 1px solid rgba(249, 115, 22, 0.2); padding: 16px 24px; display: flex; align-items: center; gap: 20px; position: relative; overflow: hidden; }
        .event-alert-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--primary); }
        .alert-icon-wrap { width: 40px; height: 40px; background: rgba(249, 115, 22, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .bell-pulse { animation: alert-pulse 2s infinite; }
        @keyframes alert-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        .alert-text { flex: 1; }
        .alert-label { font-size: 0.6rem; font-weight: 900; color: var(--primary); letter-spacing: 2px; margin-bottom: 2px; }
        .alert-title { font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px; }
        .alert-desc { font-size: 0.75rem; color: var(--text-dim); font-weight: 600; }
        .alert-type-badge { font-size: 0.65rem; font-weight: 900; color: var(--text-dim); background: rgba(0,0,0,0.2); padding: 4px 10px; border: 1px solid var(--border-main); }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
        .stat-card { border: 1px solid var(--border-main); padding: 24px; display: flex; align-items: center; gap: 20px; position: relative; }
        .stat-icon { width: 48px; height: 48px; background: rgba(249, 115, 22, 0.05); border: 1px solid rgba(249, 115, 22, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .stat-info label { display: block; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; }
        .stat-info h3 { font-size: 1.25rem; font-weight: 700; }
        .stat-trend { position: absolute; top: 12px; right: 12px; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 2px; }
        .stat-trend.up { color: #10b981; }

        .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
        .data-panel { border: 1px solid var(--border-main); background: var(--bg-sidebar); }
        .panel-header { padding: 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        .panel-header h2 { font-size: 0.75rem; letter-spacing: 1px; color: var(--text-dim); font-weight: 800; }

        .entity-cell { display: flex; align-items: center; gap: 12px; }
        .entity-avatar { width: 32px; height: 32px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; }
        .entity-name { font-weight: 700; font-size: 0.85rem; }
        .u-code { font-family: monospace; color: var(--primary); font-size: 0.8rem; }
        .user-count { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted); }
        .manage-btn { background: none; border: 1px solid var(--border-main); color: var(--text-main); font-size: 0.65rem; font-weight: 800; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .manage-btn:hover { border-color: var(--primary); color: var(--primary); }

        .payment-list { padding: 0 20px; max-height: 400px; overflow-y: auto; }
        .payment-list::-webkit-scrollbar { width: 4px; }
        .payment-list::-webkit-scrollbar-track { background: transparent; }
        .payment-list::-webkit-scrollbar-thumb { background: var(--border-main); }
        .payment-item { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border-main); }
        .payment-item:last-child { border-bottom: none; }
        .pay-user { font-weight: 700; font-size: 0.85rem; }
        .pay-meta { font-size: 0.7rem; color: var(--text-dim); margin-top: 2px; font-family: monospace; }
        .amt { font-weight: 800; color: #10b981; font-size: 0.9rem; }
        .pay-date { font-size: 0.65rem; color: var(--text-dim); margin-top: 2px; }
        .empty-msg { text-align: center; color: var(--text-dim); padding: 40px; font-size: 0.8rem; }
        
        .main-grid.full-width { grid-template-columns: 1fr; }
        .user-info { display: flex; flex-direction: column; }
        .u-name { font-weight: 700; color: var(--text-main); font-size: 0.85rem; }
        .u-role { font-size: 0.7rem; color: var(--text-dim); }
        .u-tag { background: rgba(249, 115, 22, 0.05); border: 1px solid rgba(249, 115, 22, 0.1); padding: 2px 8px; font-size: 0.65rem; font-weight: 800; color: var(--primary); }
        .u-status { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; font-weight: 800; }
        .u-status.active { color: #10b981; }
        .u-status.inactive { color: #ef4444; }
        .u-status .dot { width: 6px; height: 6px; border-radius: 0; background: currentColor; }
        
        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 6px 12px 6px 32px; font-size: 0.75rem; color: var(--text-main); width: 180px; }
        .search-box svg { position: absolute; left: 10px; color: var(--text-dim); }
        .loading-container { display: flex; align-items: center; justify-content: center; min-height: 400px; }
      `}</style>
    </MainLayout>
  );
};

export default Dashboard;
