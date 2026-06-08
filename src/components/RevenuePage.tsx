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
  X,
  Loader2
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { revenueApi, userApi, bomApi, menuApi, functionOrderApi } from '../services/api';

type TabType = 'b2b' | 'b2c' | 'online' | 'event_orders' | 'cash_closure';

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
  // BUG-R2: Styled closure confirmation modal
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

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

  // New Event Orders & Cash Closure States
  const [functionOrders, setFunctionOrders] = useState<any[]>([]);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settlingFo, setSettlingFo] = useState<any>(null);
  const [settleForm, setSettleForm] = useState({
    paymentMode: 'UPI' as 'Cash' | 'UPI' | 'Card' | 'Bank Transfer',
    paymentAmount: 0
  });

  const [cashClosureData, setCashClosureData] = useState<any>(null);
  const [cashExpenses, setCashExpenses] = useState<any[]>([]);
  const [cashForm, setCashForm] = useState({
    advanceCashTaken: 0,
    cashDepositedToBank: 0,
    cashInHand: 0
  });

  const fetchFoAndClosure = async () => {
    const targetLoc = isAdminRole() ? selectedLocationId : currentUser?._id;
    if (!targetLoc) return;

    try {
      const foRes = await functionOrderApi.getAll();
      const foList = (foRes.data.data || []).filter((fo: any) => fo.centerId === targetLoc || !fo.centerId);
      setFunctionOrders(foList);

      const closureRes = await revenueApi.getCashClosure(selectedDate, isAdminRole() ? targetLoc : undefined);
      if (closureRes.data.success) {
        const record = closureRes.data.data.record;
        const exps = closureRes.data.data.expenses || [];
        setCashClosureData(record.cashClosure);
        setCashExpenses(exps);
        setCashForm({
          advanceCashTaken: record.cashClosure?.advanceCashTaken || 0,
          cashDepositedToBank: record.cashClosure?.cashDepositedToBank || 0,
          cashInHand: record.cashClosure?.cashInHand || 0
        });
      }
    } catch (err: any) {
      console.error("Error fetching FO or Cash Closure:", err);
    }
  };

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
  const [isRateAutoResolved, setIsRateAutoResolved] = useState(false);

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
        if (targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT' || targetUserRole === 'AGGREGATE') {
          fetchFoAndClosure();
        }
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
  const closeB2cModal = () => {
    setMB2cItemId('');
    setMB2cStock(0);
    setMB2cQty(0);
    setMB2cRate(0);
    setIsRateAutoResolved(false);
    setIsB2cModalOpen(false);
  };

  const handleMB2cSelect = (itemVal: string) => {
    setMB2cItemId(itemVal);
    if (!itemVal) {
      setMB2cRate(0);
      setMB2cStock(0);
      setIsRateAutoResolved(false);
      return;
    }
    const [id, type] = itemVal.split('|');
    const targetLoc = isAdminRole() ? selectedLocationId : currentUser?._id;

    if (type === 'BOM') {
      let rateDoc = rates.find(r => r.bom?._id === id && (r.center?._id === targetLoc || r.center === targetLoc));
      if (!rateDoc) {
        rateDoc = rates.find(r => r.bom?._id === id && !r.center);
      }
      const price = rateDoc ? (rateDoc.centerRate || rateDoc.rate || 0) : 0;
      setMB2cRate(price);
      setIsRateAutoResolved(price > 0);
      setMB2cStock(0);
    } else {
      const selected = allMenus.find(m => m._id === id);
      const price = selected ? (selected.mrpPrice || 0) : 0;
      setMB2cRate(price);
      setIsRateAutoResolved(price > 0);
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

    closeB2cModal();
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
  const handleConfirmTab = async (tabType: TabType, isDraft: boolean = false) => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      let salesData: any = null;
      if (tabType === 'b2b') {
        // Validate unit prices
        const invalid = b2bItems.find(item => !item.unitPrice || item.unitPrice <= 0);
        if (invalid && b2bItems.length > 0 && !isDraft) {
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
        isDraft,
        centerId: isAdminRole() ? selectedLocationId : undefined
      });

      if (isDraft) {
        setSuccess(`${tabType.toUpperCase()} sales draft saved successfully.`);
        if (tabType === 'b2b') setLocalB2bConfirmed(false);
        if (tabType === 'b2c') setLocalB2cConfirmed(false);
        if (tabType === 'online') setLocalOnlineConfirmed(false);
      } else {
        setSuccess(`${tabType.toUpperCase()} sales details confirmed successfully.`);
        if (tabType === 'b2b') setLocalB2bConfirmed(true);
        if (tabType === 'b2c') setLocalB2cConfirmed(true);
        if (tabType === 'online') setLocalOnlineConfirmed(true);
      }

      const targetLoc = isAdminRole() ? selectedLocationId : currentUser._id;
      fetchDailyRevenue(targetLoc, selectedDate);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save sales data');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleCloseDay = async () => {
    // BUG-R2: confirmation is now handled by closeConfirmOpen modal, not window.confirm
    setCloseConfirmOpen(false);
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
  const hasOnline = (targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT') && targetOnlineEnabled;

  const isClosed = revenueRecord?.status === 'CLOSED';
  const isReadOnly = isClosed;

  // Check if all needed tabs are confirmed
  const b2bReady = !needsB2B || localB2bConfirmed;
  const b2cReady = !needsB2C || localB2cConfirmed;
  const onlineReady = !hasOnline || localOnlineConfirmed;
  const allTabsConfirmed = b2bReady && b2cReady && onlineReady;

  const isCashClosureNeeded = targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT';
  const cashClosureSubmitted = !isCashClosureNeeded || (revenueRecord?.cashClosure?.submittedForCOO || false);

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
            disabled={!allTabsConfirmed || (isCashClosureNeeded && !cashClosureSubmitted) || isSubmitting}
            onClick={() => setCloseConfirmOpen(true)}
          >
            <Lock size={14} /> CLOSE REVENUE FOR DAY
          </button>
        )}
      </div>

      {/* BUG-R2: Day Closure Confirmation Modal */}
      {closeConfirmOpen && (
        <div className="modal-overlay">
          <div className="close-day-modal">
            <div className="cdm-icon"><Lock size={24} /></div>
            <h2>LOCK DAILY REVENUE?</h2>
            <p className="cdm-warning">
              ⚠️ This action is <strong>permanent and irreversible</strong>. Once locked:
            </p>
            <ul className="cdm-list">
              <li>All revenue records for <strong>{selectedDate}</strong> will be frozen</li>
              <li>Inventory for <strong>Direct items sold</strong> will be automatically deducted</li>
              <li>No further changes can be made to this day's records</li>
            </ul>
            <div className="cdm-actions">
              <button 
                className="btn-cancel-modal"
                onClick={() => setCloseConfirmOpen(false)}
                disabled={isSubmitting}
              >
                <X size={14} /> CANCEL
              </button>
              <button 
                className="btn-confirm-close" 
                onClick={handleCloseDay}
                disabled={isSubmitting}
              >
                <Lock size={14} /> {isSubmitting ? 'LOCKING...' : 'LOCK REVENUE'}
              </button>
            </div>
          </div>
        </div>
      )}

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

        {(targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT') && (
          <button 
            className={`tab-link ${activeTab === 'event_orders' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('event_orders');
              fetchFoAndClosure();
            }}
          >
            EVENT ORDERS
            {functionOrders.some(fo => fo.status === 'PENDING_SETTLEMENT') && (
              <span className="tab-status warning"><AlertCircle size={10} /></span>
            )}
          </button>
        )}

        {(targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT') && (
          <button 
            className={`tab-link ${activeTab === 'cash_closure' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('cash_closure');
              fetchFoAndClosure();
            }}
          >
            CASH CLOSURE
            {cashClosureData?.submittedForCOO ? (
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
                  {b2bItems.length === 0 && !localB2bConfirmed && (
                    <tr>
                      <td colSpan={5} style={{padding:0}}>
                        <div className="empty-tab-warning">
                          <AlertCircle size={15} />
                          <span>
                            <strong>No dispatches planned in System for today.</strong>{' '}
                            If no dispatches were made, you may still confirm to lock this tab.
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {b2bItems.length === 0 && localB2bConfirmed && (
                    <tr>
                      <td colSpan={5} className="empty-row">No dispatches were recorded for this day.</td>
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
            {targetUserRole === 'AGGREGATE' ? (
              <div className="aggregator-receivable-card-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-main)',
                padding: '20px',
                marginBottom: '24px',
                alignItems: 'center'
              }}>
                <div className="receivable-stat">
                  <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Expected Gross Revenue</span>
                  <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>₹ {totalB2C.toFixed(2)}</strong>
                </div>
                <div className="receivable-stat">
                  <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>GST Deduction (5% Incl.)</span>
                  <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>- ₹ {((totalB2C / 1.05) * 0.05).toFixed(2)}</strong>
                </div>
                <div className="receivable-stat">
                  <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Commission ({currentUser?.aggregatorPercentage || 0}%)</span>
                  <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>- ₹ {(((currentUser?.aggregatorPercentage || 0) / 100) * totalB2C).toFixed(2)}</strong>
                </div>
                <div className="receivable-stat">
                  <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Daily Expenses</span>
                  <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>- ₹ {(cashExpenses.reduce((sum, exp) => sum + (exp.approvedAmount !== undefined ? exp.approvedAmount : exp.amount), 0)).toFixed(2)}</strong>
                </div>
                <div className="receivable-stat" style={{ borderLeft: '1px solid var(--border-main)', paddingLeft: '16px' }}>
                  <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Net Expected Receivable</span>
                  <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>
                    ₹ {(
                      totalB2C - 
                      ((totalB2C / 1.05) * 0.05) - 
                      (((currentUser?.aggregatorPercentage || 0) / 100) * totalB2C) - 
                      cashExpenses.reduce((sum, exp) => sum + (exp.approvedAmount !== undefined ? exp.approvedAmount : exp.amount), 0)
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
            ) : (
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
            )}

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
                  {b2cItems.length === 0 && !localB2cConfirmed && (
                    <tr>
                      <td colSpan={7} style={{padding:0}}>
                        <div className="empty-tab-warning">
                          <AlertCircle size={15} />
                          <span>
                            <strong>No dispatches planned in System for today.</strong>{' '}
                            No BOM dishes were received and no direct stock is available for this location.
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {b2cItems.length === 0 && localB2cConfirmed && (
                    <tr>
                      <td colSpan={7} className="empty-row">No B2C items were recorded for this day.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!localB2cConfirmed && !isReadOnly && (
              <div className="panel-actions">
                <button 
                  className="btn-confirm-tab" 
                  onClick={() => handleConfirmTab('b2c')} 
                  disabled={isSubmitting}
                >
                  <Save size={14} /> SAVE
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

        {/* ─── EVENT ORDERS TAB ──────────────────────────────────── */}
        {activeTab === 'event_orders' && (targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT') && (
          <div className="tab-panel">
            <div className="panel-header-section">
              <h3>Event / Party Orders</h3>
            </div>
            
            <div className="table-wrapper">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>ORDER CODE</th>
                    <th>EVENT DATE</th>
                    <th>DESCRIPTION</th>
                    <th>TOTAL VALUE</th>
                    <th>ADVANCE PAID</th>
                    <th>PENDING RECEIVABLE</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {functionOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-row">No function orders found for this location.</td>
                    </tr>
                  ) : (
                    functionOrders.map((fo) => {
                      const netReceivable = fo.totalOrderValue - fo.advanceAmount - (fo.finalPaymentAmount || 0);
                      return (
                        <tr key={fo._id}>
                          <td><strong>{fo.foCode}</strong></td>
                          <td>{new Date(fo.eventDate).toLocaleDateString()}</td>
                          <td>{fo.description}</td>
                          <td className="font-numeric">₹ {fo.totalOrderValue.toFixed(2)}</td>
                          <td className="font-numeric">₹ {fo.advanceAmount.toFixed(2)}</td>
                          <td className="font-numeric" style={{ color: netReceivable > 0 ? '#ef4444' : '#10b981' }}>
                            ₹ {netReceivable.toFixed(2)}
                          </td>
                          <td>
                            <span className={`status-pill status-${fo.status.toLowerCase().replace('_', '')}`} style={{ fontSize: '0.65rem', padding: '3px 8px' }}>
                              {fo.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {['REQUEST_PLACED', 'DELIVERED', 'PENDING_SETTLEMENT'].includes(fo.status) ? (
                              <button 
                                className="btn-primary" 
                                style={{ padding: '6px 12px', fontSize: '0.65rem' }}
                                onClick={() => {
                                  setSettlingFo(fo);
                                  setSettleForm({
                                    paymentMode: 'UPI',
                                    paymentAmount: Math.max(0, fo.totalOrderValue - fo.advanceAmount)
                                  });
                                  setSettleModalOpen(true);
                                }}
                              >
                                CONFIRM SETTLEMENT
                              </button>
                            ) : fo.status === 'SETTLED' ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                Settled ({fo.finalPaymentMode})
                              </span>
                            ) : fo.status === 'CLOSED' ? (
                              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 'bold' }}>
                                Closed & Reconciled
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                Placed / In Progress
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── CASH CLOSURE TAB ──────────────────────────────────── */}
        {activeTab === 'cash_closure' && (targetUserRole === 'CENTERS' || targetUserRole === 'RESTAURANT') && (
          <div className="tab-panel">
            {!localB2cConfirmed && (
              <div className="empty-tab-warning" style={{ marginBottom: '20px', borderLeftColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}>
                <AlertCircle size={15} />
                <span>
                  <strong>B2C Counter Sales are unconfirmed!</strong> Please confirm B2C Counter Sales first to compute correct expected cash.
                </span>
              </div>
            )}

            <div className="panel-header-section">
              <h3>Daily Cash Closure</h3>
              {cashClosureData?.submittedForCOO && (
                <span className="badge badge-closed"><Lock size={12} /> SUBMITTED TO COO</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              {/* Left Column: Computed Cash Flow Summary */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-main)', padding: '20px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '16px', letterSpacing: '0.5px' }}>
                  EXPECTED CASH INFLOWS & OUTFLOWS
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(+) Prev Day Cash in Hand</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>₹ {(cashClosureData?.prevDayCashInHand || 0).toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(+) Today's Cash Food Sales</span>
                    <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>₹ {(cashClosureData?.cashFoodSales || 0).toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(+) Event Advance Cash Received</span>
                    <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>₹ {(cashClosureData?.advancePaymentsReceived || 0).toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(+) Event Final Cash Settled</span>
                    <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>₹ {(cashClosureData?.functionOrderFinalPayments || 0).toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(-) Today's Cash Expenses</span>
                    <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>₹ {(cashClosureData?.cashExpenses || 0).toFixed(2)}</strong>
                  </div>
                  
                  {/* Expense Breakdowns */}
                  {cashExpenses.length > 0 && (
                    <div style={{ paddingLeft: '16px', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderLeft: '2px solid var(--border-main)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      {cashExpenses.map((exp: any) => (
                        <div key={exp._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                          <span>• {exp.description || exp.category}</span>
                          <span>₹ {(exp.approvedAmount !== undefined ? exp.approvedAmount : exp.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(+) Advance Cash Taken</span>
                    <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>₹ {(cashForm.advanceCashTaken || 0).toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(-) Cash to Bank</span>
                    <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>₹ {(cashForm.cashDepositedToBank || 0).toFixed(2)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-main)', paddingTop: '12px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>EXPECTED CASH IN HAND</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                      ₹ {((cashClosureData?.prevDayCashInHand || 0) + (cashClosureData?.cashFoodSales || 0) + (cashClosureData?.advancePaymentsReceived || 0) + (cashClosureData?.functionOrderFinalPayments || 0) - (cashClosureData?.cashExpenses || 0) + (Number(cashForm.advanceCashTaken) || 0) - (Number(cashForm.cashDepositedToBank) || 0)).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Right Column: Manual Entry Fields */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-main)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>
                  MANUAL DISBURSEMENTS & CLOSING CASH
                </h4>

                <div className="standard-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Advance Cash Taken (₹)</label>
                    <input
                      type="number"
                      value={cashForm.advanceCashTaken || ''}
                      onChange={(e) => setCashForm({ ...cashForm, advanceCashTaken: parseFloat(e.target.value) || 0 })}
                      disabled={cashClosureData?.submittedForCOO || isReadOnly || !localB2cConfirmed}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Cash to Bank (₹)</label>
                    <input
                      type="number"
                      value={cashForm.cashDepositedToBank || ''}
                      onChange={(e) => setCashForm({ ...cashForm, cashDepositedToBank: parseFloat(e.target.value) || 0 })}
                      disabled={cashClosureData?.submittedForCOO || isReadOnly || !localB2cConfirmed}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px', marginBottom: 0 }}>
                      Fill the amount that will be deposited from Cash to Bank account.
                    </p>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Actual Cash In Hand (₹)</label>
                    <input
                      type="number"
                      value={cashForm.cashInHand || ''}
                      onChange={(e) => setCashForm({ ...cashForm, cashInHand: parseFloat(e.target.value) || 0 })}
                      disabled={cashClosureData?.submittedForCOO || isReadOnly || !localB2cConfirmed}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Closing computations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <span>Declared Cash In Hand:</span>
                    <strong>₹ {(Number(cashForm.cashInHand) || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <span>Computed Expected Cash:</span>
                    <strong>
                      ₹ {((cashClosureData?.prevDayCashInHand || 0) + (cashClosureData?.cashFoodSales || 0) + (cashClosureData?.advancePaymentsReceived || 0) + (cashClosureData?.functionOrderFinalPayments || 0) - (cashClosureData?.cashExpenses || 0) + (Number(cashForm.advanceCashTaken) || 0) - (Number(cashForm.cashDepositedToBank) || 0)).toFixed(2)}
                    </strong>
                  </div>
                  
                  {/* Difference */}
                  {(() => {
                    const expected = (cashClosureData?.prevDayCashInHand || 0) + (cashClosureData?.cashFoodSales || 0) + (cashClosureData?.advancePaymentsReceived || 0) + (cashClosureData?.functionOrderFinalPayments || 0) - (cashClosureData?.cashExpenses || 0) + (Number(cashForm.advanceCashTaken) || 0) - (Number(cashForm.cashDepositedToBank) || 0);
                    const diff = ((Number(cashForm.cashInHand) || 0) - (Number(cashForm.cashDepositedToBank) || 0)) - expected;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginTop: '4px' }}>
                        <span>DIFFERENCE:</span>
                        <span style={{ color: diff === 0 ? '#10b981' : '#ef4444' }}>
                          ₹ {diff.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Closure actions */}
                {!cashClosureData?.submittedForCOO && !isReadOnly && localB2cConfirmed && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button 
                      className="btn-confirm-tab" 
                      style={{ flex: 1, justifySelf: 'stretch', background: 'var(--primary)', justifyContent: 'center' }}
                      onClick={async () => {
                        try {
                          setIsSubmitting(true);
                          setError('');
                          const targetLoc = isAdminRole() ? selectedLocationId : undefined;
                          await revenueApi.saveCashClosure({
                            date: selectedDate,
                            data: cashForm,
                            locationId: targetLoc
                          });
                          setSuccess('Cash Closure saved successfully!');
                          await fetchFoAndClosure();
                          setTimeout(() => setSuccess(''), 3000);
                        } catch (err: any) {
                          setError(err.response?.data?.error || 'Failed to save cash closure');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <Save size={14} /> SAVE FIGURES
                    </button>
                    
                    <button 
                      className="btn-confirm-tab" 
                      style={{ flex: 1, justifySelf: 'stretch', background: '#a855f7', justifyContent: 'center' }}
                      onClick={async () => {
                        if (!window.confirm("Are you sure you want to submit today's Cash Closure for COO Approval? This will lock all cash figures!")) {
                          return;
                        }
                        try {
                          setIsSubmitting(true);
                          setError('');
                          const targetLoc = isAdminRole() ? selectedLocationId : undefined;
                          await revenueApi.submitCashClosure({
                            date: selectedDate,
                            locationId: targetLoc
                          });
                          setSuccess('Cash Closure submitted for COO approval!');
                          await fetchFoAndClosure();
                          const finalLoc = isAdminRole() ? selectedLocationId : currentUser?._id;
                          if (finalLoc) fetchDailyRevenue(finalLoc, selectedDate);
                          setTimeout(() => setSuccess(''), 3000);
                        } catch (err: any) {
                          setError(err.response?.data?.error || 'Failed to submit cash closure');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      SUBMIT FOR APPROVAL
                    </button>
                  </div>
                )}
              </div>
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
            <button className="close-btn" onClick={closeB2cModal}><X size={20} /></button>
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
                  disabled={isRateAutoResolved}
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
        .empty-tab-warning { display: flex; align-items: flex-start; gap: 12px; padding: 16px 20px; background: rgba(245,158,11,0.06); border-left: 3px solid #f59e0b; color: #f59e0b; font-size: 0.82rem; }
        .empty-tab-warning strong { color: var(--text-main); }
        .empty-tab-warning svg { flex-shrink: 0; margin-top: 1px; }

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

        /* BUG-R2 — Close Day Confirmation Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(6px); }
        .close-day-modal { background: var(--bg-sidebar); border: 1px solid rgba(239,68,68,0.4); width: 100%; max-width: 480px; padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .cdm-icon { width: 56px; height: 56px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); display: flex; align-items: center; justify-content: center; color: #ef4444; }
        .close-day-modal h2 { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.5px; color: #ef4444; }
        .cdm-warning { font-size: 0.85rem; color: var(--text-dim); text-align: center; }
        .cdm-warning strong { color: var(--text-main); }
        .cdm-list { list-style: none; padding: 0; width: 100%; background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.12); padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
        .cdm-list li { font-size: 0.8rem; color: var(--text-dim); padding-left: 12px; position: relative; }
        .cdm-list li::before { content: '▸'; position: absolute; left: 0; color: #ef4444; }
        .cdm-list li strong { color: var(--text-main); }
        .cdm-actions { display: flex; gap: 12px; width: 100%; margin-top: 8px; }
        .btn-cancel-modal { flex: 1; background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-cancel-modal:hover:not(:disabled) { border-color: var(--text-main); color: var(--text-main); }
        .btn-confirm-close { flex: 2; background: #ef4444; border: none; color: white; padding: 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-confirm-close:hover:not(:disabled) { background: #dc2626; }
        .btn-confirm-close:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      {/* Settle Function Order Modal */}
      {settleModalOpen && settlingFo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <button className="close-btn" onClick={() => setSettleModalOpen(false)}><X size={20} /></button>
            <div className="modal-tag" style={{ color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' }}>
              <DollarSign size={12} /> SETTLE FUNCTION ORDER
            </div>
            <h2>Confirm Party Settlement</h2>
            {error && <div className="error-message">{error}</div>}

            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px', marginBottom: '16px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Order:</span> <strong>{settlingFo.foCode}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Total Value:</span> <strong>₹ {settlingFo.totalOrderValue.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Advance Paid:</span> <strong>₹ {settlingFo.advanceAmount.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-main)', paddingTop: '6px', marginTop: '6px', color: 'var(--text-main)' }}>
                  <span>Net Receivable:</span> <strong>₹ {(settlingFo.totalOrderValue - settlingFo.advanceAmount).toFixed(2)}</strong>
                </div>
              </div>

              <div className="standard-form">
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select
                    value={settleForm.paymentMode}
                    onChange={(e) => setSettleForm({ ...settleForm, paymentMode: e.target.value as any })}
                  >
                    <option value="Cash" disabled={revenueRecord?.cashClosure?.submittedForCOO === true}>
                      Cash {revenueRecord?.cashClosure?.submittedForCOO === true ? '(Disabled - Cash Closure Submitted)' : ''}
                    </option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                {revenueRecord?.cashClosure?.submittedForCOO === true && settleForm.paymentMode === 'Cash' && (
                  <div className="error-message" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '10px', fontSize: '0.72rem', marginTop: '-8px', marginBottom: '12px' }}>
                    ⚠️ Today's Cash Closure has already been submitted to the COO. You cannot choose Cash payment for settlement. Please select another mode.
                  </div>
                )}

                <div className="form-group">
                  <label>Payment Amount Received (₹)</label>
                  <input
                    type="number"
                    value={settleForm.paymentAmount || ''}
                    onChange={(e) => setSettleForm({ ...settleForm, paymentAmount: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="cdm-actions">
              <button className="btn-cancel-modal" onClick={() => setSettleModalOpen(false)} disabled={isSubmitting}>
                <X size={14} /> CANCEL
              </button>
              <button 
                className="btn-confirm-close" 
                style={{ background: '#a855f7' }} 
                onClick={async () => {
                  if (settleForm.paymentMode === 'Cash' && revenueRecord?.cashClosure?.submittedForCOO === true) {
                    setError("Cash Closure is already submitted. Cash settlement is blocked.");
                    return;
                  }
                  setIsSubmitting(true);
                  setError('');
                  try {
                    await functionOrderApi.settle(settlingFo._id, settleForm);
                    setSuccess('Function order settled successfully!');
                    setSettleModalOpen(false);
                    await fetchFoAndClosure();
                    const finalLoc = isAdminRole() ? selectedLocationId : currentUser?._id;
                    if (finalLoc) fetchDailyRevenue(finalLoc, selectedDate);
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Failed to settle order');
                  } finally {
                    setIsSubmitting(false);
                  }
                }} 
                disabled={isSubmitting || (settleForm.paymentMode === 'Cash' && revenueRecord?.cashClosure?.submittedForCOO === true)}
              >
                {isSubmitting ? <Loader2 size={14} className="spin" /> : <DollarSign size={14} />}
                {isSubmitting ? 'SETTLING...' : 'CONFIRM SETTLEMENT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default RevenuePage;
