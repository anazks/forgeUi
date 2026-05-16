import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Search, 
  ShieldCheck, 
  MapPin, 
  DollarSign,
  TrendingUp,
  Activity,
  ChevronRight
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { userApi, entityApi } from '../services/api';

interface UsersPageProps {
  roleType?: 'CENTER' | 'KITCHEN' | 'STORE' | 'RESORT' | 'AGGRIGATE';
}

const UsersPage: React.FC<UsersPageProps> = ({ roleType }) => {
  const navigate = useNavigate();
  const { entityId } = useParams<{ entityId: string }>();
  
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    setCurrentUser(userData);
    fetchUsers(userData);
  }, [roleType, entityId]);

  const fetchUsers = async (userData: any) => {
    try {
      setIsLoading(true);
      let res;
      if (entityId) {
        // If entityId is in URL, fetch for that specific entity
        if (roleType === 'CENTER') {
          res = await userApi.getMyCenters(entityId);
        } else if (roleType === 'KITCHEN') {
          res = await userApi.getMyKitchens(entityId);
        } else if (roleType === 'STORE') {
          res = await userApi.getMyStores(entityId);
        } else if (roleType === 'RESORT') {
          res = await userApi.getMyResorts(entityId);
        } else if (roleType === 'AGGRIGATE') {
          res = await userApi.getMyAggregates(entityId);
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
      } else if (roleType === 'AGGRIGATE') {
        res = await userApi.getMyAggregates();
      } else if (userData?.role === 'SUPER_ADMIN' || userData?.role === 'COO') {
        res = await userApi.getAll();
      } else if (userData?.entity) {
        const id = userData.entity._id || userData.entity;
        res = await entityApi.getAdmins(id);
      }
      setUsers(res?.data.data || []);
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) return <ForgeLoader />;

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>{roleType ? `${roleType} MANAGEMENT` : 'USER MANAGEMENT'}</h1>
          <p className="subtitle">{currentUser?.role === 'SUPER_ADMIN' ? 'GLOBAL SYSTEM USERS' : `PERSONNEL ROSTER`}</p>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {(roleType === 'KITCHEN' || roleType === 'CENTER' || roleType === 'STORE' || roleType === 'RESORT' || roleType === 'AGGRIGATE') && (
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

      <div className="data-panel">
        <div className="panel-header">
          <h2>{users.length} TOTAL {roleType ? `${roleType}S` : 'USERS'}</h2>
          <div className="search-box">
            <Search size={14} />
            <input type="text" placeholder="Search users..." />
          </div>
        </div>

        {(roleType === 'KITCHEN' || roleType === 'CENTER' || roleType === 'STORE' || roleType === 'RESORT' || roleType === 'AGGRIGATE') ? (
          <div className="kitchen-cards-container">
            {users.map((u) => (
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
            {users.length === 0 && <div className="empty-state">No {roleType.toLowerCase()}s found in this scope.</div>}
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
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
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
                      <div className="u-contact">
                        <p>{u.email}</p>
                        <p className="dim">{u.mobileNo}</p>
                      </div>
                    </td>
                    <td>
                      <div className="entity-tag">
                        <MapPin size={10} /> {u.entity?.name || 'SYSTEM'}
                      </div>
                    </td>
                    <td><code className="u-license">{u.licenseNumber}</code></td>
                    <td>
                      <div className={`u-expiry ${new Date(u.licenseExpires) < new Date() ? 'expired' : ''}`}>
                        {new Date(u.licenseExpires).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div className={`u-status ${u.isActive ? 'active' : 'inactive'}`}>
                        <span className="dot"></span>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <div className="empty-state">No users found in this scope.</div>}
          </div>
        )}
      </div>

      <style>{`
        .page-header { margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        
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
        .sharp-table th, .sharp-table td { text-align: center; vertical-align: middle; }
        .user-profile-cell { justify-content: center; }
        .u-contact { align-items: center; }
        .entity-tag { justify-content: center; }
        
        .search-box { position: relative; display: flex; align-items: center; margin-right: 12px; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 220px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }
        
        .panel-header { padding: 20px 24px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        
        /* Kitchen specific styles */
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

        .loading-container { display: flex; align-items: center; justify-content: center; min-height: 400px; color: var(--text-dim); }
        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
      `}</style>
    </MainLayout>
  );
};

export default UsersPage;
