import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { menuApi, bomApi, userApi, foodRequestApi } from '../services/api';
import { ITEM_CATEGORIES } from '../constants/categories';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2, BookOpen, ClipboardList, IndianRupee } from 'lucide-react';
import { useParams } from 'react-router-dom';

type TabType = 'all' | 'direct' | 'bom';

const MenuPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [menus, setMenus] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [centerRates, setCenterRates] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [editingRateItem, setEditingRateItem] = useState<any>(null);
  const [newSellingRate, setNewSellingRate] = useState<string>('');

  // Ordering state
  const [orderQtys, setOrderQtys] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'kg',
    customUnit: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [menuRes, bomRes, rateRes, userRes] = await Promise.allSettled([
        menuApi.getAll(entityId),
        bomApi.getAll(entityId),
        menuApi.getRates(entityId),
        userApi.getMe()
      ]);

      if (menuRes.status === 'fulfilled') {
        console.log('Menus fetched:', menuRes.value.data.data);
        setMenus(menuRes.value.data.data || []);
      }
      if (bomRes.status === 'fulfilled') {
        console.log('BOMs fetched:', bomRes.value.data.data);
        setBoms(bomRes.value.data.data || []);
      }
      if (rateRes.status === 'fulfilled') setCenterRates(rateRes.value.data.data || []);
      if (userRes.status === 'fulfilled') setUser(userRes.value.data.data || null);

      if (menuRes.status === 'rejected') {
        console.error('Menu fetch failed:', menuRes.reason);
        setError('Failed to load menu items');
      }
    } catch (err: any) {
      console.error('Initial fetch error:', err);
      setError(err.response?.data?.error || 'Failed to load menu data');
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

  // ── Build display lists ──────────────────────────────────────────────
  // DIRECT: all items from menus array (no type filter needed)
  const directItems = menus.map(m => {
    let finalPrice: number | null = null;
    let sellingPrice: number | null = null;
    if (user?.role === 'CENTERS') {
      const customRate = centerRates.find(r => r.menu?._id === m._id && (r.center?._id === user._id || r.center === user._id));
      if (customRate) { finalPrice = customRate.rate; sellingPrice = customRate.centerRate || customRate.rate; }
    }
    return { ...m, _source: 'DIRECT', displayPrice: finalPrice, sellingPrice };
  });

  // BOM: from boms array — each BOM dish appears as a BOM-source item
  const bomItems = boms.map(b => {
    let finalPrice: number | null = b.kitchenPrice > 0 ? b.kitchenPrice : null;
    let sellingPrice: number | null = finalPrice;
    if (user?.role === 'CENTERS') {
      const customRate = centerRates.find(r => r.bom?._id === b._id && (r.center?._id === user._id || r.center === user._id));
      if (customRate) { finalPrice = customRate.rate; sellingPrice = customRate.centerRate || customRate.rate; }
    }
    return {
      _id: b._id,
      _source: 'BOM',
      name: b.dishName,
      displayPrice: finalPrice,
      sellingPrice,
      unit: b.unit || 'pcs',
      customUnit: '',
      ingredientCount: b.items?.length || 0,
      createdAt: b.createdAt,
    };
  });

  // Merge and sort A–Z
  const allItems = [...directItems, ...bomItems].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  const directCount = directItems.length;
  const bomCount = bomItems.length;

  const filtered = allItems.filter(item => {
    const matchSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'direct') return matchSearch && item._source === 'DIRECT';
    if (activeTab === 'bom') return matchSearch && item._source === 'BOM';
    return matchSearch;
  });

  const handleQtyChange = (itemId: string, qty: string) => {
    setOrderQtys(prev => ({
      ...prev,
      [itemId]: parseInt(qty) || 0
    }));
  };

  const handleRequest = async (item: any) => {
    const qty = orderQtys[item._id];
    if (!qty || qty <= 0) {
      setError('Please enter a valid quantity');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        centerName: user.name || 'Unknown Center',
        centerId: user._id || user.id,
        entity: user.entity?._id || user.entity || null,
        deliveryDate: deliveryDate || new Date().toISOString(),
        requestedItems: [{
          materialName: item.name || item.dishName || 'Unknown Item',
          requestedQty: Number(qty),
          unit: item.unit ? (item.unit === 'custom' ? item.customUnit : item.unit) : 'unit',
          isMenuItem: true,
          menuId: item._source === 'DIRECT' ? item._id : null,
          bomId: item._source === 'BOM' ? item._id : null
        }],
        notes: `Center Request: ${qty} units of ${item.name || item.dishName || 'item'}`
      };

      console.log('Submitting Food Request Payload:', payload);
      await foodRequestApi.create(payload);
      setSuccess(`Successfully requested ${qty} units of ${item.name || item.dishName || 'item'} for ${new Date(deliveryDate).toLocaleDateString()}`);
      setOrderQtys(prev => ({ ...prev, [item._id]: 0 }));
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.log(err);
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (menu: any) => {
    setEditingId(menu._id);
    setFormData({
      name: menu.name,
      category: menu.category || '',
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
    if (!window.confirm('Delete this BOM dish?')) return;
    try {
      await bomApi.delete(id);
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete BOM');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', category: '', unit: 'kg', customUnit: '' });
    setIsModalOpen(true);
  };

  const handleUpdateSellingRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRateItem || !newSellingRate) return;
    try {
      setIsSubmitting(true);
      setError('');
      const payload: any = {
        centerId: user._id || user.id,
        centerRate: Number(newSellingRate)
      };
      if (editingRateItem._source === 'DIRECT') payload.menuId = editingRateItem._id;
      else payload.bomId = editingRateItem._id;

      await menuApi.updateRate(payload);
      setSuccess('Selling rate updated successfully');
      setEditingRateItem(null);
      setNewSellingRate('');
      fetchInitialData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRateEdit = (item: any) => {
    setEditingRateItem(item);
    setNewSellingRate(item.sellingPrice.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      const payload: any = {
        name: formData.name,
        category: formData.category,
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
      setFormData({ name: '', category: '', unit: 'kg', customUnit: '' });
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
          <p className="subtitle">
            {user?.role === 'CENTERS' ? 'VIEW MENU & REQUEST ITEMS' : 'PRODUCT CATALOG — DIRECT & BOM DISHES'}
          </p>
        </div>
        {user?.role === 'CENTERS' && (
          <div className="header-date-picker">
            <label>DELIVERY DATE:</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}
        {user?.role !== 'CENTERS' && (
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> ADD MENU ITEM
          </button>
        )}
      </header>

      {error && !isModalOpen && <div className="error-message">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {/* Summary Strip */}
      <div className="menu-summary">
        <div className="msm-stat">
          <span className="msm-val">{allItems.length}</span>
          <span className="msm-label">TOTAL ITEMS</span>
        </div>
        <div className="msm-divider" />
        <div className="msm-stat">
          <BookOpen size={14} />
          <span className="msm-val">{directCount}</span>
          <span className="msm-label">DIRECT</span>
        </div>
        <div className="msm-divider" />
        <div className="msm-stat">
          <ClipboardList size={14} />
          <span className="msm-val">{bomCount}</span>
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
                  {tab === 'all' ? allItems.length : tab === 'direct' ? directCount : bomCount}
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
                  <th style={{ textAlign: 'left' }}>ITEM / DISH NAME</th>
                  {user?.role === 'CENTERS' ? (
                    <>
                      <th>BUYING RATE (₹)</th>
                      <th>SELLING RATE (₹)</th>
                    </>
                  ) : (
                    <th>BASE PRICE (₹)</th>
                  )}
                  <th>UNIT</th>
                  {user?.role === 'CENTERS' ? (
                    <th style={{ width: '250px' }}>REQUEST QUANTITY</th>
                  ) : (
                    <>
                      <th>DATE ADDED</th>
                      <th>ACTIONS</th>
                    </>
                  )}
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
                    <td style={{ textAlign: 'left' }}>
                      <strong className="item-name">{item.name?.toUpperCase()}</strong>
                    </td>
                    {user?.role === 'CENTERS' ? (
                      <>
                        <td className="price-cell buying">
                          {item.displayPrice != null ? `₹ ${item.displayPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className="price-cell selling">
                          <div className="selling-price-wrap">
                            {item.sellingPrice != null ? `₹ ${item.sellingPrice.toFixed(2)}` : '—'}
                            <button className="icon-btn-mini" onClick={() => openRateEdit(item)} title="Edit Selling Price">
                              <Edit2 size={10} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <td className="price-cell">
                        {item.displayPrice != null ? `₹ ${item.displayPrice.toFixed(2)}` : '—'}
                      </td>
                    )}
                    <td>
                      <span className="unit-tag">
                        {(item.unit === 'custom' ? item.customUnit : item.unit)?.toUpperCase() || '—'}
                      </span>
                    </td>
                    {user?.role === 'CENTERS' ? (
                      <td>
                        <div className="order-cell">
                          <input
                            type="number"
                            className="qty-input"
                            placeholder="Qty"
                            value={orderQtys[item._id] || ''}
                            onChange={(e) => handleQtyChange(item._id, e.target.value)}
                            min="0"
                          />
                          <button
                            className="btn-order"
                            onClick={() => handleRequest(item)}
                            disabled={isSubmitting || !orderQtys[item._id]}
                          >
                            {isSubmitting ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
                            REQUEST
                          </button>
                        </div>
                      </td>
                    ) : (
                      <>
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
                      </>
                    )}
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

      {/* Selling Rate Edit Modal */}
      {editingRateItem && (
        <div className="modal-overlay">
          <div className="modal-content rate-modal">
            <button className="close-btn" onClick={() => setEditingRateItem(null)}><X size={20} /></button>
            <div className="modal-tag selling-tag"><IndianRupee size={12} /> CONFIGURE SELLING PRICE</div>
            <h2>Update Selling Rate</h2>
            <p className="item-hint">{editingRateItem.name?.toUpperCase()}</p>
            
            <div className="rate-comparison">
              <div className="rc-box">
                <span className="rc-label">BUYING FROM ADMIN</span>
                <span className="rc-val">₹ {editingRateItem.displayPrice.toFixed(2)}</span>
              </div>
              <div className="rc-arrow">→</div>
              <div className="rc-box highlight">
                <span className="rc-label">YOUR SELLING PRICE</span>
                <span className="rc-val">₹ {Number(newSellingRate || 0).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateSellingRate} className="standard-form">
              <div className="form-group">
                <label>New Selling Rate (₹)</label>
                <div className="input-with-icon">
                  <IndianRupee size={16} />
                  <input
                    type="number"
                    value={newSellingRate}
                    onChange={(e) => setNewSellingRate(e.target.value)}
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <p className="margin-hint">
                  Expected Margin: ₹ {(Number(newSellingRate) - editingRateItem.displayPrice).toFixed(2)}
                </p>
              </div>

              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'UPDATE SELLING PRICE'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Direct Menu Item Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            <div className="modal-tag direct-tag"><BookOpen size={12} /> DIRECT MENU ITEM</div>
            <h2>{editingId ? 'Edit Menu Item' : 'Add Direct Item'}</h2>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="standard-form">
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Bread, Milk, Oil" />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  <option value="">Select Category</option>
                  {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Unit of Measure</label>
                <select name="unit" value={formData.unit} onChange={handleInputChange}>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ltr">Liter (ltr)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="gm">Gram (gm)</option>
                  <option value="ml">Milliliter (ml)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {formData.unit === 'custom' && (
                <div className="form-group slide-down">
                  <label>Custom Unit Name</label>
                  <input type="text" name="customUnit" value={formData.customUnit} onChange={handleInputChange} required placeholder="e.g. Box, Plate, Dozen" />
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

        /* Item type toggle */
        .type-toggle { display: flex; gap: 8px; margin-top: 4px; }
        .type-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border-main); background: none; color: var(--text-muted); font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .type-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .type-btn.active { border-color: var(--primary); color: var(--primary); background: rgba(249,115,22,0.06); }
        .field-hint { font-size: 0.68rem; color: #a855f7; font-weight: 600; margin-top: 8px; }

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

        .success-banner { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981; padding: 12px 20px; font-size: 0.85rem; font-weight: 700; margin-bottom: 24px; }
        
        .header-date-picker { display: flex; align-items: center; gap: 12px; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 8px 16px; }
        .header-date-picker label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .header-date-picker input { background: transparent; border: none; color: var(--primary); font-size: 0.85rem; font-weight: 800; outline: none; cursor: pointer; }
        
        .order-cell { display: flex; align-items: center; gap: 8px; justify-content: center; }
        .qty-input { width: 70px; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 8px; font-size: 0.8rem; font-weight: 700; outline: none; }
        .qty-input:focus { border-color: var(--primary); }
        .btn-order { background: var(--primary); color: white; border: none; padding: 8px 12px; font-size: 0.65rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-order:hover:not(:disabled) { background: #ea580c; }
        .btn-order:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Rates */
        .price-cell.buying { color: #3b82f6; }
        .price-cell.selling { color: #10b981; }
        .selling-price-wrap { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn-mini { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981; padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: 0.2s; }
        .icon-btn-mini:hover { background: #10b981; color: white; }

        .rate-modal { max-width: 420px !important; }
        .selling-tag { color: #10b981; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.06); }
        .item-hint { font-size: 0.75rem; color: var(--text-dim); margin-top: -16px; margin-bottom: 24px; font-weight: 700; }
        
        .rate-comparison { display: flex; align-items: center; gap: 12px; background: var(--bg-sidebar); padding: 16px; border: 1px solid var(--border-main); margin-bottom: 24px; }
        .rc-box { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .rc-label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .rc-val { font-size: 1rem; font-weight: 800; color: var(--text-main); }
        .rc-box.highlight .rc-val { color: #10b981; }
        .rc-arrow { color: var(--text-dim); font-weight: 800; }

        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-with-icon svg { position: absolute; left: 12px; color: var(--text-dim); }
        .input-with-icon input { padding-left: 36px !important; }
        .margin-hint { font-size: 0.65rem; color: #10b981; font-weight: 700; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </MainLayout>
  );
};

export default MenuPage;