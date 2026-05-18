import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { foodRequestApi, userApi, vendorApi, purchaseApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import {
  Plus, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, Beaker,
  Package, PackageCheck, Edit3
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
  const [isLoading, setIsLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [demandSummary, setDemandSummary] = useState<{ totalOpenDemands: number, items: any[] }>({ totalOpenDemands: 0, items: [] });
  const [locations, setLocations] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  
  // Bulk PR State
  const [selectedForPr, setSelectedForPr] = useState<Record<string, boolean>>({});
  const [vendorForPr, setVendorForPr] = useState<Record<string, string>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [raisedPrs, setRaisedPrs] = useState<Record<string, boolean>>({});
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [summaryDate, setSummaryDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isCenter = user?.role === 'CENTERS';
  // COO has the same consolidated view as Store Manager
  const isStore = user?.role === 'STORE' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'COO';

  useEffect(() => {
    fetchRequests();
  }, [entityId]);

  useEffect(() => {
    if (!isCenter) {
      fetchDemand();
      fetchLocationsAndVendors();
    }
  }, [entityId, summaryDate]);

  const fetchLocationsAndVendors = async () => {
    try {
      const [locRes, venRes, billsRes] = await Promise.all([
        userApi.getLocations(entityId),
        vendorApi.getAll(),
        purchaseApi.getBills()  // Pre-mark already-raised PRs (duplicate guard UX layer)
      ]);
      const locs = locRes.data.data || [];
      setLocations(locs);
      setVendors(venRes.data.data || []);

      // Pre-populate raisedPrs from any existing PENDING Bills so both SM and COO
      // immediately see 'PR RAISED' on items already ordered by either role.
      const existingBills = billsRes.data.data || [];
      const preRaised: Record<string, boolean> = {};
      existingBills.forEach((bill: any) => {
        if (bill.deliveryStatus === 'PENDING') {
          (bill.items || []).forEach((i: any) => {
            const key = `${i.item}-${bill.destinationLocation}`;
            if (key !== 'undefined-undefined') preRaised[key] = true;
          });
        }
      });
      setRaisedPrs(preRaised);
      
      if (isStore && locs.length > 0 && selectedLocation === 'ALL') {
        setSelectedLocation(locs[0]._id);
      }
    } catch (err) {
      console.error('Failed to load locations/vendors', err);
    }
  };

  const fetchDemand = async () => {
    try {
      const res = await foodRequestApi.getDemandSummary(entityId, summaryDate);
      const data = res.data.data || { totalOpenDemands: 0, items: [] };
      setDemandSummary(data);

      // Auto-initialize order quantities with MOQ
      const initialQtys: Record<string, number> = {};
      data.items.forEach((item: any) => {
        if (item.type === 'MATERIAL' && item.gap > 0) {
          initialQtys[`${item.materialId}-${item.locationId}`] = item.moq || 0;
        }
      });
      setOrderQuantities(initialQtys);
    } catch (err) {
      console.error('Failed to fetch demand summary:', err);
    }
  };

  const handleBulkRaisePR = async () => {
    // Collect all checked items
    const selectedItems = demandSummary.items.filter(
      (item: any) => item.type === 'MATERIAL' && item.gap > 0 && selectedForPr[`${item.materialId}-${item.locationId}`] && !raisedPrs[`${item.materialId}-${item.locationId}`]
    );

    if (selectedItems.length === 0) {
      showToast('No items selected for PR', 'warn');
      return;
    }

    // Validate vendors are selected
    const missingVendor = selectedItems.find(i => !vendorForPr[`${i.materialId}-${i.locationId}`]);
    if (missingVendor) {
      showToast(`Please select a vendor for ${missingVendor.name}`, 'error');
      return;
    }

    try {
      setIsBulkProcessing(true);
      
      // Group by Vendor and Location
      const groupedByVendorAndLoc: Record<string, any[]> = {};
      selectedItems.forEach(item => {
        const vId = vendorForPr[`${item.materialId}-${item.locationId}`];
        const lId = item.locationId;
        const key = `${vId}_${lId}`;
        if (!groupedByVendorAndLoc[key]) groupedByVendorAndLoc[key] = { vendorId: vId, locationId: lId, items: [] };
        groupedByVendorAndLoc[key].items.push(item);
      });

      // Submit each PR
      await Promise.all(Object.values(groupedByVendorAndLoc).map(group => {
        return purchaseApi.createRequest({
          vendorId: group.vendorId,
          destinationLocation: group.locationId,
          items: group.items.map((i: any) => ({
            item: i.materialId,
            itemName: i.name,
            requestedQty: orderQuantities[`${i.materialId}-${i.locationId}`] !== undefined ? orderQuantities[`${i.materialId}-${i.locationId}`] : i.gap,
            unit: i.unit
          }))
        });
      }));

      // Mark as raised
      const newRaised = { ...raisedPrs };
      selectedItems.forEach(item => {
        newRaised[`${item.materialId}-${item.locationId}`] = true;
      });
      setRaisedPrs(newRaised);
      setSelectedForPr({});
      
      showToast('Purchase Requests generated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create PRs', 'error');
    } finally {
      setIsBulkProcessing(false);
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
      setRequests(data);
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
      showToast(message, stockStatus === 'ALL_AVAILABLE' ? 'success' : 'warn');
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
        <div className="fr-stat pending"><Clock size={14} /><span>{pending.length}</span><label>PENDING</label></div>
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
            /* ==================== CONSOLIDATED VIEW ==================== */
            <div className="consolidated-panel">
              <div className="consolidated-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div className="info-badge">
                      <Package size={14} />
                      <span>TOTAL DEMAND ACROSS ALL PENDING REQUESTS FOR SELECTED DATE</span>
                    </div>
                    <p className="info-desc">Consolidated Gap Analysis separated by preparation location.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="header-date-picker">
                      <label>LOCATION:</label>
                      <select 
                        value={selectedLocation} 
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, outline: 'none' }}
                      >
                        {!isStore && <option value="ALL">ALL LOCATIONS</option>}
                        {locations.map(loc => (
                          <option key={loc._id} value={loc._id}>{loc.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="header-date-picker">
                      <label>DELIVERY DATE:</label>
                      <input
                        type="date"
                        value={summaryDate}
                        onChange={(e) => setSummaryDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Total Open Demands Metric Card */}
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%', color: '#ef4444' }}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444', margin: 0 }}>{demandSummary.totalOpenDemands}</h3>
                    <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', margin: 0 }}>ACTIONABLE RAW MATERIAL SHORTAGES (ACROSS ALL LOCATIONS)</p>
                  </div>
                </div>
              </div>

              {/* Aggregated Demands */}
              <div className="consolidated-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="section-title"><Beaker size={14} /> STOCK REQUESTS</h3>
                  <button 
                    className="btn-seed" 
                    onClick={handleBulkRaisePR}
                    disabled={isBulkProcessing || Object.keys(selectedForPr).length === 0}
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 16px', fontWeight: 900, cursor: Object.keys(selectedForPr).length === 0 ? 'not-allowed' : 'pointer', borderRadius: '4px', opacity: Object.keys(selectedForPr).length === 0 ? 0.5 : 1 }}
                  >
                    {isBulkProcessing ? 'RAISING PRs...' : 'RAISE PR FOR SELECTED'}
                  </button>
                </div>
                
                <div className="table-wrapper">
                  <table className="sharp-table">
                    <thead>
                      <tr>
                        <th>SL NO</th>
                        <th>ITEM NAME (LOCATION)</th>
                        <th>CURRENT STOCK</th>
                        <th>REQUESTED STOCK</th>
                        <th>GAP</th>
                        <th>ORDER QTY</th>
                        <th>VENDOR</th>
                        <th style={{ textAlign: 'center' }}>SELECT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demandSummary.items.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-dim">No demands found.</td></tr>
                      ) : (
                        demandSummary.items
                          .filter((item: any) => item.type === 'MATERIAL' && item.gap > 0)
                          .filter((item: any) => selectedLocation === 'ALL' || item.locationId === selectedLocation)
                          .map((item: any, idx: number) => {
                            const locName = locations.find(l => l._id === item.locationId)?.name || 'Unknown Location';
                            const itemKey = `${item.materialId}-${item.locationId}`;
                            const isRaised = raisedPrs[itemKey];

                            return (
                              <tr key={`item-${idx}`} className={isRaised ? 'row-disabled' : ''}>
                                <td>{idx + 1}</td>
                                <td>
                                  <strong>{item.name.toUpperCase()}</strong>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{locName.toUpperCase()}</div>
                                </td>
                                <td>{item.stock.toFixed(2)} {item.unit?.toUpperCase()}</td>
                                <td>{item.demand.toFixed(2)} {item.unit?.toUpperCase()}</td>
                                <td style={{ color: '#ef4444', fontWeight: 900 }}>{item.gap.toFixed(2)} {item.unit?.toUpperCase()}</td>
                                <td>
                                  {isRaised ? (
                                    <span style={{ fontWeight: 900 }}>{orderQuantities[itemKey]} {item.unit?.toUpperCase()}</span>
                                  ) : (
                                    <input 
                                      type="number"
                                      value={orderQuantities[itemKey] ?? item.moq}
                                      onChange={(e) => setOrderQuantities({...orderQuantities, [itemKey]: Number(e.target.value)})}
                                      style={{ width: '80px', padding: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                                    />
                                  )}
                                </td>
                                <td>
                                  {isRaised ? (
                                    <span className="status-pill status-billed">PR RAISED</span>
                                  ) : (
                                    <select 
                                      value={vendorForPr[itemKey] || ''}
                                      onChange={(e) => setVendorForPr({...vendorForPr, [itemKey]: e.target.value})}
                                      style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '6px', fontSize: '0.75rem', width: '100%', outline: 'none' }}
                                    >
                                      <option value="">SELECT VENDOR...</option>
                                      {vendors.map(v => (
                                        <option key={v._id} value={v._id}>{v.vendorName.toUpperCase()}</option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedForPr[itemKey] || false}
                                    onChange={(e) => setSelectedForPr({...selectedForPr, [itemKey]: e.target.checked})}
                                    disabled={isRaised}
                                    style={{ transform: 'scale(1.2)', cursor: isRaised ? 'not-allowed' : 'pointer' }}
                                  />
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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
                  const isReceiving = receivingId === req._id;

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
                          {/* Receive Action for approved/partial requests */}
                          {(req.status === 'APPROVED' || req.status === 'PARTIAL') && (
                            <button
                              className="btn-receive"
                              onClick={(e) => {
                                e.stopPropagation();
                                const qtys: Record<string, number> = {};
                                req.requestedItems.forEach((i: any) => { qtys[i.materialName] = i.requestedQty; });
                                setReceivedQtys(qtys);
                                setReceivingId(isReceiving ? null : req._id);
                              }}
                              disabled={isProcessing}
                            >
                              <PackageCheck size={13} /> RECEIVE DELIVERY
                            </button>
                          )}
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

                      {/* Receive Form */}
                      {isReceiving && (
                        <div className="receive-form">
                          <div className="receive-header">
                            <strong style={{ fontSize: '0.75rem' }}>CONFIRM RECEIVED QUANTITIES</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Edit qty if delivery was partial</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '10px 0' }}>
                            {req.requestedItems.map((item: any) => (
                              <div key={item.materialName} className="receive-input-group">
                                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{item.materialName}</span>
                                <input
                                  className="qty-edit-input"
                                  type="number"
                                  value={receivedQtys[item.materialName] ?? item.requestedQty}
                                  onChange={(e) => setReceivedQtys({ ...receivedQtys, [item.materialName]: Number(e.target.value) })}
                                />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{item.unit}</span>
                              </div>
                            ))}
                          </div>
                          <div className="receive-actions">
                            <button
                              className="btn-receive-confirm"
                              disabled={isProcessing}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setProcessingId(req._id);
                                try {
                                  const items = req.requestedItems.map((i: any) => ({
                                    ...i,
                                    receivedQty: receivedQtys[i.materialName] ?? i.requestedQty
                                  }));
                                  await foodRequestApi.receive(req._id, items);
                                  setToast({ message: 'Delivery confirmed!', type: 'success' });
                                  setReceivingId(null);
                                  fetchRequests();
                                } catch (err: any) {
                                  setToast({ message: err.response?.data?.error || 'Failed to confirm receipt', type: 'error' });
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                            >
                              {isProcessing ? <Loader2 size={13} className="spin" /> : <PackageCheck size={13} />}
                              CONFIRM RECEIPT
                            </button>
                            <button className="btn-cancel-receive" onClick={(e) => { e.stopPropagation(); setReceivingId(null); }}>
                              CANCEL
                            </button>
                          </div>
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
