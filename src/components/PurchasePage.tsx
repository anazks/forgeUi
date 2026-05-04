import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { purchaseApi, rawMaterialApi, vendorApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { 
  ShoppingBag, Plus, Search, Filter, 
  Trash2, Check, X, Calendar, 
  DollarSign, Package, TrendingUp,
  ArrowRight, Tag
} from 'lucide-react';

const PurchasePage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalSpent: 0, totalItems: 0, recentCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    item: '',
    vendor: '',
    unitPrice: 0,
    quantity: 0,
    discount: 0,
    purchaseDate: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [pRes, iRes, vRes] = await Promise.all([
        purchaseApi.getAll(),
        rawMaterialApi.getAll(entityId),
        vendorApi.getAll(entityId)
      ]);
      setPurchases(pRes.data.data || []);
      setStats(pRes.data.stats || { totalSpent: 0, totalItems: 0, recentCount: 0 });
      setItems(iRes.data.data || []);
      setVendors(vRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch purchase data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [entityId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await purchaseApi.create(formData);
      setShowModal(false);
      setFormData({
        item: '',
        vendor: '',
        unitPrice: 0,
        quantity: 0,
        discount: 0,
        purchaseDate: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save purchase');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this purchase record? Stock will be adjusted back.')) return;
    try {
      await purchaseApi.delete(id);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete purchase');
    }
  };

  const totalCost = (formData.unitPrice * formData.quantity) - formData.discount;

  const filteredPurchases = purchases.filter(p => 
    p.item?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.purchaseCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>PURCHASE MANAGEMENT</h1>
          <p className="subtitle">Inventory procurement and expense tracking</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> NEW PURCHASE
        </button>
      </header>

      {/* Top 3 Dashboard Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={20} /></div>
          <div className="stat-info">
            <label>TOTAL SPENT</label>
            <h3>₹{stats.totalSpent.toLocaleString()}</h3>
          </div>
          <div className="stat-trend up"><TrendingUp size={12} /> ALL TIME</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Package size={20} /></div>
          <div className="stat-info">
            <label>TOTAL UNITS</label>
            <h3>{stats.totalItems.toLocaleString()}</h3>
          </div>
          <div className="stat-trend">INVENTORY LOAD</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Calendar size={20} /></div>
          <div className="stat-info">
            <label>RECENT PURCHASES</label>
            <h3>{stats.recentCount}</h3>
          </div>
          <div className="stat-trend">LAST 7 DAYS</div>
        </div>
      </div>

      <div className="data-panel">
        <div className="panel-header">
          <div className="search-box">
            <Search size={14} />
            <input 
              type="text" 
              placeholder="Search purchases or items..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="panel-actions">
            <button className="icon-btn"><Filter size={14} /></button>
          </div>
        </div>

        <div className="table-wrapper">
          {isLoading ? <ForgeLoader /> : (
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>PUR-ID</th>
                  <th>ITEM NAME</th>
                  <th>DATE</th>
                  <th>UNIT PRICE</th>
                  <th>QTY</th>
                  <th>DISCOUNT</th>
                  <th>TOTAL COST</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-dim">No purchase records found.</td></tr>
                ) : filteredPurchases.map(p => (
                  <tr key={p._id}>
                    <td><span className="code-badge">{p.purchaseCode}</span></td>
                    <td className="text-left">
                      <strong>{p.item?.name.toUpperCase()}</strong>
                    </td>
                    <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                    <td>₹{p.unitPrice}</td>
                    <td><strong>{p.quantity}</strong> <span className="unit-label">{p.item?.unit}</span></td>
                    <td className="text-danger">₹{p.discount}</td>
                    <td className="text-success"><strong>₹{p.totalCost}</strong></td>
                    <td><span className="status-pill active">{p.status}</span></td>
                    <td>
                      <button className="delete-action-btn" onClick={() => handleDelete(p._id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content vendor-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2><ShoppingBag size={18} /> NEW PURCHASE ORDER</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="vendor-form">
              <div className="form-section">
                <h3><Package size={14} /> PROCUREMENT DETAILS</h3>
                <div className="form-grid">
                  <div className="input-group full-width">
                    <label>SELECT ITEM (ADMIN CONFIG)</label>
                    <select name="item" value={formData.item} onChange={handleInputChange} required>
                      <option value="">Choose item...</option>
                      {items.map(i => (
                        <option key={i._id} value={i._id}>{i.name.toUpperCase()} ({i.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>UNIT PRICE (₹)</label>
                    <input type="number" name="unitPrice" value={formData.unitPrice} onChange={handleInputChange} required min="0" step="0.01" />
                  </div>
                  <div className="input-group">
                    <label>TOTAL UNITS</label>
                    <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required min="1" />
                  </div>
                  <div className="input-group">
                    <label>DISCOUNT (₹)</label>
                    <input type="number" name="discount" value={formData.discount} onChange={handleInputChange} min="0" />
                  </div>
                  <div className="input-group">
                    <label>PURCHASE DATE</label>
                    <input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleInputChange} required />
                  </div>
                </div>
              </div>

              <div className="cost-summary-banner">
                <div className="summary-item">
                  <label>GROSS AMOUNT</label>
                  <span>₹{formData.unitPrice * formData.quantity}</span>
                </div>
                <div className="summary-item">
                  <label>DEDUCTIONS</label>
                  <span className="text-danger">- ₹{formData.discount}</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-item total">
                  <label>NET PAYABLE</label>
                  <span>₹{totalCost}</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <ForgeLoader size={16} /> : <Check size={16} />}
                  CONFIRM PURCHASE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; }

        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 24px; }
        .stat-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 20px; position: relative; overflow: hidden; display: flex; align-items: center; gap: 16px; }
        .stat-icon { width: 40px; height: 40px; background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.2); display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .stat-info label { font-size: 0.6rem; font-weight: 900; color: var(--text-dim); letter-spacing: 1px; }
        .stat-info h3 { font-size: 1.25rem; font-weight: 800; margin-top: 2px; }
        .stat-trend { position: absolute; bottom: 8px; right: 12px; font-size: 0.6rem; font-weight: 900; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
        .stat-trend.up { color: #10b981; }

        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.1); }
        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: var(--bg-main); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 280px; outline: none; transition: 0.2s; }
        .search-box input:focus { border-color: var(--primary); background: rgba(249,115,22,0.02); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }
        .icon-btn { background: var(--bg-main); border: 1px solid var(--border-strong); color: var(--text-dim); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .icon-btn:hover { color: var(--primary); border-color: var(--primary); background: rgba(249,115,22,0.05); }

        .cost-summary-banner { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 16px; margin: 0 20px 20px; display: flex; flex-direction: column; gap: 8px; }
        .summary-item { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: var(--text-dim); }
        .summary-item span { font-family: monospace; }
        .summary-divider { height: 1px; background: var(--border-main); margin: 4px 0; }
        .summary-item.total { color: var(--text-main); font-size: 0.85rem; font-weight: 900; }
        .summary-item.total span { color: var(--primary); font-size: 1rem; }

        .unit-label { font-size: 0.65rem; color: var(--text-dim); }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }

        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-content { background: var(--bg-sidebar); border: 1px solid var(--border-strong); width: 100%; position: relative; animation: modalSlide 0.3s ease-out; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        @keyframes modalSlide { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .modal-header { padding: 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h2 { font-size: 1rem; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; gap: 10px; color: var(--primary); }
        .close-btn { background: transparent; border: none; color: var(--text-dim); cursor: pointer; }

        .vendor-form { padding: 20px 0 0; }
        .form-section { padding: 0 20px 20px; }
        .form-section h3 { font-size: 0.65rem; font-weight: 900; color: var(--text-muted); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; letter-spacing: 1px; }
        
        .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .form-grid .full-width { grid-column: span 2; }
        
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .input-group input, .input-group select { background: var(--bg-main); border: 1px solid var(--border-main); padding: 10px; color: var(--text-main); font-size: 0.8rem; outline: none; transition: 0.2s; }
        .input-group input:focus, .input-group select:focus { border-color: var(--primary); background: rgba(249,115,22,0.02); }
        .input-group select option { background: var(--bg-sidebar); color: var(--text-main); }

        .modal-footer { padding: 20px; background: rgba(0,0,0,0.2); border-top: 1px solid var(--border-main); display: flex; justify-content: flex-end; gap: 12px; }
        .btn-cancel { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 10px 20px; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .btn-cancel:hover { background: rgba(255,255,255,0.05); color: var(--text-main); }
        .btn-save { background: var(--primary); border: none; color: white; padding: 10px 24px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-save:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </MainLayout>
  );
};

export default PurchasePage;
