import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { inventoryApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import {
  Package, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Bell, ShoppingBag, BarChart2
} from 'lucide-react';

const StoreDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await inventoryApi.getStockSummary();
      setMaterials(res.data.data || []);
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

  const alerts = materials.filter(m => getStockStatus(m) !== 'ok');

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
              <span className="store-sub-note"> — Stock totals are summed across all locations in real-time</span>
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

      {/* Alert Panel */}
      {alerts.length > 0 && (
        <div className="alert-panel">
          <div className="alert-panel-header">
            <Bell size={14} />
            <span>STOCK ALERTS ({alerts.length})</span>
          </div>
          <div className="alert-list">
            {alerts.map((m, i) => {
              const status = getStockStatus(m);
              const unit = getUnitLabel(m);
              return (
                <div key={i} className={`alert-item ${status === 'critical' ? 'alert-critical' : 'alert-low'}`}>
                  {status === 'critical' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                  <span>
                    {status === 'critical'
                      ? `${m.name} is OUT OF STOCK across all locations`
                      : `${m.name} is below minimum (${m.minimumStock} ${unit}) — total: ${m.currentStock} ${unit}`}
                  </span>
                  <span className="alert-badge">{status.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      </div>

      {/* Stock Table */}
      <div className="data-panel">
        <div className="panel-header">
          <div>
            <h2>{materials.length} STOCK ITEMS</h2>
            <p className="panel-sub">Aggregated across all locations · <BarChart2 size={11} style={{display:'inline', verticalAlign:'middle'}} /> Real-time data</p>
          </div>
          <div className="panel-legend">
            <span className="leg ok"><span className="leg-dot"></span>OK</span>
            <span className="leg low"><span className="leg-dot"></span>LOW</span>
            <span className="leg crit"><span className="leg-dot"></span>CRITICAL</span>
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
                  <th>LOCATIONS</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const status = getStockStatus(m);
                  const unit = getUnitLabel(m);

                  return (
                    <tr key={m._id} className={`stock-row ${status}`}>
                      <td>
                        <div className={`status-dot-wrap ${status}`}>
                          <span className="pulse-dot"></span>
                          <span className="status-txt">
                            {status === 'ok' ? 'IN STOCK' : status === 'low' ? 'LOW' : 'CRITICAL'}
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
                      <td>
                        <span className="loc-count">{m.locationCount} loc{m.locationCount !== 1 ? 's' : ''}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {materials.length === 0 && (
              <div className="empty-state">No inventory records found. Stock is updated automatically when deliveries are received.</div>
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

        /* Alert Panel */
        .alert-panel { background: rgba(239,68,68,0.03); border: 1px solid rgba(239,68,68,0.2); margin-bottom: 24px; }
        .alert-panel-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid rgba(239,68,68,0.1); font-size: 0.7rem; font-weight: 800; color: #ef4444; letter-spacing: 1px; }
        .alert-list { display: flex; flex-direction: column; }
        .alert-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 0.8rem; border-bottom: 1px solid rgba(239,68,68,0.08); }
        .alert-item:last-child { border-bottom: none; }
        .alert-critical { color: #ef4444; }
        .alert-low { color: #eab308; }
        .alert-item svg { flex-shrink: 0; }
        .alert-item span:nth-child(2) { flex: 1; }
        .alert-badge { font-size: 0.6rem; font-weight: 800; padding: 2px 6px; border: 1px solid currentColor; background: rgba(255,255,255,0.03); }

        /* Summary Cards */
        .stock-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .stock-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 20px; display: flex; align-items: center; gap: 16px; transition: 0.2s; }
        .stock-card:hover { border-color: var(--primary); }
        .sc-icon { color: var(--text-dim); }
        .sc-icon.ok { color: #10b981; }
        .sc-icon.low { color: #eab308; }
        .sc-icon.crit { color: #ef4444; }
        .sc-info { display: flex; flex-direction: column; }
        .sc-val { font-size: 2rem; font-weight: 800; line-height: 1; }
        .sc-val.ok { color: #10b981; }
        .sc-val.low { color: #eab308; }
        .sc-val.crit { color: #ef4444; }
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
        @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.4; transform: scale(1.3); } }

        .code-badge { font-family: monospace; font-size: 0.9rem; font-weight: 800; color: var(--primary); background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.15); padding: 3px 8px; letter-spacing: 2px; }

        .item-cell { display: flex; align-items: center; gap: 10px; justify-content: center; }
        .item-av { width: 28px; height: 28px; background: var(--border-main); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800; flex-shrink: 0; }

        .vendor-cell { font-size: 0.8rem; color: var(--text-dim); }
        .dim { opacity: 0.35; }
        .min-stock { font-size: 0.82rem; color: var(--text-dim); font-weight: 600; }

        .current-stock-val { font-weight: 800; font-size: 0.95rem; }
        .current-stock-val.ok { color: #10b981; }
        .current-stock-val.low { color: #eab308; }
        .current-stock-val.critical { color: #ef4444; }

        .loc-count { font-size: 0.7rem; color: var(--text-dim); font-weight: 600; padding: 2px 8px; border: 1px solid var(--border-main); }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; }
      `}</style>
    </MainLayout>
  );
};

export default StoreDashboard;
