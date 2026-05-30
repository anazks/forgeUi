import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  AlertCircle,
  Utensils,
  IndianRupee,
  ShieldAlert
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { menuApi, bomApi } from '../services/api';

const LocationPricingPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    setCurrentUser(userData);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const [menuRes, bomRes, rateRes] = await Promise.all([
        menuApi.getAll(),
        bomApi.getAll(),
        menuApi.getRates()
      ]);

      const menuList = menuRes.data.data || [];
      const bomList = bomRes.data.data || [];
      const rateList = rateRes.data.data || [];

      // Unify logic: Get only Menu items that have an associated BOM (or BOMs sold directly)
      const locationItems: any[] = [];

      // 1. Process Menu items linked to BOM
      menuList.forEach((m: any) => {
        const linkedBom = bomList.find((b: any) => (b.menuItem?._id || b.menuItem) === m._id);
        if (linkedBom) {
          const rateObj = rateList.find((r: any) => r.menu?._id === m._id);
          locationItems.push({
            id: m._id,
            name: m.name,
            type: 'MENU ITEM',
            unit: m.unit,
            bomPrice: linkedBom.kitchenPrice,
            salePrice: rateObj && rateObj.centerRate !== undefined && rateObj.centerRate !== null ? rateObj.centerRate : null
          });
        }
      });

      // 2. Process BOM items sold directly (not linked to a menu item)
      bomList.forEach((b: any) => {
        const isLinked = menuList.some((m: any) => (b.menuItem?._id || b.menuItem) === m._id);
        if (!isLinked) {
          const rateObj = rateList.find((r: any) => r.bom?._id === b._id);
          locationItems.push({
            id: b._id,
            name: b.dishName,
            type: 'BOM DISH',
            unit: b.unit || 'pcs',
            bomPrice: b.kitchenPrice,
            salePrice: rateObj && rateObj.centerRate !== undefined && rateObj.centerRate !== null ? rateObj.centerRate : null
          });
        }
      });

      setItems(locationItems);
    } catch (err: any) {
      setError('Failed to load local pricing rates.');
    } finally {
      setIsLoading(false);
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
          <h1>LOCAL SELLING RATES</h1>
          <p className="subtitle">MANDATORY SELLING PRICES FOR {currentUser?.name?.toUpperCase() || 'YOUR LOCATION'}</p>
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
          <button className="btn-refresh-icon" onClick={fetchData} title="Refresh Rates">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {error && (
        <div className="status-banner error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="data-panel">
        <div className="panel-info-header">
          <div className="info-block">
            <Utensils size={18} />
            <div>
              <span className="label">PRICED MENU ITEMS</span>
              <span className="val">{items.length}</span>
            </div>
          </div>
          <div className="info-block security-banner">
            <ShieldAlert size={16} />
            <span>PRICES ARE MANDATORY AND LOCKED BY CENTRAL MANAGEMENT</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="sharp-table">
            <thead>
              <tr>
                <th>ITEM / DISH NAME</th>
                <th>CATEGORY</th>
                <th>UNIT OF MEASURE</th>
                <th className="text-right">YOUR SELLING PRICE</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="item-profile">
                      <span className="item-name">{item.name.toUpperCase()}</span>
                      <small className="item-type">{item.type}</small>
                    </div>
                  </td>
                  <td>
                    <span className="category-tag">{item.type}</span>
                  </td>
                  <td>
                    <span className="unit-label">PER {item.unit.toUpperCase()}</span>
                  </td>
                  <td className="text-right pricing-cell">
                    {item.salePrice === null || item.salePrice === undefined ? (
                      <span className="empty-warning"><AlertCircle size={12} /> Unset</span>
                    ) : (
                      <div className="price-badge">
                        <IndianRupee size={12} />
                        <span>{Number(item.salePrice).toFixed(2)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">No priced items found.</td>
                </tr>
              )}
            </tbody>
          </table>
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

        .data-panel { border: 1px solid var(--border-main); background: var(--bg-sidebar); }
        .panel-info-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border-main); background: rgba(249, 115, 22, 0.01); }
        .info-block { display: flex; align-items: center; gap: 12px; }
        .info-block svg { color: var(--primary); }
        .info-block .label { display: block; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .info-block .val { font-size: 1.1rem; font-weight: 800; color: var(--text-main); }
        
        .security-banner { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); display: flex; align-items: center; gap: 8px; border: 1px dashed var(--border-main); padding: 6px 14px; background: rgba(255, 255, 255, 0.02); }
        .security-banner svg { color: #f59e0b; }

        .table-wrapper { border: none; }
        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 14px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.85rem; color: var(--text-muted); }
        .sharp-table tr:hover { background: var(--row-hover); }

        .item-profile { display: flex; flex-direction: column; }
        .item-name { font-weight: 800; color: var(--text-main); font-size: 0.85rem; }
        .item-type { font-size: 0.6rem; color: var(--primary); font-weight: 800; margin-top: 2px; }

        .category-tag { font-size: 0.65rem; font-weight: 800; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-main); padding: 2px 8px; color: var(--text-main); }
        .bom-price { font-weight: 700; color: var(--text-dim); }
        .unit-label { font-size: 0.7rem; font-weight: 700; color: var(--text-dim); }
        
        .pricing-cell { display: flex; justify-content: flex-end; }
        .price-badge { display: flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; padding: 6px 14px; font-weight: 900; font-size: 1rem; }
        .price-badge svg { flex-shrink: 0; }
        .empty-warning { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.08); padding: 6px 12px; border: 1px dashed rgba(245, 158, 11, 0.2); }
        
        .text-right { text-align: right; }
        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 700; }
      `}</style>
    </MainLayout>
  );
};

export default LocationPricingPage;
