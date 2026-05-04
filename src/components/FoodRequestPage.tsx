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

  useEffect(() => { fetchRequests(); }, [entityId]);

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

          {requests.map(req => {
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
                      <strong>{req.centerName.toUpperCase()}</strong>
                      <span className="fr-meta">
                        {req.requestedItems.length} ITEMS · {new Date(req.createdAt).toLocaleDateString()}
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
                          {req.status !== 'PENDING' && <th>IN STOCK AT APPROVAL</th>}
                          {req.status !== 'PENDING' && <th>SUFFICIENT?</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {req.requestedItems.map((item: any, i: number) => (
                          <tr key={i}>
                            <td><span className="code-sm">{item.simpleCode}</span></td>
                            <td>{item.materialName.toUpperCase()}</td>
                            <td><strong>{item.requestedQty} {item.unit?.toUpperCase()}</strong></td>
                            {req.status !== 'PENDING' && (
                              <td className={item.isStockSufficient === false ? 'td-warn' : ''}>
                                {item.availableStock !== null ? `${item.availableStock} ${item.unit?.toUpperCase()}` : '—'}
                              </td>
                            )}
                            {req.status !== 'PENDING' && (
                              <td>
                                {item.isStockSufficient === true  && <span className="suff-yes">✓ YES</span>}
                                {item.isStockSufficient === false && <span className="suff-no">✗ NO</span>}
                                {item.isStockSufficient === null  && <span className="suff-na">—</span>}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
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

        /* Cards */
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
        .fr-meta { font-size: 0.68rem; color: var(--text-dim); font-weight: 600; }

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

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </MainLayout>
  );
};

export default FoodRequestPage;
