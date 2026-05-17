import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Building2,
  Utensils,
  IndianRupee,
  Save
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Local state for temporary rate changes before saving
  const [localRates, setLocalRates] = useState<Record<string, any>>({});
  const [localCenterRates, setLocalCenterRates] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [menuRes, centerRes, rateRes, bomRes] = await Promise.all([
        menuApi.getAll(),
        userApi.getMyCenters(),
        menuApi.getRates(),
        bomApi.getAll()
      ]);

      const menuList = menuRes.data.data || [];
      const bomList = bomRes.data.data || [];
      const centerList = centerRes.data.data || [];
      const rateList = rateRes.data.data || [];

      // Unify logic: List everything that can have a rate
      const unifiedItems: any[] = [];
      
      // 1. Process Menu items (primary selling units)
      menuList.forEach((m: any) => {
        const linkedBom = bomList.find((b: any) => (b.menuItem?._id || b.menuItem) === m._id);
        unifiedItems.push({
          id: m._id,
          type: 'MENU',
          name: m.name,
          basePrice: m.unitPrice,
          unit: m.unit,
          menuId: m._id,
          bomId: linkedBom?._id,
          bomPrice: linkedBom?.kitchenPrice
        });
      });

      // 2. Process BOM items that are NOT linked to any Menu (dish definitions)
      bomList.forEach((b: any) => {
        const isLinked = menuList.some((m: any) => (b.menuItem?._id || b.menuItem) === m._id);
        if (!isLinked) {
          unifiedItems.push({
            id: b._id,
            type: 'BOM',
            name: b.dishName,
            basePrice: b.kitchenPrice,
            unit: 'dish',
            menuId: null,
            bomId: b._id,
            bomPrice: b.kitchenPrice
          });
        }
      });

      setItems(unifiedItems);
      setCenters(centerList);
      setRates(rateList);

      // Initialize local rates
      const initialLocalRates: Record<string, any> = {};
      const initialLocalCenterRates: Record<string, any> = {};
      
      rateList.forEach((r: any) => {
        const itemId = r.menu?._id || r.bom?._id;
        if (itemId) {
          initialLocalRates[`${itemId}_${r.center._id}`] = r.rate;
          initialLocalCenterRates[`${itemId}_${r.center._id}`] = r.centerRate || 0;
        }
      });

      // For items with no custom rate, default to basePrice
      unifiedItems.forEach(item => {
        centerList.forEach(center => {
          const key = `${item.id}_${center._id}`;
          if (initialLocalRates[key] === undefined) {
            initialLocalRates[key] = item.basePrice;
          }
          if (initialLocalCenterRates[key] === undefined) {
            initialLocalCenterRates[key] = item.basePrice; // Default center rate to base price too
          }
        });
      });

      setLocalRates(initialLocalRates);
      setLocalCenterRates(initialLocalCenterRates);

    } catch (err: any) {
      setError('Failed to fetch configuration data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateChange = (itemId: string, centerId: string, value: string, type: 'admin' | 'center') => {
    if (type === 'admin') {
      setLocalRates(prev => ({
        ...prev,
        [`${itemId}_${centerId}`]: value
      }));
    } else {
      setLocalCenterRates(prev => ({
        ...prev,
        [`${itemId}_${centerId}`]: value
      }));
    }
  };

  const saveRate = async (item: any, centerId: string, type: 'admin' | 'center') => {
    const key = `${item.id}_${centerId}`;
    const rateValue = type === 'admin' ? localRates[key] : localCenterRates[key];
    const rateNum = typeof rateValue === 'string' ? parseFloat(rateValue) : rateValue;
    
    if (isNaN(rateNum)) {
      setError('Invalid rate value');
      return;
    }
    
    try {
      setIsSaving(`${key}_${type}`);
      const payload: any = { centerId };
      if (type === 'admin') payload.rate = rateNum;
      else payload.centerRate = rateNum;

      if (item.menuId) payload.menuId = item.menuId;
      else if (item.bomId) payload.bomId = item.bomId;

      await menuApi.updateRate(payload);
      setSuccess(`${type === 'admin' ? 'Admin' : 'Center'} rate updated`);
      setTimeout(() => setSuccess(''), 3000);
      
      const rateRes = await menuApi.getRates();
      setRates(rateRes.data.data);
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
          <h1>PAYMENT SETTINGS</h1>
          <p className="subtitle">CONFIGURE RATES PER CENTER</p>
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
              <span className="label">TOTAL CENTERS</span>
              <span className="val">{centers.length}</span>
            </div>
          </div>
        </div>

        <div className="table-container-scrollable">
          <table className="rate-matrix-table">
            <thead>
              <tr>
                <th className="sticky-col first-col">ITEM / DISH</th>
                <th className="bom-rate-col">BOM COST</th>
                <th className="kitchen-rate-col">BASE RATE</th>
                {centers.map(center => (
                  <th key={center._id} className="center-col">
                    <div className="center-header-cell">
                      <span>{center.name.toUpperCase()}</span>
                      <small>{center.entity?.name || 'Center'}</small>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td className="sticky-col first-col">
                    <div className="menu-cell">
                      <div className={`type-tag ${item.type.toLowerCase()}`}>{item.type[0]}</div>
                      <div className="menu-info">
                        <span className="item-name">{item.name.toUpperCase()}</span>
                        <small className="item-meta">{item.type === 'MENU' ? 'MENU ITEM' : 'BOM DISH'}</small>
                      </div>
                    </div>
                  </td>
                  <td className="bom-rate-cell">
                    {item.bomPrice !== undefined ? (
                      <div className="bom-price-wrap">
                        <span className="bom-val">₹ {item.bomPrice.toFixed(2)}</span>
                        <small>PRODUCTION</small>
                      </div>
                    ) : (
                      <span className="no-bom">—</span>
                    )}
                  </td>
                  <td className="kitchen-rate-cell">
                    <span className="base-price">₹ {item.basePrice.toFixed(2)}</span>
                    <small>PER {item.unit.toUpperCase()}</small>
                  </td>
                  {centers.map(center => {
                    const key = `${item.id}_${center._id}`;
                    const currentRate = localRates[key];
                    const currentCenterRate = localCenterRates[key];
                    
                    const savedRateObj = rates.find(r => 
                      (item.menuId && r.menu?._id === item.menuId && r.center._id === center._id) ||
                      (!item.menuId && item.bomId && r.bom?._id === item.bomId && r.center._id === center._id)
                    );
                    const savedRate = savedRateObj ? savedRateObj.rate : item.basePrice;
                    const savedCenterRate = savedRateObj ? (savedRateObj.centerRate || 0) : item.basePrice;

                    const isChanged = parseFloat(currentRate as any) !== savedRate;
                    const isCenterChanged = parseFloat(currentCenterRate as any) !== savedCenterRate;

                    return (
                      <td key={center._id} className="rate-input-cell">
                        <div className="dual-rate-stack">
                          {/* Admin Rate */}
                          <div className={`input-wrapper ${isChanged ? 'changed' : ''}`}>
                            <div className="input-label-mini">ADM</div>
                            <IndianRupee size={10} className="currency-icon" />
                            <input 
                              type="number" 
                              step="0.01"
                              value={currentRate}
                              onChange={(e) => handleRateChange(item.id, center._id, e.target.value, 'admin')}
                              onFocus={(e) => e.target.select()}
                              className="rate-input"
                            />
                            {isChanged && (
                              <button 
                                className="save-mini-btn" 
                                onClick={() => saveRate(item, center._id, 'admin')}
                                disabled={isSaving === `${key}_admin`}
                              >
                                {isSaving === `${key}_admin` ? <RefreshCw size={10} className="spin" /> : <Save size={10} />}
                              </button>
                            )}
                          </div>

                          {/* Center Rate */}
                          <div className={`input-wrapper center-style ${isCenterChanged ? 'changed' : ''}`}>
                            <div className="input-label-mini">CTR</div>
                            <IndianRupee size={10} className="currency-icon" />
                            <input 
                              type="number" 
                              step="0.01"
                              value={currentCenterRate}
                              onChange={(e) => handleRateChange(item.id, center._id, e.target.value, 'center')}
                              onFocus={(e) => e.target.select()}
                              className="rate-input"
                            />
                            {isCenterChanged && (
                              <button 
                                className="save-mini-btn center-btn" 
                                onClick={() => saveRate(item, center._id, 'center')}
                                disabled={isSaving === `${key}_center`}
                              >
                                {isSaving === `${key}_center` ? <RefreshCw size={10} className="spin" /> : <Save size={10} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
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
        
        .bom-rate-cell { background: rgba(99, 102, 241, 0.03); border-right: 1px solid var(--border-main); min-width: 140px; }
        .bom-price-wrap { display: flex; flex-direction: column; }
        .bom-val { font-weight: 800; color: var(--secondary); font-size: 0.9rem; }
        .bom-price-wrap small { font-size: 0.6rem; color: var(--text-dim); font-weight: 700; margin-top: 2px; }
        .no-bom { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); opacity: 0.5; }

        .kitchen-rate-cell { background: rgba(0,0,0,0.1); min-width: 150px; border-right: 1px solid var(--border-main); }
        .base-price { display: block; font-weight: 800; color: var(--primary); font-size: 0.95rem; }
        .kitchen-rate-cell small { font-size: 0.6rem; color: var(--text-dim); font-weight: 700; }
        
        .center-header-cell { display: flex; flex-direction: column; }
        .center-header-cell small { color: var(--primary); font-size: 0.6rem; margin-top: 2px; }
        
        .rate-input-cell { min-width: 160px; }
        .dual-rate-stack { display: flex; flex-direction: column; gap: 8px; }
        .input-wrapper { position: relative; display: flex; align-items: center; background: var(--bg-input); border: 1px solid var(--border-main); padding: 0 8px; transition: 0.2s; }
        .input-wrapper:focus-within { border-color: var(--primary); }
        .input-wrapper.changed { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.1) !important; }
        
        .input-label-mini { font-size: 0.55rem; font-weight: 900; color: var(--text-dim); background: var(--border-main); padding: 2px 4px; margin-right: 4px; border-radius: 2px; flex-shrink: 0; }
        .center-style { background: rgba(16, 185, 129, 0.03); }
        .center-style .input-label-mini { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .center-btn { background: #10b981 !important; }
        .center-btn:hover { background: #059669 !important; }

        .currency-icon { color: var(--text-dim); flex-shrink: 0; }
        .rate-input { background: transparent; border: none; color: var(--text-main); padding: 6px 4px; font-size: 0.8rem; font-weight: 700; width: 100%; outline: none; -moz-appearance: textfield; }
        .rate-input::-webkit-outer-spin-button, .rate-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        
        .save-mini-btn { background: var(--primary); color: white; border: none; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 4px; border-radius: 2px; }
        .save-mini-btn:hover { background: var(--primary-dark); }
        .save-mini-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .empty-matrix { padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </MainLayout>
  );
};

export default PaymentSettings;
