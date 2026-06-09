import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { expenseApi, revenueApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { 
  Check, AlertCircle, FileText, CheckCircle2, MapPin
} from 'lucide-react';

const CooExpenseApprovalsPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [pendingClosures, setPendingClosures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering state
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Expandable row state for Day Closures
  const [expandedClosureId, setExpandedClosureId] = useState<string | null>(null);
  const [closureExpenses, setClosureExpenses] = useState<Record<string, any[]>>({});
  const [editableAmounts, setEditableAmounts] = useState<Record<string, number>>({});

  // Day closure details inline editing state
  const [editingClosureId, setEditingClosureId] = useState<string | null>(null);
  const [editedClosureFields, setEditedClosureFields] = useState<Record<string, {
    prevDayCashInHand: number;
    cashFoodSales: number;
    advancePaymentsReceived: number;
    functionOrderFinalPayments: number;
    advanceCashTaken: number;
    cashDepositedToBank: number;
    cashInHand: number;
  }>>({});

  const [editedB2cSales, setEditedB2cSales] = useState<Record<string, any[]>>({});
  const [editedB2bSales, setEditedB2bSales] = useState<Record<string, any[]>>({});

  const fetchPendingData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const closureRes = await revenueApi.getPendingCooClosures();
      setPendingClosures(closureRes.data.data || []);
    } catch (err) {
      setError('Failed to fetch pending closures');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, [entityId]);

  const handleToggleExpand = async (closure: any) => {
    if (expandedClosureId === closure._id) {
      setExpandedClosureId(null);
      setEditingClosureId(null);
      return;
    }

    setExpandedClosureId(closure._id);
    
    // Initialize edited sales grids
    if (!editedB2cSales[closure._id]) {
      setEditedB2cSales(prev => ({ ...prev, [closure._id]: JSON.parse(JSON.stringify(closure.b2cSales || [])) }));
    }
    if (!editedB2bSales[closure._id]) {
      setEditedB2bSales(prev => ({ ...prev, [closure._id]: JSON.parse(JSON.stringify(closure.b2bSales || [])) }));
    }

    if (closureExpenses[closure._id]) return; // already loaded

    try {
      const dateStr = new Date(closure.date).toLocaleDateString('en-CA');
      const res = await expenseApi.getAll({
        locationId: closure.locationId._id,
        startDate: dateStr,
        endDate: dateStr
      });
      const allExps = res.data.data || [];
      const cashExps = allExps.filter((e: any) => e.paymentMethod === 'Cash' && e.status !== 'REJECTED');
      
      setClosureExpenses(prev => ({ ...prev, [closure._id]: cashExps }));
      
      const newAmounts = { ...editableAmounts };
      cashExps.forEach((exp: any) => {
        newAmounts[exp._id] = exp.approvedAmount !== undefined ? exp.approvedAmount : exp.amount;
      });
      setEditableAmounts(newAmounts);
    } catch (err) {
      console.error("Failed to load closure expenses:", err);
      setError("Failed to load closure expenses");
    }
  };

  const handleApprovedAmountChange = (expenseId: string, val: string) => {
    setEditableAmounts(prev => ({
      ...prev,
      [expenseId]: parseFloat(val) || 0
    }));
  };

  // Inline fields editing helpers
  const startEditingClosure = (closure: any) => {
    setEditingClosureId(closure._id);
    if (!editedClosureFields[closure._id]) {
      const cc = closure.cashClosure || {};
      setEditedClosureFields(prev => ({
        ...prev,
        [closure._id]: {
          prevDayCashInHand: cc.prevDayCashInHand || 0,
          cashFoodSales: cc.cashFoodSales || 0,
          advancePaymentsReceived: cc.advancePaymentsReceived || 0,
          functionOrderFinalPayments: cc.functionOrderFinalPayments || 0,
          advanceCashTaken: cc.advanceCashTaken || 0,
          cashDepositedToBank: cc.cashDepositedToBank || 0,
          cashInHand: cc.cashInHand || 0
        }
      }));
    }
  };

  const getFieldValue = (closureId: string, cc: any, field: string) => {
    if (editedClosureFields[closureId] && editedClosureFields[closureId][field as keyof typeof editedClosureFields[string]] !== undefined) {
      return editedClosureFields[closureId][field as keyof typeof editedClosureFields[string]];
    }
    return cc[field] || 0;
  };

  const handleFieldChange = (closureId: string, field: string, val: string) => {
    const num = parseFloat(val) || 0;
    setEditedClosureFields(prev => {
      const current = prev[closureId] || {
        prevDayCashInHand: 0,
        cashFoodSales: 0,
        advancePaymentsReceived: 0,
        functionOrderFinalPayments: 0,
        advanceCashTaken: 0,
        cashDepositedToBank: 0,
        cashInHand: 0
      };
      return {
        ...prev,
        [closureId]: {
          ...current,
          [field]: num
        }
      };
    });
  };

  const getB2cSalesList = (closure: any) => {
    return editedB2cSales[closure._id] || closure.b2cSales || [];
  };

  const getB2bSalesList = (closure: any) => {
    return editedB2bSales[closure._id] || closure.b2bSales || [];
  };

  const handleB2cSaleQtyChange = (closureId: string, idx: number, val: string) => {
    const list = [...(editedB2cSales[closureId] || [])];
    if (list[idx]) {
      list[idx] = { ...list[idx], soldQty: parseFloat(val) || 0 };
      setEditedB2cSales(prev => ({ ...prev, [closureId]: list }));
    }
  };

  const handleB2cSalePriceChange = (closureId: string, idx: number, val: string) => {
    const list = [...(editedB2cSales[closureId] || [])];
    if (list[idx]) {
      list[idx] = { ...list[idx], unitPrice: parseFloat(val) || 0 };
      setEditedB2cSales(prev => ({ ...prev, [closureId]: list }));
    }
  };

  const handleB2bSaleQtyChange = (closureId: string, idx: number, val: string) => {
    const list = [...(editedB2bSales[closureId] || [])];
    if (list[idx]) {
      list[idx] = { ...list[idx], quantity: parseFloat(val) || 0 };
      setEditedB2bSales(prev => ({ ...prev, [closureId]: list }));
    }
  };

  const handleB2bSalePriceChange = (closureId: string, idx: number, val: string) => {
    const list = [...(editedB2bSales[closureId] || [])];
    if (list[idx]) {
      list[idx] = { ...list[idx], unitPrice: parseFloat(val) || 0 };
      setEditedB2bSales(prev => ({ ...prev, [closureId]: list }));
    }
  };

  const handleApproveClosure = async (closure: any) => {
    const expsForClosure = closureExpenses[closure._id] || [];
    const approvedExpenses = expsForClosure.map((exp: any) => ({
      expenseId: exp._id,
      approvedAmount: editableAmounts[exp._id] !== undefined ? editableAmounts[exp._id] : exp.amount
    }));

    const closureUpdates = editedClosureFields[closure._id];
    const b2cSales = editedB2cSales[closure._id];
    const b2bSales = editedB2bSales[closure._id];

    if (!window.confirm(`Approve today's Day Closure for ${closure.locationId?.name}?`)) return;

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');
      
      await revenueApi.cooApproveCashClosure({
        locationId: closure.locationId._id,
        date: new Date(closure.date).toLocaleDateString('en-CA'),
        approvedExpenses,
        closureUpdates,
        b2cSales,
        b2bSales
      });

      setSuccess('Day Closure approved successfully.');
      setExpandedClosureId(null);
      setEditingClosureId(null);
      fetchPendingData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve day closure');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get unique locations from pending closures list for filter dropdown
  const uniqueLocations = Array.from(
    new Map(
      pendingClosures.map(c => [c.locationId?._id, c.locationId])
    ).values()
  ).filter(Boolean);

  // Apply filters
  const filteredClosures = pendingClosures.filter(c => {
    const matchLoc = selectedLocation === 'all' || c.locationId?._id === selectedLocation;
    const matchDate = !selectedDate || new Date(c.date).toLocaleDateString('en-CA') === selectedDate;
    return matchLoc && matchDate;
  });

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>DAY CLOSURE APPROVALS</h1>
          <p className="subtitle">Review, adjust sales grids, expenses, and authorize daily closures</p>
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
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Small location badges indicating count of pending closures */}
      <div className="location-badges-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button
          onClick={() => setSelectedLocation('all')}
          style={{
            background: selectedLocation === 'all' ? 'var(--primary)' : 'var(--bg-sidebar)',
            border: selectedLocation === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-main)',
            color: selectedLocation === 'all' ? 'white' : 'var(--text-dim)',
            padding: '8px 16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ALL ({pendingClosures.length})
        </button>
        {uniqueLocations.map((loc: any) => {
          const count = pendingClosures.filter(c => c.locationId?._id === loc._id).length;
          return (
            <button
              key={loc._id}
              onClick={() => setSelectedLocation(loc._id)}
              style={{
                background: selectedLocation === loc._id ? 'var(--primary)' : 'var(--bg-sidebar)',
                border: selectedLocation === loc._id ? '1px solid var(--primary)' : '1px solid var(--border-main)',
                color: selectedLocation === loc._id ? 'white' : 'var(--text-main)',
                padding: '8px 16px',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MapPin size={12} />
              {loc.name.toUpperCase()} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <ForgeLoader />
      ) : (
        <div className="table-main-panel" style={{ width: '100%' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <h2><FileText size={16} /> CLOSURE SUBMISSIONS AWAITING REVIEW ({filteredClosures.length})</h2>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Location filter dropdown */}
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-main)',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  outline: 'none',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <option value="all">ALL LOCATIONS</option>
                {uniqueLocations.map((loc: any) => (
                  <option key={loc._id} value={loc._id}>{loc.name.toUpperCase()}</option>
                ))}
              </select>

              {/* Date filter */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-main)',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  outline: 'none',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: 0
                  }}
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
          <div className="table-wrapper" style={{ overflow: 'visible' }}>
            <table className="sharp-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}></th>
                  <th>LOCATION</th>
                  <th>ROLE</th>
                  <th>DATE</th>
                  <th>EXPECTED TOTAL (₹)</th>
                  <th>DECLARED TOTAL (₹)</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosures.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      <Check size={24} className="text-success" />
                      <p>{pendingClosures.length === 0 ? 'All day closures reviewed and approved!' : 'No day closures match your filter criteria.'}</p>
                    </td>
                  </tr>
                ) : (
                  filteredClosures.map((closure) => {
                    const isExpanded = expandedClosureId === closure._id;
                    const cc = closure.cashClosure || {};
                    const isAgg = closure.locationId?.role === 'AGGREGATE';
                    
                    const prevDay = getFieldValue(closure._id, cc, 'prevDayCashInHand');
                    const sales = getFieldValue(closure._id, cc, 'cashFoodSales');
                    const advPay = getFieldValue(closure._id, cc, 'advancePaymentsReceived');
                    const foFinal = getFieldValue(closure._id, cc, 'functionOrderFinalPayments');
                    const advTaken = getFieldValue(closure._id, cc, 'advanceCashTaken');
                    const toBank = getFieldValue(closure._id, cc, 'cashDepositedToBank');
                    const actual = getFieldValue(closure._id, cc, 'cashInHand');
                    
                    const exps = closureExpenses[closure._id] || [];
                    const currentExpenses = exps.length > 0 
                      ? exps.reduce((sum, exp) => sum + (editableAmounts[exp._id] !== undefined ? editableAmounts[exp._id] : exp.amount), 0) 
                      : (cc.cashExpenses || 0);

                    const expected = prevDay + sales + advPay + foFinal - currentExpenses + advTaken - toBank;

                    // Compute B2C total
                    const b2cList = getB2cSalesList(closure);
                    const computedB2cTotal = b2cList.reduce((sum: number, item: any) => sum + (item.soldQty * item.unitPrice), 0);

                    // Compute B2B total
                    const b2bList = getB2bSalesList(closure);
                    const computedB2bTotal = b2bList.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

                    const totalOnline = closure.onlineSales?.totalSaleValue || 0;
                    
                    const expectedTotal = isAgg ? computedB2cTotal : (computedB2bTotal + computedB2cTotal + totalOnline);
                    const declaredTotal = isAgg ? computedB2cTotal : (computedB2bTotal + (closure.reportedCash || 0) + (closure.reportedOnline || 0) + totalOnline);

                    return (
                      <React.Fragment key={closure._id}>
                        <tr style={{ background: isExpanded ? 'rgba(255,255,255,0.02)' : 'none' }}>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => handleToggleExpand(closure)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 8px' }}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td>
                            <strong>{closure.locationId?.name?.toUpperCase()}</strong>
                          </td>
                          <td>
                            <span className="badge-type" style={{
                              background: isAgg ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                              color: isAgg ? '#a855f7' : '#3b82f6',
                              padding: '2px 8px',
                              fontSize: '0.65rem',
                              fontWeight: 800
                            }}>{closure.locationId?.role}</span>
                          </td>
                          <td>{new Date(closure.date).toLocaleDateString()}</td>
                          <td className="font-numeric">₹ {expectedTotal.toFixed(2)}</td>
                          <td className="font-numeric">₹ {declaredTotal.toFixed(2)}</td>
                          <td>
                            {closure.financeReconciled ? (
                              <span className="badge-status-closed" style={{
                                background: 'rgba(16,185,129,0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.2)',
                                padding: '4px 10px',
                                fontSize: '0.65rem',
                                fontWeight: 800
                              }}>CLOSED</span>
                            ) : closure.cooApproved ? (
                              <span className="badge-status-finance" style={{
                                background: 'rgba(59,130,246,0.1)',
                                color: '#3b82f6',
                                border: '1px solid rgba(59,130,246,0.2)',
                                padding: '4px 10px',
                                fontSize: '0.65rem',
                                fontWeight: 800
                              }}>PENDING FINANCE</span>
                            ) : (
                              <span className="badge-status-coo" style={{
                                background: 'rgba(249,115,22,0.1)',
                                color: '#f97316',
                                border: '1px solid rgba(249,115,22,0.2)',
                                padding: '4px 10px',
                                fontSize: '0.65rem',
                                fontWeight: 800
                              }}>PENDING COO</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className={`btn-action-mini ${isExpanded ? 'reject' : 'approve'}`}
                              onClick={() => handleToggleExpand(closure)}
                              style={{ 
                                background: isExpanded ? 'rgba(239,68,68,0.1)' : 'rgba(168,85,247,0.1)', 
                                color: isExpanded ? '#ef4444' : '#a855f7', 
                                border: isExpanded ? '1px solid #ef4444' : '1px solid #a855f7' 
                              }}
                            >
                              {isExpanded ? 'CLOSE DETAILS' : 'VIEW DETAILS'}
                            </button>
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ padding: '0 20px 20px 20px', background: 'rgba(255,255,255,0.01)' }}>
                              <div style={{ border: '1px solid var(--border-main)', padding: '24px', background: 'var(--bg-main)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                
                                {/* 1. B2C Sales grid (Editable) */}
                                {['CENTERS', 'AGGREGATE', 'RESTAURANT'].includes(closure.locationId?.role) && (
                                  <div>
                                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                      B2C Counter Sales (Editable)
                                    </h3>
                                    <table className="sharp-table" style={{ margin: 0, background: 'none' }}>
                                      <thead>
                                        <tr>
                                          <th>ITEM NAME</th>
                                          <th>TYPE</th>
                                          <th>UNIT</th>
                                          <th>MAX STOCK</th>
                                          <th>QTY SOLD</th>
                                          <th>SELLING PRICE (₹)</th>
                                          <th style={{ textAlign: 'right' }}>TOTAL VALUE (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {b2cList.map((item: any, idx: number) => (
                                          <tr key={idx} style={{ background: 'none' }}>
                                            <td><strong>{item.itemName?.toUpperCase()}</strong></td>
                                            <td>{item.itemType}</td>
                                            <td>{item.unit || 'pcs'}</td>
                                            <td>{item.stockQty}</td>
                                            <td>
                                              <input
                                                type="number"
                                                className="table-input"
                                                style={{ width: '80px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '4px' }}
                                                value={item.soldQty}
                                                onChange={(e) => handleB2cSaleQtyChange(closure._id, idx, e.target.value)}
                                                disabled={isProcessing || closure.cooApproved}
                                                min="0"
                                              />
                                            </td>
                                            <td>
                                              <input
                                                type="number"
                                                className="table-input"
                                                style={{ width: '80px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '4px' }}
                                                value={item.unitPrice}
                                                onChange={(e) => handleB2cSalePriceChange(closure._id, idx, e.target.value)}
                                                disabled={isProcessing || closure.cooApproved}
                                                min="0"
                                                step="0.01"
                                              />
                                            </td>
                                            <td className="font-numeric" style={{ textAlign: 'right' }}>₹ {(item.soldQty * item.unitPrice).toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* 2. B2B Dispatches grid (Editable) */}
                                {['KITCHEN', 'RESTAURANT'].includes(closure.locationId?.role) && (
                                  <div>
                                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                      B2B Dispatches (Editable)
                                    </h3>
                                    <table className="sharp-table" style={{ margin: 0, background: 'none' }}>
                                      <thead>
                                        <tr>
                                          <th>ITEM NAME</th>
                                          <th>TYPE</th>
                                          <th>DISPATCHED QTY</th>
                                          <th>UNIT TRANSFER RATE (₹)</th>
                                          <th style={{ textAlign: 'right' }}>TOTAL VALUE (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {b2bList.map((item: any, idx: number) => (
                                          <tr key={idx} style={{ background: 'none' }}>
                                            <td><strong>{item.itemName?.toUpperCase()}</strong></td>
                                            <td>{item.itemType}</td>
                                            <td>
                                              <input
                                                type="number"
                                                className="table-input"
                                                style={{ width: '80px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '4px' }}
                                                value={item.quantity}
                                                onChange={(e) => handleB2bSaleQtyChange(closure._id, idx, e.target.value)}
                                                disabled={isProcessing || closure.cooApproved}
                                                min="0"
                                              />
                                            </td>
                                            <td>
                                              <input
                                                type="number"
                                                className="table-input"
                                                style={{ width: '80px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '4px' }}
                                                value={item.unitPrice}
                                                onChange={(e) => handleB2bSalePriceChange(closure._id, idx, e.target.value)}
                                                disabled={isProcessing || closure.cooApproved}
                                                min="0"
                                                step="0.01"
                                              />
                                            </td>
                                            <td className="font-numeric" style={{ textAlign: 'right' }}>₹ {(item.quantity * item.unitPrice).toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* 3. Aggregator details block */}
                                {isAgg && (
                                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-main)', padding: '20px', borderRadius: '4px' }}>
                                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                      Aggregator Expected Receivable Summary
                                    </h3>
                                    {(() => {
                                      const commPct = closure.locationId?.aggregatorPercentage || 0;
                                      const gst = (computedB2cTotal / 1.05) * 0.05;
                                      const comm = (commPct / 100) * computedB2cTotal;
                                      const approvedExpsTotal = currentExpenses;
                                      const netRec = computedB2cTotal - gst - comm - approvedExpsTotal;
                                      
                                      return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 800 }}>EXPECTED GROSS REVENUE</span>
                                            <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>₹ {computedB2cTotal.toFixed(2)}</strong>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 800 }}>GST DEDUCTION (5%)</span>
                                            <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>- ₹ {gst.toFixed(2)}</strong>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 800 }}>COMMISSION ({commPct}%)</span>
                                            <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>- ₹ {comm.toFixed(2)}</strong>
                                          </div>
                                          <div>
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 800 }}>DAILY EXPENSES</span>
                                            <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>- ₹ {approvedExpsTotal.toFixed(2)}</strong>
                                          </div>
                                          <div style={{ borderLeft: '1px solid var(--border-main)', paddingLeft: '16px' }}>
                                            <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--primary)', fontWeight: 800 }}>NET EXPECTED RECEIVABLE</span>
                                            <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>₹ {netRec.toFixed(2)}</strong>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* 4. Standard Cash Closure flow */}
                                {!isAgg && closure.cashClosure && (
                                  <div>
                                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                      Cash Closure Details
                                    </h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>PREV DAY CASH IN HAND</div>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={prevDay || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'prevDayCashInHand', e.target.value)}
                                            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900, marginTop: '4px', boxSizing: 'border-box' }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>₹ {prevDay.toFixed(2)}</div>
                                        )}
                                      </div>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>CASH FOOD SALES</div>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={sales || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'cashFoodSales', e.target.value)}
                                            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900, marginTop: '4px', boxSizing: 'border-box' }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>₹ {sales.toFixed(2)}</div>
                                        )}
                                      </div>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>CASH ADVANCE PAYMENTS</div>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={advPay || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'advancePaymentsReceived', e.target.value)}
                                            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900, marginTop: '4px', boxSizing: 'border-box' }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>₹ {advPay.toFixed(2)}</div>
                                        )}
                                      </div>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>EVENT CASH PAYMENTS</div>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={foFinal || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'functionOrderFinalPayments', e.target.value)}
                                            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900, marginTop: '4px', boxSizing: 'border-box' }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>₹ {foFinal.toFixed(2)}</div>
                                        )}
                                      </div>
                                      
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>ADVANCE CASH TAKEN</div>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={advTaken || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'advanceCashTaken', e.target.value)}
                                            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900, marginTop: '4px', boxSizing: 'border-box' }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>₹ {advTaken.toFixed(2)}</div>
                                        )}
                                      </div>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>CASH TO BANK</div>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={toBank || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'cashDepositedToBank', e.target.value)}
                                            style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900, marginTop: '4px', boxSizing: 'border-box' }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>₹ {toBank.toFixed(2)}</div>
                                        )}
                                      </div>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>CASH EXPENSES</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
                                          ₹ {currentExpenses.toFixed(2)}
                                        </div>
                                      </div>
                                      
                                      <div style={{ background: 'rgba(249,115,22,0.05)', padding: '12px', border: '1px solid var(--primary)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--primary)', fontWeight: 800 }}>EXPECTED CASH IN HAND</div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                                          ₹ {expected.toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                      <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800 }}>ACTUAL CASH IN HAND DECLARED:</span>
                                        {editingClosureId === closure._id ? (
                                          <input
                                            type="number"
                                            value={actual || ''}
                                            onChange={(e) => handleFieldChange(closure._id, 'cashInHand', e.target.value)}
                                            style={{ width: '150px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.9rem', fontWeight: 900 }}
                                            disabled={isProcessing || closure.cooApproved}
                                          />
                                        ) : (
                                          <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>₹ {actual.toFixed(2)}</strong>
                                        )}
                                      </div>
                                      <div style={{ 
                                        background: 'var(--bg-sidebar)', 
                                        padding: '12px', 
                                        border: '1px solid var(--border-main)', 
                                        borderRadius: '4px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                      }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800 }}>DIFFERENCE:</span>
                                        <strong style={{ fontSize: '1.1rem', color: ((actual - toBank) - expected) === 0 ? '#10b981' : '#ef4444' }}>
                                          ₹ {((actual - toBank) - expected).toFixed(2)}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* 5. Expenses list (Editable for standard and aggregator) */}
                                <div>
                                  <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                    Individual Expenses (Edit Approved Amounts)
                                  </h3>
                                  
                                  {(!closureExpenses[closure._id] || closureExpenses[closure._id].length === 0) ? (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', margin: 0 }}>
                                      No cash expenses recorded for this day.
                                    </p>
                                  ) : (
                                    <table className="sharp-table" style={{ margin: 0, border: 'none' }}>
                                      <thead>
                                        <tr>
                                          <th>CATEGORY</th>
                                          <th>DESCRIPTION</th>
                                          <th>ORIGINAL AMOUNT (₹)</th>
                                          <th>APPROVED AMOUNT (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {closureExpenses[closure._id].map((exp: any) => (
                                          <tr key={exp._id} style={{ background: 'none' }}>
                                            <td><span className="category-tag">{exp.category}</span></td>
                                            <td>{exp.description}</td>
                                            <td className="font-numeric">₹ {exp.amount.toFixed(2)}</td>
                                            <td>
                                              <div className="price-input-container" style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '8px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>₹</span>
                                                <input
                                                  type="number"
                                                  className="table-input"
                                                  style={{ width: '100px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px 8px 6px 20px', outline: 'none' }}
                                                  value={editableAmounts[exp._id] !== undefined ? editableAmounts[exp._id] : exp.amount}
                                                  onChange={(e) => handleApprovedAmountChange(exp._id, e.target.value)}
                                                  min="0"
                                                  step="0.01"
                                                  disabled={isProcessing || closure.cooApproved}
                                                />
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                                {/* Actions Row */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
                                  {closure.cooApproved ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
                                      <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 900 }}>
                                        APPROVED BY COO {closure.financeReconciled && '(CLOSED & RECONCILED)'}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      {!isAgg && (
                                        editingClosureId === closure._id ? (
                                          <button 
                                            className="btn-action-mini" 
                                            onClick={() => setEditingClosureId(null)}
                                            style={{ background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-dim)', padding: '8px 16px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                          >
                                            CANCEL EDIT
                                          </button>
                                        ) : (
                                          <button 
                                            className="btn-action-mini" 
                                            onClick={() => startEditingClosure(closure)}
                                            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '8px 16px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                          >
                                            EDIT DETAILS
                                          </button>
                                        )
                                      )}
                                      <button 
                                        className="btn-action-mini approve"
                                        onClick={() => handleApproveClosure(closure)}
                                        disabled={isProcessing}
                                        style={{ background: '#a855f7', color: 'white', padding: '8px 24px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                      >
                                        {isProcessing ? 'PROCESSING...' : 'APPROVE DAY CLOSURE'}
                                      </button>
                                    </>
                                  )}
                                </div>
                                
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; border-bottom: 1px solid var(--border-main); padding-bottom: 16px; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }

        .table-main-panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); min-width: 0; }
        
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); }
        .panel-header h2 { font-size: 0.75rem; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
        
        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.8rem; color: var(--text-muted); }
        .sharp-table tr:hover { background: var(--row-hover); }
        .subtext { display: block; font-size: 0.62rem; color: var(--text-dim); margin-top: 2px; }
        .font-numeric { font-family: monospace; font-size: 0.85rem; font-weight: 700; color: var(--text-main); }
        
        .category-tag { font-size: 0.65rem; font-weight: 800; background: rgba(249,115,22,0.05); color: var(--primary); border: 1px solid rgba(249,115,22,0.2); padding: 2px 8px; }
        
        .btn-action-mini { border: none; padding: 6px 12px; font-size: 0.62rem; font-weight: 900; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .btn-action-mini.approve { background: #10b981; color: white; }
        .btn-action-mini.approve:hover { background: #059669; }
        
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
