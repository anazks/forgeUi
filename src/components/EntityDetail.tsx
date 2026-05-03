import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserPlus, 
  MapPin, 
  Loader2,
  ShieldCheck,
  Trash2,
  Edit2,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { entityApi, userApi, paymentApi } from '../services/api';
import MainLayout from '../layouts/MainLayout';

const EntityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<any>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [renewalData, setRenewalData] = useState({ amount: 0, duration: 1 });
  
  const [newUser, setNewUser] = useState<any>({
    name: '',
    email: '',
    password: '',
    mobileNo: '',
    area: '',
    role: 'ADMIN',
    duration: 1,
    commissionRate: 0
  });
  const [error, setError] = useState('');

  const fetchData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await entityApi.getAll();
      const found = res.data.data.find((e: any) => e._id === id);
      setEntity(found);
      
      const adminRes = await entityApi.getAdmins(id);
      setAdmins(adminRes.data.data);
    } catch (err) {
      setError('Failed to fetch details');
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
    fetchData();
  }, [id]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      if (newUser._id) {
        await userApi.update(newUser._id, newUser);
      } else {
        await entityApi.addAdmin(id, newUser);
      }
      setIsAddingUser(false);
      setNewUser({ name: '', email: '', password: '', mobileNo: '', area: '', role: 'ADMIN', duration: 1, commissionRate: 0 });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await userApi.delete(userId);
      fetchData();
    } catch (err) {
      setError('Delete failed');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await userApi.toggleStatus(userId);
      fetchData();
    } catch (err) {
      setError('Toggle failed');
    }
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    if (!window.confirm(`Confirm renewal of ₹${renewalData.amount} for ${selectedUser.name}?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      await paymentApi.manualRenewal({
        adminId: selectedUser._id,
        amount: renewalData.amount,
        duration: renewalData.duration
      });
      
      setIsRenewing(false);
      setSelectedUser(null);
      setRenewalData({ amount: 0, duration: 1 });
      alert('RENEWAL SUCCESSFUL');
      fetchData();
    } catch (err) {
      setError('Renewal failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <MainLayout><div className="loading-container"><Loader2 className="animate-spin" /></div></MainLayout>;
  if (!entity) return <MainLayout><div className="loading-container">NOT FOUND</div></MainLayout>;

  return (
    <MainLayout>
      <nav className="breadcrumb">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={14} /> BACK
        </button>
      </nav>

      <header className="entity-header">
        <div className="entity-title">
          <span className="status-label">OPERATIONAL UNIT</span>
          <h1>{entity.name.toUpperCase()}</h1>
          <div className="meta-row">
            <span className="code">#{entity.username}</span>
            <span className="loc"><MapPin size={12} /> {entity.location}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => {
          setNewUser({ name: '', email: '', password: '', mobileNo: '', area: '', role: 'ADMIN', duration: 1, commissionRate: 0 });
          setIsAddingUser(true);
        }}>
          <UserPlus size={16} /> ADD USER
        </button>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="management-section">
        <div className="table-wrapper">
          <table className="sharp-table">
            <thead>
              <tr>
                <th>USER MEMBER</th>
                <th>CONTACT</th>
                <th>LICENSE NUMBER</th>
                <th>STATUS</th>
                <th>EXPIRY</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td>
                    <div className="user-info">
                      <p className="u-name">{admin.name}</p>
                      <p className="u-role"><ShieldCheck size={10} /> {admin.role}</p>
                    </div>
                  </td>
                  <td><div className="u-contact"><p>{admin.email}</p><p>{admin.mobileNo}</p></div></td>
                  <td><code className="u-license">{admin.licenseNumber}</code></td>
                  <td>
                    <button className={`status-pill ${admin.isActive ? 'active' : 'inactive'}`} onClick={() => handleToggleStatus(admin._id)}>
                      {admin.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      {admin.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td>
                    <div className={`u-status ${new Date(admin.licenseExpires) < new Date() ? 'expired' : ''}`}>
                      <span className="dot"></span>
                      {new Date(admin.licenseExpires).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="action-btns">
                      <button className="icon-btn renew" title="Renew License" onClick={() => { setSelectedUser(admin); setIsRenewing(true); }}><RefreshCw size={14} /></button>
                      <button className="icon-btn edit" onClick={() => { setNewUser({...admin, password: ''}); setIsAddingUser(true); }}><Edit2 size={14} /></button>
                      <button className="icon-btn delete" onClick={() => handleDeleteUser(admin._id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr><td colSpan={6} className="empty-row">NO PERSONNEL REGISTERED</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>{newUser._id ? 'UPDATE' : 'ADD'} USER</h2></div>
            <form onSubmit={handleAddUser}>
              <div className="provision-grid">
                <div className="input-group"><label>NAME</label><input className="input-field" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required /></div>
                <div className="input-group"><label>EMAIL</label><input className="input-field" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required /></div>
                {!newUser._id && <div className="input-group"><label>PASSWORD</label><input className="input-field" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required /></div>}
                <div className="input-group"><label>CONTACT</label><input className="input-field" value={newUser.mobileNo} onChange={e => setNewUser({...newUser, mobileNo: e.target.value})} /></div>
                <div className="input-group"><label>AREA</label><input className="input-field" value={newUser.area} onChange={e => setNewUser({...newUser, area: e.target.value})} /></div>
                <div className="input-group"><label>ROLE</label>
                  <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="ADMIN">ADMIN</option><option value="KITCHEN">KITCHEN</option><option value="CENTERS">CENTERS</option><option value="STORE">STORE</option><option value="COO">COO</option><option value="RESORT">RESORT</option><option value="AGGRIGATE">AGGRIGATE</option>
                  </select>
                </div>
                {newUser.role === 'AGGRIGATE' && <div className="input-group"><label>COMMISSION %</label><input type="number" className="input-field" value={newUser.commissionRate} onChange={e => setNewUser({...newUser, commissionRate: parseFloat(e.target.value)})} required /></div>}
                {!newUser._id && <div className="input-group"><label>LICENSE MONTHS</label>
                  <select className="input-field" value={newUser.duration} onChange={e => setNewUser({...newUser, duration: parseInt(e.target.value)})}>
                    <option value={1}>1 MONTH</option><option value={4}>4 MONTHS</option><option value={6}>6 MONTHS</option><option value={12}>12 MONTHS</option>
                  </select>
                </div>}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAddingUser(false)}>CANCEL</button>
                <button type="submit" className="btn-primary">SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRenewing && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>RENEW LICENSE - {selectedUser?.name}</h2></div>
            <form onSubmit={handleRenew}>
              <div className="provision-grid">
                <div className="input-group">
                  <label>AMOUNT PAID (INR)</label>
                  <div className="input-wrapper">
                    <span className="inr-symbol">₹</span>
                    <input type="number" className="input-field pl-10" value={renewalData.amount} onChange={e => setRenewalData({...renewalData, amount: parseFloat(e.target.value)})} required />
                  </div>
                </div>
                <div className="input-group">
                  <label>DURATION (MONTHS)</label>
                  <select className="input-field" value={renewalData.duration} onChange={e => setRenewalData({...renewalData, duration: parseInt(e.target.value)})}>
                    <option value={1}>1 MONTH</option><option value={4}>4 MONTHS</option><option value={6}>6 MONTHS</option><option value={12}>12 MONTHS</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsRenewing(false)}>CANCEL</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'PROCESSING...' : 'CONFIRM PAYMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .breadcrumb { margin-bottom: 24px; }
        .back-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .back-btn:hover { color: var(--text-main); }
        
        .entity-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; border-bottom: 1px solid var(--border-main); padding-bottom: 16px; }
        .status-label { font-size: 0.65rem; font-weight: 800; color: var(--primary); letter-spacing: 1px; }
        .meta-row { display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-dim); font-weight: 700; margin-top: 4px; }
        .meta-row .code { color: var(--text-main); }

        .table-wrapper { border: 1px solid var(--border-main); background: var(--bg-sidebar); }
        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.85rem; color: var(--text-muted); }
        .sharp-table tr:hover { background: var(--row-hover); }
        
        .u-name { font-weight: 700; color: var(--text-main); font-size: 0.9rem; }
        .u-role { font-size: 0.65rem; color: var(--primary); font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
        .u-contact p { margin-bottom: 2px; }
        .u-tag { border: 1px solid var(--border-main); padding: 2px 8px; font-size: 0.7rem; font-weight: 700; }
        .u-status { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; }
        .u-status .dot { width: 6px; height: 6px; background: #10b981; }
        
        .status-pill { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-main); padding: 4px 12px; background: none; color: var(--text-muted); font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .status-pill.active { color: #10b981; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); }
        .status-pill.inactive { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); }
        .u-status.expired { color: #ef4444; }
        .u-status.expired .dot { background: #ef4444; box-shadow: 0 0 10px #ef4444; }

        .action-btns { display: flex; gap: 8px; justify-content: flex-end; }
        .icon-btn { background: none; border: 1px solid var(--border-main); color: var(--text-dim); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .icon-btn:hover { color: var(--text-main); border-color: var(--text-main); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
        .icon-btn.edit:hover { color: var(--primary); border-color: var(--primary); background: rgba(249, 115, 22, 0.05); }
        .icon-btn.renew:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
        
        .u-license { font-family: monospace; font-size: 0.75rem; color: var(--primary); background: rgba(249, 115, 22, 0.05); padding: 2px 6px; border: 1px solid rgba(249, 115, 22, 0.1); }
        .text-right { text-align: right; }
        
        .provision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pl-10 { padding-left: 40px !important; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .inr-symbol { position: absolute; left: 12px; color: var(--text-main); font-weight: 800; font-size: 1rem; }
        .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 16px; color: var(--text-dim); }
        .empty-row { padding: 40px !important; text-align: center; color: var(--text-dim); }
      `}</style>
    </MainLayout>
  );
};

export default EntityDetail;
