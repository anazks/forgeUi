import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Edit2, 
  RefreshCw, 
  Building, 
  Save, 
  Plus,
  DollarSign,
  X
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { revenueApi, userApi, bomApi, menuApi } from '../services/api';

type TabType = 'b2b' | 'b2c' | 'online';

const RevenuePage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  
  // Selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [activeTab, setActiveTab] = useState<TabType>('b2b');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dropdown list catalogs for manual additions
  const [allBoms, setAllBoms] = useState<any[]>([]);
  const [allMenus, setAllMenus] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);

  // Daily Revenue record data
  const [revenueRecord, setRevenueRecord] = useState<any>(null);
  
  // Local edit states
  const [b2bItems, setB2bItems] = useState<any[]>([]);
  const [b2cItems, setB2cItems] = useState<any[]>([]);
  const [reportedCash, setReportedCash] = useState<number>(0);
  const [reportedOnline, setReportedOnline] = useState<number>(0);
  const [onlineSales, setOnlineSales] = useState<{ totalSaleValue: number; aggregatorPercentage: number }>({
    totalSaleValue: 0,
    aggregatorPercentage: 0
  });

  // Local overrides for confirmation statuses to allow pre-close edits
  const [localB2bConfirmed, setLocalB2bConfirmed] = useState(false);
  const [localB2cConfirmed, setLocalB2cConfirmed] = useState(false);
  const [localOnlineConfirmed, setLocalOnlineConfirmed] = useState(false);

  // Manual addition modal states
  const [isB2bModalOpen, setIsB2bModalOpen] = useState(false);
  const [mB2bItemId, setMB2bItemId] = useState(''); // format: "id|BOM" or "id|DIRECT"
  const [mB2bQty, setMB2bQty] = useState<number>(0);
  const [mB2bRate, setMB2bRate] = useState<number>(0);

  const [isB2cModalOpen, setIsB2cModalOpen] = useState(false);
  const [mB2cItemId, setMB2cItemId] = useState(''); // format: "id|BOM" or "id|DIRECT"
  const [mB2cStock, setMB2cStock] = useState<number>(0);
  const [mB2cQty, setMB2cQty] = useState<number>(0);
  const [mB2cRate, setMB2cRate] = useState<number>(0);

  useEffect(() => {
    fetchInitialSetup();
  }, []);

  useEffect(() => {
    if (currentUser) {
      // Determine default active tab
      const isKitchen = currentUser.role === 'KITCHEN';
      const isRestaurant = currentUser.role === 'RESTAURANT';
      const isCenterOrAggregate = currentUser.role === 'CENTERS' || currentUser.role === 'AGGREGATE';

      if (isKitchen) setActiveTab('b2b');
      else if (isCenterOrAggregate) setActiveTab('b2c');
      else if (isRestaurant) setActiveTab('b2b');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const targetLoc = isAdminRole() ? selectedLocationId : currentUser._id;
      if (targetLoc) {
        fetchDailyRevenue(targetLoc, selectedDate);
      }
    }
  }, [selectedDate, selectedLocationId, currentUser]);

  const isAdminRole = () => {
    return ['SUPER_ADMIN', 'ADMIN', 'COO'].includes(currentUser?.role);
  };

  const fetchInitialSetup = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [userRes, bomsRes, menusRes, ratesRes] = await Promise.all([
        userApi.getMe(),
        bomApi.getAll(),
        menuApi.getAll(),
        menuApi.getRates()
      ]);

      const user = userRes.data.data;
      setCurrentUser(user);
      setAllBoms(bomsRes.data.data || []);
      setAllMenus(menusRes.data.data || []);
      setRates(ratesRes.data.data || []);

      if (['SUPER_ADMIN', 'ADMIN', 'COO'].includes(user.role)) {
        const locRes = await userApi.getLocations();
        const locs = locRes.data.data || [];
        setLocations(locs);
        if (locs.length > 0) {
          setSelectedLocationId(locs[0]._id);
        }
      }
    } catch (err: any) {
      setError('Failed to fetch user profile or catalog items');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDailyRevenue = async (locationId: string, targetDate: string) => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      const res = await revenueApi.getDaily(
        targetDate, 
        isAdminRole() ? locationId : undefined
      );

      const record = res.data.data;
      setRevenueRecord(record);

      // Populate local states
      setB2bItems(record.b2bSales || []);
      setB2cItems(record.b2cSales || []);
      setOnlineSales(record.onlineSales || { totalSaleValue: 0, aggregatorPercentage: 0 });

      setReportedCash(record.reportedCash || 0);
      setReportedOnline(record.reportedOnline || 0);

      setLocalB2bConfirmed(record.b2bConfirmed || false);
      setLocalB2cConfirmed(record.b2cConfirmed || false);
      setLocalOnlineConfirmed(record.onlineConfirmed || false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load revenue records');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── B2B Manual Add Modal Handlers ─────────────────────────────────────
  const handleMB2bSelect = (itemVal: string) => {
    setMB2bItemId(itemVal);
    if (!itemVal) {
      setMB2bRate(0);
      return;
    }
    const [id, type] = itemVal.split('|');
    const targetLoc = isAdminRole() ? selectedLocationId : currentUser?._id;

    if (type === 'BOM') {
      let rateDoc = rates.find(r => r.bom?._id === id && (r.center?._id === targetLoc || r.center === targetLoc));
      if (!rateDoc) {
        rateDoc = rates.find(r => r.bom?._id === id && !r.center);
      }
      setMB2bRate(rateDoc ? (rateDoc.centerRate || rateDoc.rate || 0) : 0);
    } else {
      let rateDoc = rates.find(r => r.menu?._id === id && (r.center?._id === targetLoc || r.center === targetLoc));
      if (!rateDoc) {
        rateDoc = rates.find(r => r.menu?._id === id && !r.center);
      }
      setMB2bRate(rateDoc ? (rateDoc.centerRate || rateDoc.rate || 0) : 0);
    }
  };

  const handleSaveMB2b = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mB2bItemId) return;
    const [id, type] = mB2bItemId.split('|');

    if (b2bItems.some(i => (i.bomId === id || i.menuItem === id))) {
      setError('Item is already in the list');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (type === 'BOM') {
      const selected = allBoms.find(b => b._id === id);
      if (!selected) return;
      setB2bItems([
        ...b2bItems,
        {
          bomId: selected._id,
          itemName: selected.dishName,
          itemType: 'BOM',
          quantity: mB2bQty,
          unitPrice: mB2bRate,
          totalVal: mB2bQty * mB2bRate,
          isManual: true
        }
      ]);
    } else {
      const selected = allMenus.find(m => m._id === id);
      if (!selected) return;
      setB2bItems([
        ...b2bItems,
        {
          menuItem: selected._id,
          itemName: selected.name,
          itemType: 'DIRECT',
          quantity: mB2bQty,
          unitPrice: mB2bRate,
          totalVal: mB2bQty * mB2bRate,
          isManual: true
        }
      ]);
    }

    // Reset and close
    setMB2bItemId('');
    setMB2bQty(0);
    setMB2bRate(0);
    setIsB2bModalOpen(false);
  };

  // ─── B2C Manual Add Modal Handlers ─────────────────────────────────────
  const handleMB2cSelect = (itemVal: string) => {
    setMB2cItemId(itemVal);
    if (!itemVal) {
      setMB2cRate(0);
      setMB2cStock(0);
      return;
    }
    const [id, type] = itemVal.split('|');
    const targetLoc = isAdminRole() ? selectedLocationId : currentUser?._id;

    if (type === 'BOM') {
      let rateDoc = rates.find(r => r.bom?._id === id && (r.center?._id === targetLoc || r.center === targetLoc));
      if (!rateDoc) {
        rateDoc = rates.find(r => r.bom?._id === id && !r.center);
      }
      setMB2cRate(rateDoc ? (rateDoc.centerRate || rateDoc.rate || 0) : 0);
      setMB2cStock(0);
    } else {
      let rateDoc = rates.find(r => r.menu?._id === id && (r.center?._id === targetLoc || r.center === targetLoc));
      if (!rateDoc) {
        rateDoc = rates.find(r => r.menu?._id === id && !r.center);
      }
      setMB2cRate(rateDoc ? (rateDoc.centerRate || rateDoc.rate || 0) : 0);
      setMB2cStock(0);
    }
  };

  const handleSaveMB2c = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mB2cItemId) return;
    const [id, type] = mB2cItemId.split('|');

    if (b2cItems.some(i => (i.bomId === id || i.menuItem === id))) {
      setError('Item is already in the list');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (type === 'BOM') {
      const selected = allBoms.find(b => b._id === id);
      if (!selected) return;
      setB2cItems([
        ...b2cItems,
        {
          bomId: selected._id,
          itemName: selected.dishName,
          itemType: 'BOM',
          unit: selected.unit || 'pcs',
          stockQty: mB2cStock,
          soldQty: mB2cQty,
          unitPrice: mB2cRate,
          totalVal: mB2cQty * mB2cRate,
          isManual: true
        }
      ]);
    } else {
      const selected = allMenus.find(m => m._id === id);
      if (!selected) return;
      setB2cItems([
        ...b2cItems,
        {
          menuItem: selected._id,
          itemName: selected.name,
          itemType: 'DIRECT',
          unit: selected.unit || 'pcs',
          stockQty: mB2cStock,
          soldQty: mB2cQty,
          unitPrice: mB2cRate,
          totalVal: mB2cQty * mB2cRate,
          isManual: true
        }
      ]);
    }

    // Reset and close
    setMB2cItemId('');
    setMB2cStock(0);
    setMB2cQty(0);
    setMB2cRate(0);
    setIsB2cModalOpen(false);
  };

  const handleB2bPriceChange = (index: number, val: string) => {
    const updated = [...b2bItems];
    const price = parseFloat(val) || 0;
    updated[index].unitPrice = price;
    updated[index].totalVal = updated[index].quantity * price;
    setB2bItems(updated);
  };

  const handleB2bManualQtyChange = (index: number, val: string) => {
    const updated = [...b2bItems];
    const qty = parseFloat(val) || 0;
    updated[index].quantity = qty;
    updated[index].totalVal = qty * updated[index].unitPrice;
    setB2bItems(updated);
  };

  const handleB2cQtyChange = (index: number, val: string) => {
    const updated = [...b2cItems];
    const qty = parseFloat(val) || 0;
    
    // Capped by stockQty
    if (qty > updated[index].stockQty) {
      setError(`Quantity sold for "${updated[index].itemName}" cannot exceed stock (${updated[index].stockQty})`);
      setTimeout(() => setError(''), 4000);
      return;
    }
    if (qty < 0) return;

    updated[index].soldQty = qty;
    updated[index].totalVal = qty * updated[index].unitPrice;
    setB2cItems(updated);
  };

  const handleB2cManualStockChange = (index: number, val: string) => {
    const updated = [...b2cItems];
    const stock = parseFloat(val) || 0;
    updated[index].stockQty = stock;
    if (updated[index].soldQty > stock) {
      updated[index].soldQty = stock;
      updated[index].totalVal = stock * updated[index].unitPrice;
    }
    setB2cItems(updated);
  };

  const handleB2cManualPriceChange = (index: number, val: string) => {
    const updated = [...b2cItems];
    const price = parseFloat(val) || 0;
    updated[index].unitPrice = price;
    updated[index].totalVal = updated[index].soldQty * price;
    setB2cItems(updated);
  };

  const handleConfirmTab = async (tabType: TabType) => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      let salesData: any = null;
      if (tabType === 'b2b') {
        // Validate unit prices
        const invalid = b2bItems.find(item => !item.unitPrice || item.unitPrice <= 0);
        if (invalid && b2bItems.length > 0) {
          setError(`Item "${invalid.itemName}" requires a positive unit price before confirmation`);
          setIsSubmitting(false);
          return;
        }
        salesData = b2bItems;
      } else if (tabType === 'b2c') {
        salesData = {
          b2cSales: b2cItems,
          reportedCash,
          reportedOnline
        };
      } else if (tabType === 'online') {
        salesData = onlineSales;
      }

      await revenueApi.confirmTab({
        date: selectedDate,
        tabType,
        salesData,
        centerId: isAdminRole() ? selectedLocationId : undefined
      });

      setSuccess(`${tabType.toUpperCase()} sales details confirmed successfully.`);
      if (tabType === 'b2b') setLocalB2bConfirmed(true);
      if (tabType === 'b2c') setLocalB2cConfirmed(true);
      if (tabType === 'online') setLocalOnlineConfirmed(true);

      const targetLoc = isAdminRole() ? selectedLocationId : currentUser._id;
      fetchDailyRevenue(targetLoc, selectedDate);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm sales data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDay = async () => {
    if (!window.confirm("WARNING: Once closed, daily revenue records are permanently locked and cannot be reopened. Inventory for Direct items will be updated. Proceed?")) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      await revenueApi.closeDaily({
        date: selectedDate,
        centerId: isAdminRole() ? selectedLocationId : undefined
      });

      setSuccess('Revenue for the day is now CLOSED and locked.');
      const targetLoc = isAdminRole() ? selectedLocationId : currentUser._id;
      fetchDailyRevenue(targetLoc, selectedDate);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to close revenue day');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine visibility of tabs based on roles
  const targetUserRole = isAdminRole() 
    ? locations.find(l => l._id === selectedLocationId)?.role 
    : currentUser?.role;

  const targetOnlineEnabled = isAdminRole()
    ? locations.find(l => l._id === selectedLocationId)?.onlineSalesEnabled
    : currentUser?.onlineSalesEnabled;

  const needsB2B = targetUserRole === 'KITCHEN' || targetUserRole === 'RESTAURANT';
  const needsB2C = targetUserRole === 'CENTERS' || targetUserRole === 'AGGREGATE' || targetUserRole === 'RESTAURANT';
  const hasOnline = (targetUserRole === 'CENTERS' || targetUserRole === 'AGGREGATE' || targetUserRole === 'RESTAURANT') && targetOnlineEnabled;

  const isClosed = revenueRecord?.status === 'CLOSED';
  const isReadOnly = isClosed;

  // Check if all needed tabs are confirmed
  const b2bReady = !needsB2B || localB2bConfirmed;
  const b2cReady = !needsB2C || localB2cConfirmed;
  const onlineReady = !hasOnline || localOnlineConfirmed;
  const allTabsConfirmed = b2bReady && b2cReady && onlineReady;

  // Dynamic Live Calculation of Total Revenue
  const totalB2B = b2bItems.reduce((acc, item) => acc + (item.totalVal || 0), 0);
  const totalB2C = b2cItems.reduce((acc, item) => acc + (item.totalVal || 0), 0);
  const totalOnline = onlineSales.totalSaleValue || 0;
  const liveTotalAmount = totalB2B + totalB2C + totalOnline;

  if (isLoading && !revenueRecord) {
    return <ForgeLoader />;
  }

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>REVENUE MANAGEMENT</h1>
          <p className="subtitle">RECORD DAILY DISPATCHES &amp; B2C CLOSURE</p>
        </div>

        <div className="header-controls">
          {isAdminRole() && (
            <div className="location-select-wrap">
              <Building size={16} />
              <select 
                value={selectedLocationId} 
                onChange={(e) => setSelectedLocationId(e.target.value)}
                disabled={isSubmitting}
              >
                {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.name} ({loc.role})</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div className="date-picker-wrap">
            <span className="picker-label">DATE:</span>
            <Calendar size={14} />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              disabled={isSubmitting}
            />
          </div>

          <button 
            className="btn-refresh" 
            onClick={() => {
              const targetLoc = isAdminRole() ? selectedLocationId : currentUser._id;
              if (targetLoc) fetchDailyRevenue(targetLoc, selectedDate);
            }}
            disabled={isSubmitting}
          >
            <RefreshCw size={14} className={isSubmitting ? "animate-spin" : ""} />
          </button>
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

      {/* Main Stats Banner */}
      <div className="status-strip">
        <div className="status-badge-container">
          <span className="status-label">STATUS:</span>
          {isClosed ? (
            <span className="badge badge-closed"><Lock size={12} /> LOCKED</span>
          ) : (
            <span className="badge badge-open"><Unlock size={12} /> OPEN</span>
          )}
        </div>

        <div className="amount-stat">
          <span className="amount-label">TOTAL REVENUE:</span>
          <span className="amount-value">₹ {liveTotalAmount.toFixed(2)}</span>
        </div>

        {!isReadOnly && (
          <button 
            className="btn-close-day" 
            disabled={!allTabsConfirmed || isSubmitting}
            onClick={handleCloseDay}
          >
            <Lock size={14} /> CLOSE REVENUE FOR DAY
          </button>
        )}
      </div>

      {/* Tab Selectors */}
      <div className="tabs-header">
        {needsB2B && (
          <button 
            className={`tab-link ${activeTab === 'b2b' ? 'active' : ''}`}
            onClick={() => setActiveTab('b2b')}
          >
            B2B REVENUE
            {localB2bConfirmed ? (
              <span className="tab-status verified"><CheckCircle2 size={10} /></span>
            ) : (
              b2bItems.length > 0 && <span className="tab-status warning"><AlertCircle size={10} /></span>
            )}
          </button>
        )}

        {needsB2C && (
          <button 
            className={`tab-link ${activeTab === 'b2c' ? 'active' : ''}`}
            onClick={() => setActiveTab('b2c')}
          >
            B2C REVENUE
            {localB2cConfirmed ? (
              <span className="tab-status verified"><CheckCircle2 size={10} /></span>
            ) : (
              b2cItems.length > 0 && <span className="tab-status warning"><AlertCircle size={10} /></span>
            )}
          </button>
        )}

        {hasOnline && (
          <button 
            className={`tab-link ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            ONLINE SALES
            {localOnlineConfirmed ? (
              <span className="tab-status verified"><CheckCircle2 size={10} /></span>
            ) : (
              <span className="tab-status warning"><AlertCircle size={10} /></span>
            )}
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="data-panel">
        
        {/* ─── B2B TAB ────────────────────────────────────────────── */}
        {activeTab === 'b2b' && needsB2B && (
          <div className="tab-panel">
            <div className="panel-header-section">
              <h3>Inter-unit Dispatches</h3>
              
              <div className="manual-add-controls">
                {!localB2bConfirmed && !isReadOnly && (
                  <button className="btn-primary" onClick={() => setIsB2bModalOpen(true)}>
                    <Plus size={14} /> ADD DISPATCH MANUALLY
                  </button>
                )}
                {localB2bConfirmed && !isReadOnly && (
                  <button className="btn-edit-tab" onClick={() => setLocalB2bConfirmed(false)}>
                    <Edit2 size={12} /> Edit Dispatches
                  </button>
                )}
              </div>
            </div>

            <div className="table-wrapper">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>ITEM DISPATCHED</th>
                    <th>TYPE</th>
                    <th>DISPATCHED QTY</th>
                    <th>UNIT TRANSFER RATE (₹)</th>
                    <th className="text-right">TOTAL VALUE (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {b2bItems.map((item, idx) => {
                    const isRateMissing = !item.unitPrice || item.unitPrice <= 0;
                    return (
                      <tr key={item.bomId || item.menuItem || idx}>
                        <td>
                          <strong>{item.itemName?.toUpperCase()}</strong>
                          {item.isManual && <span className="manual-tag">MANUAL</span>}
                        </td>
                        <td>
                          <span className={`badge-type ${item.itemType === 'DIRECT' ? 'direct' : 'bom'}`}>
                            {item.itemType || 'BOM'}
                          </span>
                        </td>
                        <td>
                          {item.isManual && !localB2bConfirmed && !isReadOnly ? (
                            <input 
                              type="number"
                              className="table-input qty-box-input"
                              value={item.quantity || ''}
                              onChange={(e) => handleB2bManualQtyChange(idx, e.target.value)}
                              min="0"
                            />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td>
                          {localB2bConfirmed || isReadOnly ? (
                            <div className="price-display-wrapper">
                               <span>₹ {item.unitPrice.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div className="price-input-container">
                              <span className="currency">₹</span>
                              <input 
                                type="number" 
                                className={`table-input price-box-input ${isRateMissing ? 'input-warning' : ''}`}
                                value={item.unitPrice || ''} 
                                onChange={(e) => handleB2bPriceChange(idx, e.target.value)}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                              />
                              {isRateMissing && (
                                <span className="warning-indicator" title="Transfer Price is required!">
                                  <AlertCircle size={14} />
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-right font-numeric">₹ {(item.totalVal || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {b2bItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-row">No dispatches recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!localB2bConfirmed && !isReadOnly && (
              <div className="panel-actions">
                <button className="btn-confirm-tab" onClick={() => handleConfirmTab('b2b')} disabled={isSubmitting}>
                  <Save size={14} /> CONFIRM B2B DISPATCHES
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── B2C TAB ────────────────────────────────────────────── */}
        {activeTab === 'b2c' && needsB2C && (
          <div className="tab-panel">
            <div className="panel-header-section">
              <h3>B2C Counter Sales</h3>

              <div className="manual-add-controls">
                {!localB2cConfirmed && !isReadOnly && (
                  <button className="btn-primary" onClick={() => setIsB2cModalOpen(true)}>
                    <Plus size={14} /> ADD SALE MANUALLY
                  </button>
                )}
                {localB2cConfirmed && !isReadOnly && (
                  <button className="btn-edit-tab" onClick={() => setLocalB2cConfirmed(false)}>
                    <Edit2 size={12} /> Edit Sales
                  </button>
                )}
              </div>
            </div>

            {/* B2C Cash & Online Reported inputs */}
            <div className="b2c-reported-inputs-banner">
              <div className="reported-input-group">
                <label>TOTAL EXPECTED REVENUE (₹)</label>
                <div className="reported-value-display">₹ {totalB2C.toFixed(2)}</div>
              </div>
              <div className="reported-input-group">
                <label>TOTAL CASH RECEIVED (₹)</label>
                {localB2cConfirmed || isReadOnly ? (
                  <div className="reported-value-display">₹ {reportedCash.toFixed(2)}</div>
                ) : (
                  <input
                    type="number"
                    value={reportedCash || ''}
                    onChange={(e) => setReportedCash(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="reported-input-field"
                  />
                )}
              </div>
              <div className="reported-input-group">
                <label>TOTAL ONLINE RECEIVED (₹)</label>
                {localB2cConfirmed || isReadOnly ? (
                  <div className="reported-value-display">₹ {reportedOnline.toFixed(2)}</div>
                ) : (
                  <input
                    type="number"
                    value={reportedOnline || ''}
                    onChange={(e) => setReportedOnline(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="reported-input-field"
                  />
                )}
              </div>
              <div className="reported-input-group difference-group">
                <label>DIFFERENCE (₹)</label>
                <div className={`reported-value-display difference ${(totalB2C - (reportedCash + reportedOnline)) !== 0 ? 'mismatch' : 'matched'}`}>
                  ₹ {(totalB2C - (reportedCash + reportedOnline)).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>ITEM NAME</th>
                    <th>TYPE</th>
                    <th>UNIT</th>
                    <th>MAX STOCK AVAILABLE</th>
                    <th>QTY SOLD</th>
                    <th>SELLING PRICE (₹)</th>
                    <th className="text-right">TOTAL VALUE (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {b2cItems.map((item, idx) => (
                    <tr key={`${item.bomId || item.menuItem || idx}`}>
                      <td>
                        <strong>{item.itemName?.toUpperCase()}</strong>
                        {item.isManual && <span className="manual-tag">MANUAL</span>}
                      </td>
                      <td>
                        <span className={`badge-type ${item.itemType === 'BOM' ? 'bom' : 'direct'}`}>
                          {item.itemType}
                        </span>
                      </td>
                      <td>{item.unit || 'pcs'}</td>
                      <td>
                        {item.isManual && !localB2cConfirmed && !isReadOnly ? (
                          <input 
                            type="number"
                            className="table-input qty-box-input"
                            value={item.stockQty || ''}
                            onChange={(e) => handleB2cManualStockChange(idx, e.target.value)}
                            min="0"
                          />
                        ) : (
                          item.stockQty
                        )}
                      </td>
                      <td>
                        {localB2cConfirmed || isReadOnly ? (
                          <span>{item.soldQty}</span>
                        ) : (
                          <input 
                            type="number" 
                            className="table-input qty-box-input"
                            value={item.soldQty || ''} 
                            onChange={(e) => handleB2cQtyChange(idx, e.target.value)}
                            min="0"
                            max={item.stockQty}
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td>
                        {item.isManual && !localB2cConfirmed && !isReadOnly ? (
                          <div className="price-input-container">
                            <span className="currency">₹</span>
                            <input 
                              type="number"
                              className="table-input price-box-input"
                              value={item.unitPrice || ''}
                              onChange={(e) => handleB2cManualPriceChange(idx, e.target.value)}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        ) : (
                          <span>₹ {item.unitPrice.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="text-right font-numeric">₹ {(item.totalVal || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {b2cItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-row">No B2C items available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!localB2cConfirmed && !isReadOnly && (
              <div className="panel-actions">
                <button className="btn-confirm-tab" onClick={() => handleConfirmTab('b2c')} disabled={isSubmitting}>
                  <Save size={14} /> CONFIRM B2C SALES
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── ONLINE TAB ─────────────────────────────────────────── */}
        {activeTab === 'online' && hasOnline && (
          <div className="tab-panel">
            <div className="panel-header-section">
              <h3>Aggregator Deliveries (Zomato/Swiggy)</h3>
              {localOnlineConfirmed && !isReadOnly && (
                <button className="btn-edit-tab" onClick={() => setLocalOnlineConfirmed(false)}>
                  <Edit2 size={12} /> Edit Online Value
                </button>
              )}
            </div>

            <div className="online-form-container">
              <div className="metadata-card">
                <div className="meta-item">
                  <span className="label">ACTIVE AGGREGATOR COMMISSION</span>
                  <span className="value">{onlineSales.aggregatorPercentage || 0} %</span>
                </div>
                <div className="meta-item">
                  <span className="label">EXPECTED PAYOUT SHARE</span>
                  <span className="value">{(100 - (onlineSales.aggregatorPercentage || 0)).toFixed(2)} %</span>
                </div>
              </div>

              <div className="form-group-online">
                <label>TOTAL ONLINE SALES VALUE (₹)</label>
                {localOnlineConfirmed || isReadOnly ? (
                  <div className="closed-online-value">
                    <DollarSign size={18} />
                    <span>₹ {(onlineSales.totalSaleValue || 0).toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="price-input-large">
                    <span className="currency">₹</span>
                    <input 
                      type="number"
                      value={onlineSales.totalSaleValue || ''}
                      onChange={(e) => setOnlineSales({
                        ...onlineSales,
                        totalSaleValue: parseFloat(e.target.value) || 0
                      })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
              </div>

              {!localOnlineConfirmed && !isReadOnly && (
                <button className="btn-confirm-tab btn-online-save" onClick={() => handleConfirmTab('online')} disabled={isSubmitting}>
                  <Save size={14} /> CONFIRM ONLINE SALES
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ─── B2B MANUAL ADD MODAL WINDOW ─────────────────────────────────── */}
      {isB2bModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content rate-modal">
            <button className="close-btn" onClick={() => {
              setMB2bItemId('');
              setMB2bQty(0);
              setMB2bRate(0);
              setIsB2bModalOpen(false);
            }}><X size={20} /></button>
            <h2>Add B2B Dispatch Manually</h2>
            <form onSubmit={handleSaveMB2b} className="standard-form">
              <div className="form-group">
                <label>Select Item</label>
                <select 
                  value={mB2bItemId} 
                  onChange={e => handleMB2bSelect(e.target.value)} 
                  required
                >
                  <option value="">-- Choose Item --</option>
                  <optgroup label="BOM Recipes">
                    {allBoms.map(b => (
                      <option key={b._id} value={`${b._id}|BOM`}>{b.dishName} (BOM)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Direct Menu Items">
                    {allMenus.map(m => (
                      <option key={m._id} value={`${m._id}|DIRECT`}>{m.name} (Direct)</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label>Quantity Dispatched</label>
                <input 
                  type="number" 
                  value={mB2bQty || ''} 
                  onChange={e => setMB2bQty(parseFloat(e.target.value) || 0)} 
                  min="0" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Unit Rate (₹)</label>
                <input 
                  type="number" 
                  value={mB2bRate || ''} 
                  onChange={e => setMB2bRate(parseFloat(e.target.value) || 0)} 
                  min="0" 
                  step="0.01" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Total Value (₹)</label>
                <div className="closed-online-value">
                  <span>₹ {(mB2bQty * mB2bRate).toFixed(2)}</span>
                </div>
              </div>
              <button type="submit" className="btn-submit">ADD DISPATCH</button>
            </form>
          </div>
        </div>
      )}

      {/* ─── B2C MANUAL ADD MODAL WINDOW ─────────────────────────────────── */}
      {isB2cModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content rate-modal">
            <button className="close-btn" onClick={() => setIsB2cModalOpen(false)}><X size={20} /></button>
            <h2>Add B2C Counter Sale Manually</h2>
            <form onSubmit={handleSaveMB2c} className="standard-form">
              <div className="form-group">
                <label>Select Item</label>
                <select 
                  value={mB2cItemId} 
                  onChange={e => handleMB2cSelect(e.target.value)} 
                  required
                >
                  <option value="">-- Choose Item --</option>
                  <optgroup label="BOM Recipes">
                    {allBoms.map(b => (
                      <option key={b._id} value={`${b._id}|BOM`}>{b.dishName} (BOM)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Direct Menu Items">
                    {allMenus.map(m => (
                      <option key={m._id} value={`${m._id}|DIRECT`}>{m.name} (Direct)</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label>Max Stock Available</label>
                <input 
                  type="number" 
                  value={mB2cStock || ''} 
                  onChange={e => setMB2cStock(parseFloat(e.target.value) || 0)} 
                  min="0" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Quantity Sold</label>
                <input 
                  type="number" 
                  value={mB2cQty || ''} 
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val > mB2cStock) {
                      alert(`Sold quantity cannot exceed stock availability of ${mB2cStock}`);
                      return;
                    }
                    setMB2cQty(val);
                  }} 
                  min="0" 
                  max={mB2cStock}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Unit Selling Price (₹)</label>
                <input 
                  type="number" 
                  value={mB2cRate || ''} 
                  onChange={e => setMB2cRate(parseFloat(e.target.value) || 0)} 
                  min="0" 
                  step="0.01" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Total Value (₹)</label>
                <div className="closed-online-value">
                  <span>₹ {(mB2cQty * mB2cRate).toFixed(2)}</span>
                </div>
              </div>
              <button type="submit" className="btn-submit">ADD SALE</button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        
        .header-controls { display: flex; gap: 12px; align-items: center; }
        
        .location-select-wrap { display: flex; align-items: center; gap: 8px; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 8px 12px; }
        .location-select-wrap select { background: transparent; border: none; color: var(--text-main); font-size: 0.8rem; font-weight: 700; outline: none; }
        .location-select-wrap svg { color: var(--primary); }
 
        .date-picker-wrap { display: flex; align-items: center; gap: 6px; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 8px 12px; }
        .picker-label { font-size: 0.62rem; font-weight: 800; color: var(--text-dim); }
        .date-picker-wrap input { background: transparent; border: none; color: var(--primary); font-size: 0.82rem; font-weight: 800; outline: none; cursor: pointer; }
        .date-picker-wrap svg { color: var(--text-dim); }

        .btn-refresh { background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-dim); padding: 9px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; }
        .btn-refresh:hover { color: var(--primary); border-color: var(--primary); }

        .alert { display: flex; align-items: center; gap: 10px; padding: 12px 20px; font-size: 0.82rem; font-weight: 700; margin-bottom: 20px; }
        .alert-error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; }
        .alert-success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; }

        .status-strip { display: flex; justify-content: space-between; align-items: center; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 16px 24px; margin-bottom: 24px; }
        .status-badge-container { display: flex; align-items: center; gap: 8px; }
        .status-label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 800; padding: 4px 10px; }
        .badge-open { color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3); background: rgba(249, 115, 22, 0.05); }
        .badge-closed { color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05); }
        
        .amount-stat { display: flex; flex-direction: column; gap: 2px; }
        .amount-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .amount-value { font-size: 1.25rem; font-weight: 900; color: #10b981; }

        .btn-close-day { background: var(--primary); color: white; border: none; padding: 10px 18px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-close-day:hover:not(:disabled) { background: #ea580c; transform: translateY(-1px); }
        .btn-close-day:disabled { opacity: 0.4; cursor: not-allowed; }

        .tabs-header { display: flex; border-bottom: 1px solid var(--border-main); margin-bottom: 20px; }
        .tab-link { background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-dim); font-size: 0.72rem; font-weight: 800; padding: 12px 24px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .tab-link:hover { color: var(--text-main); }
        .tab-link.active { color: var(--primary); border-bottom-color: var(--primary); }
        .tab-status { display: inline-flex; align-items: center; }
        .tab-status.verified { color: #10b981; }
        .tab-status.warning { color: #f59e0b; }

        .data-panel { border: 1px solid var(--border-main); background: var(--bg-sidebar); padding: 24px; }
        .panel-header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .panel-header-section h3 { font-size: 0.95rem; font-weight: 800; color: var(--text-main); }
        
        .manual-add-controls { display: flex; align-items: center; gap: 12px; }
        .btn-primary { background: var(--primary); color: white; border: none; padding: 6px 12px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-primary:hover { opacity: 0.9; }

        .manual-tag { font-size: 0.55rem; font-weight: 900; background: var(--primary); color: white; padding: 1px 4px; margin-left: 8px; vertical-align: middle; border-radius: 2px; }

        .btn-edit-tab { background: transparent; border: 1px solid var(--border-main); color: var(--text-muted); font-size: 0.65rem; font-weight: 800; padding: 4px 10px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 4px; }
        .btn-edit-tab:hover { color: var(--primary); border-color: var(--primary); }
 
        .table-wrapper { border: 1px solid var(--border-main); margin-bottom: 16px; }
        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.82rem; color: var(--text-muted); vertical-align: middle; }
        .sharp-table tr:hover { background: var(--row-hover); }

        .price-display-wrapper { font-weight: 700; color: var(--text-main); }
        
        .price-input-container { position: relative; display: inline-flex; align-items: center; }
        .currency { position: absolute; left: 10px; color: var(--text-dim); font-weight: 700; font-size: 0.8rem; }
        .table-input { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 6px 8px 6px 20px; font-size: 0.8rem; font-weight: 700; outline: none; width: 100px; transition: 0.2s; }
        .table-input:focus { border-color: var(--primary); background: #ffffff; color: #000000; }
        .price-box-input { width: 120px; }
        .qty-box-input { width: 80px; padding-left: 8px; }
        .input-warning { border-color: #f59e0b !important; }
        .warning-indicator { margin-left: 8px; color: #f59e0b; display: flex; align-items: center; }

        .badge-type { font-size: 0.62rem; font-weight: 800; padding: 2px 6px; border: 1px solid; }
        .badge-type.bom { color: #a855f7; border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.05); }
        .badge-type.direct { color: #3b82f6; border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.05); }

        .font-numeric { font-family: monospace; font-weight: 800; font-size: 0.85rem; color: #10b981; }
        .text-right { text-align: right; }
        .empty-row { padding: 40px !important; text-align: center; color: var(--text-dim); }

        .panel-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
        .btn-confirm-tab { background: #10b981; color: white; border: none; padding: 10px 20px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-confirm-tab:hover:not(:disabled) { background: #059669; }
        .btn-confirm-tab:disabled { opacity: 0.5; cursor: not-allowed; }
 
        /* Online Tab */
        .online-form-container { max-width: 480px; }
        .metadata-card { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-main); padding: 16px; margin-bottom: 24px; }
        .meta-item { display: flex; flex-direction: column; gap: 4px; }
        .meta-item .label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .meta-item .value { font-size: 1rem; font-weight: 900; color: var(--primary); }

        .form-group-online { margin-bottom: 24px; }
        .form-group-online label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); margin-bottom: 12px; letter-spacing: 0.5px; }
        
        .closed-online-value { display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); padding: 10px 20px; color: #10b981; font-weight: 900; font-size: 1.25rem; }
        
        .price-input-large { position: relative; display: flex; align-items: center; max-width: 240px; }
        .price-input-large .currency { left: 16px; font-size: 1.1rem; }
        .price-input-large input { width: 100%; background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px 12px 12px 32px; font-size: 1.1rem; font-weight: 900; outline: none; transition: 0.2s; }
        .price-input-large input:focus { border-color: var(--primary); background: #ffffff; color: #000000; }
        .btn-online-save { width: 100%; max-width: 240px; justify-content: center; }

        /* Modal styling */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 500px; padding: 32px; position: relative; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-content h2 { margin-bottom: 24px; font-size: 1.25rem; font-weight: 800; }
        .standard-form .form-group { margin-bottom: 20px; }
        .standard-form label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; font-size: 0.85rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }
        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover { background: #ea580c; }

        .b2c-reported-inputs-banner {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-main);
          padding: 16px;
          margin-bottom: 20px;
        }
        .reported-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .reported-input-group label {
          font-size: 0.6rem;
          font-weight: 800;
          color: var(--text-dim);
          letter-spacing: 0.5px;
        }
        .reported-input-field {
          background: var(--bg-main);
          border: 1px solid var(--border-main);
          color: var(--text-main);
          padding: 10px 12px;
          font-size: 0.95rem;
          font-weight: 700;
          outline: none;
          transition: 0.2s;
        }
        .reported-input-field:focus {
          border-color: var(--primary);
        }
        .reported-value-display {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-main);
          padding: 8px 0;
        }
        .reported-value-display.difference.mismatch {
          color: #ef4444;
        }
        .reported-value-display.difference.matched {
          color: #10b981;
        }
      `}</style>
    </MainLayout>
  );
};

export default RevenuePage;
