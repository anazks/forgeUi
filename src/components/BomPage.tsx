import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { bomApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2, Trash } from 'lucide-react';

const BomPage: React.FC = () => {
  const [boms, setBoms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [dishName, setDishName] = useState('');
  const [items, setItems] = useState<any[]>([{
    itemName: '',
    quantity: '',
    unit: 'kg',
    customUnit: '',
    type: 'Raw Material'
  }]);

  useEffect(() => {
    fetchBoms();
  }, []);

  const fetchBoms = async () => {
    try {
      setIsLoading(true);
      const res = await bomApi.getAll();
      setBoms(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load BOMs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { itemName: '', quantity: '', unit: 'kg', customUnit: '', type: 'Raw Material' }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setDishName('');
    setItems([{ itemName: '', quantity: '', unit: 'kg', customUnit: '', type: 'Raw Material' }]);
    setIsModalOpen(true);
  };

  const handleEdit = (bom: any) => {
    setEditingId(bom._id);
    setDishName(bom.dishName);
    setItems(bom.items.map((i: any) => ({
      itemName: i.itemName,
      quantity: i.quantity.toString(),
      unit: i.unit,
      customUnit: i.customUnit || '',
      type: i.type
    })));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this BOM?')) return;
    try {
      await bomApi.delete(id);
      fetchBoms();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete BOM');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      
      const payload = {
        dishName,
        items: items.map(i => ({
          itemName: i.itemName,
          quantity: Number(i.quantity),
          unit: i.unit,
          type: i.type,
          ...(i.unit === 'custom' && { customUnit: i.customUnit })
        }))
      };

      if (editingId) {
        await bomApi.update(editingId, payload);
      } else {
        await bomApi.create(payload);
      }
      
      setIsModalOpen(false);
      fetchBoms();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save BOM');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>BILL OF MATERIALS (BOM)</h1>
          <p className="subtitle">RECIPE & INGREDIENT CONFIGURATION</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> CREATE BOM
        </button>
      </header>

      {error && !isModalOpen && <div className="error-message">{error}</div>}

      <div className="data-panel">
        <div className="panel-header">
          <h2>{boms.length} TOTAL RECIPES</h2>
          <div className="search-box">
            <Search size={14} />
            <input type="text" placeholder="Search BOM..." />
          </div>
        </div>

        {isLoading ? (
          <ForgeLoader />
        ) : (
          <div className="table-wrapper">
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>DISH NAME</th>
                  <th>INGREDIENTS COUNT</th>
                  <th>DATE CONFIGURED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((b) => (
                  <tr key={b._id}>
                    <td><strong>{b.dishName.toUpperCase()}</strong></td>
                    <td>
                      <span className="unit-tag">{b.items.length} ITEMS</span>
                    </td>
                    <td className="date-cell">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn edit" onClick={() => handleEdit(b)} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button className="icon-btn delete" onClick={() => handleDelete(b._id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {boms.length === 0 && <div className="empty-state">No BOM configured yet. Create your first recipe!</div>}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            <h2>{editingId ? 'Edit Bill of Materials' : 'Create Bill of Materials'}</h2>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit} className="standard-form">
              <div className="form-group">
                <label>Dish Name</label>
                <input 
                  type="text" 
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  required 
                  placeholder="e.g. Butter Chicken"
                />
              </div>

              <div className="ingredients-section">
                <div className="ingredients-header">
                  <h3>Ingredients Configuration</h3>
                  <button type="button" className="btn-add-item" onClick={handleAddItem}>
                    <Plus size={14} /> ADD INGREDIENT
                  </button>
                </div>

                <div className="ingredients-list">
                  {items.map((item, index) => (
                    <div key={index} className="ingredient-row slide-down">
                      <div className="form-group flex-2">
                        <label>Item Name</label>
                        <input 
                          type="text" 
                          value={item.itemName}
                          onChange={(e) => handleItemChange(index, 'itemName', e.target.value)}
                          required 
                          placeholder="e.g. Tomato Paste"
                        />
                      </div>
                      
                      <div className="form-group flex-1">
                        <label>Quantity</label>
                        <input 
                          type="number" 
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required 
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="form-group flex-1">
                        <label>Unit</label>
                        <select value={item.unit} onChange={(e) => handleItemChange(index, 'unit', e.target.value)}>
                          <option value="kg">kg</option>
                          <option value="ltr">ltr</option>
                          <option value="pcs">pcs</option>
                          <option value="custom">custom</option>
                        </select>
                      </div>

                      {item.unit === 'custom' && (
                        <div className="form-group flex-1">
                          <label>Custom</label>
                          <input 
                            type="text" 
                            value={item.customUnit}
                            onChange={(e) => handleItemChange(index, 'customUnit', e.target.value)}
                            required 
                            placeholder="Unit"
                          />
                        </div>
                      )}

                      <div className="form-group flex-1.5">
                        <label>Type</label>
                        <select value={item.type} onChange={(e) => handleItemChange(index, 'type', e.target.value)}>
                          <option value="Raw Material">Raw Material</option>
                          <option value="Consumable">Consumable</option>
                        </select>
                      </div>

                      <button type="button" className="btn-remove-item" onClick={() => handleRemoveItem(index)} disabled={items.length === 1}>
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? 'UPDATE BOM' : 'SAVE BOM'}
                </button>
              </div>
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

        .unit-tag { background: rgba(249, 115, 22, 0.1); color: var(--primary); font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border: 1px solid rgba(249, 115, 22, 0.2); }
        .date-cell { color: var(--text-dim); font-size: 0.8rem; font-weight: 500; }
        
        .action-buttons { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .icon-btn.edit:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); overflow-y: auto; padding: 40px 0; }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 500px; padding: 32px; position: relative; }
        .large-modal { max-width: 800px; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-content h2 { margin-bottom: 24px; font-size: 1.25rem; font-weight: 800; }
        
        .standard-form .form-group { margin-bottom: 20px; }
        .standard-form label { display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 10px 12px; font-size: 0.8rem; outline: none; transition: 0.2s; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }
        
        .ingredients-section { margin-top: 32px; border-top: 1px solid var(--border-main); padding-top: 24px; }
        .ingredients-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .ingredients-header h3 { font-size: 1rem; color: var(--text-main); font-weight: 800; }
        
        .btn-add-item { background: transparent; border: 1px dashed var(--primary); color: var(--primary); padding: 6px 12px; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .btn-add-item:hover { background: rgba(249, 115, 22, 0.1); }

        .ingredients-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 12px; }
        .ingredients-list::-webkit-scrollbar { width: 4px; }
        .ingredients-list::-webkit-scrollbar-thumb { background: var(--border-main); }
        
        .ingredient-row { display: flex; gap: 12px; align-items: flex-end; background: var(--bg-sidebar); padding: 16px; border: 1px solid var(--border-main); }
        .ingredient-row .form-group { margin-bottom: 0; }
        
        .flex-2 { flex: 2; }
        .flex-1 { flex: 1; }
        .flex-1\.5 { flex: 1.5; }

        .btn-remove-item { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 10px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; height: 38px; }
        .btn-remove-item:hover:not(:disabled) { background: #ef4444; color: white; }
        .btn-remove-item:disabled { opacity: 0.5; cursor: not-allowed; }

        .modal-footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border-main); }
        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
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

export default BomPage;
