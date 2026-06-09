import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { inventoryApi, purchaseApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import {
  Package, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, ShoppingBag, BarChart2, Filter
} from 'lucide-react';

const StoreDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [allInventory, setAllInventory] = useState<any[]>([]); // per-location records for filter
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>('ALL');

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const [stockRes, allInvRes, billsRes] = await Promise.all([
        inventoryApi.getStockSummary(),
        inventoryApi.getAll(),                           // for location filter
        purchaseApi.getBills().catch(() => ({ data: { data: [] } }))
      ]);
      setMaterials(stockRes.data.data || []);
      setAllInventory(allInvRes.data.data || []);
      setBills(billsRes.data.data || []);               // Bug#11: consistent path
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const getUnitLabel = (m: any) =>
    m.unit === 'custom' ? (m.customUnit || '').toUpperCase() : m.unit?.toUpperCase?.() || '';

  const getStockStatus = (m: any) => {
    if (m.currentStock === 0) return 'critical';
    if (m.currentStock < m.minimumStock) return 'low';
    return 'ok';
  };

  const criticalCount = materials.filter(m => m.currentStock === 0).length;
  const lowCount = materials.filter(m => m.currentStock > 0 && m.currentStock < m.minimumStock).length;
  const okCount = materials.filter(m => m.currentStock >= m.minimumStock && m.minimumStock > 0).length;
  const pendingPoBills = bills.filter((b: any) => b.deliveryStatus === 'PENDING').length;
  const deliveredUnpaid = bills.filter((b: any) => b.deliveryStatus === 'DELIVERED' && b.paymentStatus !== 'PAID').length;

  // Build unique location list from per-location inventory records (locationId is populated with {_id, name})
  const locationOptions: string[] = ['ALL', ...Array.from(
    new Set(
      allInventory
        .map((inv: any) => inv.locationId?.name || '')
        .filter(Boolean)
    )
  ).sort()];

  // Show only low/critical items, filtered by location
  const filteredMaterials = materials
    .filter(m => getStockStatus(m) !== 'ok')
    .filter(m => {
      if (locationFilter === 'ALL') return true;
      // Find if any per-location record for this material matches the selected location
      return allInventory.some((inv: any) =>
        (inv.materialId?._id || inv.materialId)?.toString() === m._id?.toString() &&
        inv.locationId?.name === locationFilter
      );
    });

  return (
    <MainLayout>
      {/* Header */}
      <div className="store-header">
        <div className="store-greeting">
          <div className="store-icon"><Package size={20} /></div>
          <div>
            <h1>STOCK DASHBOARD</h1>
            <p className="store-sub">
              Welcome back, <strong>{user?.name?.toUpperCase()}</strong> · STORE MANAGER
              <span className="store-sub-note"> — Showing items requiring attention (low/critical stock)</span>
            </p>
          </div>
        </div>
        <div className="flex-center gap-2">
          <button className="btn-primary" onClick={() => navigate('/purchase')}>
            <ShoppingBag size={14} /> NEW PURCHASE
          </button>
          <button className="btn-refresh" onClick={fetchSummary}>
            <RefreshCw size={14} /> REFRESH
          </button>
        </div>
      </div>

      {lastUpdated && (
        <p className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</p>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* Summary Cards */}
      <div className="stock-cards">
        <div className="stock-card total">
          <div className="sc-icon"><Package size={22} /></div>
          <div className="sc-info">
            <span className="sc-val">{materials.length}</span>
            <span className="sc-label">TOTAL ITEMS</span>
          </div>
        </div>
        <div className="stock-card ok">
          <div className="sc-icon ok"><CheckCircle size={22} /></div>
          <div className="sc-info">
            <span className="sc-val ok">{okCount}</span>
            <span className="sc-label">IN STOCK</span>
          </div>
        </div>
        <div className="stock-card low">
          <div className="sc-icon low"><AlertTriangle size={22} /></div>
          <div className="sc-info">
            <span className="sc-val low">{lowCount}</span>
            <span className="sc-label">LOW STOCK</span>
          </div>
        </div>
        <div className="stock-card critical">
          <div className="sc-icon crit"><XCircle size={22} /></div>
          <div className="sc-info">
            <span className="sc-val crit">{criticalCount}</span>
            <span className="sc-label">OUT OF STOCK</span>
          </div>
        </div>
        <div className="stock-card po">
          <div className="sc-icon po"><ShoppingBag size={22} /></div>
          <div className="sc-info">
            <span className="sc-val po">{pendingPoBills}</span>
            <span className="sc-label">PENDING PO DELIVERIES</span>
          </div>
        </div>
        <div className="stock-card unpaid">
          <div className="sc-icon unpaid"><AlertTriangle size={22} /></div>
          <div className="sc-info">
            <span className="sc-val unpaid">{deliveredUnpaid}</span>
            <span className="sc-label">DELIVERED, UNPAID BILLS</span>
          </div>
        </div>
      </div>

      {/* Stock Table — low/critical only + location filter */}
      <div className="data-panel">
        <div className="panel-header">
          <div>
            <h2>{filteredMaterials.length} ITEMS NEEDING ATTENTION</h2>
            <p className="panel-sub">Low and critical stock only · <BarChart2 size={11} style={{display:'inline', verticalAlign:'middle'}} /> Real-time data</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="panel-legend">
              <span className="leg low"><span className="leg-dot"></span>LOW</span>
              <span className="leg crit"><span className="leg-dot"></span>CRITICAL</span>
            </div>
            {/* Location filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={12} style={{ color: 'var(--text-dim)' }} />
              <select
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-main)',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {locationOptions.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? <ForgeLoader /> : (
          <div className="table-wrapper">
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>CODE</th>
                  <th>ITEM NAME</th>
                  <th>MIN. STOCK</th>
                  <th>TOTAL STOCK (ALL LOCATIONS)</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map(m => {
                  const status = getStockStatus(m);
                  const unit = getUnitLabel(m);

                  return (
                    <tr key={m._id} className={`stock-row ${status}`}>
                      <td>
                        <div className={`status-dot-wrap ${status}`}>
                          <span className="pulse-dot"></span>
                          <span className="status-txt">
                            {status === 'low' ? 'LOW' : 'CRITICAL'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="code-badge">{m.simpleCode}</span>
                      </td>
                      <td>
                        <div className="item-cell">
                          <div className="item-av">{m.name[0]}</div>
                          <span>{m.name.toUpperCase()}</span>
                        </div>
                      </td>
                      <td>
                        <span className="min-stock">{m.minimumStock} {unit}</span>
                      </td>
                      <td>
                        <span className={`current-stock-val ${status}`}>
                          {m.currentStock?.toFixed?.(2) ?? m.currentStock} {unit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredMaterials.length === 0 && (
              <div className="empty-state">
                {locationFilter === 'ALL'
                  ? '✅ All stock levels are within minimum thresholds.'
                  : `No low/critical items for location: ${locationFilter}`}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .store-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .store-greeting { display: flex; align-items: center; gap: 16px; }
        .store-icon { width: 48px; height: 48px; background: linear-gradient(135deg, var(--primary), #ea580c); display: flex; align-items: center; justify-content: center; color: white; }
        .store-greeting h1 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; }
        .store-sub { font-size: 0.78rem; color: var(--text-dim); margin-top: 4px; }
        .store-sub strong { color: var(--primary); }
        .store-sub-note { color: var(--text-dim); opacity: 0.7; font-size: 0.7rem; margin-left: 6px; }
        .last-updated { font-size: 0.65rem; color: var(--text-dim); margin-bottom: 20px; letter-spacing: 0.3px; }
        .btn-refresh { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 8px 16px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-refresh:hover { border-color: var(--primary); color: var(--primary); }

        /* Summary Cards */
        .stock-cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 28px; }
        @media(max-width: 1100px) { .stock-cards { grid-template-columns: repeat(3, 1fr); } }
        @media(max-width: 700px) { .stock-cards { grid-template-columns: repeat(2, 1fr); } }
        .stock-card { background: var(--bg-card); border: 1px solid var(--border-main); padding: 20px; display: flex; align-items: center; gap: 16px; transition: 0.2s; }
        .stock-card:hover { border-color: var(--primary); }
        .sc-icon { color: var(--text-dim); }
        .sc-icon.ok { color: #10b981; }
        .sc-icon.low { color: #eab308; }
        .sc-icon.crit { color: #ef4444; }
        .sc-icon.po { color: #3b82f6; }
        .sc-icon.unpaid { color: #f97316; }
        .sc-info { display: flex; flex-direction: column; }
        .sc-val { font-size: 2rem; font-weight: 800; line-height: 1; }
        .sc-val.ok { color: #10b981; }
        .sc-val.low { color: #eab308; }
        .sc-val.crit { color: #ef4444; }
        .sc-val.po { color: #3b82f6; }
        .sc-val.unpaid { color: #f97316; }
        .sc-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; margin-top: 4px; }

        /* Panel */
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; }
        .panel-header h2 { font-size: 0.75rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; }
        .panel-sub { font-size: 0.65rem; color: var(--text-dim); margin-top: 3px; opacity: 0.7; }
        .panel-legend { display: flex; gap: 16px; }
        .leg { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); }
        .leg-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .leg.ok { color: #10b981; }
        .leg.low { color: #eab308; }
        .leg.crit { color: #ef4444; }

        /* Table */
        .sharp-table th, .sharp-table td { text-align: center; vertical-align: middle; }
        .stock-row.ok { background: rgba(16,185,129,0.01); }
        .stock-row.low { background: rgba(234,179,8,0.02); }
        .stock-row.critical { background: rgba(239,68,68,0.03); }

        /* Status indicator */
        .status-dot-wrap { display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 0.65rem; font-weight: 800; }
        .status-dot-wrap.ok { color: #10b981; }
        .status-dot-wrap.low { color: #eab308; }
        .status-dot-wrap.critical { color: #ef4444; }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .status-dot-wrap.critical .pulse-dot { animation: pulse 1.5s infinite; }
        .status-dot-wrap.low .pulse-dot { animation: pulse 3s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.4; transform: scale(1.3); } }

        .code-badge { font-family: monospace; font-size: 0.9rem; font-weight: 800; color: var(--primary); background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.15); padding: 3px 8px; letter-spacing: 2px; }

        .item-cell { display: flex; align-items: center; gap: 10px; justify-content: center; }
        .item-av { width: 28px; height: 28px; background: var(--border-main); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800; flex-shrink: 0; }

        .min-stock { font-size: 0.82rem; color: var(--text-dim); font-weight: 600; }

        .current-stock-val { font-weight: 800; font-size: 0.95rem; }
        .current-stock-val.ok { color: #10b981; }
        .current-stock-val.low { color: #eab308; }
        .current-stock-val.critical { color: #ef4444; }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; }
      `}</style>
    </MainLayout>
  );
};

export default StoreDashboard;
