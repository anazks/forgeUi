import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { menuApi, bomApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2, BookOpen, ClipboardList } from 'lucide-react';
import { useParams } from 'react-router-dom';

type TabType = 'all' | 'direct' | 'bom';

const MenuPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [menus, setMenus] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    unitPrice: '',
    unit: 'kg',
    customUnit: ''
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [menuRes, bomRes] = await Promise.all([
        menuApi.getAll(entityId),
        bomApi.getAll(entityId)
      ]);
      setMenus(menuRes.data.data || []);
      setBoms(bomRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMenus = async () => {
    try {
      const [menuRes, bomRes] = await Promise.all([
        menuApi.getAll(entityId),
        bomApi.getAll(entityId)
      ]);
      setMenus(menuRes.data.data || []);
      setBoms(bomRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to refresh');
    }
  };

  // Combine & filter
  const directItems = menus.map(m => ({ ...m, _source: 'DIRECT' }));
  const bomItems = boms.map(b => ({
    _id: b._id,
    _source: 'BOM',
    name: b.dishName,
    unitPrice: b.kitchenPrice || 0,
    unit: '—',
    ingredientCount: b.items?.length || 0,
    createdAt: b.createdAt,
  }));

  const allItems = [...directItems, ...bomItems];

  const filtered = allItems.filter(item => {
    const matchSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'direct') return matchSearch && item._source === 'DIRECT';
    if (activeTab === 'bom') return matchSearch && item._source === 'BOM';
    return matchSearch;
  });

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

  const handleDeleteDirect = async (id: string) => {
    if (!window.confirm('Delete this menu item?')) return;
    try {
      await menuApi.delete(id);
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete menu item');
    }
  };

  const handleDeleteBom = async (id: string) => {
    if (!window.confirm('Delete this BOM dish from menu?')) return;
    try {
      await bomApi.delete(id);
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete BOM');
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
      setError(err.response?.data?.error || 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>MENU MANAGEMENT</h1>
          <p className="subtitle">PRODUCT CATALOG — DIRECT &amp; BOM DISHES</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> ADD MENU ITEM
        </button>
      </header>

      {error && !isModalOpen && <div className="error-message">{error}</div>}

      {/* Summary Strip */}
      <div className="menu-summary">
        <div className="msm-stat">
          <span className="msm-val">{allItems.length}</span>
          <span className="msm-label">TOTAL ITEMS</span>
        </div>
        <div className="msm-divider" />
        <div className="msm-stat">
          <BookOpen size={14} />
          <span className="msm-val">{menus.length}</span>
          <span className="msm-label">DIRECT</span>
        </div>
        <div className="msm-divider" />
        <div className="msm-stat">
          <ClipboardList size={14} />
          <span className="msm-val">{boms.length}</span>
          <span className="msm-label">FROM BOM</span>
        </div>
      </div>

      <div className="data-panel">
        {/* Tabs + Search */}
        <div className="panel-header">
          <div className="tab-group">
            {(['all', 'direct', 'bom'] as TabType[]).map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'all' ? 'ALL ITEMS' : tab === 'direct' ? 'DIRECT' : 'FROM BOM'}
                <span className="tab-count">
                  {tab === 'all' ? allItems.length : tab === 'direct' ? menus.length : boms.length}
                </span>
              </button>
            ))}
          </div>
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search menu..."
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
                  <th>SOURCE</th>
                  <th>ITEM / DISH NAME</th>
                  <th>PRICE (₹)</th>
                  <th>UNIT / INGREDIENTS</th>
                  <th>DATE ADDED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={`${item._source}-${item._id}`}>
                    <td>
                      <span className={`source-tag ${item._source === 'BOM' ? 'bom' : 'direct'}`}>
                        {item._source === 'BOM' ? <ClipboardList size={10} /> : <BookOpen size={10} />}
                        {item._source}
                      </span>
                    </td>
                    <td>
                      <strong className="item-name">{item.name?.toUpperCase()}</strong>
                    </td>
                    <td className="price-cell">₹ {(item.unitPrice || 0).toFixed(2)}</td>
                    <td>
                      {item._source === 'DIRECT' ? (
                        <span className="unit-tag">
                          {item.unit === 'custom' ? item.customUnit?.toUpperCase() : item.unit?.toUpperCase()}
                        </span>
                      ) : (
                        <span className="ing-count">{item.ingredientCount} INGREDIENTS</span>
                      )}
                    </td>
                    <td className="date-cell">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        {item._source === 'DIRECT' && (
                          <button className="icon-btn edit" onClick={() => handleEdit(item)} title="Edit">
                            <Edit2 size={14} />
                          </button>
                        )}
                        <button
                          className="icon-btn delete"
                          onClick={() => item._source === 'DIRECT' ? handleDeleteDirect(item._id) : handleDeleteBom(item._id)}
                          title="Delete"
                        >
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
                {searchTerm ? `No results for "${searchTerm}"` : 'No menu items found.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Direct Menu Item Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            <div className="modal-tag direct-tag"><BookOpen size={12} /> DIRECT MENU ITEM</div>
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
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

        /* Summary strip */
        .menu-summary { display: flex; align-items: center; gap: 0; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 16px 24px; margin-bottom: 24px; }
        .msm-stat { display: flex; align-items: center; gap: 8px; }
        .msm-val { font-size: 1.4rem; font-weight: 800; color: var(--text-main); }
        .msm-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .msm-divider { width: 1px; height: 32px; background: var(--border-main); margin: 0 24px; }
        .msm-stat svg { color: var(--primary); }

        /* Tabs */
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .tab-group { display: flex; gap: 4px; }
        .tab-btn { background: none; border: 1px solid transparent; color: var(--text-dim); font-size: 0.7rem; font-weight: 800; padding: 6px 14px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
        .tab-btn:hover { color: var(--text-main); border-color: var(--border-main); }
        .tab-btn.active { color: var(--primary); border-color: var(--primary); background: rgba(249,115,22,0.06); }
        .tab-count { font-size: 0.6rem; background: var(--border-main); padding: 1px 5px; border-radius: 10px; }
        .tab-btn.active .tab-count { background: rgba(249,115,22,0.15); color: var(--primary); }

        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 220px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }

        .sharp-table th, .sharp-table td { text-align: center; vertical-align: middle; }

        /* Source tags */
        .source-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 0.62rem; font-weight: 800; padding: 3px 8px; border: 1px solid; }
        .source-tag.direct { color: #3b82f6; border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.06); }
        .source-tag.bom { color: #a855f7; border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.06); }

        .item-name { font-size: 0.88rem; color: var(--text-main); }
        .price-cell { color: #10b981; font-weight: 800; font-size: 0.9rem; }
        .unit-tag { background: rgba(249,115,22,0.1); color: var(--primary); font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border: 1px solid rgba(249,115,22,0.2); }
        .ing-count { font-size: 0.72rem; font-weight: 700; color: #a855f7; background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.2); padding: 3px 8px; }
        .date-cell { color: var(--text-dim); font-size: 0.8rem; font-weight: 500; }

        .action-buttons { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .icon-btn.edit:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.1); }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 500px; padding: 32px; position: relative; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 0.6rem; font-weight: 800; padding: 3px 8px; margin-bottom: 12px; }
        .direct-tag { color: #3b82f6; border: 1px solid rgba(59,130,246,0.3); background: rgba(59,130,246,0.06); }
        .modal-content h2 { margin-bottom: 24px; font-size: 1.25rem; font-weight: 800; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .standard-form .form-group { margin-bottom: 20px; }
        .standard-form label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; font-size: 0.85rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }

        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover:not(:disabled) { background: #ea580c; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
        .slide-down { animation: slideDown 0.3s ease-out forwards; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </MainLayout>
  );
};

export default MenuPage;
