import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, ChevronRight, Loader2, Search,
  Building, Activity, Users, Bell,
  Calendar, AlertTriangle, TrendingUp
} from 'lucide-react';
import { entityApi, eventApi, paymentApi } from '../services/api';
import MainLayout from '../layouts/MainLayout';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [entities, setEntities] = useState<any[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newEntity, setNewEntity] = useState({ username: '', name: '', location: '' });
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [adminPersonnel, setAdminPersonnel] = useState<any[]>([]);

  // Revenue chart state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [yearTotal, setYearTotal] = useState(0);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchRevenue = async (year: number) => {
    try {
      const res = await paymentApi.getMonthlyRevenue(year);
      setRevenueData(res.data.data);
      setYearTotal(res.data.yearTotal);
    } catch { setRevenueData([]); setYearTotal(0); }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      setUser(userData);

      const eventRes = await eventApi.getUpcoming();
      setUpcomingEvents(eventRes.data.data || []);

      if (userData?.role === 'SUPER_ADMIN') {
        const [entityRes, renewalRes] = await Promise.all([
          entityApi.getAll(),
          entityApi.getUpcomingRenewals()
        ]);
        setEntities(entityRes.data.data);
        setUpcomingRenewals(renewalRes.data.data || []);
        await fetchRevenue(selectedYear);
      } else if (userData?.entity) {
        const userEntity = userData.entity;
        setEntities([userEntity]);
        const personnelRes = await entityApi.getAdmins(userEntity._id || userEntity);
        setAdminPersonnel(personnelRes.data.data);
      }
    } catch { setError('Failed to fetch data'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    if (userData?.role === 'STORE') { navigate('/store-dashboard'); return; }
    fetchData();
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') fetchRevenue(selectedYear);
  }, [selectedYear]);

  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await entityApi.create(newEntity);
      setNewEntity({ username: '', name: '', location: '' });
      setIsAdding(false);
      fetchData();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to create entity'); }
  };

  const getDaysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  // Bar chart helpers
  const maxRevenue = Math.max(...revenueData.map(m => m.total), 1);

  if (isLoading) return <MainLayout><div className="loading-container"><Loader2 className="animate-spin" /></div></MainLayout>;

  return (
    <MainLayout>
      <header className="main-header">
        <div className="header-title">
          <h1>OPERATIONAL OVERVIEW</h1>
          <p className="subtitle">Enterprise resource management</p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button className="btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={16} /> REGISTER UNIT
          </button>
        )}
      </header>

      {/* Event Notifications */}
      {upcomingEvents.length > 0 && (
        <div className="event-notification-bar">
          {upcomingEvents.map(ev => (
            <div key={ev._id} className="event-alert-card">
              <div className="alert-icon-wrap"><Bell className="bell-pulse" size={18} /></div>
              <div className="alert-text">
                <p className="alert-label">UPCOMING TOMORROW</p>
                <h3 className="alert-title">{ev.eventName.toUpperCase()}</h3>
                <p className="alert-desc">{ev.description || 'No additional details.'}</p>
              </div>
              <div className="alert-type-badge">{ev.type}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── SUPER ADMIN VIEW ── */}
      {user?.role === 'SUPER_ADMIN' ? (
        <>
          {/* Stats */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><Building size={20} /></div>
              <div className="stat-info"><label>ACTIVE ENTITIES</label><h3>{entities.length}</h3></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Users size={20} /></div>
              <div className="stat-info">
                <label>TOTAL USERS</label>
                <h3>{entities.reduce((a, e) => a + (e.admins?.length || 0), 0)}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Activity size={20} /></div>
              <div className="stat-info"><label>SYSTEM STATUS</label><h3>OPERATIONAL</h3></div>
            </div>
          </section>

          {/* Revenue Chart */}
          <div className="data-panel revenue-panel">
            <div className="panel-header">
              <div className="revenue-title">
                <TrendingUp size={16} />
                <h2>MONTHLY REVENUE</h2>
                <span className="year-total">₹{yearTotal.toLocaleString()} total</span>
              </div>
              <select
                className="year-select"
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="chart-area">
              {revenueData.map((m, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-value">
                    {m.total > 0 ? `₹${(m.total / 1000).toFixed(1)}k` : ''}
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ height: `${(m.total / maxRevenue) * 100}%` }}
                      title={`₹${m.total.toLocaleString()} (${m.count} payment${m.count !== 1 ? 's' : ''})`}
                    />
                  </div>
                  <div className="bar-month">{MONTHS[i]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Entities + Renewals */}
          <div className="main-grid">
            <div className="data-panel">
              <div className="panel-header">
                <h2>BUSINESS UNITS ({entities.length})</h2>
                <div className="search-box"><Search size={14} /><input type="text" placeholder="Filter entities..." /></div>
              </div>
              <div className="table-wrapper">
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>ENTITY NAME</th><th>LOCATION</th><th>IDENTIFIER</th><th>USERS</th><th className="text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map(entity => (
                      <tr key={entity?._id}>
                        <td>
                          <div className="entity-cell">
                            <div className="entity-avatar">{entity?.name?.[0] || 'E'}</div>
                            <span className="entity-name">{entity?.name?.toUpperCase()}</span>
                          </div>
                        </td>
                        <td>{entity?.location}</td>
                        <td><code className="u-code">#{entity?.username}</code></td>
                        <td><div className="user-count"><Users size={12} /> {entity?.admins?.length || 0}</div></td>
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

            {/* Upcoming Renewals */}
            <div className="data-panel">
              <div className="panel-header">
                <h2><Calendar size={14} style={{marginRight:6,display:'inline'}} />UPCOMING RENEWALS</h2>
              </div>
              <div className="renewal-list">
                {upcomingRenewals.length === 0 && <p className="empty-msg">No renewals in next 6 months</p>}
                {upcomingRenewals.map(u => {
                  const days = getDaysUntil(u.licenseExpires);
                  const isUrgent = days <= 30;
                  return (
                    <div className={`renewal-item ${isUrgent ? 'urgent' : ''}`} key={u._id}>
                      <div className="renewal-left">
                        {isUrgent && <AlertTriangle size={12} className="warn-icon" />}
                        <div>
                          <p className="renewal-name">{u.name}</p>
                          <p className="renewal-entity">{u.entity?.name || '—'}</p>
                        </div>
                      </div>
                      <div className="renewal-right">
                        <p className="renewal-date">{new Date(u.licenseExpires).toLocaleDateString()}</p>
                        <p className={`renewal-days ${isUrgent ? 'urgent-text' : ''}`}>{days}d left</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        // Admin / Partner stats
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon"><Building size={20} /></div>
            <div className="stat-info"><label>MY BUSINESS UNIT</label><h3>{entities[0]?.name?.toUpperCase() || 'UNLINKED'}</h3></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Users size={20} /></div>
            <div className="stat-info"><label>ACTIVE PERSONNEL</label><h3>{adminPersonnel.length}</h3></div>
          </div>
          <div className="stat-card clickable" onClick={() => navigate(`/entity/${user?.entity?._id || user?.entity}`)}>
            <div className="stat-icon"><Activity size={20} /></div>
            <div className="stat-info"><label>OPERATIONAL STATUS</label><h3>ACTIVE</h3></div>
            <div className="stat-trend"><ChevronRight size={14} /></div>
          </div>
        </section>
      )}

      {/* Add Entity Modal */}
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
              {error && <div className="error-message">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsAdding(false); setError(''); }}>CANCEL</button>
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
        .event-alert-card { background: rgba(249,115,22,0.03); border: 1px solid rgba(249,115,22,0.2); padding: 16px 24px; display: flex; align-items: center; gap: 20px; position: relative; overflow: hidden; }
        .event-alert-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--primary); }
        .alert-icon-wrap { width: 40px; height: 40px; background: rgba(249,115,22,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .bell-pulse { animation: alert-pulse 2s infinite; }
        @keyframes alert-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        .alert-text { flex: 1; }
        .alert-label { font-size: 0.6rem; font-weight: 900; color: var(--primary); letter-spacing: 2px; margin-bottom: 2px; }
        .alert-title { font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px; }
        .alert-desc { font-size: 0.75rem; color: var(--text-dim); font-weight: 600; }
        .alert-type-badge { font-size: 0.65rem; font-weight: 900; color: var(--text-dim); background: rgba(0,0,0,0.2); padding: 4px 10px; border: 1px solid var(--border-main); }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 32px; }
        .stat-card { border: 1px solid var(--border-main); padding: 24px; display: flex; align-items: center; gap: 20px; position: relative; transition: 0.2s; }
        .stat-card.clickable { cursor: pointer; }
        .stat-card.clickable:hover { border-color: var(--primary); }
        .stat-icon { width: 48px; height: 48px; background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.1); display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .stat-info label { display: block; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; }
        .stat-info h3 { font-size: 1.25rem; font-weight: 700; }
        .stat-trend { position: absolute; top: 12px; right: 12px; }

        /* Revenue Chart */
        .revenue-panel { border: 1px solid var(--border-main); background: var(--bg-sidebar); margin-bottom: 32px; }
        .revenue-title { display: flex; align-items: center; gap: 10px; }
        .revenue-title h2 { font-size: 0.75rem; letter-spacing: 1px; color: var(--text-dim); font-weight: 800; }
        .year-total { font-size: 0.75rem; font-weight: 700; color: var(--primary); background: rgba(249,115,22,0.08); padding: 2px 8px; border: 1px solid rgba(249,115,22,0.15); }
        .year-select { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); color: var(--text-main); padding: 6px 12px; font-size: 0.75rem; font-weight: 700; cursor: pointer; outline: none; }
        .year-select:focus { border-color: var(--primary); }
        .chart-area { display: flex; align-items: flex-end; gap: 6px; padding: 20px 24px 12px; height: 200px; }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
        .bar-value { font-size: 0.6rem; font-weight: 700; color: var(--primary); min-height: 14px; }
        .bar-track { flex: 1; width: 100%; background: rgba(249,115,22,0.06); border: 1px solid var(--border-main); position: relative; display: flex; align-items: flex-end; }
        .bar-fill { width: 100%; background: linear-gradient(to top, var(--primary), rgba(249,115,22,0.5)); transition: height 0.6s ease; min-height: 2px; }
        .bar-month { font-size: 0.6rem; font-weight: 700; color: var(--text-dim); }
        .bar-col:hover .bar-fill { background: linear-gradient(to top, #fb923c, rgba(249,115,22,0.8)); }

        .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
        .data-panel { border: 1px solid var(--border-main); background: var(--bg-sidebar); }
        .panel-header { padding: 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        .panel-header h2 { font-size: 0.75rem; letter-spacing: 1px; color: var(--text-dim); font-weight: 800; display: flex; align-items: center; }

        .entity-cell { display: flex; align-items: center; gap: 12px; }
        .entity-avatar { width: 32px; height: 32px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; }
        .entity-name { font-weight: 700; font-size: 0.85rem; }
        .u-code { font-family: monospace; color: var(--primary); font-size: 0.8rem; }
        .user-count { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-muted); }
        .manage-btn { background: none; border: 1px solid var(--border-main); color: var(--text-main); font-size: 0.65rem; font-weight: 800; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .manage-btn:hover { border-color: var(--primary); color: var(--primary); }

        .renewal-list { max-height: 420px; overflow-y: auto; }
        .renewal-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid var(--border-main); transition: 0.2s; }
        .renewal-item:hover { background: var(--row-hover); }
        .renewal-item.urgent { background: rgba(239,68,68,0.03); border-left: 3px solid #ef4444; }
        .renewal-left { display: flex; align-items: center; gap: 10px; }
        .warn-icon { color: #ef4444; flex-shrink: 0; }
        .renewal-name { font-weight: 700; font-size: 0.85rem; color: var(--text-main); }
        .renewal-entity { font-size: 0.7rem; color: var(--text-dim); margin-top: 2px; }
        .renewal-right { text-align: right; }
        .renewal-date { font-size: 0.8rem; font-weight: 700; color: var(--text-main); }
        .renewal-days { font-size: 0.7rem; color: var(--text-dim); margin-top: 2px; }
        .renewal-days.urgent-text { color: #ef4444; font-weight: 800; }
        .empty-msg { text-align: center; color: var(--text-dim); padding: 40px; font-size: 0.8rem; }

        .sharp-table { width: 100%; border-collapse: collapse; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.85rem; color: var(--text-muted); }
        .sharp-table tr:hover { background: var(--row-hover); }
        .text-right { text-align: right; }

        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 6px 12px 6px 32px; font-size: 0.75rem; color: var(--text-main); width: 180px; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 10px; color: var(--text-dim); }
        .loading-container { display: flex; align-items: center; justify-content: center; min-height: 400px; }
      `}</style>
    </MainLayout>
  );
};

export default Dashboard;
