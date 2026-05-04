import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '../layouts/MainLayout';
import { bomApi, rawMaterialApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2, Trash, ChevronDown, Check } from 'lucide-react';
import { useParams } from 'react-router-dom';

/* ─── Searchable Material Dropdown ─────────────────────────────────── */
interface Material { _id: string; name: string; simpleCode: string; unit: string; customUnit?: string; }

interface MaterialDropdownProps {
  materials: Material[];
  selectedId: string;
  onChange: (material: Material | null) => void;
}

const MaterialDropdown: React.FC<MaterialDropdownProps> = ({ materials, selectedId, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = materials.find(m => m._id === selectedId) || null;

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.simpleCode.includes(search)
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getUnitLabel = (m: Material) =>
    m.unit === 'custom' ? (m.customUnit || '').toUpperCase() : m.unit.toUpperCase();

  return (
    <div className="mat-dropdown" ref={ref}>
      <button
        type="button"
        className={`mat-dropdown-trigger ${open ? 'open' : ''}`}
        onClick={() => { setOpen(!open); setSearch(''); }}
      >
        {selected ? (
          <span className="mat-selected">
            <span className="mat-code">{selected.simpleCode}</span>
            <span>{selected.name}</span>
          </span>
        ) : (
          <span className="mat-placeholder">Select ingredient...</span>
        )}
        <ChevronDown size={14} className={`chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="mat-dropdown-menu">
          <div className="mat-search">
            <Search size={13} />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="mat-options">
            {filtered.length === 0 ? (
              <div className="mat-empty">No materials found</div>
            ) : (
              filtered.map(m => (
                <button
                  key={m._id}
                  type="button"
                  className={`mat-option ${selectedId === m._id ? 'active' : ''}`}
                  onClick={() => { onChange(m); setOpen(false); }}
                >
                  <span className="mat-opt-code">{m.simpleCode}</span>
                  <span className="mat-opt-name">{m.name}</span>
                  <span className="mat-opt-unit">{getUnitLabel(m)}</span>
                  {selectedId === m._id && <Check size={12} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── BOM Page ──────────────────────────────────────────────────────── */
const BomPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [boms, setBoms] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [dishName, setDishName] = useState('');
  const [kitchenPrice, setKitchenPrice] = useState('');
  const [items, setItems] = useState<any[]>([{
    materialId: '',
    itemName: '',
    quantity: '',
    unit: 'kg',
    customUnit: '',
    type: 'Raw Material'
  }]);

  useEffect(() => {
    fetchBoms();
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const res = await rawMaterialApi.getAll(entityId);
      setRawMaterials(res.data.data || []);
    } catch {
      // silently fail
    }
  };

  const fetchBoms = async () => {
    try {
      setIsLoading(true);
      const res = await bomApi.getAll(entityId);
      setBoms(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load BOMs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaterialSelect = (index: number, material: Material | null) => {
    const newItems = [...items];
    if (material) {
      newItems[index].materialId = material._id;
      newItems[index].itemName = material.name;
      newItems[index].unit = material.unit;
      newItems[index].customUnit = material.customUnit || '';
    } else {
      newItems[index].materialId = '';
      newItems[index].itemName = '';
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { materialId: '', itemName: '', quantity: '', unit: 'kg', customUnit: '', type: 'Raw Material' }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setDishName('');
    setKitchenPrice('');
    setItems([{ materialId: '', itemName: '', quantity: '', unit: 'kg', customUnit: '', type: 'Raw Material' }]);
    setError('');
    setIsModalOpen(true);
  };

  const handleEdit = (bom: any) => {
    setEditingId(bom._id);
    setDishName(bom.dishName);
    setKitchenPrice(bom.kitchenPrice?.toString() || '0');
    setItems(bom.items.map((i: any) => ({
      materialId: i.materialId || '',
      itemName: i.itemName,
      quantity: i.quantity.toString(),
      unit: i.unit,
      customUnit: i.customUnit || '',
      type: i.type
    })));
    setError('');
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
    // Validate all items have a material selected
    const unset = items.findIndex(i => !i.itemName.trim());
    if (unset !== -1) {
      setError(`Please select a material for ingredient row ${unset + 1}`);
      return;
    }
    try {
      setIsSubmitting(true);
      setError('');
      const payload = {
        dishName,
        kitchenPrice: Number(kitchenPrice) || 0,
        items: items.map(i => ({
          itemName: i.itemName,
          materialId: i.materialId || undefined,
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

  const getUnitLabel = (unit: string, customUnit?: string) =>
    unit === 'custom' ? (customUnit || '').toUpperCase() : unit.toUpperCase();

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>BILL OF MATERIALS (BOM)</h1>
          <p className="subtitle">RECIPE &amp; INGREDIENT CONFIGURATION</p>
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
                  <th>KITCHEN PRICE</th>
                  <th>INGREDIENTS</th>
                  <th>DATE CONFIGURED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((b) => (
                  <tr key={b._id}>
                    <td><strong>{b.dishName.toUpperCase()}</strong></td>
                    <td>
                      <span className="price-cell">₹ {(b.kitchenPrice || 0).toFixed(2)}</span>
                    </td>
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
              <div className="bom-top-fields">
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
                <div className="form-group">
                  <label>Kitchen Price (₹)</label>
                  <div className="price-input-wrap">
                    <span className="inr">₹</span>
                    <input
                      type="number"
                      value={kitchenPrice}
                      onChange={(e) => setKitchenPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="price-input"
                    />
                  </div>
                </div>
              </div>

              <div className="ingredients-section">
                <div className="ingredients-header">
                  <h3>Ingredients Configuration</h3>
                  <button type="button" className="btn-add-item" onClick={handleAddItem}>
                    <Plus size={14} /> ADD INGREDIENT
                  </button>
                </div>

                {rawMaterials.length === 0 && (
                  <div className="no-materials-warn">
                    ⚠ No items found in Item Config. Add raw materials first for quick selection.
                  </div>
                )}

                <div className="ingredients-list">
                  {items.map((item, index) => (
                    <div key={index} className="ingredient-row slide-down">
                      {/* Row header */}
                      <div className="ingredient-row-header">
                        <span className="row-num">#{index + 1}</span>
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash size={14} />
                        </button>
                      </div>

                      {/* Material selector */}
                      <div className="form-group full-width">
                        <label>Select Ingredient</label>
                        <MaterialDropdown
                          materials={rawMaterials}
                          selectedId={item.materialId}
                          onChange={(mat) => handleMaterialSelect(index, mat)}
                        />
                      </div>

                      {/* Quantity + Unit (auto-filled) + Type */}
                      <div className="ingredient-fields">
                        <div className="form-group">
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

                        <div className="form-group">
                          <label>Unit <span className="auto-label">(from item config)</span></label>
                          <div className="unit-display">
                            {item.unit === 'custom'
                              ? (item.customUnit || '—').toUpperCase()
                              : item.unit.toUpperCase()}
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Type</label>
                          <select
                            value={item.type}
                            onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                          >
                            <option value="Raw Material">Raw Material</option>
                            <option value="Consumable">Consumable</option>
                          </select>
                        </div>
                      </div>
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

        .unit-tag { background: rgba(249,115,22,0.1); color: var(--primary); font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border: 1px solid rgba(249,115,22,0.2); }
        .date-cell { color: var(--text-dim); font-size: 0.8rem; font-weight: 500; }
        .action-buttons { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .icon-btn.edit:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.1); }
        .sharp-table th, .sharp-table td { text-align: center; }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); overflow-y: auto; padding: 40px 0; }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 600px; padding: 32px; position: relative; margin: auto; }
        .large-modal { max-width: 700px; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-content h2 { margin-bottom: 24px; font-size: 1.25rem; font-weight: 800; }

        .standard-form .form-group { margin-bottom: 16px; }
        .standard-form label { display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; }
        .auto-label { font-weight: 500; font-size: 0.62rem; text-transform: none; color: #3b82f6; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 10px 12px; font-size: 0.8rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }
        .full-width { width: 100%; }

        /* Ingredient rows */
        .ingredients-section { margin-top: 24px; border-top: 1px solid var(--border-main); padding-top: 20px; }
        .ingredients-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .ingredients-header h3 { font-size: 1rem; color: var(--text-main); font-weight: 800; }
        .btn-add-item { background: transparent; border: 1px dashed var(--primary); color: var(--primary); padding: 6px 12px; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; }
        .btn-add-item:hover { background: rgba(249,115,22,0.1); }

        .no-materials-warn { background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); padding: 10px 14px; font-size: 0.75rem; color: #eab308; margin-bottom: 16px; }

        .ingredients-list { display: flex; flex-direction: column; gap: 16px; max-height: 480px; overflow-y: auto; padding-right: 4px; }
        .ingredients-list::-webkit-scrollbar { width: 4px; }
        .ingredients-list::-webkit-scrollbar-thumb { background: var(--border-main); }

        .ingredient-row { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 16px; transition: border-color 0.2s; }
        .ingredient-row:hover { border-color: rgba(249,115,22,0.3); }

        .ingredient-row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .row-num { font-size: 0.65rem; font-weight: 800; color: var(--primary); letter-spacing: 1px; }
        .btn-remove-item { background: none; border: 1px solid rgba(239,68,68,0.2); color: #ef4444; padding: 4px 8px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 800; }
        .btn-remove-item:hover:not(:disabled) { background: rgba(239,68,68,0.1); }
        .btn-remove-item:disabled { opacity: 0.3; cursor: not-allowed; }

        .ingredient-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 4px; }

        /* Unit display (read-only) */
        .unit-display { background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.15); color: #60a5fa; padding: 10px 12px; font-size: 0.8rem; font-weight: 800; letter-spacing: 1px; min-height: 38px; display: flex; align-items: center; }

        /* Material Dropdown */
        .mat-dropdown { position: relative; width: 100%; }
        .mat-dropdown-trigger { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 10px 12px; font-size: 0.8rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; text-align: left; transition: 0.2s; }
        .mat-dropdown-trigger:hover, .mat-dropdown-trigger.open { border-color: var(--primary); }
        .mat-placeholder { color: var(--text-dim); }
        .mat-selected { display: flex; align-items: center; gap: 8px; }
        .mat-code { font-family: monospace; font-size: 0.7rem; color: var(--primary); background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.15); padding: 1px 6px; }
        .chevron { transition: transform 0.2s; flex-shrink: 0; }
        .chevron.rotated { transform: rotate(180deg); }

        .mat-dropdown-menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-sidebar); border: 1px solid var(--border-main); z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .mat-search { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border-main); }
        .mat-search input { flex: 1; background: none; border: none; outline: none; color: var(--text-main); font-size: 0.8rem; }
        .mat-search svg { color: var(--text-dim); flex-shrink: 0; }

        .mat-options { max-height: 220px; overflow-y: auto; }
        .mat-options::-webkit-scrollbar { width: 4px; }
        .mat-options::-webkit-scrollbar-thumb { background: var(--border-main); }
        .mat-option { width: 100%; background: none; border: none; padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.15s; text-align: left; }
        .mat-option:hover { background: var(--row-hover); }
        .mat-option.active { background: rgba(249,115,22,0.06); }
        .mat-opt-code { font-family: monospace; font-size: 0.7rem; color: var(--primary); min-width: 36px; }
        .mat-opt-name { flex: 1; font-size: 0.82rem; font-weight: 600; color: var(--text-main); }
        .mat-opt-unit { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); background: var(--border-main); padding: 1px 6px; }
        .mat-empty { padding: 20px; text-align: center; color: var(--text-dim); font-size: 0.8rem; }

        .modal-footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-main); }
        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover:not(:disabled) { background: #ea580c; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
        .slide-down { animation: slideDown 0.3s ease-out forwards; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .bom-top-fields { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 4px; }
        .price-input-wrap { position: relative; display: flex; align-items: center; }
        .inr { position: absolute; left: 12px; color: var(--text-main); font-weight: 800; font-size: 0.9rem; z-index:1; }
        .price-input { padding-left: 28px !important; }
        .price-cell { color: #10b981; font-weight: 800; font-size: 0.9rem; }
      `}</style>
    </MainLayout>
  );
};

export default BomPage;
