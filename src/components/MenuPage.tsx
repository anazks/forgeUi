import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { menuApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2 } from 'lucide-react';

const MenuPage: React.FC = () => {
  const [menus, setMenus] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    unitPrice: '',
    unit: 'kg',
    customUnit: ''
  });

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      setIsLoading(true);
      const res = await menuApi.getAll();
      setMenus(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (menu: any) => {
    setEditingId(menu._id);
    setFormData({
      name: menu.name,
      unitPrice: menu.unitPrice.toString(),
      unit: menu.unit,
      customUnit: menu.customUnit || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await menuApi.delete(id);
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete menu item');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', unitPrice: '', unit: 'kg', customUnit: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      
      const payload = {
        name: formData.name,
        unitPrice: Number(formData.unitPrice),
        unit: formData.unit,
        ...(formData.unit === 'custom' && { customUnit: formData.customUnit })
      };

      if (editingId) {
        await menuApi.update(editingId, payload);
      } else {
        await menuApi.create(payload);
      }
      
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', unitPrice: '', unit: 'kg', customUnit: '' });
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>MENU MANAGEMENT</h1>
          <p className="subtitle">PRODUCT CATALOG & PRICING</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> ADD MENU ITEM
        </button>
      </header>

      {error && !isModalOpen && <div className="error-message">{error}</div>}

      <div className="data-panel">
        <div className="panel-header">
          <h2>{menus.length} TOTAL ITEMS</h2>
          <div className="search-box">
            <Search size={14} />
            <input type="text" placeholder="Search menu..." />
          </div>
        </div>

        {isLoading ? <ForgeLoader /> : (
          <div className="table-wrapper">
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>ITEM NAME</th>
                  <th>UNIT PRICE</th>
                  <th>UOM (UNIT OF MEASURE)</th>
                  <th>DATE ADDED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((m) => (
                  <tr key={m._id}>
                    <td><strong>{m.name.toUpperCase()}</strong></td>
                    <td className="price-cell">₹ {m.unitPrice.toFixed(2)}</td>
                    <td>
                      <span className="unit-tag">
                        {m.unit === 'custom' ? m.customUnit.toUpperCase() : m.unit.toUpperCase()}
                      </span>
                    </td>
                    <td className="date-cell">{new Date(m.createdAt).toLocaleDateString()}</td>
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
            {menus.length === 0 && <div className="empty-state">No menu items found. Add your first item!</div>}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            <h2>{editingId ? 'Edit Menu Item' : 'Create Menu Item'}</h2>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit} className="standard-form">
              <div className="form-group">
                <label>Item Name</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required 
                  placeholder="e.g. Chicken Biryani"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Unit Price (₹)</label>
                  <input 
                    type="number" 
                    name="unitPrice"
                    value={formData.unitPrice}
                    onChange={handleInputChange}
                    required 
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                
                <div className="form-group">
                  <label>Unit of Measure</label>
                  <select name="unit" value={formData.unit} onChange={handleInputChange}>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="ltr">Liter (ltr)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {formData.unit === 'custom' && (
                <div className="form-group slide-down">
                  <label>Custom Unit Name</label>
                  <input 
                    type="text" 
                    name="customUnit"
                    value={formData.customUnit}
                    onChange={handleInputChange}
                    required 
                    placeholder="e.g. Box, Plate, Dozen"
                  />
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? 'UPDATE ITEM' : 'SAVE ITEM'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        
        .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

        .panel-header { padding: 20px 24px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        
        .search-box { position: relative; display: flex; align-items: center; margin-right: 12px; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 220px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }

        .sharp-table th, .sharp-table td { text-align: center; }
        .price-cell { color: #10b981; font-weight: 800; }
        .unit-tag { background: rgba(249, 115, 22, 0.1); color: var(--primary); font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border: 1px solid rgba(249, 115, 22, 0.2); }
        .date-cell { color: var(--text-dim); font-size: 0.8rem; font-weight: 500; }
        
        .action-buttons { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .icon-btn.edit:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 500px; padding: 32px; position: relative; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-content h2 { margin-bottom: 24px; font-size: 1.25rem; font-weight: 800; }
        
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .standard-form .form-group { margin-bottom: 20px; }
        .standard-form label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; font-size: 0.85rem; outline: none; transition: 0.2s; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }
        
        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover:not(:disabled) { background: #ea580c; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .loading-container { display: flex; align-items: center; justify-content: center; min-height: 400px; color: var(--text-dim); }
        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
        .slide-down { animation: slideDown 0.3s ease-out forwards; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </MainLayout>
  );
};

export default MenuPage;
