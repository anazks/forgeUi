import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Building2,
  Utensils,
  IndianRupee,
  Save,
  Pencil,
  X
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { menuApi, userApi, bomApi } from '../services/api';

const PaymentSettings: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Local state for pricing fields
  const [localRates, setLocalRates] = useState<Record<string, any>>({});
  const [localCenterRates, setLocalCenterRates] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [menuRes, locationsRes, rateRes, bomRes] = await Promise.all([
        menuApi.getAll(),
        userApi.getLocations(),
        menuApi.getRates(),
        bomApi.getAll()
      ]);

      const menuList = menuRes.data.data || [];
      const bomList = bomRes.data.data || [];
      const allLocations = locationsRes.data.data || [];
      const rateList = rateRes.data.data || [];

      // Filter locations to KITCHEN, CENTERS, RESTAURANT, AGGREGATE
      const locationList = allLocations.filter((u: any) => 
        ['KITCHEN', 'CENTERS', 'RESTAURANT', 'AGGREGATE'].includes(u.role)
      );

      // Unify logic: List only Menu items that have an associated BOM (or BOMs sold directly)
      const unifiedItems: any[] = [];
      
      // 1. Process Menu items linked to BOM
      menuList.forEach((m: any) => {
        const linkedBom = bomList.find((b: any) => (b.menuItem?._id || b.menuItem) === m._id);
        if (linkedBom) {
          unifiedItems.push({
            id: m._id,
            type: 'MENU',
            name: m.name,
            unit: m.unit,
            menuId: m._id,
            bomId: linkedBom._id
          });
        }
      });

      // 2. Process BOM items sold directly (not linked to a menu item)
      bomList.forEach((b: any) => {
        const isLinked = menuList.some((m: any) => (b.menuItem?._id || b.menuItem) === m._id);
        if (!isLinked) {
          unifiedItems.push({
            id: b._id,
            type: 'BOM',
            name: b.dishName,
            unit: b.unit || 'pcs',
            menuId: null,
            bomId: b._id
          });
        }
      });

      setItems(unifiedItems);
      setCenters(locationList);
      setRates(rateList);

      // Initialize local states with database values
      const initialLocalRates: Record<string, any> = {};
      const initialLocalCenterRates: Record<string, any> = {};
      
      rateList.forEach((r: any) => {
        const itemId = r.menu?._id || r.bom?._id;
        if (itemId) {
          if (!r.center) {
            // Global Base Price
            initialLocalRates[itemId] = r.rate;
          } else {
            // Location Sale Price
            initialLocalCenterRates[`${itemId}_${r.center._id}`] = r.centerRate;
          }
        }
      });

      // Leave unconfigured values completely blank
      unifiedItems.forEach(item => {
        if (initialLocalRates[item.id] === undefined) {
          initialLocalRates[item.id] = '';
        }
        locationList.forEach((center: any) => {
          const key = `${item.id}_${center._id}`;
          if (initialLocalCenterRates[key] === undefined) {
            initialLocalCenterRates[key] = '';
          }
        });
      });

      setLocalRates(initialLocalRates);
      setLocalCenterRates(initialLocalCenterRates);

    } catch (err: any) {
      setError('Failed to fetch pricing configuration data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateChange = (itemId: string, centerId: string, value: string, type: 'admin' | 'center') => {
    if (type === 'admin') {
      setLocalRates(prev => ({
        ...prev,
        [itemId]: value
      }));
    } else {
      setLocalCenterRates(prev => ({
        ...prev,
        [`${itemId}_${centerId}`]: value
      }));
    }
  };

  const cancelEdit = (itemId: string) => {
    // Reset local state to the saved rates in the database
    const savedBaseRate = rates.find(r => !r.center && (r.menu?._id === itemId || r.bom?._id === itemId));
    setLocalRates(prev => ({
      ...prev,
      [itemId]: savedBaseRate ? savedBaseRate.rate : ''
    }));

    centers.forEach(center => {
      const key = `${itemId}_${center._id}`;
      const savedLocationRate = rates.find(r => r.center?._id === center._id && (r.menu?._id === itemId || r.bom?._id === itemId));
      setLocalCenterRates(prev => ({
        ...prev,
        [key]: savedLocationRate ? savedLocationRate.centerRate : ''
      }));
    });

    setEditingRowId(null);
  };

  const saveRow = async (item: any) => {
    const ratesPayload: any[] = [];

    // 1. Prepare Base Price payload
    const baseValue = localRates[item.id];
    ratesPayload.push({
      menuId: item.menuId,
      bomId: item.bomId,
      centerId: null, // Global base price
      rate: baseValue !== '' && baseValue !== undefined ? parseFloat(baseValue) : null
    });

    // 2. Prepare location Sale Price payloads
    centers.forEach(center => {
      const saleValue = localCenterRates[`${item.id}_${center._id}`];
      ratesPayload.push({
        menuId: item.menuId,
        bomId: item.bomId,
        centerId: center._id,
        centerRate: saleValue !== '' && saleValue !== undefined ? parseFloat(saleValue) : null
      });
    });

    try {
      setIsSaving(item.id);
      await menuApi.updateRatesBulk(ratesPayload);
      setSuccess('Pricing updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload rates
      const rateRes = await menuApi.getRates();
      setRates(rateRes.data.data || []);
      
      setEditingRowId(null);
    } catch (err) {
      setError('Save failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSaving(null);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <ForgeLoader />;

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>PRICING CONSOLE</h1>
          <p className="subtitle">SET DUAL PRICING SCHEME (GLOBAL BASE & LOCAL SALE PRICES)</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <Search size={14} />
            <input 
              type="text" 
              placeholder="Search items..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn-refresh-icon" onClick={fetchData} title="Refresh Data">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {error && (
        <div className="status-banner error">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      
      {success && (
        <div className="status-banner success">
          <Check size={16} /> {success}
        </div>
      )}

      <div className="data-panel">
        <div className="panel-info-header">
          <div className="info-block">
            <Utensils size={18} />
            <div>
              <span className="label">TOTAL ITEMS</span>
              <span className="val">{items.length}</span>
            </div>
          </div>
          <div className="info-block">
            <Building2 size={18} />
            <div>
              <span className="label">TOTAL LOCATIONS</span>
              <span className="val">{centers.length}</span>
            </div>
          </div>
        </div>

        <div className="table-container-scrollable">
          <table className="rate-matrix-table">
            <thead>
              <tr>
                <th className="sticky-col first-col">ITEM / DISH</th>
                <th className="base-price-header-col">GLOBAL BASE PRICE</th>
                {centers.map(center => (
                  <th key={center._id} className="center-col">
                    <div className="center-header-cell">
                      <span>{center.name.toUpperCase()}</span>
                      <small>{center.role}</small>
                    </div>
                  </th>
                ))}
                <th className="actions-header-col text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const isEditing = editingRowId === item.id;
                
                // Base price calculations
                const baseVal = localRates[item.id];
                const isBaseEmpty = baseVal === '' || baseVal === undefined || baseVal === null;

                return (
                  <tr key={item.id} className={isEditing ? 'editing-row-active' : ''}>
                    {/* Item details */}
                    <td className="sticky-col first-col">
                      <div className="menu-cell">
                        <div className={`type-tag ${item.type.toLowerCase()}`}>{item.type[0]}</div>
                        <div className="menu-info">
                          <span className="item-name">{item.name.toUpperCase()}</span>
                          <small className="item-meta">{item.type === 'MENU' ? 'MENU ITEM' : 'BOM DISH'} • PER {item.unit.toUpperCase()}</small>
                        </div>
                      </div>
                    </td>

                    {/* Global Base Price Cell */}
                    <td className="base-price-cell">
                      {isEditing ? (
                        <div className="input-with-warning-wrapper">
                          <div className="input-wrapper">
                            <IndianRupee size={10} className="currency-icon" />
                            <input 
                              type="number" 
                              step="0.01"
                              value={baseVal}
                              onChange={(e) => handleRateChange(item.id, '', e.target.value, 'admin')}
                              onFocus={(e) => e.target.select()}
                              className="rate-input"
                              placeholder="0.00"
                            />
                          </div>
                          {isBaseEmpty && (
                            <div className="warning-indicator-inline" title="Warning: Base price is unconfigured">
                              <AlertCircle size={12} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="cell-value-wrap">
                          {isBaseEmpty ? (
                            <span className="empty-warning"><AlertCircle size={12} /> Unset</span>
                          ) : (
                            <span className="rate-value-text">₹ {Number(baseVal).toFixed(2)}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Location Sale Price Cells */}
                    {centers.map(center => {
                      const key = `${item.id}_${center._id}`;
                      const saleVal = localCenterRates[key];
                      const isSaleEmpty = saleVal === '' || saleVal === undefined || saleVal === null;

                      return (
                        <td key={center._id} className="rate-input-cell">
                          {isEditing ? (
                            <div className="input-with-warning-wrapper">
                              <div className="input-wrapper center-style">
                                <IndianRupee size={10} className="currency-icon" />
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={saleVal}
                                  onChange={(e) => handleRateChange(item.id, center._id, e.target.value, 'center')}
                                  onFocus={(e) => e.target.select()}
                                  className="rate-input"
                                  placeholder="0.00"
                                />
                              </div>
                              {isSaleEmpty && (
                                <div className="warning-indicator-inline" title="Warning: Sale price is unconfigured">
                                  <AlertCircle size={12} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="cell-value-wrap">
                              {isSaleEmpty ? (
                                <span className="empty-warning"><AlertCircle size={12} /> Unset</span>
                              ) : (
                                <span className="rate-value-text sale-value">₹ {Number(saleVal).toFixed(2)}</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Row Level Action Buttons */}
                    <td className="actions-cell text-center">
                      {isEditing ? (
                        <div className="row-action-btns">
                          <button 
                            className="row-save-btn" 
                            onClick={() => saveRow(item)}
                            disabled={isSaving === item.id}
                            title="Save Dish Prices"
                          >
                            {isSaving === item.id ? <RefreshCw size={12} className="spin" /> : <Save size={12} />}
                            <span>Save</span>
                          </button>
                          <button 
                            className="row-cancel-btn" 
                            onClick={() => cancelEdit(item.id)}
                            title="Cancel Changes"
                          >
                            <X size={12} />
                            <span>Cancel</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="row-edit-btn"
                          onClick={() => setEditingRowId(item.id)}
                          disabled={editingRowId !== null}
                          title={editingRowId !== null ? 'Another item is being edited' : 'Edit rates for this dish'}
                        >
                          <Pencil size={12} />
                          <span>Edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="empty-matrix">No items found matching your search.</div>
          )}
        </div>
      </div>

      <style>{`
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        
        .header-actions { display: flex; gap: 16px; align-items: center; }
        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 10px 12px 10px 36px; font-size: 0.8rem; color: var(--text-main); width: 240px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); background: var(--bg-input); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }

        .btn-refresh-icon { background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-dim); padding: 10px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .btn-refresh-icon:hover { color: var(--primary); border-color: var(--primary); }
        
        .status-banner { padding: 12px 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
        .status-banner.error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; }
        .status-banner.success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; }

        .panel-info-header { display: flex; gap: 40px; padding: 24px; border-bottom: 1px solid var(--border-main); background: rgba(249, 115, 22, 0.02); }
        .info-block { display: flex; align-items: center; gap: 12px; }
        .info-block svg { color: var(--primary); opacity: 0.8; }
        .info-block .label { display: block; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .info-block .val { font-size: 1.1rem; font-weight: 800; color: var(--text-main); }

        .table-container-scrollable { overflow-x: auto; max-width: 100%; position: relative; }
        .rate-matrix-table { width: 100%; border-collapse: collapse; min-width: 1100px; }
        
        .rate-matrix-table th { background: var(--bg-sidebar); padding: 16px 20px; font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; border-bottom: 2px solid var(--border-main); text-align: left; }
        .rate-matrix-table td { padding: 16px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.85rem; vertical-align: middle; }
        
        .sticky-col { position: sticky; left: 0; background: var(--bg-main); z-index: 2; border-right: 1px solid var(--border-main); }
        th.sticky-col { z-index: 3; background: var(--bg-sidebar); }
        .first-col { min-width: 250px; }
        
        .menu-cell { display: flex; align-items: center; gap: 12px; }
        .type-tag { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 900; color: white; flex-shrink: 0; }
        .type-tag.menu { background: var(--primary); }
        .type-tag.bom { background: var(--secondary); }
        
        .menu-info { display: flex; flex-direction: column; }
        .item-name { font-weight: 800; color: var(--text-main); font-size: 0.85rem; line-height: 1.2; }
        .item-meta { font-size: 0.6rem; color: var(--text-dim); font-weight: 700; margin-top: 2px; }
        
        .base-price-header-col { background: rgba(249, 115, 22, 0.03); width: 160px; }
        .base-price-cell { background: rgba(249, 115, 22, 0.01); border-right: 1px solid var(--border-main); min-width: 150px; }
        
        .rate-value-text { font-weight: 800; color: var(--text-main); font-size: 0.9rem; }
        .rate-value-text.sale-value { color: #10b981; }

        .center-header-cell { display: flex; flex-direction: column; }
        .center-header-cell small { color: var(--primary); font-size: 0.6rem; margin-top: 2px; text-transform: uppercase; }
        
        .rate-input-cell { min-width: 150px; }
        .input-with-warning-wrapper { display: flex; align-items: center; gap: 6px; position: relative; }
        .warning-indicator-inline { display: flex; align-items: center; justify-content: center; color: #f59e0b; flex-shrink: 0; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

        .input-wrapper { position: relative; display: flex; align-items: center; background: var(--bg-input); border: 1px solid var(--border-main); padding: 0 8px; transition: 0.2s; width: 100%; }
        .input-wrapper:focus-within { border-color: var(--primary); }
        .input-wrapper.changed { border-color: var(--primary); }
        
        .center-style { background: var(--bg-input); }

        .currency-icon { color: var(--text-dim); flex-shrink: 0; }
        .rate-input { background: transparent; border: none; color: var(--text-main); padding: 8px 4px; font-size: 0.8rem; font-weight: 700; width: 100%; outline: none; }
        .rate-input::-webkit-outer-spin-button, .rate-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        
        .empty-warning { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.08); padding: 2px 8px; border: 1px dashed rgba(245, 158, 11, 0.2); }
        .cell-value-wrap { display: flex; align-items: center; min-height: 36px; }

        /* Row Level Styling & Actions */
        .editing-row-active { background: rgba(249, 115, 22, 0.03) !important; }
        .editing-row-active .sticky-col { background: var(--bg-sidebar) !important; }
        .actions-header-col { width: 180px; }
        .actions-cell { min-width: 170px; border-left: 1px solid var(--border-main); }
        
        .row-action-btns { display: flex; gap: 6px; justify-content: center; }
        
        .row-edit-btn { background: none; border: 1px solid var(--border-main); color: var(--text-main); font-size: 0.75rem; font-weight: 800; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; }
        .row-edit-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); background: rgba(249, 115, 22, 0.05); }
        .row-edit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .row-save-btn { background: var(--primary); border: 1px solid var(--primary); color: white; font-size: 0.7rem; font-weight: 800; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: 0.2s; }
        .row-save-btn:hover { background: var(--primary-dark); border-color: var(--primary-dark); }
        
        .row-cancel-btn { background: none; border: 1px solid var(--border-main); color: var(--text-dim); font-size: 0.7rem; font-weight: 800; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: 0.2s; }
        .row-cancel-btn:hover { border-color: #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.05); }

        .empty-matrix { padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .text-center { text-align: center !important; }
      `}</style>
    </MainLayout>
  );
};

export default PaymentSettings;
