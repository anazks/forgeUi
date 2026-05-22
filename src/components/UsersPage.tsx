import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  MapPin,
  DollarSign,
  TrendingUp,
  Activity,
  ChevronRight,
  Building2
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { userApi, entityApi } from '../services/api';

interface UsersPageProps {
  roleType?: 'CENTER' | 'KITCHEN' | 'STORE' | 'RESORT' | 'AGGREGATE' | 'RESTAURANT';
}

const UsersPage: React.FC<UsersPageProps> = ({ roleType }) => {
  const navigate = useNavigate();
  const { entityId } = useParams<{ entityId: string }>();

  const [users, setUsers] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>(entityId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState('');

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    setCurrentUser(userData);

    if (userData?.role === 'SUPER_ADMIN') {
      entityApi.getAll().then(res => {
        setEntities(res.data.data);
        if (entityId) setSelectedEntity(entityId);
      }).catch(() => setError('Failed to load entities'));
    }

    fetchUsers(userData, entityId || '');
  }, [roleType, entityId]);

  const fetchUsers = async (userData: any, eid: string) => {
    try {
      setIsLoading(true);
      let res;
      const scopeId = eid || undefined;

      if (userData?.role === 'SUPER_ADMIN') {
        if (scopeId) {
          res = await entityApi.getAdmins(scopeId);
        } else {
          setUsers([]);
          setIsLoading(false);
          return;
        }
      } else if (entityId) {
        // Admin inside an entity scope
        if (roleType === 'CENTER') {
          res = await userApi.getMyCenters(entityId);
        } else if (roleType === 'KITCHEN') {
          res = await userApi.getMyKitchens(entityId);
        } else if (roleType === 'STORE') {
          res = await userApi.getMyStores(entityId);
        } else if (roleType === 'RESORT') {
          res = await userApi.getMyResorts(entityId);
        } else if (roleType === 'AGGREGATE') {
          res = await userApi.getMyAggregates(entityId);
        } else if (roleType === 'RESTAURANT') {
          res = await userApi.getMyRestaurants(entityId);
        } else {
          res = await userApi.getAll(entityId);
        }
      } else if (roleType === 'CENTER') {
        res = await userApi.getMyCenters();
      } else if (roleType === 'KITCHEN') {
        res = await userApi.getMyKitchens();
      } else if (roleType === 'STORE') {
        res = await userApi.getMyStores();
      } else if (roleType === 'RESORT') {
        res = await userApi.getMyResorts();
      } else if (roleType === 'AGGREGATE') {
        res = await userApi.getMyAggregates();
      } else if (roleType === 'RESTAURANT') {
        res = await userApi.getMyRestaurants();
      } else if (userData?.entity) {
        const id = userData.entity._id || userData.entity;
        res = await entityApi.getAdmins(id);
      }
      setUsers(res?.data.data || []);
    } catch {
      setError('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntityChange = (eid: string) => {
    setSelectedEntity(eid);
    fetchUsers(currentUser, eid);
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <ForgeLoader />;

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>{roleType ? `${roleType} MANAGEMENT` : 'USER MANAGEMENT'}</h1>
          <p className="subtitle">{isSuperAdmin ? 'SELECT ENTITY TO MANAGE USERS' : 'PERSONNEL ROSTER'}</p>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Super Admin: Entity Picker */}
      {isSuperAdmin && (
        <div className="entity-picker">
          <div className="picker-label"><Building2 size={14} /> SELECT ENTITY</div>
          <div className="entity-cards">
            {entities.map(e => (
              <button
                key={e._id}
                className={`entity-card ${selectedEntity === e._id ? 'selected' : ''}`}
                onClick={() => handleEntityChange(e._id)}
              >
                <div className="ec-avatar">{e.name[0]}</div>
                <div className="ec-info">
                  <span className="ec-name">{e.name.toUpperCase()}</span>
                  <span className="ec-loc"><MapPin size={10} /> {e.location}</span>
                </div>
                <ChevronRight size={14} className="ec-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin: Kitchen/Center/etc stats cards */}
      {!isSuperAdmin && (roleType === 'KITCHEN' || roleType === 'CENTER' || roleType === 'STORE' || roleType === 'RESORT' || roleType === 'AGGREGATE' || roleType === 'RESTAURANT') && (
        <section className="kitchen-dashboard">
          <div className="stat-card">
            <div className="stat-icon"><DollarSign size={20} /></div>
            <div className="stat-info">
              <label>REVENUE TODAY</label>
              <h3>₹ 0.00</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><TrendingUp size={20} /></div>
            <div className="stat-info">
              <label>THIS WEEK</label>
              <h3>₹ 0.00</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Activity size={20} /></div>
            <div className="stat-info">
              <label>ACTIVE {roleType}S</label>
              <h3>{users.filter(u => u.isActive).length}</h3>
            </div>
          </div>
        </section>
      )}

      {/* Users Table / Cards */}
      {(selectedEntity || !isSuperAdmin) && (
        <div className="data-panel">
          <div className="panel-header">
            <h2>{filtered.length} {roleType || 'TOTAL'} USERS{selectedEntity && isSuperAdmin ? ` — ${entities.find(e => e._id === selectedEntity)?.name?.toUpperCase() || ''}` : ''}</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="search-box">
                <Search size={14} />
                <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {isSuperAdmin && selectedEntity && (
                <button className="btn-primary" style={{ fontSize: '0.7rem', padding: '6px 14px' }} onClick={() => navigate(`/entity/${selectedEntity}`)}>
                  MANAGE IN CONSOLE
                </button>
              )}
            </div>
          </div>

          {/* Admin kitchen-card view for specific role types */}
          {!isSuperAdmin && (roleType === 'KITCHEN' || roleType === 'CENTER' || roleType === 'STORE' || roleType === 'RESORT' || roleType === 'AGGREGATE' || roleType === 'RESTAURANT') ? (
            <div className="kitchen-cards-container">
              {filtered.map((u) => (
                <div key={u._id} className="kitchen-card">
                  <div className="k-left">
                    <div className="k-avatar">{u.name[0]}</div>
                    <div className="k-details">
                      <h4>{u.name.toUpperCase()}</h4>
                      <span className="k-contact">{u.email} • {u.mobileNo}</span>
                    </div>
                  </div>
                  <div className="k-middle">
                    <div className="k-entity"><MapPin size={12} /> {u.entity?.name || 'SYSTEM'}</div>
                    <code className="k-license">{u.licenseNumber}</code>
                  </div>
                  <div className="k-right">
                    <div className={`u-status ${u.isActive ? 'active' : 'inactive'}`}>
                      <span className="dot"></span>
                      {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                    <button className="btn-view" onClick={() => navigate(`/entity/${u.entity?._id || u.entity}`)}>
                      VIEW {roleType} <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="empty-state">No {roleType?.toLowerCase()}s found in this scope.</div>}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>USER MEMBER</th>
                    <th>CONTACT</th>
                    <th>ENTITY / UNIT</th>
                    <th>LICENSE</th>
                    <th>EXPIRY</th>
                    <th>STATUS</th>
                    {isSuperAdmin && <th className="text-right">ACTION</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u._id}>
                      <td>
                        <div className="user-profile-cell">
                          <div className="u-avatar">{u.name[0]}</div>
                          <div className="u-info">
                            <p className="u-name">{u.name.toUpperCase()}</p>
                            <p className="u-role"><ShieldCheck size={10} /> {u.role}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="u-contact"><p>{u.email}</p><p className="dim">{u.mobileNo}</p></div>
                      </td>
                      <td><div className="entity-tag"><MapPin size={10} /> {u.entity?.name || 'SYSTEM'}</div></td>
                      <td><code className="u-license">{u.licenseNumber}</code></td>
                      <td>
                        <div className={`u-expiry ${new Date(u.licenseExpires) < new Date() ? 'expired' : ''}`}>
                          {u.licenseExpires ? new Date(u.licenseExpires).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td>
                        <div className={`u-status ${u.isActive ? 'active' : 'inactive'}`}>
                          <span className="dot"></span>
                          {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </div>
                      </td>
                      {isSuperAdmin && (
                        <td className="text-right">
                          <button className="manage-btn" onClick={() => navigate(`/entity/${selectedEntity}`)}>
                            EDIT <ChevronRight size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="empty-state">{selectedEntity ? 'No users found.' : 'Select an entity above to view users.'}</div>}
            </div>
          )}
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }

        /* Super Admin entity picker */
        .entity-picker { margin-bottom: 32px; }
        .picker-label { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; margin-bottom: 12px; }
        .entity-cards { display: flex; flex-direction: column; gap: 8px; }
        .entity-card { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: var(--bg-sidebar); border: 1px solid var(--border-main); cursor: pointer; transition: 0.2s; text-align: left; }
        .entity-card:hover, .entity-card.selected { border-color: var(--primary); background: rgba(249,115,22,0.04); }
        .ec-avatar { width: 36px; height: 36px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; }
        .ec-info { flex: 1; display: flex; flex-direction: column; }
        .ec-name { font-size: 0.85rem; font-weight: 700; color: var(--text-main); }
        .ec-loc { font-size: 0.7rem; color: var(--text-dim); display: flex; align-items: center; gap: 4px; margin-top: 2px; }
        .ec-arrow { color: var(--text-dim); }
        .entity-card.selected .ec-arrow { color: var(--primary); }

        .data-panel { border: 1px solid var(--border-main); background: var(--bg-sidebar); }
        .panel-header { padding: 20px 24px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        .panel-header h2 { font-size: 0.75rem; letter-spacing: 1px; color: var(--text-dim); font-weight: 800; }

        .user-profile-cell { display: flex; align-items: center; gap: 12px; }
        .u-avatar { width: 32px; height: 32px; background: var(--border-main); color: var(--text-main); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; }
        .u-info { display: flex; flex-direction: column; }
        .u-name { font-weight: 700; font-size: 0.85rem; color: var(--text-main); }
        .u-role { font-size: 0.65rem; color: var(--primary); font-weight: 800; display: flex; align-items: center; gap: 4px; }
        .u-contact p { font-size: 0.8rem; font-weight: 500; }
        .u-contact .dim { font-size: 0.7rem; color: var(--text-dim); }
        .entity-tag { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 700; color: var(--text-dim); }
        .u-license { font-family: monospace; font-size: 0.75rem; color: var(--primary); background: rgba(249, 115, 22, 0.05); padding: 2px 6px; border: 1px solid rgba(249, 115, 22, 0.1); }
        .u-expiry { font-size: 0.75rem; font-weight: 700; color: var(--text-main); }
        .u-expiry.expired { color: #ef4444; text-decoration: line-through; }
        .u-status { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.7rem; font-weight: 800; }
        .u-status.active { color: #10b981; }
        .u-status.inactive { color: #ef4444; }
        .u-status .dot { width: 6px; height: 6px; border-radius: 0; background: currentColor; }

        /* Table Alignment & Search Box Styling */
        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.85rem; }
        .sharp-table tr:hover { background: var(--row-hover); }
        .text-right { text-align: right; }

        .manage-btn { background: none; border: 1px solid var(--border-main); color: var(--text-main); font-size: 0.65rem; font-weight: 800; padding: 5px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; margin-left: auto; }
        .manage-btn:hover { border-color: var(--primary); color: var(--primary); }

        .search-box { position: relative; display: flex; align-items: center; margin-right: 12px; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 220px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }

        /* Kitchen/Admin specific styles */
        .kitchen-dashboard { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 32px; }
        .stat-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 24px; display: flex; align-items: center; gap: 20px; }
        .stat-icon { width: 48px; height: 48px; background: rgba(249, 115, 22, 0.05); border: 1px solid rgba(249, 115, 22, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .stat-info label { display: block; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; }
        .stat-info h3 { font-size: 1.25rem; font-weight: 700; color: var(--text-main); }

        .kitchen-cards-container { padding: 24px; display: flex; flex-direction: column; gap: 16px; background: var(--bg-main); }
        .kitchen-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
        .kitchen-card:hover { border-color: var(--primary); }

        .k-left { display: flex; align-items: center; gap: 16px; min-width: 250px; }
        .k-avatar { width: 40px; height: 40px; background: rgba(249, 115, 22, 0.1); color: var(--primary); font-weight: 800; font-size: 1rem; display: flex; align-items: center; justify-content: center; }
        .k-details h4 { font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px; }
        .k-contact { font-size: 0.75rem; color: var(--text-dim); }

        .k-middle { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .k-entity { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--text-dim); }
        .k-license { font-family: monospace; font-size: 0.75rem; color: var(--primary); background: rgba(249, 115, 22, 0.05); padding: 2px 8px; border: 1px solid rgba(249, 115, 22, 0.1); }

        .k-right { display: flex; align-items: center; gap: 24px; }
        .btn-view { background: transparent; border: 1px solid var(--border-main); color: var(--text-main); padding: 8px 16px; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .btn-view:hover { background: var(--primary); color: white; border-color: var(--primary); }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
      `}</style>
    </MainLayout>
  );
};

export default UsersPage;
