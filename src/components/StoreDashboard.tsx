import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { rawMaterialApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import {
  Package, AlertTriangle, CheckCircle, XCircle,
  Edit3, Check, X, RefreshCw, Bell, Flame,
  ShoppingBag
} from 'lucide-react';

interface StockAlert { level: 'LOW' | 'CRITICAL'; message: string; id: string; }

const StoreDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await rawMaterialApi.getAll();
      setMaterials(res.data.data || []);
      setLastUpdated(new Date());

      // Re-evaluate alerts from fresh data
      const newAlerts: StockAlert[] = [];
      (res.data.data || []).forEach((m: any) => {
        if (m.currentStock === 0) {
          newAlerts.push({ level: 'CRITICAL', message: `${m.name} is OUT OF STOCK!`, id: m._id });
        } else if (m.currentStock < m.minimumStock) {
          newAlerts.push({ level: 'LOW', message: `${m.name} is below minimum (${m.minimumStock} ${m.unit})`, id: m._id });
        }
      });
      setAlerts(newAlerts);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const startEdit = (m: any) => {
    setEditingId(m._id);
    setEditValue(m.currentStock.toString());
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const saveStock = async (m: any) => {
    const newVal = Number(editValue);
    if (isNaN(newVal) || newVal < 0) return;
    try {
      setSavingId(m._id);
      const res = await rawMaterialApi.updateStock(m._id, newVal);

      // Update local state
      setMaterials(prev => prev.map(item =>
        item._id === m._id ? { ...item, currentStock: newVal } : item
      ));

      // Handle alert from response
      if (res.data.alert) {
        setAlerts(prev => {
          const filtered = prev.filter(a => a.id !== m._id);
          return [{ ...res.data.alert, id: m._id }, ...filtered];
        });
      } else {
        // Clear alert for this item if stock is now OK
        setAlerts(prev => prev.filter(a => a.id !== m._id));
      }

      setEditingId(null);
      setEditValue('');
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update stock');
    } finally {
      setSavingId(null);
    }
  };

  const getStockStatus = (m: any) => {
    if (m.currentStock === 0) return 'critical';
    if (m.currentStock < m.minimumStock) return 'low';
    return 'ok';
  };

  const getUnitLabel = (m: any) =>
    m.unit === 'custom' ? (m.customUnit || '').toUpperCase() : m.unit.toUpperCase();

  const criticalCount = materials.filter(m => m.currentStock === 0).length;
  const lowCount = materials.filter(m => m.currentStock > 0 && m.currentStock < m.minimumStock).length;
  const okCount = materials.filter(m => m.currentStock >= m.minimumStock && m.minimumStock > 0).length;

  return (
    <MainLayout>
      {/* Welcome Header */}
      <div className="store-header">
        <div className="store-greeting">
          <div className="store-icon"><Package size={20} /></div>
          <div>
            <h1>STOCK DASHBOARD</h1>
            <p className="store-sub">Welcome back, <strong>{user?.name?.toUpperCase()}</strong> · STORE MANAGER</p>
          </div>
        </div>
        <div className="flex-center gap-2">
          <button className="btn-refresh" onClick={fetchMaterials}>
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
            {alerts.map((alert, i) => (
              <div key={i} className={`alert-item ${alert.level === 'CRITICAL' ? 'alert-critical' : 'alert-low'}`}>
                {alert.level === 'CRITICAL'
                  ? <XCircle size={14} />
                  : <AlertTriangle size={14} />}
                <span>{alert.message}</span>
                <span className="alert-badge">{alert.level}</span>
              </div>
            ))}
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
          <h2>{materials.length} STOCK ITEMS</h2>
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
                  <th>VENDOR</th>
                  <th>MIN. STOCK</th>
                  <th>CURRENT STOCK</th>
                  <th>UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const status = getStockStatus(m);
                  const unit = getUnitLabel(m);
                  const isEditing = editingId === m._id;
                  const isSaving = savingId === m._id;

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
                      <td className="vendor-cell">{m.vendorName || <span className="dim">—</span>}</td>
                      <td>
                        <span className="min-stock">{m.minimumStock} {unit}</span>
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="stock-edit">
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              min="0"
                              step="0.01"
                              autoFocus
                              className="stock-input"
                            />
                            <span className="unit-hint">{unit}</span>
                          </div>
                        ) : (
                          <span className={`current-stock-val ${status}`}>
                            {m.currentStock} {unit}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="edit-actions">
                            <button
                              className="icon-btn save"
                              onClick={() => saveStock(m)}
                              disabled={isSaving}
                              title="Save"
                            >
                              {isSaving ? <RefreshCw size={13} className="spin" /> : <Check size={13} />}
                            </button>
                            <button className="icon-btn cancel" onClick={cancelEdit} title="Cancel">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button className="icon-btn edit" onClick={() => startEdit(m)} title="Update Stock">
                            <Edit3 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {materials.length === 0 && (
              <div className="empty-state">No items configured yet. Ask your admin to add raw materials.</div>
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
        .last-updated { font-size: 0.65rem; color: var(--text-dim); margin-bottom: 20px; letter-spacing: 0.3px; }
        .btn-refresh { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 10px 20px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-refresh:hover { border-color: var(--primary); color: var(--primary); }
        .btn-primary { padding: 10px 20px !important; }

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

        /* Inline edit */
        .stock-edit { display: flex; align-items: center; gap: 6px; justify-content: center; }
        .stock-input { background: var(--bg-main); border: 1px solid var(--primary); color: var(--text-main); padding: 6px 8px; font-size: 0.85rem; font-weight: 700; outline: none; width: 90px; text-align: center; }
        .unit-hint { font-size: 0.7rem; color: var(--primary); font-weight: 800; }

        .edit-actions { display: flex; align-items: center; justify-content: center; gap: 6px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn.edit:hover { color: var(--primary); border-color: var(--primary); background: rgba(249,115,22,0.06); }
        .icon-btn.save { color: #10b981; border-color: rgba(16,185,129,0.3); }
        .icon-btn.save:hover { background: rgba(16,185,129,0.1); }
        .icon-btn.cancel { color: #ef4444; border-color: rgba(239,68,68,0.3); }
        .icon-btn.cancel:hover { background: rgba(239,68,68,0.1); }
        .icon-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; }
      `}</style>
    </MainLayout>
  );
};

export default StoreDashboard;
