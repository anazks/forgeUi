import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { rawMaterialApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2, Package, Hash } from 'lucide-react';
import { useParams } from 'react-router-dom';

const UNITS = ['kg', 'ltr', 'pcs', 'gm', 'ml', 'custom'];

const ItemConfigPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [materials, setMaterials] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    vendorName: '',
    unit: 'kg',
    customUnit: '',
    minimumStock: '',
  });

  useEffect(() => { fetchMaterials(); }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFiltered(
      materials.filter(m =>
        m.name.toLowerCase().includes(term) ||
        m.simpleCode.includes(term) ||
        (m.vendorName || '').toLowerCase().includes(term)
      )
    );
  }, [searchTerm, materials]);

  const fetchMaterials = async () => {
    try {
      setIsLoading(true);
      const res = await rawMaterialApi.getAll(entityId);
      setMaterials(res.data.data);
      setFiltered(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load raw materials');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', vendorName: '', unit: 'kg', customUnit: '', minimumStock: '' });
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (m: any) => {
    setEditingId(m._id);
    setFormData({
      name: m.name,
      vendorName: m.vendorName || '',
      unit: m.unit,
      customUnit: m.customUnit || '',
      minimumStock: m.minimumStock.toString(),
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this raw material?')) return;
    try {
      await rawMaterialApi.delete(id);
      fetchMaterials();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      const payload = {
        name: formData.name,
        vendorName: formData.vendorName,
        unit: formData.unit,
        minimumStock: Number(formData.minimumStock),
        ...(formData.unit === 'custom' && { customUnit: formData.customUnit }),
      };

      if (editingId) {
        await rawMaterialApi.update(editingId, payload);
      } else {
        await rawMaterialApi.create(payload);
      }
      setIsModalOpen(false);
      fetchMaterials();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitDisplay = (m: any) =>
    m.unit === 'custom' ? (m.customUnit || '').toUpperCase() : m.unit.toUpperCase();

  const getStockStatus = (stock: number) => {
    if (stock === 0) return 'zero';
    if (stock < 10) return 'low';
    return 'normal';
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>ITEM CONFIGURATION</h1>
          <p className="subtitle">RAW MATERIAL REGISTRY &amp; STOCK THRESHOLDS</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> ADD MATERIAL
        </button>
      </header>

      {error && !isModalOpen && <div className="error-message">{error}</div>}

      {/* Summary Cards */}
      <section className="summary-grid">
        <div className="sum-card">
          <div className="sum-icon"><Package size={20} /></div>
          <div className="sum-info">
            <label>TOTAL MATERIALS</label>
            <h3>{materials.length}</h3>
          </div>
        </div>
        <div className="sum-card warn">
          <div className="sum-icon warn"><Package size={20} /></div>
          <div className="sum-info">
            <label>LOW THRESHOLD</label>
            <h3>{materials.filter(m => m.minimumStock < 10 && m.minimumStock > 0).length}</h3>
          </div>
        </div>
        <div className="sum-card danger">
          <div className="sum-icon danger"><Package size={20} /></div>
          <div className="sum-info">
            <label>ZERO THRESHOLD</label>
            <h3>{materials.filter(m => m.minimumStock === 0).length}</h3>
          </div>
        </div>
      </section>

      <div className="data-panel">
        <div className="panel-header">
          <h2>{filtered.length} TOTAL MATERIALS</h2>
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by name, code or vendor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? <ForgeLoader /> : (
          <div className="table-wrapper">
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>MATERIAL NAME</th>
                  <th>VENDOR</th>
                  <th>UNIT</th>
                  <th>MIN. STOCK</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m._id}>
                    <td>
                      <span className="code-badge">
                        <Hash size={10} />{m.simpleCode}
                      </span>
                    </td>
                    <td>
                      <div className="material-cell">
                        <div className="mat-avatar">{m.name[0]}</div>
                        <strong>{m.name.toUpperCase()}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="vendor-name">{m.vendorName || <span className="no-vendor">—</span>}</span>
                    </td>
                    <td><span className="unit-tag">{getUnitDisplay(m)}</span></td>
                    <td>
                      <span className={`stock-val ${getStockStatus(m.minimumStock)}`}>
                        {m.minimumStock} {getUnitDisplay(m)}
                      </span>
                    </td>
                    <td>
                      <div className={`stock-status ${getStockStatus(m.minimumStock)}`}>
                        <span className="dot"></span>
                        {getStockStatus(m.minimumStock) === 'zero' ? 'NO THRESHOLD' :
                          getStockStatus(m.minimumStock) === 'low' ? 'LOW THRESHOLD' : 'CONFIGURED'}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn edit" onClick={() => handleEdit(m)} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button className="icon-btn delete" onClick={() => handleDelete(m._id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                {searchTerm ? `No results for "${searchTerm}"` : 'No raw materials configured yet. Add your first item!'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            <h2>{editingId ? 'EDIT MATERIAL' : 'ADD RAW MATERIAL'}</h2>

            {/* Auto-code notice for new entries */}
            {!editingId && (
              <div className="auto-code-notice">
                <Hash size={12} />
                <span>A 4-digit item code will be <strong>auto-generated</strong> when saved.</span>
              </div>
            )}

            {/* Show existing code when editing */}
            {editingId && (
              <div className="existing-code-display">
                <span className="ec-label">ITEM CODE</span>
                <span className="ec-value">
                  <Hash size={11} />
                  {materials.find(m => m._id === editingId)?.simpleCode || '—'}
                </span>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="standard-form">

              {/* Material Name */}
              <div className="form-group">
                <label>MATERIAL NAME</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Tomato Paste"
                />
              </div>

              {/* Vendor Name */}
              <div className="form-group">
                <label>VENDOR NAME <span className="label-hint">(optional)</span></label>
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={handleInputChange}
                  placeholder="e.g. Fresh Farms Supplies"
                />
              </div>

              <div className="form-row">
                {/* Unit */}
                <div className="form-group">
                  <label>UNIT</label>
                  <select name="unit" value={formData.unit} onChange={handleInputChange}>
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u === 'custom' ? 'Custom' : u.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Minimum Stock */}
                <div className="form-group">
                  <label>MINIMUM STOCK</label>
                  <input
                    type="number"
                    name="minimumStock"
                    value={formData.minimumStock}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {formData.unit === 'custom' && (
                <div className="form-group slide-down">
                  <label>CUSTOM UNIT NAME</label>
                  <input
                    type="text"
                    name="customUnit"
                    value={formData.customUnit}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Box, Dozen"
                  />
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting
                  ? <Loader2 size={16} className="animate-spin" />
                  : editingId ? 'UPDATE MATERIAL' : 'SAVE & GENERATE CODE'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }

        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px; }
        .sum-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 20px 24px; display: flex; align-items: center; gap: 16px; }
        .sum-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.15); color: var(--primary); }
        .sum-icon.warn { background: rgba(234,179,8,0.05); border-color: rgba(234,179,8,0.2); color: #eab308; }
        .sum-icon.danger { background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.2); color: #ef4444; }
        .sum-info label { display: block; font-size: 0.6rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; letter-spacing: 0.5px; }
        .sum-info h3 { font-size: 1.5rem; font-weight: 800; color: var(--text-main); }

        .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

        .panel-header { padding: 20px 24px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        .panel-header h2 { font-size: 0.75rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; }

        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 260px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }

        .sharp-table th, .sharp-table td { text-align: center; vertical-align: middle; }

        .code-badge { font-family: 'Courier New', monospace; font-size: 0.9rem; font-weight: 800; color: var(--primary); background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.2); padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; letter-spacing: 2px; }

        .material-cell { display: flex; align-items: center; gap: 12px; justify-content: center; }
        .mat-avatar { width: 30px; height: 30px; background: var(--border-main); color: var(--text-main); font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .vendor-name { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .no-vendor { color: var(--text-dim); opacity: 0.4; }

        .unit-tag { background: rgba(249,115,22,0.08); color: var(--primary); font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border: 1px solid rgba(249,115,22,0.2); }

        .stock-val { font-weight: 700; font-size: 0.85rem; }
        .stock-val.normal { color: #10b981; }
        .stock-val.low { color: #eab308; }
        .stock-val.zero { color: #ef4444; }

        .stock-status { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.65rem; font-weight: 800; }
        .stock-status.normal { color: #10b981; }
        .stock-status.low { color: #eab308; }
        .stock-status.zero { color: #ef4444; }
        .stock-status .dot { width: 6px; height: 6px; border-radius: 0; background: currentColor; }

        .action-buttons { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .icon-btn.edit:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.1); }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 480px; padding: 36px; position: relative; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-content h2 { margin-bottom: 16px; font-size: 1.1rem; font-weight: 800; letter-spacing: 1px; }

        /* Auto-code notice */
        .auto-code-notice { display: flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.15); padding: 10px 14px; margin-bottom: 20px; font-size: 0.75rem; color: #60a5fa; }
        .auto-code-notice strong { font-weight: 800; }

        /* Existing code display when editing */
        .existing-code-display { display: flex; align-items: center; justify-content: space-between; background: rgba(249,115,22,0.04); border: 1px solid rgba(249,115,22,0.12); padding: 10px 14px; margin-bottom: 20px; }
        .ec-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .ec-value { font-family: 'Courier New', monospace; font-size: 1.1rem; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 4px; letter-spacing: 3px; }

        .standard-form .form-group { margin-bottom: 20px; }
        .standard-form label { display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .label-hint { font-weight: 500; color: var(--text-dim); font-size: 0.65rem; text-transform: none; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; font-size: 0.85rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover:not(:disabled) { background: #ea580c; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; }
        .slide-down { animation: slideDown 0.25s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </MainLayout>
  );
};

export default ItemConfigPage;
