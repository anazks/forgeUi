import React, { useState, useEffect } from 'react';
import { wastageApi } from '../services/api';
import { RefreshCw, Save, TrendingUp, PackageMinus } from 'lucide-react';

import MainLayout from '../layouts/MainLayout';

const WastagePage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);

  useEffect(() => {
    fetchData(date || undefined);
  }, [date]);

  const fetchData = async (targetDate?: string) => {
    setIsLoading(true);
    try {
      const res = await wastageApi.getToday(targetDate);
      if (!date) setDate(res.data.data.date);
      setItems(res.data.data.items);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load wastage data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'warn' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleQtyChange = (idx: number, field: 'wastageQty', val: string) => {
    const num = parseFloat(val) || 0;
    const newItems = [...items];
    const item = newItems[idx];
    
    // Wastage cannot exceed approved
    const wastage = num >= 0 ? (num <= item.approvedQty ? num : item.approvedQty) : 0;
    item.wastageQty = wastage;
    
    // Automatically calculate soldQty
    item.soldQty = item.approvedQty - wastage;
    
    setItems(newItems);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await wastageApi.save({ date, items });
      showToast('Wastage and sales data saved successfully!', 'success');
      fetchData(date);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  let totalCostExpense = 0; // Total approved cost
  let totalIncome = 0; // Total sales at center price
  let totalWastageLoss = 0; // Loss at admin rate

  items.forEach(item => {
    const costPrice = item.rate || 0;
    const sellPrice = item.sellingRate || costPrice;
    
    totalCostExpense += (item.approvedQty * costPrice);
    totalIncome += (item.soldQty * sellPrice);
    totalWastageLoss += (item.wastageQty * costPrice);
  });

  const totalMargin = totalIncome - totalCostExpense;
  const isProfit = totalMargin >= 0;

  return (
    <MainLayout>
      <div className="module-page">
        {toast && <div className={`fr-toast fr-toast-${toast.type}`}>{toast.message}</div>}

        <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h2>Wastage & Sales Management</h2>
          <p>Input daily wastage to calculate sales and margins.</p>
        </div>
        <div className="header-actions">
          <div className="date-picker-group">
            <label>TRACKING DATE</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="date-input"
            />
          </div>
          <button className="btn-refresh" onClick={() => fetchData(date)} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> REFRESH
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving || items.length === 0}>
            {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} SAVE DATA
          </button>
        </div>
      </header>

      {/* Daily Profit & Loss Dashboard */}
      <div className="demand-container" style={{ marginBottom: '32px' }}>
        <div className="demand-toggle" style={{ cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={14} /> 
            TODAY'S DASHBOARD ({date})
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '20px' }}>
          <div className="demand-card" style={{ borderColor: 'var(--primary)' }}>
            <div className="demand-card-header">
              <span className="demand-name">COST EXPENSE</span>
              <span className="demand-qty" style={{ color: 'var(--primary)' }}>₹{totalCostExpense.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Approved buying cost from Admin.</p>
          </div>
          
          <div className="demand-card" style={{ borderColor: '#10b981' }}>
            <div className="demand-card-header">
              <span className="demand-name">TOTAL INCOME</span>
              <span className="demand-qty" style={{ color: '#10b981' }}>₹{totalIncome.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Revenue generated at center price.</p>
          </div>

          <div className="demand-card" style={{ borderColor: '#ef4444' }}>
            <div className="demand-card-header">
              <span className="demand-name">WASTAGE LOSS</span>
              <span className="demand-qty" style={{ color: '#ef4444' }}>₹{totalWastageLoss.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Investment lost to wastage.</p>
          </div>

          <div className="demand-card" style={{ borderColor: isProfit ? '#10b981' : '#ef4444', background: isProfit ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
            <div className="demand-card-header">
              <span className="demand-name">TOTAL MARGIN</span>
              <span className="demand-qty" style={{ color: isProfit ? '#10b981' : '#ef4444' }}>
                {isProfit ? '+' : ''}₹{totalMargin.toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Net profit/loss for the day.</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, padding: '16px 20px', borderBottom: '1px solid var(--border-main)', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PackageMinus size={15} /> ITEM BREAKDOWN
        </h3>
        
        {items.length === 0 && !isLoading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            No approved items found for today.
          </div>
        )}

        {items.length > 0 && (
          <table className="fr-items-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '1px' }}>ITEM NAME</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '1px' }}>BUYING / SELLING</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '1px' }}>APPROVED</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', color: '#ef4444', letterSpacing: '1px' }}>WASTAGE UNIT</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', color: '#10b981', letterSpacing: '1px' }}>SOLD UNIT</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.7rem', color: '#10b981', letterSpacing: '1px' }}>INCOME (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                  const income = (item.soldQty * (item.sellingRate || item.rate));
                  return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-main)' }}>
                  <td style={{ padding: '16px 20px' }}><strong>{item.itemName.toUpperCase()}</strong></td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>B: ₹{item.rate.toFixed(2)}</span>
                       <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 800 }}>S: ₹{(item.sellingRate || item.rate).toFixed(2)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}><strong>{item.approvedQty}</strong></td>
                  <td style={{ padding: '16px 20px' }}>
                    <input 
                      type="number" 
                      min="0"
                      max={item.approvedQty}
                      step="0.01"
                      value={item.wastageQty} 
                      onChange={e => handleQtyChange(idx, 'wastageQty', e.target.value)}
                      style={{ background: 'var(--bg-main)', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', width: '90px', fontWeight: 'bold' }}
                    />
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#10b981', fontSize: '1rem' }}>{item.soldQty}</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>AUTO</span>
                     </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <strong style={{ color: '#10b981' }}>₹{income.toFixed(2)}</strong>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .page-header h2 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
        .page-header p { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
        .header-actions { display: flex; gap: 10px; align-items: center; }
        .date-picker-group { display: flex; flex-direction: column; gap: 4px; }
        .date-picker-group label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .date-input { background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 6px 12px; font-size: 0.75rem; font-weight: 700; outline: none; }
        .date-input:focus { border-color: var(--primary); }


        .btn-refresh { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 9px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: 0.2s; }
        .btn-refresh:hover { border-color: var(--primary); color: var(--primary); }
        .btn-primary { background: var(--primary); color: white; border: none; padding: 9px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: 0.2s; }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .fr-toast { position: fixed; top: 24px; right: 24px; z-index: 9999; padding: 14px 20px; font-size: 0.82rem; font-weight: 700; border-left: 4px solid; animation: slideIn 0.3s ease-out; }
        .fr-toast-success { background: rgba(16,185,129,0.1); border-color: #10b981; color: #10b981; }
        .fr-toast-warn    { background: rgba(234,179,8,0.1);  border-color: #eab308; color: #eab308; }
        .fr-toast-error   { background: rgba(239,68,68,0.1);  border-color: #ef4444; color: #ef4444; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .demand-container { background: rgba(0,0,0,0.1); border: 1px solid var(--border-main); }
        .demand-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: none; border: none; color: var(--primary); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; border-bottom: 1px solid var(--border-main); }
        .demand-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .demand-card-header { display: flex; justify-content: space-between; align-items: center; }
        .demand-name { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); }
        .demand-qty { font-size: 1.2rem; font-weight: 800; }
        
        .glass-panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); overflow: hidden; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
      </div>
    </MainLayout>
  );
};

export default WastagePage;
