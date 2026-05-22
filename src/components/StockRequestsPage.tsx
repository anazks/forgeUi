import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { foodRequestApi, userApi, vendorApi, purchaseApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { AlertTriangle, Package, Beaker, Clock } from 'lucide-react';

const StockRequestsPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);
  
  const [demandSummary, setDemandSummary] = useState<{ totalOpenDemands: number, items: any[] }>({ totalOpenDemands: 0, items: [] });
  const [locations, setLocations] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');

  // Bulk PR State
  const [selectedForPr, setSelectedForPr] = useState<Record<string, boolean>>({});
  const [vendorForPr, setVendorForPr] = useState<Record<string, string>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [raisedPrs, setRaisedPrs] = useState<Record<string, boolean>>({});
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [summaryDate, setSummaryDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isStore = user?.role === 'STORE' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'COO';

  useEffect(() => {
    fetchDemand();
    fetchLocationsAndVendors();
  }, [entityId, summaryDate]);

  const fetchLocationsAndVendors = async () => {
    try {
      const [locRes, venRes, billsRes] = await Promise.all([
        userApi.getLocations(entityId),
        vendorApi.getAll(),
        purchaseApi.getBills()
      ]);
      const locs = locRes.data.data || [];
      setLocations(locs);
      setVendors(venRes.data.data || []);

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
      setIsLoading(true);
      const res = await foodRequestApi.getDemandSummary(entityId, summaryDate);
      const data = res.data.data || { totalOpenDemands: 0, items: [] };
      setDemandSummary(data);

      const initialQtys: Record<string, number> = {};
      data.items.forEach((item: any) => {
        if (item.type === 'MATERIAL' && item.approvedGap > 0) {
          const key = `${item.materialId}-${item.locationId}`;
          if (item.moq && item.moq > 0) {
            initialQtys[key] = item.moq * Math.ceil(item.approvedGap / item.moq);
          } else {
            initialQtys[key] = item.approvedGap;
          }
        }
      });
      setOrderQuantities(initialQtys);
    } catch (err) {
      console.error('Failed to fetch demand summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkRaisePR = async () => {
    const selectedItems = demandSummary.items.filter(
      (item: any) => item.type === 'MATERIAL' && item.approvedGap > 0 && selectedForPr[`${item.materialId}-${item.locationId}`] && !raisedPrs[`${item.materialId}-${item.locationId}`]
    );

    if (selectedItems.length === 0) {
      showToast('No items selected for PR', 'warn');
      return;
    }

    const missingVendor = selectedItems.find(i => !vendorForPr[`${i.materialId}-${i.locationId}`]);
    if (missingVendor) {
      showToast(`Please select a vendor for ${missingVendor.name}`, 'error');
      return;
    }

    try {
      setIsBulkProcessing(true);
      
      const groupedByVendorAndLoc: Record<string, any> = {};
      selectedItems.forEach(item => {
        const vId = vendorForPr[`${item.materialId}-${item.locationId}`];
        const lId = item.locationId;
        const key = `${vId}_${lId}`;
        if (!groupedByVendorAndLoc[key]) groupedByVendorAndLoc[key] = { vendorId: vId, locationId: lId, items: [] };
        groupedByVendorAndLoc[key].items.push(item);
      });

      await Promise.all(Object.values(groupedByVendorAndLoc).map(group => {
        return purchaseApi.createRequest({
          vendorId: group.vendorId,
          destinationLocation: group.locationId,
          items: group.items.map((i: any) => ({
            item: i.materialId,
            itemName: i.name,
            requestedQty: orderQuantities[`${i.materialId}-${i.locationId}`] !== undefined
              ? orderQuantities[`${i.materialId}-${i.locationId}`]
              : i.approvedGap,
            unitPrice: unitPrices[`${i.materialId}-${i.locationId}`] || 0,
            unit: i.unit
          }))
        });
      }));

      const newRaised = { ...raisedPrs };
      selectedItems.forEach(item => {
        newRaised[`${item.materialId}-${item.locationId}`] = true;
      });
      setRaisedPrs(newRaised);
      setSelectedForPr({});
      
      showToast('Purchase Requests generated successfully!', 'success');
      fetchDemand();
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

  const locationsWithShortages = Array.from(
    new Set(
      demandSummary.items
        .filter((item: any) => item.type === 'MATERIAL' && item.approvedGap > 0)
        .map((item: any) => item.locationId)
    )
  ).map(locId => {
    const loc = locations.find(l => l._id === locId);
    return loc ? loc.name : 'Unknown Location';
  }).filter(name => name !== 'Unknown Location');

  return (
    <MainLayout>
      {toast && (
        <div className={`fr-toast fr-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <header className="page-header">
        <div className="header-title">
          <h1>STOCK REQUESTS (GAP ANALYSIS)</h1>
          <p className="subtitle">Review approved demands and generate PRs</p>
        </div>
      </header>

      {isLoading ? <ForgeLoader /> : (
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
            
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '20px' }}>
              {/* Shortages Box */}
              <div style={{ flex: 1, minWidth: '280px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%', color: '#ef4444' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444', margin: 0 }}>{demandSummary.totalOpenDemands}</h3>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', margin: 0 }}>ACTIONABLE RAW MATERIAL SHORTAGES (ACROSS ALL LOCATIONS)</p>
                </div>
              </div>

              {/* Open Requests Box */}
              <div style={{ flex: 1, minWidth: '280px', padding: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '50%', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                    <Clock size={16} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>OPEN REQUESTS BY LOCATION</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {locationsWithShortages.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-dim)' }}>NO OPEN REQUESTS</span>
                  ) : (
                    locationsWithShortages.map((locName) => (
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
                        {locName}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

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
                    <th>UNIT PRICE (₹)</th>
                    <th>VENDOR</th>
                    <th style={{ textAlign: 'center' }}>SELECT</th>
                  </tr>
                </thead>
                <tbody>
                  {demandSummary.items.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-dim">No demands found.</td></tr>
                  ) : (
                    demandSummary.items
                      .filter((item: any) => item.type === 'MATERIAL' && item.displayGap > 0)
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
                            <td>{(item.requestedStock ?? item.demand).toFixed(2)} {item.unit?.toUpperCase()}</td>
                            <td style={{ color: (item.displayGap ?? item.gap) > 0 ? '#ef4444' : 'inherit', fontWeight: 900 }}>{(item.displayGap ?? item.gap).toFixed(2)} {item.unit?.toUpperCase()}</td>
                            <td>
                                {isRaised ? (
                                <span style={{ fontWeight: 900 }}>{orderQuantities[itemKey]} {item.unit?.toUpperCase()}</span>
                              ) : (
                                <input
                                  type="number"
                                  value={orderQuantities[itemKey] ?? item.approvedGap}
                                  onChange={(e) => setOrderQuantities({...orderQuantities, [itemKey]: Number(e.target.value)})}
                                  style={{ width: '80px', padding: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                                />
                              )}
                            </td>
                            <td>
                              {isRaised ? (
                                <span style={{ fontWeight: 900 }}>₹{unitPrices[itemKey] || 0}</span>
                              ) : (
                                <input 
                                  type="number"
                                  placeholder="0.00"
                                  value={unitPrices[itemKey] ?? ''}
                                  onChange={(e) => setUnitPrices({...unitPrices, [itemKey]: Number(e.target.value)})}
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
                                disabled={isRaised || item.approvedGap === 0}
                                title={item.approvedGap === 0 ? 'Awaiting COO approval' : ''}
                                style={{ transform: 'scale(1.2)', cursor: (isRaised || item.approvedGap === 0) ? 'not-allowed' : 'pointer', opacity: item.approvedGap === 0 ? 0.3 : 1 }}
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
      )}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
        
        .header-date-picker { display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-main); padding: 8px 16px; border-radius: 4px; }
        .header-date-picker label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .header-date-picker input { background: transparent; border: none; color: var(--primary); font-size: 0.85rem; font-weight: 800; outline: none; cursor: pointer; color-scheme: dark; }

        .btn-seed { background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); color: #a855f7; padding: 9px 16px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: 0.2s; }
        .btn-seed:hover:not(:disabled) { background: rgba(168,85,247,0.2); }
        .btn-seed:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Toast */
        .fr-toast { position: fixed; top: 24px; right: 24px; z-index: 9999; padding: 14px 20px; font-size: 0.82rem; font-weight: 700; border-left: 4px solid; animation: slideIn 0.3s ease-out; }
        .fr-toast-success { background: rgba(16,185,129,0.1); border-color: #10b981; color: #10b981; }
        .fr-toast-warn    { background: rgba(234,179,8,0.1);  border-color: #eab308; color: #eab308; }
        .fr-toast-error   { background: rgba(239,68,68,0.1);  border-color: #ef4444; color: #ef4444; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        .consolidated-panel { background: transparent; border: 1px solid var(--border-main); padding: 24px; }
        .consolidated-header { margin-bottom: 24px; }
        .section-title { font-size: 0.7rem; font-weight: 800; color: var(--primary); letter-spacing: 1px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(249,115,22,0.1); padding-bottom: 8px; }
        .info-badge { display: flex; align-items: center; gap: 8px; color: var(--primary); font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
        .info-desc { font-size: 0.7rem; color: var(--text-dim); }
        .row-disabled { opacity: 0.45; pointer-events: none; }
        .status-pill { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; }
        .status-billed { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
      `}</style>
    </MainLayout>
  );
};

export default StockRequestsPage;
