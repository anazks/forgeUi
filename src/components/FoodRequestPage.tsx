import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { foodRequestApi, userApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import {
  Plus, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, ChevronDown, ChevronUp, Loader2,
  Package, Edit3, PackageCheck, Save
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'status-pending',
  APPROVED: 'status-approved',
  REJECTED: 'status-rejected',
  PARTIAL: 'status-partial',
  RECEIVED: 'status-received',
};

const FoodRequestPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();

  // Mock data for immediate visibility
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
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // COO Food Request approval state
  const [cooSelectedItems, setCooSelectedItems] = useState<Record<string, boolean>>({});
  const [cooEditQtys, setCooEditQtys] = useState<Record<string, number>>({});  // key: requestId_itemId
  const [cooSavingKey, setCooSavingKey] = useState<string | null>(null);
  const [cooApproving, setCooApproving] = useState(false);
  const [cooLocFilter, setCooLocFilter] = useState<string>('ALL');
  const [cooActiveTab, setCooActiveTab] = useState<'OPEN' | 'APPROVED'>('OPEN');
  const [cooExpandedGroups, setCooExpandedGroups] = useState<Record<string, boolean>>({});

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  // Roles that submit requests (see their own cards view)
  const isCenter = user?.role === 'CENTERS' || user?.role === 'RESTAURANT' || user?.role === 'AGGREGATE';
  const isCOO = user?.role === 'COO';
  // COO has the same consolidated view as Store Manager
  const isStore = user?.role === 'STORE' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'COO';

  useEffect(() => {
    fetchRequests();
  }, [entityId]);

  const showToast = (message: string, type: 'success' | 'warn' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const [reqRes, locRes] = await Promise.all([
        foodRequestApi.getAll(entityId),
        userApi.getLocations(entityId)
      ]);
      setRequests(reqRes.data.data || []);
      setLocations(locRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };



  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await foodRequestApi.approve(id);
      const { stockStatus, message } = res.data;
      showToast(message, stockStatus === 'ALL_AVAILABLE' ? 'success' : 'warn');
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

  const handleReceive = async (id: string) => {
    try {
      setProcessingId(id);
      const req = requests.find(r => r._id === id);
      const items = req.requestedItems.map((item: any, idx: number) => ({
        ...item,
        receivedQty: Number(receivedQtys[`${id}-${idx}`] ?? item.requestedQty)
      }));

      await foodRequestApi.receive(id, items);
      showToast('Inventory updated and pricing adjusted!', 'success');
      setReceivingId(null);
      setExpandedId(null);
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update receipt', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const approved = requests.filter(r => r.status === 'APPROVED');
  const partial = requests.filter(r => r.status === 'PARTIAL');
  const rejected = requests.filter(r => r.status === 'REJECTED');

  const openByLocation = requests
    .filter(r => r.status === 'PENDING')
    .reduce((acc: Record<string, number>, r) => {
      if (r.centerName) {
        acc[r.centerName] = (acc[r.centerName] || 0) + 1;
      }
      return acc;
    }, {});

  const getCooRows = (): any[] => {
    const rows: any[] = [];
    requests
      .filter(r => ['PENDING', 'PARTIAL'].includes(r.status))
      .filter(r => cooLocFilter === 'ALL' || r.centerName === cooLocFilter)
      .forEach(req => {
        req.requestedItems.forEach((item: any) => {
          const status = item.approvalStatus || 'PENDING';
          if (status === 'APPROVED' || status === 'REJECTED') {
            return;
          }
          rows.push({
            requestId: req._id,
            itemId: item._id,
            centerName: req.centerName,
            materialName: item.materialName,
            isMenuItem: item.isMenuItem,
            requestedQty: item.requestedQty,
            unit: item.unit,
            approvalStatus: status,
          });
        });
      });
    return rows;
  };

  const getCooApprovedGroupedRows = (): any[] => {
    const groups: Record<string, { dateStr: string; centerName: string; key: string; items: any[] }> = {};

    requests.forEach(req => {
      if (cooLocFilter !== 'ALL' && req.centerName !== cooLocFilter) {
        return;
      }

      req.requestedItems.forEach((item: any) => {
        const status = item.approvalStatus || 'PENDING';
        if (status !== 'APPROVED' && status !== 'REJECTED') {
          return;
        }

        const rawDate = req.deliveryDate || req.createdAt;
        const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : 'N/A';
        const centerName = req.centerName;
        const groupKey = `${dateStr}_${centerName}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            dateStr,
            centerName,
            key: groupKey,
            items: []
          };
        }

        groups[groupKey].items.push({
          requestId: req._id,
          itemId: item._id,
          materialName: item.materialName,
          isMenuItem: item.isMenuItem,
          requestedQty: item.requestedQty,
          unit: item.unit,
          approvalStatus: status,
          receivedQty: item.receivedQty || 0,
          simpleCode: item.simpleCode || 'N/A'
        });
      });
    });

    return Object.values(groups);
  };

  const toggleGroupExpand = (key: string) => {
    setCooExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Groups selected COO items by requestId and fires one API call per request.
  const handleCooAction = async (action: 'APPROVED' | 'REJECTED') => {
    const selected = Object.entries(cooSelectedItems).filter(([, v]) => v);
    if (selected.length === 0) return;

    // Group itemIds by requestId
    const byRequest: Record<string, string[]> = {};
    selected.forEach(([key]) => {
      const [requestId, itemId] = key.split('_');
      if (!byRequest[requestId]) byRequest[requestId] = [];
      byRequest[requestId].push(itemId);
    });

    setCooApproving(true);
    try {
      await Promise.all(
        Object.entries(byRequest).map(([requestId, itemIds]) =>
          foodRequestApi.approveItems(requestId, itemIds, action)
        )
      );
      showToast(`${selected.length} item(s) ${action.toLowerCase()}`, action === 'APPROVED' ? 'success' : 'warn');
      setCooSelectedItems({});
      fetchRequests();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    } finally {
      setCooApproving(false);
    }
  };

  const renderStatusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle size={13} />;
    if (status === 'REJECTED') return <XCircle size={13} />;
    if (status === 'PARTIAL') return <AlertTriangle size={13} />;
    if (status === 'RECEIVED') return <PackageCheck size={13} />;
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
          <h1>{isStore ? 'STOCK REQUESTS' : 'FOOD REQUESTS'}</h1>
          <p className="subtitle">{isStore ? 'GAP ANALYSIS & PR GENERATION' : 'REQUESTS FROM CENTERS â€” STOCK VERIFICATION & APPROVAL'}</p>
        </div>
        <div className="header-actions">

          <button className="btn-refresh" onClick={fetchRequests}>
            <RefreshCw size={14} /> REFRESH
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Stock Requests always shows Consolidated Demand â€” CENTER REQUESTS tab removed */}

      {/* Summary strip */}
      <div className="fr-summary">
        <div className="fr-stat pending" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} />
            <label style={{ margin: 0 }}>PENDING</label>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
            {Object.keys(openByLocation).length === 0 ? (
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-dim)' }}>0</span>
            ) : (
              Object.entries(openByLocation).map(([locName, count]) => (
                <span key={locName} style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 900, 
                  background: 'rgba(245, 158, 11, 0.1)', 
                  border: '1px solid rgba(245, 158, 11, 0.25)', 
                  color: '#f59e0b', 
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  {locName}: {count}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="fr-divider" />
        <div className="fr-stat approved"><CheckCircle size={14} /><span>{approved.length}</span><label>APPROVED</label></div>
        <div className="fr-divider" />
        <div className="fr-stat partial"><AlertTriangle size={14} /><span>{partial.length}</span><label>PARTIAL</label></div>
        <div className="fr-divider" />
        <div className="fr-stat rejected"><XCircle size={14} /><span>{rejected.length}</span><label>REJECTED</label></div>
        <div className="fr-divider" />
        <div className="fr-stat received"><PackageCheck size={14} /><span>{requests.filter(r => r.status === 'RECEIVED').length}</span><label>RECEIVED</label></div>
      </div>

      {isLoading ? <ForgeLoader /> : (
        <div className="fr-content">
          {!isCenter ? (
            <div className="consolidated-panel">

              {/* ====== COO SECTION A: Food Request Approval Table ====== */}
              {isCOO && (
                <div className="coo-approval-panel">
                  {/* Tabs header */}
                  <div className="coo-tabs" style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border-main)' }}>
                    <button 
                      onClick={() => setCooActiveTab('OPEN')}
                      style={{
                        background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer',
                        color: cooActiveTab === 'OPEN' ? 'var(--primary)' : 'var(--text-dim)',
                        borderBottom: cooActiveTab === 'OPEN' ? '2px solid var(--primary)' : 'none',
                        fontWeight: 800, fontSize: '0.85rem', outline: 'none'
                      }}
                    >
                      OPEN REQUESTS
                    </button>
                    <button 
                      onClick={() => setCooActiveTab('APPROVED')}
                      style={{
                        background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer',
                        color: cooActiveTab === 'APPROVED' ? 'var(--primary)' : 'var(--text-dim)',
                        borderBottom: cooActiveTab === 'APPROVED' ? '2px solid var(--primary)' : 'none',
                        fontWeight: 800, fontSize: '0.85rem', outline: 'none'
                      }}
                    >
                      APPROVED REQUESTS
                    </button>
                  </div>

                  <div className="coo-approval-header">
                    <div>
                      <div className="info-badge"><Edit3 size={14} /><span>{cooActiveTab === 'OPEN' ? 'FOOD REQUEST APPROVAL' : 'APPROVED & REJECTED REQUESTS'}</span></div>
                      <p className="info-desc">
                        {cooActiveTab === 'OPEN' 
                          ? 'Review, edit quantities, and approve or reject center requests.' 
                          : 'View consolidated approved/rejected requests. Edit quantities of approved items if needed.'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div className="header-date-picker">
                        <label>CENTER LOCATION:</label>
                        <select
                          value={cooLocFilter}
                          onChange={e => setCooLocFilter(e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, outline: 'none' }}
                        >
                          <option value="ALL">ALL CENTERS</option>
                          {(() => {
                            const reqNames = requests.map((r: any) => r.centerName).filter(Boolean);
                            const locNames = locations
                              .filter((l: any) => ['KITCHEN', 'CENTERS', 'STORE', 'RESORT', 'AGGREGATE', 'RESTAURANT'].includes(l.role))
                              .map((l: any) => l.name)
                              .filter(Boolean);
                            const allNames = Array.from(new Set([...reqNames, ...locNames])).sort();
                            return allNames.map((name: string) => (
                              <option key={name} value={name}>{name.toUpperCase()}</option>
                            ));
                          })()}
                        </select>
                      </div>
                      {cooActiveTab === 'OPEN' && (
                        <>
                          <button
                            className="btn-approve"
                            disabled={cooApproving || Object.keys(cooSelectedItems).filter(k => cooSelectedItems[k]).length === 0}
                            onClick={async () => {
                              await handleCooAction('APPROVED');
                            }}
                          >
                            <CheckCircle size={13} /> APPROVE SELECTED
                          </button>
                          <button
                            className="btn-reject"
                            disabled={cooApproving || Object.keys(cooSelectedItems).filter(k => cooSelectedItems[k]).length === 0}
                            onClick={async () => {
                              await handleCooAction('REJECTED');
                            }}
                          >
                            <XCircle size={13} /> REJECT SELECTED
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {cooActiveTab === 'OPEN' ? (
                    <div className="table-wrapper" style={{ marginTop: '16px' }}>
                      <table className="sharp-table">
                        <thead>
                          <tr>
                            <th>SL</th>
                            <th>CENTER</th>
                            <th>ITEM NAME</th>
                            <th>TYPE</th>
                            <th>REQUESTED QTY</th>
                            <th>EDIT QTY</th>
                            <th>STATUS</th>
                            <th style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                onChange={e => {
                                  const all: Record<string, boolean> = {};
                                  getCooRows().forEach((row: any) => {
                                    all[`${row.requestId}_${row.itemId}`] = e.target.checked;
                                  });
                                  setCooSelectedItems(all);
                                }}
                                style={{ transform: 'scale(1.2)' }}
                              />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {getCooRows().length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-12 text-dim">No pending requests to review.</td></tr>
                          ) : (
                            getCooRows().map((row: any, idx: number) => {
                              const rowKey = `${row.requestId}_${row.itemId}`;
                              const editQty = cooEditQtys[rowKey] !== undefined ? cooEditQtys[rowKey] : row.requestedQty;
                              return (
                                <tr key={rowKey} className={row.approvalStatus === 'REJECTED' ? 'row-rejected' : row.approvalStatus === 'APPROVED' ? 'row-approved' : ''}>
                                  <td>{idx + 1}</td>
                                  <td><strong>{row.centerName}</strong></td>
                                  <td>{row.materialName}</td>
                                  <td><span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{row.isMenuItem ? 'DISH' : 'RAW'}</span></td>
                                  <td>{row.requestedQty} {row.unit}</td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <input
                                        type="number"
                                        value={editQty}
                                        min={0}
                                        onChange={e => setCooEditQtys({ ...cooEditQtys, [rowKey]: Number(e.target.value) })}
                                        style={{ width: '70px', padding: '5px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                                      />
                                      <button
                                        className="btn-refresh"
                                        disabled={cooSavingKey === rowKey || editQty === row.requestedQty}
                                        onClick={async () => {
                                          setCooSavingKey(rowKey);
                                          try {
                                            await foodRequestApi.updateItemQty(row.requestId, row.itemId, editQty);
                                            showToast('Quantity updated', 'success');
                                            fetchRequests();
                                          } catch (err: any) {
                                            showToast(err.response?.data?.error || 'Update failed', 'error');
                                          } finally {
                                            setCooSavingKey(null);
                                          }
                                        }}
                                      >
                                        {cooSavingKey === rowKey ? <RefreshCw size={12} className="spinning" /> : <Save size={12} />}
                                      </button>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`status-pill status-${row.approvalStatus.toLowerCase()}`}>
                                      {row.approvalStatus}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {row.approvalStatus === 'PENDING' && (
                                      <input
                                        type="checkbox"
                                        checked={!!cooSelectedItems[rowKey]}
                                        onChange={e => setCooSelectedItems({ ...cooSelectedItems, [rowKey]: e.target.checked })}
                                        style={{ transform: 'scale(1.2)' }}
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="table-wrapper" style={{ marginTop: '16px' }}>
                      <table className="sharp-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>SL</th>
                            <th>DATE</th>
                            <th>CENTER NAME</th>
                            <th style={{ textAlign: 'center' }}>TOTAL ITEMS</th>
                            <th>STATUS</th>
                            <th style={{ textAlign: 'center', width: '120px' }}>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getCooApprovedGroupedRows().length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12 text-dim">No processed requests found.</td></tr>
                          ) : (
                            getCooApprovedGroupedRows().map((group: any, idx: number) => {
                              const isExpanded = !!cooExpandedGroups[group.key];
                              const hasApproved = group.items.some((i: any) => i.approvalStatus === 'APPROVED');
                              const hasRejected = group.items.some((i: any) => i.approvalStatus === 'REJECTED');
                              let groupStatus = 'PROCESSED';
                              if (hasApproved && hasRejected) groupStatus = 'PARTIAL';
                              else if (hasApproved) groupStatus = 'APPROVED';
                              else if (hasRejected) groupStatus = 'REJECTED';

                              return (
                                <React.Fragment key={group.key}>
                                  <tr>
                                    <td>{idx + 1}</td>
                                    <td><strong>{group.dateStr}</strong></td>
                                    <td><strong>{group.centerName}</strong></td>
                                    <td style={{ textAlign: 'center' }}>{group.items.length}</td>
                                    <td>
                                      <span className={`status-pill status-${groupStatus.toLowerCase()}`}>
                                        {groupStatus}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <button 
                                        className="btn-refresh" 
                                        onClick={() => toggleGroupExpand(group.key)}
                                        style={{ display: 'inline-flex', gap: '4px', padding: '4px 8px', fontSize: '0.7rem' }}
                                      >
                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        {isExpanded ? 'HIDE DETAILS' : 'VIEW DETAILS'}
                                      </button>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={6} style={{ padding: '16px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid var(--border-main)' }}>
                                        <table className="sharp-table" style={{ width: '100%', margin: 0, background: 'var(--bg-main)' }}>
                                          <thead>
                                            <tr>
                                              <th>ITEM NAME</th>
                                              <th>CODE</th>
                                              <th>QTY</th>
                                              <th>EDIT QTY</th>
                                              <th>STATUS</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {group.items.map((item: any) => {
                                              const rowKey = `${item.requestId}_${item.itemId}`;
                                              const editQty = cooEditQtys[rowKey] !== undefined ? cooEditQtys[rowKey] : item.requestedQty;
                                              return (
                                                <tr key={rowKey}>
                                                  <td>{item.materialName}</td>
                                                  <td><code>{item.simpleCode}</code></td>
                                                  <td><strong>{item.requestedQty} {item.unit}</strong></td>
                                                  <td>
                                                    {item.approvalStatus === 'APPROVED' ? (
                                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <input
                                                          type="number"
                                                          value={editQty}
                                                          min={0}
                                                          onChange={e => setCooEditQtys({ ...cooEditQtys, [rowKey]: Number(e.target.value) })}
                                                          style={{ width: '70px', padding: '5px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                                                        />
                                                        <button
                                                          className="btn-refresh"
                                                          disabled={cooSavingKey === rowKey || editQty === item.requestedQty}
                                                          onClick={async () => {
                                                            setCooSavingKey(rowKey);
                                                            try {
                                                              await foodRequestApi.updateItemQty(item.requestId, item.itemId, editQty);
                                                              showToast('Quantity updated', 'success');
                                                              fetchRequests();
                                                            } catch (err: any) {
                                                              showToast(err.response?.data?.error || 'Update failed', 'error');
                                                            } finally {
                                                              setCooSavingKey(null);
                                                            }
                                                          }}
                                                        >
                                                          {cooSavingKey === rowKey ? <RefreshCw size={12} className="spinning" /> : <Save size={12} />}
                                                        </button>
                                                      </div>
                                                    ) : (
                                                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>N/A (REJECTED)</span>
                                                    )}
                                                  </td>
                                                  <td>
                                                    <span className={`status-pill status-${item.approvalStatus.toLowerCase()}`}>
                                                      {item.approvalStatus}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
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
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ==================== CENTER VIEW: My Submitted Requests ==================== */
            <div className="fr-list">
              {requests.length === 0 ? (
                <div className="empty-state">
                  <Package size={40} style={{ opacity: 0.3 }} />
                  <span>No requests submitted yet.</span>
                </div>
              ) : (
                requests.map((req: any) => {
                  const isExpanded = expandedId === req._id;
                  const isProcessing = processingId === req._id;

                  return (
                    <div key={req._id} className={`fr-card ${req.status.toLowerCase()}`}>
                      {/* Card Header */}
                      <div className="fr-card-header" onClick={() => setExpandedId(isExpanded ? null : req._id)}>
                        <div className="fr-card-left">
                          <div className={`fr-status-tag ${STATUS_COLORS[req.status]}`}>
                            {req.status === 'PENDING' && <Clock size={11} />}
                            {req.status === 'APPROVED' && <CheckCircle size={11} />}
                            {req.status === 'PARTIAL' && <AlertTriangle size={11} />}
                            {req.status === 'REJECTED' && <XCircle size={11} />}
                            {req.status === 'RECEIVED' && <PackageCheck size={11} />}
                            {req.status}
                          </div>
                          <div className="fr-center-info">
                            <span className="fr-meta">
                              <strong className="item-count-badge">{req.requestedItems.length} ITEMS</strong> ·
                              {new Date(req.createdAt).toLocaleDateString()} ·&nbsp;
                              <strong style={{ color: 'var(--primary)' }}>
                                DELIVERY: {req.deliveryDate ? new Date(req.deliveryDate).toLocaleDateString() : 'TBD'}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="fr-card-right">
                          <button className="expand-btn">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Rejection Reason */}
                      {req.status === 'REJECTED' && req.rejectionReason && (
                        <div style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.05)', borderTop: '1px solid var(--border-main)', fontSize: '0.75rem', color: '#ef4444' }}>
                          <strong>Reason:</strong> {req.rejectionReason}
                        </div>
                      )}

                      {/* Expanded Items Panel */}
                      {isExpanded && (
                        <div className="fr-items-panel">
                          {req.notes && <p className="fr-notes">📝 {req.notes}</p>}
                          <table className="fr-items-table">
                            <thead>
                              <tr>
                                <th>ITEM</th>
                                <th>CODE</th>
                                <th>REQUESTED</th>
                                <th>UNIT</th>
                                <th>RECEIVED</th>
                                <th>STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.requestedItems.map((item: any, i: number) => (
                                <tr key={i}>
                                  <td><strong>{item.materialName}</strong></td>
                                  <td><span className="code-sm">{item.simpleCode || '—'}</span></td>
                                  <td>{item.requestedQty}</td>
                                  <td>{item.unit}</td>
                                  <td>{item.receivedQty ?? '—'}</td>
                                  <td>
                                    {item.approvalStatus === 'APPROVED' && <span className="suff-yes">✓ APPROVED</span>}
                                    {item.approvalStatus === 'REJECTED' && <span className="suff-no">✗ REJECTED</span>}
                                    {item.approvalStatus === 'PENDING' && <span className="suff-na">PENDING</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* PR Modal Removed in favor of Bulk Inline PR */}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
        .header-actions { display: flex; gap: 10px; align-items: center; }

        .header-date-picker { display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-main); padding: 8px 16px; border-radius: 4px; }
        .header-date-picker label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .header-date-picker input { background: transparent; border: none; color: var(--primary); font-size: 0.85rem; font-weight: 800; outline: none; cursor: pointer; color-scheme: dark; }


        .btn-refresh { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 9px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: 0.2s; }
        .btn-refresh:hover { border-color: var(--primary); color: var(--primary); }

        /* Toast */
        .fr-toast { position: fixed; top: 24px; right: 24px; z-index: 9999; padding: 14px 20px; font-size: 0.82rem; font-weight: 700; border-left: 4px solid; animation: slideIn 0.3s ease-out; }
        .fr-toast-success { background: rgba(16,185,129,0.1); border-color: #10b981; color: #10b981; }
        .fr-toast-warn    { background: rgba(234,179,8,0.1);  border-color: #eab308; color: #eab308; }
        .fr-toast-error   { background: rgba(239,68,68,0.1);  border-color: #ef4444; color: #ef4444; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .workflow-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--border-main); padding-bottom: 2px; }
        .tab-item { background: none; border: none; padding: 12px 24px; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; position: relative; }
        .tab-item:hover { color: var(--text-main); }
        .tab-item.active { color: var(--primary); }
        .tab-item.active::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background: var(--primary); }

        .consolidated-panel { background: transparent; border: 1px solid var(--border-main); padding: 24px; }
        .consolidated-header { margin-bottom: 24px; }
        .section-title { font-size: 0.7rem; font-weight: 800; color: var(--primary); letter-spacing: 1px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(249,115,22,0.1); padding-bottom: 8px; }
        .info-badge { display: flex; align-items: center; gap: 8px; color: var(--primary); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
        .info-desc { font-size: 0.7rem; color: var(--text-dim); }
        
        .demand-grid.consolidated { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .demand-card.consolidated { padding: 16px; background: var(--bg-main); }
        .demand-card.consolidated.menu-type { border-color: rgba(59,130,246,0.3); }
        .demand-footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); }
        .status-label { font-size: 0.6rem; font-weight: 800; display: flex; align-items: center; gap: 4px; }
        .status-label.ok { color: #10b981; }
        .status-label.short { color: #ef4444; }
        .status-label.production { color: #3b82f6; }

        .consolidated-actions { margin-top: 24px; padding-top: 20px; border-top: 1px dashed var(--border-main); }
        .action-hint { display: flex; align-items: center; gap: 10px; font-size: 0.7rem; color: var(--text-dim); font-weight: 700; background: rgba(249,115,22,0.05); padding: 10px 16px; border: 1px solid rgba(249,115,22,0.2); }

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
        .fr-stat.received { color: #8b5cf6; }
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
        .fr-card.received { border-left: 3px solid #8b5cf6; }

        .fr-card-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; cursor: pointer; gap: 16px; }
        .fr-card-left { display: flex; align-items: center; gap: 16px; flex: 1; }
        .fr-card-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

        .fr-status-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 0.65rem; font-weight: 800; padding: 4px 10px; border: 1px solid; white-space: nowrap; }
        .status-pending  { color: #f59e0b; border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.06); }
        .status-approved { color: #10b981; border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.06); }
        .status-rejected { color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); }
        .status-partial  { color: #f97316; border-color: rgba(249,115,22,0.3); background: rgba(249,115,22,0.06); }
        .status-received { color: #8b5cf6; border-color: rgba(139,92,246,0.3); background: rgba(139,92,246,0.06); }

        .fr-center-info strong { display: block; font-size: 0.95rem; color: var(--text-main); }
        .item-count-badge { background: var(--primary); color: white; padding: 2px 8px; font-size: 0.6rem; border-radius: 4px; margin-right: 8px; }
        .fr-meta { font-size: 0.68rem; color: var(--text-dim); font-weight: 600; display: flex; align-items: center; }

        .fr-action-row { display: flex; gap: 8px; }
        .btn-approve { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #10b981; padding: 7px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-approve:hover:not(:disabled) { background: rgba(16,185,129,0.2); }
        .btn-reject { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #ef4444; padding: 7px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-reject:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
        .btn-approve:disabled, .btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

        /* COO Approval Panel */
        .coo-approval-panel { margin-bottom: 32px; padding: 20px; background: rgba(99,102,241,0.04); border: 1px solid rgba(99,102,241,0.15); border-radius: 8px; }
        .coo-approval-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .row-approved { background: rgba(16,185,129,0.04); }
        .row-rejected { background: rgba(239,68,68,0.04); opacity: 0.6; }
        .suff-yes { color: #10b981; font-weight: 800; font-size: 0.7rem; }
        .suff-no  { color: #ef4444; font-weight: 800; font-size: 0.7rem; }
        .suff-na  { color: var(--text-dim); font-weight: 700; font-size: 0.7rem; }
        .row-disabled { opacity: 0.45; pointer-events: none; }

        .approved-by { font-size: 0.7rem; color: #10b981; font-weight: 700; }
        .rejected-by { font-size: 0.7rem; color: #ef4444; font-weight: 700; max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
        .partial-note { font-size: 0.7rem; color: #f97316; font-weight: 700; }
        .received-by { font-size: 0.7rem; color: #8b5cf6; font-weight: 700; }

        .btn-receive { background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); color: #8b5cf6; padding: 7px 14px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-receive:hover:not(:disabled) { background: rgba(139,92,246,0.2); }
        .btn-receive:disabled { opacity: 0.5; cursor: not-allowed; }

        .receive-form { padding: 16px 20px; border-top: 1px solid var(--border-main); background: rgba(139,92,246,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .receive-header { display: flex; flex-direction: column; }
        .receive-actions { display: flex; gap: 10px; }
        .btn-receive-confirm { background: #8b5cf6; color: white; border: none; padding: 8px 16px; font-weight: 800; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-cancel-receive { background: none; border: 1px solid var(--border-main); color: var(--text-dim); padding: 8px 12px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }

        .receive-input-group { display: flex; align-items: center; gap: 6px; }
        .qty-edit-input { width: 70px; background: var(--bg-main); border: 1px solid rgba(139,92,246,0.4); color: var(--text-main); padding: 4px 8px; font-size: 0.8rem; font-weight: 800; outline: none; transition: border-color 0.2s; }
        .qty-edit-input:focus { border-color: #8b5cf6; }

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
