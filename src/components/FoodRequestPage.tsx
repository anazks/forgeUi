import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { foodRequestApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import {
  Plus, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, Beaker
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING:  'status-pending',
  APPROVED: 'status-approved',
  REJECTED: 'status-rejected',
  PARTIAL:  'status-partial',
};

const FoodRequestPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  
  // Mock data for immediate visibility as requested
  const mockRequests = [
    {
      _id: 'mock-1',
      centerName: 'North Center (Sample)',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      requestedItems: [
        { materialName: 'Tomato Paste', simpleCode: '0001', requestedQty: 5, unit: 'kg' },
        { materialName: 'Cooking Oil', simpleCode: '0004', requestedQty: 10, unit: 'ltr' }
      ],
      notes: 'Weekly refill request'
    },
    {
      _id: 'mock-2',
      centerName: 'East Wing (Sample)',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      requestedItems: [
        { materialName: 'Basmati Rice', simpleCode: '0002', requestedQty: 50, unit: 'kg' }
      ],
      notes: 'Urgent requirement for banquet'
    }
  ];

  const [requests, setRequests] = useState<any[]>(mockRequests);
  const [isLoading, setIsLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [demandSummary, setDemandSummary] = useState<any[]>([]);
  const [showDemand, setShowDemand] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isCenter = user?.role === 'CENTERS';

  useEffect(() => { 
    fetchRequests(); 
    if (!isCenter) fetchDemand();
  }, [entityId]);

  const fetchDemand = async () => {
    try {
      const res = await foodRequestApi.getDemandSummary(entityId);
      setDemandSummary(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch demand summary:', err);
    }
  };

  const showToast = (message: string, type: 'success' | 'warn' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await foodRequestApi.getAll(entityId);
      const data = res.data.data || [];
      if (data.length === 0) {
        setRequests(mockRequests);
      } else {
        setRequests(data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedSample = async () => {
    try {
      setSeeding(true);
      await foodRequestApi.seedSample(entityId ? { entity: entityId } : {});
      showToast('3 sample requests created!', 'success');
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to seed. Add raw materials first.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await foodRequestApi.approve(id);
      const { stockStatus, message } = res.data;
      if (stockStatus === 'ALL_AVAILABLE') {
        showToast(message, 'success');
      } else {
        showToast(message, 'warn');
      }
      fetchRequests();
      fetchDemand();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      await foodRequestApi.reject(id, rejectReason || 'Rejected by store manager');
      showToast('Request rejected.', 'warn');
      setRejectingId(null);
      setRejectReason('');
      fetchRequests();
      fetchDemand();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pending  = requests.filter(r => r.status === 'PENDING');
  const approved = requests.filter(r => r.status === 'APPROVED');
  const partial  = requests.filter(r => r.status === 'PARTIAL');
  const rejected = requests.filter(r => r.status === 'REJECTED');

  const renderStatusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle size={13} />;
    if (status === 'REJECTED') return <XCircle size={13} />;
    if (status === 'PARTIAL')  return <AlertTriangle size={13} />;
    return <Clock size={13} />;
  };

  return (
    <MainLayout>
      {/* Toast */}
      {toast && (
        <div className={`fr-toast fr-toast-${toast.type}`}>{toast.message}</div>
      )}

      <header className="page-header">
        <div className="header-title">
          <h1>FOOD REQUESTS</h1>
          <p className="subtitle">REQUESTS FROM CENTERS — STOCK VERIFICATION &amp; APPROVAL</p>
        </div>
        <div className="header-actions">
          <button className="btn-seed" onClick={handleSeedSample} disabled={seeding}>
            {seeding ? <Loader2 size={14} className="spin" /> : <Beaker size={14} />}
            CREATE SAMPLE REQUESTS
          </button>
          <button className="btn-refresh" onClick={fetchRequests}>
            <RefreshCw size={14} /> REFRESH
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Demand Summary / Center Dashboard Section */}
      {!isCenter ? (
        <div className="demand-container">
          <button className="demand-toggle" onClick={() => setShowDemand(!showDemand)}>
            <Beaker size={14} /> 
            KITCHEN PRODUCTION DEMAND (MENU ITEMS ONLY)
            {showDemand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showDemand && (
            <div className="demand-grid">
              {demandSummary.length === 0 ? (
                <div className="demand-empty">No pending material demand.</div>
              ) : (
                demandSummary.map((item, idx) => {
                  const stock = item.currentStock || 0;
                  const isSufficient = stock >= item.totalQty;
                  const percent = item.totalQty > 0 ? Math.min((stock / item.totalQty) * 100, 100) : 100;
                  return (
                  <div key={idx} className={`demand-card ${isSufficient ? 'demand-suff' : 'demand-insuff'}`}>
                    <div className="demand-card-header">
                      <span className="demand-name">{item.name.toUpperCase()}</span>
                      <div className="demand-qty-group">
                        <span className="demand-qty" title="Required">{item.totalQty.toFixed(2)}</span>
                        <span className="demand-vs">/</span>
                        <span className={`demand-stock ${isSufficient ? 'txt-suff' : 'txt-insuff'}`} title="In Stock">{stock.toFixed(2)} {item.unit?.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="demand-progress-bg">
                      <div className={`demand-progress-fill ${isSufficient ? 'bg-suff' : 'bg-insuff'}`} style={{width: `${percent}%`}} />
                    </div>
                  </div>
                )})
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="demand-container">
          <div className="demand-toggle" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={14} /> 
              DAILY REVENUE DASHBOARD (APPROVED ITEMS)
            </div>
          </div>
          <div className="demand-grid">
            {(() => {
              const dailyStats: { [date: string]: { cost: number; sales: number } } = {};
              requests.forEach(req => {
                if (req.status === 'APPROVED' || req.status === 'PARTIAL') {
                  const d = new Date(req.deliveryDate).toLocaleDateString();
                  if (!dailyStats[d]) dailyStats[d] = { cost: 0, sales: 0 };
                  req.requestedItems.forEach((item: any) => {
                    if (item.isStockSufficient !== false) {
                      const rate = item.assignedRate || 0;
                      const selling = item.sellingRate || rate;
                      dailyStats[d].cost += (rate * item.requestedQty);
                      dailyStats[d].sales += (selling * item.requestedQty);
                    }
                  });
                }
              });

              const dates = Object.keys(dailyStats).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
              
              if (dates.length === 0) {
                return <div className="demand-empty">No approved requests yet.</div>;
              }

              return dates.map((date, idx) => {
                const { cost, sales } = dailyStats[date];
                const margin = sales - cost;
                return (
                  <div key={idx} className="demand-card revenue-card">
                    <div className="demand-card-header">
                      <span className="demand-name">{date}</span>
                    </div>
                    <div className="revenue-stats">
                      <div className="rev-stat">
                        <label>BUYING</label>
                        <span className="val cost">₹{cost.toFixed(2)}</span>
                      </div>
                      <div className="rev-stat">
                        <label>SELLING</label>
                        <span className="val sales">₹{sales.toFixed(2)}</span>
                      </div>
                      <div className="rev-stat margin">
                        <label>MARGIN</label>
                        <span className="val profit">₹{margin.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="fr-summary">
        <div className="fr-stat pending"><Clock size={14} /><span>{pending.length}</span><label>PENDING</label></div>
        <div className="fr-divider" />
        <div className="fr-stat approved"><CheckCircle size={14} /><span>{approved.length}</span><label>APPROVED</label></div>
        <div className="fr-divider" />
        <div className="fr-stat partial"><AlertTriangle size={14} /><span>{partial.length}</span><label>PARTIAL</label></div>
        <div className="fr-divider" />
        <div className="fr-stat rejected"><XCircle size={14} /><span>{rejected.length}</span><label>REJECTED</label></div>
      </div>

      {isLoading ? <ForgeLoader /> : (
        <div className="fr-list">
          {requests.length === 0 && (
            <div className="empty-state">
              No food requests yet.
              <button className="btn-seed inline-seed" onClick={handleSeedSample} disabled={seeding}>
                {seeding ? 'Creating...' : '+ Create Sample Requests'}
              </button>
            </div>
          )}

          {/* Grouped by Center */}
          {Object.entries(
            requests.reduce((acc: any, req) => {
              const name = req.centerName || 'Unknown Center';
              if (!acc[name]) acc[name] = [];
              acc[name].push(req);
              return acc;
            }, {})
          ).map(([centerName, centerRequests]: [string, any]) => (
            <div key={centerName} className="center-group">
              <div className="center-group-header">
                <div className="center-dot" />
                <h2>{centerName.toUpperCase()}</h2>
                <span className="center-req-count">{centerRequests.length} REQUESTS</span>
              </div>
              
              <div className="center-group-content">
                {centerRequests.map((req: any) => {
            const isExpanded = expandedId === req._id;
            const isProcessing = processingId === req._id;
            const isRejecting = rejectingId === req._id;
            const isPending = req.status === 'PENDING';

            return (
              <div key={req._id} className={`fr-card ${req.status.toLowerCase()}`}>
                {/* Card Header */}
                <div className="fr-card-header" onClick={() => setExpandedId(isExpanded ? null : req._id)}>
                  <div className="fr-card-left">
                    <div className={`fr-status-tag ${STATUS_COLORS[req.status]}`}>
                      {renderStatusIcon(req.status)}
                      {req.status}
                    </div>
                    <div className="fr-center-info">
                      <span className="fr-meta">
                        <strong className="item-count-badge">{req.requestedItems.length} ITEMS TOTAL</strong> · REQ: {new Date(req.createdAt).toLocaleDateString()} · <strong style={{color: 'var(--primary)'}}>DELIVERY: {req.deliveryDate ? new Date(req.deliveryDate).toLocaleDateString() : 'TBD'}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="fr-card-right">
                    {isPending && (
                      <div className="fr-action-row" onClick={e => e.stopPropagation()}>
                        <button
                          className="btn-approve"
                          onClick={() => handleApprove(req._id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? <Loader2 size={13} className="spin" /> : <CheckCircle size={13} />}
                          APPROVE
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => setRejectingId(isRejecting ? null : req._id)}
                          disabled={isProcessing}
                        >
                          <XCircle size={13} /> REJECT
                        </button>
                      </div>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="approved-by">
                        ✓ Approved {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : ''}
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="rejected-by">✕ {req.rejectionReason || 'Rejected'}</span>
                    )}
                    {req.status === 'PARTIAL' && (
                      <span className="partial-note">⚠ Insufficient stock on some items</span>
                    )}
                    <button className="expand-btn">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Reject reason input */}
                {isRejecting && (
                  <div className="reject-form" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="reject-input"
                    />
                    <button className="btn-reject-confirm" onClick={() => handleReject(req._id)} disabled={isProcessing}>
                      {isProcessing ? <Loader2 size={13} className="spin" /> : 'CONFIRM REJECT'}
                    </button>
                    <button className="btn-cancel-reject" onClick={() => setRejectingId(null)}>CANCEL</button>
                  </div>
                )}

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="fr-items-panel">
                    {req.notes && <p className="fr-notes">📝 {req.notes}</p>}
                    <table className="fr-items-table">
                      <thead>
                        <tr>
                          <th>CODE</th>
                          <th>ITEM</th>
                          <th>REQUESTED</th>
                          {!isCenter && req.status !== 'PENDING' && <th>IN STOCK AT APPROVAL</th>}
                          {!isCenter && req.status !== 'PENDING' && <th>SUFFICIENT?</th>}
                          {isCenter && req.status !== 'PENDING' && <th>RATE</th>}
                          {isCenter && req.status !== 'PENDING' && <th>TOTAL COST</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {req.requestedItems.map((item: any, i: number) => {
                          const hasBom = item.isMenuItem && item.bomId && item.bomId.items && item.bomId.items.length > 0;
                          return (
                            <React.Fragment key={i}>
                              <tr className={hasBom ? "has-bom-row" : ""}>
                                <td><span className="code-sm">{item.simpleCode || '—'}</span></td>
                                <td>
                                  <strong>{item.materialName.toUpperCase()}</strong>
                                  {hasBom && <span className="bom-badge">MENU ITEM</span>}
                                </td>
                                <td><strong>{item.requestedQty} {item.unit?.toUpperCase()}</strong></td>
                                {!isCenter && req.status !== 'PENDING' && (
                                  <td className={item.isStockSufficient === false ? 'td-warn' : ''}>
                                    {item.availableStock !== null ? `${item.availableStock} ${item.unit?.toUpperCase()}` : '—'}
                                  </td>
                                )}
                                {!isCenter && req.status !== 'PENDING' && (
                                  <td>
                                    {item.isStockSufficient === true  && <span className="suff-yes">✓ YES</span>}
                                    {item.isStockSufficient === false && <span className="suff-no">✗ NO</span>}
                                    {item.isStockSufficient === null  && <span className="suff-na">—</span>}
                                  </td>
                                )}
                                {isCenter && req.status !== 'PENDING' && (
                                  <td>
                                    {item.isStockSufficient === false ? <span className="suff-no">REJECTED</span> : (item.assignedRate !== undefined ? `₹${item.assignedRate}` : '—')}
                                  </td>
                                )}
                                {isCenter && req.status !== 'PENDING' && (
                                  <td>
                                    <strong style={{ color: item.isStockSufficient === false ? 'var(--text-dim)' : 'var(--primary)' }}>
                                      {item.isStockSufficient === false ? '—' : (item.assignedRate !== undefined ? `₹${(item.assignedRate * item.requestedQty).toFixed(2)}` : '—')}
                                    </strong>
                                  </td>
                                )}
                              </tr>
                              {!isCenter && hasBom && item.bomId.items.map((ing: any, idx: number) => {
                                const totalIngQty = Number(ing.quantity) * Number(item.requestedQty);
                                return (
                                  <tr key={`bom-${i}-${idx}`} className="bom-ingredient-row">
                                    <td></td>
                                    <td className="bom-ing-name"><span className="ing-arrow">↳</span> {(ing.itemName || ing.materialName || 'Unknown Material').toUpperCase()}</td>
                                    <td className="bom-ing-qty">{totalIngQty.toFixed(2)} {ing.unit === 'custom' ? (ing.customUnit || 'unit').toUpperCase() : (ing.unit || 'UNIT').toUpperCase()}</td>
                                    {req.status !== 'PENDING' && <td colSpan={2}></td>}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
        .header-actions { display: flex; gap: 10px; align-items: center; }

        .btn-seed { background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); color: #a855f7; padding: 9px 16px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: 0.2s; }
        .btn-seed:hover:not(:disabled) { background: rgba(168,85,247,0.2); }
        .btn-seed:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-refresh { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 9px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: 0.2s; }
        .btn-refresh:hover { border-color: var(--primary); color: var(--primary); }

        /* Toast */
        .fr-toast { position: fixed; top: 24px; right: 24px; z-index: 9999; padding: 14px 20px; font-size: 0.82rem; font-weight: 700; border-left: 4px solid; animation: slideIn 0.3s ease-out; }
        .fr-toast-success { background: rgba(16,185,129,0.1); border-color: #10b981; color: #10b981; }
        .fr-toast-warn    { background: rgba(234,179,8,0.1);  border-color: #eab308; color: #eab308; }
        .fr-toast-error   { background: rgba(239,68,68,0.1);  border-color: #ef4444; color: #ef4444; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .demand-container { margin-bottom: 24px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-main); }
        .demand-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: none; border: none; color: var(--primary); font-size: 0.75rem; font-weight: 800; cursor: pointer; letter-spacing: 1px; }
        .demand-toggle:hover { background: rgba(249,115,22,0.05); }
        .demand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; padding: 0 20px 20px; }
        .demand-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 12px; }
        .demand-card.demand-suff { border-color: rgba(16,185,129,0.3); }
        .demand-card.demand-insuff { border-color: rgba(239,68,68,0.3); }
        .demand-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .demand-name { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); }
        .demand-qty-group { display: flex; align-items: baseline; gap: 4px; font-size: 0.85rem; font-weight: 800; }
        .demand-qty { color: var(--text-main); }
        .demand-vs { color: var(--text-dim); font-size: 0.7rem; font-weight: 400; }
        .txt-suff { color: #10b981; }
        .txt-insuff { color: #ef4444; }
        .demand-progress-bg { height: 4px; background: var(--bg-main); border-radius: 2px; overflow: hidden; }
        .demand-progress-fill { height: 100%; opacity: 0.8; transition: width 0.3s ease; }
        .bg-suff { background: #10b981; }
        .bg-insuff { background: #ef4444; }
        .demand-empty { grid-column: 1/-1; text-align: center; color: var(--text-dim); font-size: 0.8rem; padding: 20px; }

        .revenue-card { border-color: var(--primary) !important; background: rgba(249,115,22,0.02); }
        .revenue-stats { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        .rev-stat { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border-main); padding-bottom: 4px; }
        .rev-stat:last-child { border: none; }
        .rev-stat label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .rev-stat .val { font-size: 0.85rem; font-weight: 800; }
        .rev-stat .val.cost { color: #3b82f6; }
        .rev-stat .val.sales { color: #10b981; }
        .rev-stat.margin { background: rgba(16,185,129,0.05); padding: 4px 8px; margin: 0 -8px -4px; border-radius: 0 0 4px 4px; border: none; }
        .rev-stat .val.profit { color: #10b981; font-size: 0.95rem; }

        /* Summary */
        .fr-summary { display: flex; align-items: center; gap: 0; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 16px 28px; margin-bottom: 24px; }
        .fr-stat { display: flex; align-items: center; gap: 8px; }
        .fr-stat span { font-size: 1.6rem; font-weight: 800; }
        .fr-stat label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .fr-stat.pending { color: #f59e0b; }
        .fr-stat.approved { color: #10b981; }
        .fr-stat.partial { color: #f97316; }
        .fr-stat.rejected { color: #ef4444; }
        .fr-divider { width: 1px; height: 36px; background: var(--border-main); margin: 0 28px; }

        /* Groups */
        .center-group { margin-bottom: 32px; }
        .center-group-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border-main); }
        .center-dot { width: 10px; height: 10px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 10px var(--primary); }
        .center-group-header h2 { font-size: 0.9rem; font-weight: 800; letter-spacing: 1px; color: var(--text-main); }
        .center-req-count { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); background: var(--bg-main); padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border-main); }
        .center-group-content { display: flex; flex-direction: column; gap: 12px; padding-left: 22px; border-left: 1px dashed var(--border-main); }

        .fr-list { display: flex; flex-direction: column; gap: 12px; }
        .fr-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); transition: border-color 0.2s; }
        .fr-card.pending  { border-left: 3px solid #f59e0b; }
        .fr-card.approved { border-left: 3px solid #10b981; }
        .fr-card.rejected { border-left: 3px solid #ef4444; }
        .fr-card.partial  { border-left: 3px solid #f97316; }

        .fr-card-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; cursor: pointer; gap: 16px; }
        .fr-card-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .fr-card-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

        .fr-status-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 0.65rem; font-weight: 800; padding: 4px 10px; border: 1px solid; white-space: nowrap; }
        .status-pending  { color: #f59e0b; border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.06); }
        .status-approved { color: #10b981; border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.06); }
        .status-rejected { color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); }
        .status-partial  { color: #f97316; border-color: rgba(249,115,22,0.3); background: rgba(249,115,22,0.06); }

        .fr-center-info strong { display: block; font-size: 0.95rem; color: var(--text-main); }
        .item-count-badge { background: var(--primary); color: white; padding: 2px 8px; font-size: 0.6rem; border-radius: 4px; margin-right: 8px; }
        .fr-meta { font-size: 0.68rem; color: var(--text-dim); font-weight: 600; display: flex; align-items: center; }

        .fr-action-row { display: flex; gap: 8px; }
        .btn-approve { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #10b981; padding: 7px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-approve:hover:not(:disabled) { background: rgba(16,185,129,0.2); }
        .btn-reject { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #ef4444; padding: 7px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-reject:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
        .btn-approve:disabled, .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

        .approved-by { font-size: 0.7rem; color: #10b981; font-weight: 700; }
        .rejected-by { font-size: 0.7rem; color: #ef4444; font-weight: 700; max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
        .partial-note { font-size: 0.7rem; color: #f97316; font-weight: 700; }

        .expand-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; }

        /* Reject form */
        .reject-form { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--border-main); background: rgba(239,68,68,0.03); flex-wrap: wrap; }
        .reject-input { flex: 1; background: var(--bg-main); border: 1px solid rgba(239,68,68,0.3); color: var(--text-main); padding: 8px 12px; font-size: 0.8rem; outline: none; min-width: 200px; }
        .btn-reject-confirm { background: #ef4444; color: white; border: none; padding: 8px 14px; font-weight: 800; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-cancel-reject { background: none; border: 1px solid var(--border-main); color: var(--text-dim); padding: 8px 12px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }

        /* Expanded items */
        .fr-items-panel { border-top: 1px solid var(--border-main); padding: 16px 20px; background: rgba(0,0,0,0.08); }
        .fr-notes { font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px; font-style: italic; }
        .fr-items-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .fr-items-table th { text-align: left; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; padding: 6px 10px; border-bottom: 1px solid var(--border-main); }
        .fr-items-table td { padding: 10px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .code-sm { font-family: monospace; font-size: 0.85rem; font-weight: 800; color: var(--primary); }
        .td-warn { color: #ef4444; font-weight: 700; }
        .suff-yes { color: #10b981; font-size: 0.75rem; font-weight: 800; }
        .suff-no  { color: #ef4444; font-size: 0.75rem; font-weight: 800; }
        .suff-na  { color: var(--text-dim); }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.9rem; display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .inline-seed { background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); color: #a855f7; padding: 9px 18px; font-size: 0.78rem; font-weight: 800; cursor: pointer; }
        .inline-seed:disabled { opacity: 0.6; cursor: not-allowed; }

        /* BOM ingredient rows in requested items table */
        .has-bom-row td { border-bottom: none; padding-bottom: 4px; }
        .bom-badge { font-size: 0.55rem; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 800; }
        .bom-ingredient-row td { padding-top: 4px; padding-bottom: 4px; border-bottom: none; color: var(--text-dim); background: rgba(255, 255, 255, 0.02); }
        .bom-ingredient-row:last-child td { border-bottom: 1px solid rgba(255, 255, 255, 0.04); padding-bottom: 10px; }
        .bom-ing-name { font-size: 0.7rem; padding-left: 20px !important; }
        .ing-arrow { color: var(--primary); font-weight: bold; margin-right: 4px; }
        .bom-ing-qty { font-size: 0.75rem; font-weight: 700; color: var(--text-dim); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </MainLayout>
  );
};

export default FoodRequestPage;
