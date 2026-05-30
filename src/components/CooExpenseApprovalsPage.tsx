import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { expenseApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { 
  Check, X, 
  MapPin, ClipboardList, AlertCircle, FileText
} from 'lucide-react';

const CooExpenseApprovalsPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPendingExpenses = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await expenseApi.getAll({ status: 'PENDING_COO' });
      setExpenses(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch pending expenses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingExpenses();
  }, [entityId]);

  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this expense request? It will be forwarded to Finance.")) return;
    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');
      await expenseApi.cooApprove(id);
      setSuccess('Expense request approved successfully.');
      fetchPendingExpenses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve expense');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Reject this expense request?")) return;
    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');
      await expenseApi.cooReject(id);
      setSuccess('Expense request rejected.');
      fetchPendingExpenses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject expense');
    } finally {
      setIsProcessing(false);
    }
  };

  // Group pending expenses by location for the summary
  const locationSummary = expenses.reduce((acc: Record<string, number>, curr: any) => {
    const locName = curr.locationId?.name?.toUpperCase() || 'UNKNOWN LOCATION';
    acc[locName] = (acc[locName] || 0) + 1;
    return acc;
  }, {});

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>COO EXPENSE APPROVALS</h1>
          <p className="subtitle">Review and authorize location expense requests</p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      {isLoading ? (
        <ForgeLoader />
      ) : (
        <div className="coo-layout-split">
          {/* Left panel: Location summary */}
          <div className="summary-sidebar-panel">
            <div className="panel-header">
              <h2><ClipboardList size={16} /> PENDING SUMMARY</h2>
            </div>
            <div className="summary-body">
              <div className="total-pending-box">
                <span className="label">TOTAL PENDING</span>
                <span className="value">{expenses.length}</span>
              </div>
              
              <div className="location-breakdown">
                <h3>BY LOCATION</h3>
                {Object.keys(locationSummary).length === 0 ? (
                  <p className="empty-breakdown">No pending locations</p>
                ) : (
                  <ul className="breakdown-list">
                    {Object.entries(locationSummary).map(([loc, count]) => (
                      <li key={loc} className="breakdown-item">
                        <span className="loc-name"><MapPin size={12} /> {loc}</span>
                        <span className="loc-count">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Requests Table */}
          <div className="table-main-panel">
            <div className="panel-header">
              <h2><FileText size={16} /> PENDING REQUESTS</h2>
            </div>
            <div className="table-wrapper scroll-inside">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>SL</th>
                    <th>LOCATION</th>
                    <th>DATE</th>
                    <th>CATEGORY</th>
                    <th>DESCRIPTION</th>
                    <th>AMOUNT (₹)</th>
                    <th>METHOD</th>
                    <th style={{ textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        <Check size={24} className="text-success" />
                        <p>All expense requests reviewed and cleared!</p>
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp, idx) => (
                      <tr key={exp._id}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{exp.locationId?.name?.toUpperCase()}</strong>
                          <span className="subtext">{exp.locationId?.role}</span>
                        </td>
                        <td>{new Date(exp.date).toLocaleDateString()}</td>
                        <td><span className="category-tag">{exp.category}</span></td>
                        <td>{exp.description}</td>
                        <td className="font-numeric">₹ {exp.amount.toFixed(2)}</td>
                        <td>{exp.paymentMethod}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-buttons-cell">
                            <button 
                              className="btn-action-mini approve"
                              onClick={() => handleApprove(exp._id)}
                              disabled={isProcessing}
                            >
                              <Check size={12} /> APPROVE
                            </button>
                            <button 
                              className="btn-action-mini reject"
                              onClick={() => handleReject(exp._id)}
                              disabled={isProcessing}
                            >
                              <X size={12} /> REJECT
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; border-bottom: 1px solid var(--border-main); padding-bottom: 16px; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }

        .coo-layout-split { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }
        
        .summary-sidebar-panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); }
        .table-main-panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); min-width: 0; }
        
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); }
        .panel-header h2 { font-size: 0.75rem; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
        
        .summary-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        
        .total-pending-box { background: rgba(0,0,0,0.15); border: 1px solid var(--border-main); padding: 16px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
        .total-pending-box .label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .total-pending-box .value { font-size: 2rem; font-weight: 900; color: var(--primary); }
        
        .location-breakdown h3 { font-size: 0.65rem; font-weight: 900; color: var(--text-dim); margin-bottom: 10px; letter-spacing: 0.5px; }
        .empty-breakdown { font-size: 0.75rem; color: var(--text-dim); font-style: italic; }
        
        .breakdown-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .breakdown-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; padding: 8px 12px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-main); }
        .breakdown-item .loc-name { display: flex; align-items: center; gap: 6px; font-weight: 800; color: var(--text-main); }
        .breakdown-item .loc-count { background: var(--primary); color: white; padding: 2px 8px; font-size: 0.65rem; font-weight: 900; }
        
        .scroll-inside { overflow-y: auto; max-height: 600px; }
        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.8rem; color: var(--text-muted); }
        .sharp-table tr:hover { background: var(--row-hover); }
        .subtext { display: block; font-size: 0.62rem; color: var(--text-dim); margin-top: 2px; }
        .font-numeric { font-family: monospace; font-size: 0.85rem; font-weight: 700; color: var(--text-main); }
        
        .category-tag { font-size: 0.65rem; font-weight: 800; background: rgba(249,115,22,0.05); color: var(--primary); border: 1px solid rgba(249,115,22,0.2); padding: 2px 8px; }
        
        .action-buttons-cell { display: flex; gap: 8px; justify-content: center; }
        .btn-action-mini { border: none; padding: 6px 12px; font-size: 0.62rem; font-weight: 900; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .btn-action-mini.approve { background: #10b981; color: white; }
        .btn-action-mini.approve:hover { background: #059669; }
        .btn-action-mini.reject { background: #ef4444; color: white; }
        .btn-action-mini.reject:hover { background: #dc2626; }
        
        .alert { display: flex; align-items: center; gap: 10px; padding: 12px 20px; font-size: 0.82rem; font-weight: 700; margin-bottom: 20px; }
        .alert-error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; }
        .alert-success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; }
        
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.82rem; }
        .text-success { color: #10b981; }
      `}</style>
    </MainLayout>
  );
};

export default CooExpenseApprovalsPage;
