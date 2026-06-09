import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Landmark, 
  Calendar as CalendarIcon, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  Lock, 
  Unlock, 
  ShieldAlert,
  Building2,
  TrendingUp,
  Package,
  FileText
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import BillViewModal from './BillViewModal';
import { financeApi, userApi, bankApi, purchaseApi, functionOrderApi } from '../services/api';

type TopTabType = 'dashboard' | 'location' | 'banks' | 'function_orders';
type LogTabType = 'b2c' | 'b2b' | 'stock_purchases';

const FinancePage: React.FC = () => {
  const routerLocation = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TopTabType>('location');
  const [logTab, setLogTab] = useState<LogTabType>('b2c');
  const [foSubTab, setFoSubTab] = useState<'advances' | 'final_payments' | 'all_orders'>('advances');
  const [pendingAdvances, setPendingAdvances] = useState<any[]>([]);
  const [pendingFinalPayments, setPendingFinalPayments] = useState<any[]>([]);
  const [allFunctionOrders, setAllFunctionOrders] = useState<any[]>([]);
  const [foNotes, setFoNotes] = useState<Record<string, string>>({});
  
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  
  // Dashboard rollups & logs
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [locationLogs, setLocationLogs] = useState<any[]>([]);
  
  // Bank List states
  const [banksList, setBanksList] = useState<any[]>([]);

  // Expandable log card state (tracks which daily log date string is expanded)
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Local verification edits state indexed by date
  const [localVerification, setLocalVerification] = useState<Record<string, any>>({});

  const [bankDetails, setBankDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Stock Purchases bills list
  const [bills, setBills] = useState<any[]>([]);
  // Stock purchases sub-tab filters
  const [stockDateFilter, setStockDateFilter] = useState<string>('');
  // Selected bill for view modal (Finance view)
  const [selectedBillForView, setSelectedBillForView] = useState<any | null>(null);

  const fetchBills = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await purchaseApi.getBills();
      setBills(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch vendor bills');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkBillPaid = async (billId: string) => {
    if (!window.confirm("Mark this vendor bill as PAID?")) return;
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await purchaseApi.updateBill(billId, { paymentStatus: 'PAID' });
      setSuccess('Bill marked as paid successfully!');
      fetchBills();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update bill payment status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchPendingFunctionOrders = async () => {
    try {
      setIsLoading(true);
      setError('');
      // Fetch ALL function orders so acknowledged ones remain visible
      const res = await functionOrderApi.getAll();
      const all: any[] = res.data.data || [];
      setAllFunctionOrders(all);
      // Advance pending = has advanceAmount but not yet finance-acknowledged
      setPendingAdvances(
        all.filter((o: any) => (o.advanceAmount > 0) && !o.advanceFinanceAcknowledged)
      );
      // Final payment pending = settled/closed but finance not yet acknowledged
      setPendingFinalPayments(
        all.filter((o: any) => ['SETTLED', 'CLOSED'].includes(o.status) && !o.finalFinanceAcknowledged)
      );
    } catch (err) {
      console.error(err);
      setError('Failed to fetch function orders for reconciliation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledgeAdvance = async (orderId: string, note?: string) => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await functionOrderApi.acknowledgeAdvance(orderId, note);
      setSuccess('Advance payment acknowledged successfully!');
      fetchPendingFunctionOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge advance payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeFinalPayment = async (orderId: string, note?: string) => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await functionOrderApi.acknowledgeFinal(orderId, note);
      setSuccess('Final payment acknowledged successfully!');
      fetchPendingFunctionOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge final payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse parameters from search query
  const searchParams = new URLSearchParams(routerLocation.search);
  const tabParam = searchParams.get('tab') as TopTabType || 'location';
  const locIdParam = searchParams.get('locationId') || '';

  // Synchronize parameter changes with state
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
    if (locIdParam) {
      setSelectedLocationId(locIdParam);
    }
  }, [tabParam, locIdParam]);

  useEffect(() => {
    fetchInitialSetup();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
      fetchBills();
      fetchPendingFunctionOrders();
    } else if (activeTab === 'location' && selectedLocationId) {
      fetchLocationLogs(selectedLocationId);
    } else if (activeTab === 'banks') {
      fetchBanks();
    } else if (activeTab === 'function_orders') {
      fetchPendingFunctionOrders();
    }
  }, [activeTab, selectedLocationId]);

  // Fetch bills when switching to stock_purchases sub-tab inside location view
  useEffect(() => {
    if (activeTab === 'location' && logTab === 'stock_purchases') {
      fetchBills();
    }
  }, [logTab, activeTab]);

  const fetchInitialSetup = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const userRes = await userApi.getMe();
      const user = userRes.data.data;
      setCurrentUser(user);

      const entityId = user.role === 'SUPER_ADMIN' ? undefined : (user.entity?._id || user.entity);
      const locRes = await userApi.getLocations(entityId);
      const locs = locRes.data.data || [];
      const saleLocs = locs.filter((l: any) => 
        ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(l.role)
      );
      setLocations(saleLocs);
      
      if (locIdParam) {
        setSelectedLocationId(locIdParam);
      } else if (saleLocs.length > 0) {
        setSelectedLocationId(saleLocs[0]._id);
      }
    } catch (err: any) {
      setError('Failed to initialize Finance console');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setError('');
      const entityId = currentUser?.role === 'SUPER_ADMIN' ? undefined : (currentUser?.entity?._id || currentUser?.entity);
      const statsRes = await financeApi.getFinanceStats(entityId);
      setDashboardStats(statsRes.data.data);
    } catch (err) {
      setError('Failed to reload dashboard statistics');
    }
  };

  const fetchLocationLogs = async (locationId: string) => {
    try {
      setIsLoading(true);
      setError('');
      const entityId = currentUser?.role === 'SUPER_ADMIN' ? undefined : (currentUser?.entity?._id || currentUser?.entity);
      const res = await financeApi.getFinanceLocationDetails(locationId, entityId);
      const { records, bank } = res.data.data;
      setLocationLogs(records || []);
      setBankDetails(bank || null);
      setExpandedDate(null); // Reset expanded accordion day

      // Prepopulate verification inputs
      const initialVerifs: Record<string, any> = {};
      records.forEach((rec: any) => {
        initialVerifs[rec.date] = {
          cashDeposited: rec.verification?.cashDeposited || 0,
          onlinePayments: rec.verification?.onlinePayments || 0,
          onlineSalesReceivedAmount: rec.verification?.onlineSalesReceivedAmount || 0,
          onlineSalesCommission: rec.verification?.onlineSalesCommission || 0,
          aggregatorAmountReceived: rec.verification?.aggregatorAmountReceived || 0,
          aggregatorGstVerified: rec.verification?.aggregatorGstVerified || 0,
          aggregatorCommissionVerified: rec.verification?.aggregatorCommissionVerified || 0,
          remarks: rec.verification?.remarks || '',
          isAcknowledged: rec.verification?.isAcknowledged || false
        };
      });
      setLocalVerification(initialVerifs);
      
      const targetLoc = locations.find(l => l._id === locationId);
      if (targetLoc) {
        const hasB2C = ['CENTERS', 'AGGREGATE', 'RESTAURANT', 'RESORT'].includes(targetLoc.role);
        setLogTab(hasB2C ? 'b2c' : 'b2b');
      }
    } catch (err) {
      setError('Failed to fetch location records');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      setError('');
      const entityId = currentUser?.role === 'SUPER_ADMIN' ? undefined : (currentUser?.entity?._id || currentUser?.entity);
      const res = await bankApi.getAll(entityId);
      setBanksList(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch bank accounts');
    } finally {
      setIsLoading(false);
    }
  };


  const handleSaveVerification = async (dateStr: string, isAck: boolean = false) => {
    const inputs = localVerification[dateStr];
    if (!inputs) return;

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      await financeApi.saveFinanceVerification({
        locationId: selectedLocationId,
        date: dateStr,
        verificationData: {
          ...inputs,
          isAcknowledged: isAck
        }
      });

      setSuccess(isAck ? 'Daily log successfully Acknowledged & locked!' : 'Verification data saved successfully.');
      fetchLocationLogs(selectedLocationId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReconciliationMath = (record: any, verifInputs: any, role: string, isOnlineEnabled: boolean) => {
    if (role === 'AGGREGATE') {
      const reportedTotal = record.aggregatorTotalReceivable || 0;
      const verifiedTotal = Number(verifInputs?.aggregatorAmountReceived) || 0;
      const difference = reportedTotal - verifiedTotal;
      return {
        reportedTotal,
        verifiedTotal,
        difference
      };
    }

    const cashToBankExpected = record.cashClosure?.cashDepositedToBank || 0;
    const b2cOnlineExpected = record.reportedOnline || 0;
    const onlineSalesExpected = isOnlineEnabled ? (record.onlineSales?.totalSaleValue || 0) : 0;
    
    // For B2B/Restaurant locations, expect the B2B revenue
    const isB2B = ['KITCHEN', 'RESTAURANT'].includes(role);
    const b2bExpected = isB2B ? (record.b2bSales?.reduce((sum: number, item: any) => sum + (item.totalVal || 0), 0) || 0) : 0;

    const reportedTotal = cashToBankExpected + b2cOnlineExpected + onlineSalesExpected + b2bExpected;

    const cashDep = Number(verifInputs?.cashDeposited) || 0;
    const onlinePay = Number(verifInputs?.onlinePayments) || 0;
    const salesRecv = isOnlineEnabled ? (Number(verifInputs?.onlineSalesReceivedAmount) || 0) : 0;
    const onlineComm = isOnlineEnabled ? (Number(verifInputs?.onlineSalesCommission) || 0) : 0;
    
    const verifiedTotal = cashDep + onlinePay + salesRecv + onlineComm + b2bExpected;

    const difference = reportedTotal - verifiedTotal;

    return {
      reportedTotal,
      verifiedTotal,
      difference
    };
  };

  const selectedLoc = locations.find(l => l._id === selectedLocationId);
  const selectedLocRole = selectedLoc?.role || '';
  const isB2BLocation = ['KITCHEN', 'RESTAURANT'].includes(selectedLocRole);
  const isB2CLocation = ['CENTERS', 'AGGREGATE', 'RESTAURANT', 'RESORT'].includes(selectedLocRole);

  const getLogStatus = (rec: any) => {
    if (rec.status === 'OPEN') return { text: 'OPEN', class: 'status-open', icon: <Unlock size={12} /> };
    if (rec.verification?.isAcknowledged) return { text: 'ACKNOWLEDGED', class: 'status-ack', icon: <CheckCircle2 size={12} /> };
    if (rec.verification?.cashDeposited > 0 || rec.verification?.onlinePayments > 0 || rec.verification?.onlineSalesReceivedAmount > 0 || rec.verification?.aggregatorAmountReceived > 0) {
      return { text: 'ACKNOWLEDGEMENT PENDING', class: 'status-pending', icon: <Clock size={12} /> };
    }
    if (rec.cooApproved) return { text: 'PENDING RECONCILIATION', class: 'status-pending', icon: <Clock size={12} /> };
    return { text: 'USER CLOSED SALES', class: 'status-closed', icon: <Lock size={12} /> };
  };

  if (isLoading) return <ForgeLoader />;

  return (
    <MainLayout>
      <div className="finance-console">
        <header className="page-header">
          <div className="header-title">
            <h1>FINANCIAL CONSOLE</h1>
            <p className="subtitle">
              {activeTab === 'location' && `DAILY REVENUE LOGS: ${selectedLoc?.name?.toUpperCase() || ''}`}
            </p>
          </div>
        </header>

        {/* Top Navigation Tabs — only shown for location/function_orders; bank master & dashboard use sidebar */}
        {(activeTab === 'location' || activeTab === 'function_orders') && (
          <div className="tabs-header" style={{ display: 'flex', borderBottom: '1px solid var(--border-main)', marginBottom: '20px', flexWrap: 'wrap', gap: '4px' }}>
            <button 
              className={`tab-link ${activeTab === 'location' ? 'active' : ''}`}
              onClick={() => setActiveTab('location')}
              style={{ background: 'none', border: 'none', borderBottom: activeTab === 'location' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'location' ? 'var(--primary)' : 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 800, padding: '12px 20px', cursor: 'pointer' }}
            >
              SALES RECONCILIATION {selectedLoc ? `(${selectedLoc.name.toUpperCase()})` : ''}
            </button>

            <button 
              className={`tab-link ${activeTab === 'function_orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('function_orders')}
              style={{ background: 'none', border: 'none', borderBottom: activeTab === 'function_orders' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'function_orders' ? 'var(--primary)' : 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 800, padding: '12px 20px', cursor: 'pointer' }}
            >
              FUNCTION ORDERS
            </button>
          </div>
        )}

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

        {/* ─── TAB 1: FINANCIAL DASHBOARD ───────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="finance-tab-content">

            {/* ── ROW 0: Notification Bar ── */}
            {(() => {
              const pendingRecon = dashboardStats?.pendingReconciliations?.length || 0;
              const pendingStock = bills.filter((b: any) => b.paymentStatus !== 'PAID' && b.deliveryStatus === 'DELIVERED').length;
              const pendingFO = (pendingAdvances?.length || 0) + (pendingFinalPayments?.length || 0);
              const hasAlerts = pendingRecon > 0 || pendingStock > 0 || pendingFO > 0;
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', marginBottom: '20px',
                  background: hasAlerts ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
                  border: hasAlerts ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.25)',
                  borderRadius: '4px', flexWrap: 'wrap'
                }}>
                  {hasAlerts
                    ? <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
                    : <CheckCircle2 size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: hasAlerts ? '#f87171' : '#34d399', textTransform: 'uppercase' }}>
                    {hasAlerts ? 'Action Required' : 'All Clear'}
                  </span>
                  {pendingRecon > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 10px', borderRadius: '20px' }}>
                      {pendingRecon} Reconciliation{pendingRecon !== 1 ? 's' : ''} Pending
                    </span>
                  )}
                  {pendingStock > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 10px', borderRadius: '20px' }}>
                      {pendingStock} Stock Payment{pendingStock !== 1 ? 's' : ''} Due
                    </span>
                  )}
                  {pendingFO > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 10px', borderRadius: '20px' }}>
                      {pendingFO} Function Order{pendingFO !== 1 ? 's' : ''} Due
                    </span>
                  )}
                  {!hasAlerts && (
                    <span style={{ fontSize: '0.7rem', color: '#34d399' }}>No pending actions across all locations.</span>
                  )}
                </div>
              );
            })()}

            {/* ── ROW 1: 5 KPI Summary Cards (current week) ── */}
            {(() => {
              const now = new Date();
              const dayOfWeek = now.getDay(); // 0=Sun
              const startOfWeek = new Date(now);
              startOfWeek.setDate(now.getDate() - dayOfWeek);
              startOfWeek.setHours(0, 0, 0, 0);

              const pendingRecon = dashboardStats?.pendingReconciliations?.length || 0;
              const pendingStock = bills.filter((b: any) => b.paymentStatus !== 'PAID' && b.deliveryStatus === 'DELIVERED').length;
              const paidThisWeek = bills.filter((b: any) => b.paymentStatus === 'PAID' && new Date(b.updatedAt || b.createdAt) >= startOfWeek).length;
              const pendingFO = (pendingAdvances?.length || 0) + (pendingFinalPayments?.length || 0);
              const totalVerified = dashboardStats?.totalVerified || 0;

              const cards = [
                { label: 'Pending Reconciliations', value: pendingRecon, unit: 'entries', color: pendingRecon > 0 ? '#f87171' : '#34d399', icon: <Clock size={18} /> },
                { label: 'Stock Payments Due', value: pendingStock, unit: 'bills', color: pendingStock > 0 ? '#f59e0b' : '#34d399', icon: <Package size={18} /> },
                { label: 'Stock Bills Paid (This Week)', value: paidThisWeek, unit: 'bills', color: '#34d399', icon: <CheckCircle2 size={18} /> },
                { label: 'Function Orders Due', value: pendingFO, unit: 'orders', color: pendingFO > 0 ? '#818cf8' : '#34d399', icon: <FileText size={18} /> },
                { label: 'Total Verified Revenue', value: `₹ ${totalVerified.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, unit: '', color: '#f97316', icon: <DollarSign size={18} /> },
              ];

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '28px' }}>
                  {cards.map((card, i) => (
                    <div key={i} style={{
                      padding: '18px 16px',
                      background: 'var(--bg-card)',
                      border: `1.5px solid ${card.color}30`,
                      borderTop: `3px solid ${card.color}`,
                      display: 'flex', flexDirection: 'column', gap: '10px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.3 }}>{card.label}</span>
                        <span style={{ color: card.color, opacity: 0.75, flexShrink: 0, marginLeft: '6px' }}>{card.icon}</span>
                      </div>
                      <div style={{ fontSize: typeof card.value === 'string' ? '1.15rem' : '2.1rem', fontWeight: 900, color: card.color, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                        {card.value}
                      </div>
                      {card.unit && <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{card.unit}</span>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── ROW 2: Location-wise Stacked Horizontal Bar Chart + Summary Table ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* Chart panel */}
              <div style={{ padding: '22px', background: 'var(--bg-card)', border: '1px solid var(--border-main)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-main)' }}>
                  <TrendingUp size={15} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Pending Reconciliations by Location
                  </span>
                </div>
                {(() => {
                  if (!dashboardStats?.pendingReconciliations || dashboardStats.pendingReconciliations.length === 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '160px', gap: '8px' }}>
                        <CheckCircle2 size={32} style={{ color: '#34d399' }} />
                        <p style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 700 }}>All reconciled!</p>
                      </div>
                    );
                  }

                  // Group pending reconciliations by location
                  const byLoc: Record<string, { name: string; count: number; pending: number; total: number }> = {};
                  dashboardStats.pendingReconciliations.forEach((pr: any) => {
                    const key = pr.locationId;
                    if (!byLoc[key]) byLoc[key] = { name: pr.locationName, count: 0, pending: 0, total: 0 };
                    byLoc[key].count += 1;
                    byLoc[key].pending += Math.abs(pr.difference || 0);
                    byLoc[key].total += pr.reportedTotal || 0;
                  });

                  const locEntries = Object.values(byLoc);
                  const maxTotal = Math.max(...locEntries.map(l => l.total), 1);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {locEntries.map((loc, i) => {
                        const reconPct = (loc.pending / maxTotal) * 100;
                        const verifiedPct = ((loc.total - loc.pending) / maxTotal) * 100;
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-main)' }}>{loc.name.toUpperCase()}</span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 700 }}>{loc.count} pending</span>
                            </div>
                            <div style={{ display: 'flex', height: '18px', borderRadius: '2px', overflow: 'hidden', background: 'var(--bg-main)' }}>
                              <div style={{ width: `${verifiedPct}%`, background: '#10b981', transition: 'width 0.6s ease' }} title={`Verified: ₹${(loc.total - loc.pending).toFixed(0)}`} />
                              <div style={{ width: `${reconPct}%`, background: '#f87171', transition: 'width 0.6s ease' }} title={`Pending: ₹${loc.pending.toFixed(0)}`} />
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} />
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 700 }}>Verified</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', background: '#f87171', borderRadius: '2px' }} />
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 700 }}>Pending Reconciliation</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Summary table panel */}
              <div style={{ padding: '22px', background: 'var(--bg-card)', border: '1px solid var(--border-main)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-main)' }}>
                  <Building2 size={15} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Pending Items by Location
                  </span>
                </div>
                <table className="sharp-table" style={{ fontSize: '0.72rem' }}>
                  <thead>
                    <tr>
                      <th>LOCATION</th>
                      <th style={{ textAlign: 'center' }}>RECON</th>
                      <th style={{ textAlign: 'center' }}>STOCK PMT</th>
                      <th style={{ textAlign: 'center' }}>FO DUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc: any) => {
                      const reconCount = dashboardStats?.pendingReconciliations?.filter((pr: any) => pr.locationId === loc._id).length || 0;
                      const stockDue = bills.filter((b: any) => {
                        const destId = b.destinationLocation?._id || b.destinationLocation;
                        return destId === loc._id && b.paymentStatus !== 'PAID' && b.deliveryStatus === 'DELIVERED';
                      }).length;
                      const foDue = [...(pendingAdvances || []), ...(pendingFinalPayments || [])].filter((fo: any) => {
                        return fo.location === loc._id || fo.location?._id === loc._id;
                      }).length;
                      return (
                        <tr key={loc._id}>
                          <td><strong>{loc.name.toUpperCase()}</strong><br /><span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{loc.role}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            {reconCount > 0
                              ? <span style={{ color: '#f87171', fontWeight: 900 }}>{reconCount}</span>
                              : <span style={{ color: '#34d399' }}>✓</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {stockDue > 0
                              ? <span style={{ color: '#f59e0b', fontWeight: 900 }}>{stockDue}</span>
                              : <span style={{ color: '#34d399' }}>✓</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {foDue > 0
                              ? <span style={{ color: '#818cf8', fontWeight: 900 }}>{foDue}</span>
                              : <span style={{ color: '#34d399' }}>✓</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {locations.length === 0 && (
                      <tr>
                        <td colSpan={4} className="empty-state">No sale locations found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}


        {/* ─── TAB 2: REVENUE BY LOCATION (ACCORDION CARDS) ───────────────── */}
        {activeTab === 'location' && (
          <div className="location-detail-workspace-full">
            {selectedLoc ? (
              <>
                <header className="detail-header-card">
                  <div className="left-meta">
                    <span className="type-pill">{selectedLoc.role}</span>
                    <h2>{selectedLoc.name.toUpperCase()}</h2>
                    <p>{selectedLoc.email} • {selectedLoc.mobileNo || 'No contact'}</p>
                  </div>
                </header>

                <div className="sub-tabs-header">
                  {isB2CLocation && (
                    <button 
                      className={`sub-tab-btn ${logTab === 'b2c' ? 'active' : ''}`}
                      onClick={() => setLogTab('b2c')}
                    >
                      B2C Counter &amp; Online Sales
                    </button>
                  )}
                  {isB2BLocation && (
                    <button 
                      className={`sub-tab-btn ${logTab === 'b2b' ? 'active' : ''}`}
                      onClick={() => setLogTab('b2b')}
                    >
                      B2B Dispatches
                    </button>
                  )}
                  <button 
                    className={`sub-tab-btn ${logTab === 'stock_purchases' ? 'active' : ''}`}
                    onClick={() => setLogTab('stock_purchases')}
                  >
                    <Package size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                    Stock Purchases
                  </button>
                </div>

                <div className="logs-accordion-container">
                  {/* B2C logs rendered as accordion day cards */}
                  {logTab === 'b2c' && isB2CLocation && (
                    <div className="accordion-list">
                      {locationLogs.map((rec) => {
                        const verif = localVerification[rec.date] || {};
                        const isAck = rec.verification?.isAcknowledged;
                        const isOnlineEnabled = selectedLocRole !== 'AGGREGATE' && !!selectedLoc?.onlineSalesEnabled;
                        const math = getReconciliationMath(rec, verif, selectedLocRole, isOnlineEnabled);
                        const b2bTotal = rec.b2bSales?.reduce((s: number, item: any) => s + (item.totalVal || 0), 0) || 0;
                        const b2cExpected = rec.b2cSales?.reduce((s: number, item: any) => s + (item.totalVal || 0), 0) || 0;
                        const isExpanded = expandedDate === rec.date;
                        const statusMeta = getLogStatus(rec);

                        return (
                          <div key={rec._id} className={`accordion-day-card ${isAck ? 'card-acknowledged' : ''} ${isExpanded ? 'expanded' : ''}`}>
                            {/* Card Header */}
                            <header 
                              className="card-header-clickable"
                              onClick={() => setExpandedDate(isExpanded ? null : rec.date)}
                            >
                              <div className="left-info">
                                <CalendarIcon size={16} className="text-dim mr-2" />
                                <span className="day-date">{new Date(rec.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                <span className={`status-badge-custom ${statusMeta.class}`}>
                                  {statusMeta.icon}
                                  <span>{statusMeta.text}</span>
                                </span>
                              </div>
                              <div className="right-summary">
                                {rec.status === 'CLOSED' && (
                                  <div className="summary-math-preview">
                                    <span>Expected: <strong>₹ {math.reportedTotal.toFixed(2)}</strong></span>
                                    <span className="spacer-dash">|</span>
                                    <span>Verified: <strong>₹ {math.verifiedTotal.toFixed(2)}</strong></span>
                                    <span className="spacer-dash">|</span>
                                    <span className={`diff-preview ${math.difference !== 0 ? 'gap' : 'ok'}`}>
                                      Diff: <strong>₹ {math.difference.toFixed(2)}</strong>
                                    </span>
                                  </div>
                                )}
                                {isExpanded ? <ChevronDown size={18} className="text-dim" /> : <ChevronRight size={18} className="text-dim" />}
                              </div>
                            </header>

                            {/* Card Body */}
                            {isExpanded && (
                              <div className="card-expanded-body">
                                <div className="detail-boxes-grid">
                                  {/* Box 1: Reported Sales */}
                                  <div className="detail-data-box reported-box">
                                    <h3>REPORTED SALES (USER)</h3>
                                    {selectedLocRole === 'AGGREGATE' ? (
                                      <div className="box-fields-list">
                                        <div className="field-row">
                                          <span>Expected Gross Revenue</span>
                                          <strong>₹ {(rec.aggregatorExpectedRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div className="field-row">
                                          <span>GST Deduction (5%)</span>
                                          <strong>₹ {(rec.aggregatorGstDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div className="field-row">
                                          <span>Commission</span>
                                          <strong>₹ {(rec.aggregatorCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div className="field-row">
                                          <span>Daily Expenses</span>
                                          <strong>₹ {(rec.aggregatorExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div className="field-row divider-row">
                                          <span>Net Expected Receivable</span>
                                          <strong className="text-primary font-large">₹ {math.reportedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="box-fields-list">
                                        <div className="field-row">
                                          <span>B2C Expected Revenue</span>
                                          <strong>₹ {b2cExpected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div className="field-row">
                                          <span>Expected Cash to Bank</span>
                                          <strong>₹ {(rec.cashClosure?.cashDepositedToBank || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        <div className="field-row">
                                          <span>B2C Online Sales</span>
                                          <strong>₹ {(rec.reportedOnline || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                        {isOnlineEnabled && (
                                          <div className="field-row">
                                            <span>Online Sales Amount</span>
                                            <strong>₹ {(rec.onlineSales?.totalSaleValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                          </div>
                                        )}
                                        {isB2BLocation && (
                                          <div className="field-row">
                                            <span>B2B Total Revenue</span>
                                            <strong>₹ {b2bTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                          </div>
                                        )}
                                        <div className="field-row divider-row">
                                          <span>Expected Total</span>
                                          <strong className="text-primary font-large">₹ {math.reportedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Box 2: Verification */}
                                  <div className="detail-data-box verification-box">
                                    <h3>VERIFICATION DETAILS (FINANCE)</h3>
                                    
                                    {bankDetails && (
                                      <div style={{ 
                                        background: 'rgba(255,255,255,0.02)', 
                                        border: '1px solid var(--border-main)', 
                                        padding: '12px', 
                                        borderRadius: '4px', 
                                        marginBottom: '16px' 
                                      }}>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                                          Location Bank Account Info
                                        </div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                          {bankDetails.bankName} | A/C: {bankDetails.accountNumber}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                                          IFSC: {bankDetails.ifscCode} {bankDetails.branchName ? `| Branch: ${bankDetails.branchName}` : ''}
                                        </div>
                                      </div>
                                    )}

                                    {isAck ? (
                                      <div className="box-fields-list">
                                        {selectedLocRole === 'AGGREGATE' ? (
                                          <>
                                            <div className="field-row">
                                              <span>Payout Received</span>
                                              <strong>₹ {(verif.aggregatorAmountReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            <div className="field-row">
                                              <span>GST Verified</span>
                                              <strong>₹ {(verif.aggregatorGstVerified || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            <div className="field-row">
                                              <span>Commission Verified</span>
                                              <strong>₹ {(verif.aggregatorCommissionVerified || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="field-row">
                                              <span>Cash Deposited</span>
                                              <strong>₹ {(verif.cashDeposited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            <div className="field-row">
                                              <span>Online B2C Clearing</span>
                                              <strong>₹ {(verif.onlinePayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            {isOnlineEnabled && (
                                              <>
                                                <div className="field-row">
                                                  <span>Online Payout Received</span>
                                                  <strong>₹ {(verif.onlineSalesReceivedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                                <div className="field-row">
                                                  <span>Online Sales Commission</span>
                                                  <strong>₹ {(verif.onlineSalesCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                              </>
                                            )}
                                            <div className="field-row">
                                              <span>Approved Expenses</span>
                                              <strong>₹ {(rec.approvedExpensesAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                          </>
                                        )}
                                        <div className="field-row divider-row">
                                          <span>Verified Total</span>
                                          <strong className="font-large">₹ {math.verifiedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="verification-form-inputs">
                                        {selectedLocRole === 'AGGREGATE' ? (
                                          <>
                                            <div className="input-group-finance">
                                              <label>Payout Received (₹)</label>
                                              <input 
                                                type="number"
                                                value={verif.aggregatorAmountReceived || ''}
                                                onChange={e => setLocalVerification({
                                                  ...localVerification,
                                                  [rec.date]: {
                                                    ...verif,
                                                    aggregatorAmountReceived: parseFloat(e.target.value) || 0
                                                  }
                                                })}
                                                placeholder="0.00"
                                                disabled={rec.status === 'OPEN'}
                                              />
                                            </div>
                                            <div className="input-group-finance">
                                              <label>GST Verified (₹)</label>
                                              <input 
                                                type="number"
                                                value={verif.aggregatorGstVerified || ''}
                                                onChange={e => setLocalVerification({
                                                  ...localVerification,
                                                  [rec.date]: {
                                                    ...verif,
                                                    aggregatorGstVerified: parseFloat(e.target.value) || 0
                                                  }
                                                })}
                                                placeholder="0.00"
                                                disabled={rec.status === 'OPEN'}
                                              />
                                            </div>
                                            <div className="input-group-finance">
                                              <label>Commission Verified (₹)</label>
                                              <input 
                                                type="number"
                                                value={verif.aggregatorCommissionVerified || ''}
                                                onChange={e => setLocalVerification({
                                                  ...localVerification,
                                                  [rec.date]: {
                                                    ...verif,
                                                    aggregatorCommissionVerified: parseFloat(e.target.value) || 0
                                                  }
                                                })}
                                                placeholder="0.00"
                                                disabled={rec.status === 'OPEN'}
                                              />
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="input-group-finance">
                                              <label>Cash Deposited (₹)</label>
                                              <input 
                                                type="number"
                                                value={verif.cashDeposited || ''}
                                                onChange={e => setLocalVerification({
                                                  ...localVerification,
                                                  [rec.date]: {
                                                    ...verif,
                                                    cashDeposited: parseFloat(e.target.value) || 0
                                                  }
                                                })}
                                                placeholder="0.00"
                                                disabled={rec.status === 'OPEN'}
                                              />
                                            </div>
                                            <div className="input-group-finance">
                                              <label>Online B2C Clearing (₹)</label>
                                              <input 
                                                type="number"
                                                value={verif.onlinePayments || ''}
                                                onChange={e => setLocalVerification({
                                                  ...localVerification,
                                                  [rec.date]: {
                                                    ...verif,
                                                    onlinePayments: parseFloat(e.target.value) || 0
                                                  }
                                                })}
                                                placeholder="0.00"
                                                disabled={rec.status === 'OPEN'}
                                              />
                                            </div>
                                            {isOnlineEnabled && (
                                              <>
                                                <div className="input-group-finance">
                                                  <label>Online Sales Received (₹)</label>
                                                  <input 
                                                    type="number"
                                                    value={verif.onlineSalesReceivedAmount || ''}
                                                    onChange={e => setLocalVerification({
                                                      ...localVerification,
                                                      [rec.date]: {
                                                        ...verif,
                                                        onlineSalesReceivedAmount: parseFloat(e.target.value) || 0
                                                      }
                                                    })}
                                                    placeholder="0.00"
                                                    disabled={rec.status === 'OPEN'}
                                                  />
                                                </div>
                                                <div className="input-group-finance">
                                                  <label>Online Comm Charged (₹)</label>
                                                  <input 
                                                    type="number"
                                                    value={verif.onlineSalesCommission || ''}
                                                    onChange={e => setLocalVerification({
                                                      ...localVerification,
                                                      [rec.date]: {
                                                        ...verif,
                                                        onlineSalesCommission: parseFloat(e.target.value) || 0
                                                      }
                                                    })}
                                                    placeholder="0.00"
                                                    disabled={rec.status === 'OPEN'}
                                                  />
                                                </div>
                                              </>
                                            )}
                                            <div className="field-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-main)' }}>
                                              <span>Approved Expenses</span>
                                              <strong>₹ {(rec.approvedExpensesAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Box 3: Reconciliation */}
                                  <div className="detail-data-box action-box">
                                    <h3>RECONCILIATION SUMMARY</h3>
                                    
                                    <div className="mismatch-large-display">
                                      <span className="label">RECONCILIATION MISMATCH</span>
                                      <span className={`value-badge ${math.difference !== 0 ? 'mismatch' : 'balanced'}`}>
                                        ₹ {math.difference.toFixed(2)}
                                      </span>
                                      <span className="subtext">{math.difference !== 0 ? 'Unreconciled Deficit' : 'Perfect Settlement'}</span>
                                    </div>

                                    <div className="remarks-section-wrap">
                                      <label>RECONCILIATION NOTES &amp; REMARKS</label>
                                      {isAck ? (
                                        <p className="remarks-text">{verif.remarks || 'No remarks notes recorded.'}</p>
                                      ) : (
                                        <textarea 
                                          value={verif.remarks || ''}
                                          onChange={e => setLocalVerification({
                                            ...localVerification,
                                            [rec.date]: {
                                              ...verif,
                                              remarks: e.target.value
                                            }
                                          })}
                                          placeholder="Enter details about differences, deposits, or adjustments..."
                                          disabled={rec.status === 'OPEN'}
                                        />
                                      )}
                                    </div>

                                    {!isAck && rec.status === 'CLOSED' && (
                                      <div className="action-buttons-wrap">
                                        <button 
                                          className="btn-card-save"
                                          onClick={() => handleSaveVerification(rec.date, false)}
                                          disabled={isSubmitting}
                                        >
                                          SAVE CHANGES
                                        </button>
                                        <button 
                                          className="btn-card-ack"
                                          onClick={() => handleSaveVerification(rec.date, true)}
                                          disabled={isSubmitting}
                                        >
                                          ACKNOWLEDGE &amp; LOCK
                                        </button>
                                      </div>
                                    )}
                                    {isAck && (
                                      <div className="locked-card-ack-banner">
                                        <CheckCircle2 size={16} />
                                        <span>RECONCILIATION LOCKED</span>
                                      </div>
                                    )}
                                    {rec.status === 'OPEN' && (
                                      <div className="warning-open-card-banner">
                                        <AlertCircle size={16} />
                                        <span>USER CLOSED SALES IS REQUIRED FIRST</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {locationLogs.length === 0 && (
                        <div className="empty-state">No B2C records found for this location.</div>
                      )}
                    </div>
                  )}

                  {/* B2B table logs */}
                  {logTab === 'b2b' && isB2BLocation && (
                    <div className="table-wrapper scroll-inside">
                      <table className="sharp-table">
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>B2B REPORTED REVENUE</th>
                            <th>STATUS</th>
                            <th>CLOSED DATE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {locationLogs.map((rec) => {
                            const b2bTotal = rec.b2bSales?.reduce((sum: number, item: any) => sum + (item.totalVal || 0), 0) || 0;
                            return (
                              <tr key={rec._id}>
                                  <td>
                                    <div className="date-cell">
                                      <CalendarIcon size={12} className="text-dim" />
                                      <strong>{new Date(rec.date).toLocaleDateString()}</strong>
                                    </div>
                                  </td>
                                  <td className="font-numeric">₹ {b2bTotal.toFixed(2)}</td>
                                  <td>
                                    <span className={`status-badge-inline ${rec.status === 'CLOSED' ? 'closed' : 'open'}`}>
                                      {rec.status}
                                    </span>
                                  </td>
                                  <td>{rec.closedAt ? new Date(rec.closedAt).toLocaleString() : '—'}</td>
                              </tr>
                            );
                          })}
                          {locationLogs.length === 0 && (
                            <tr>
                              <td colSpan={4} className="empty-state">No B2B dispatches found for this location.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Expenses tab content is removed */}

                  {/* ── STOCK PURCHASES SUB-TAB ── */}
                  {logTab === 'stock_purchases' && (
                    <div style={{ padding: '8px 0' }}>
                      {/* Date filter */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                          Filter by Date
                        </label>
                        <input
                          type="date"
                          value={stockDateFilter}
                          onChange={e => setStockDateFilter(e.target.value)}
                          style={{ padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: '0.8rem' }}
                        />
                        {stockDateFilter && (
                          <button
                            onClick={() => setStockDateFilter('')}
                            style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕ Clear
                          </button>
                        )}
                      </div>

                      <div className="table-wrapper">
                        <table className="sharp-table">
                          <thead>
                            <tr>
                              <th>PR CODE</th>
                              <th>VENDOR</th>
                              <th>DATE</th>
                              <th>TOTAL AMOUNT</th>
                              <th>DELIVERY</th>
                              <th>PAYMENT</th>
                              <th>ACTIONS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const locBills = bills.filter((b: any) => {
                                const matchLoc = b.destinationLocation === selectedLocationId ||
                                  b.destinationLocation?._id === selectedLocationId;
                                if (!matchLoc) return false;
                                if (stockDateFilter) {
                                  const billDate = new Date(b.createdAt).toLocaleDateString('en-CA');
                                  return billDate === stockDateFilter;
                                }
                                return true;
                              });

                              if (locBills.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={7} className="empty-state">
                                      No stock purchases found{stockDateFilter ? ` for ${new Date(stockDateFilter).toLocaleDateString()}` : ' for this location'}.
                                    </td>
                                  </tr>
                                );
                              }

                              return locBills.map((b: any) => {
                                const isPaid = b.paymentStatus === 'PAID';
                                const isDelivered = b.deliveryStatus === 'DELIVERED';
                                return (
                                  <tr key={b._id}>
                                    <td>
                                      <strong className="code-badge" style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>
                                        {b.purchaseRequest?.prCode || '—'}
                                      </strong>
                                    </td>
                                    <td><strong>{b.vendor?.vendorName || '—'}</strong></td>
                                    <td style={{ fontSize: '0.78rem' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                                    <td>
                                      <strong style={{ fontFamily: 'monospace' }}>
                                        ₹ {(b.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </strong>
                                    </td>
                                    <td>
                                      <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px',
                                        background: isDelivered ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                        color: isDelivered ? '#34d399' : '#f59e0b',
                                        border: isDelivered ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)'
                                      }}>
                                        {isDelivered ? '✓ DELIVERED' : 'PENDING'}
                                      </span>
                                    </td>
                                    <td>
                                      <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px',
                                        background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                                        color: isPaid ? '#34d399' : '#f87171',
                                        border: isPaid ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.25)'
                                      }}>
                                        {isPaid ? '✓ PAID' : 'PAYMENT DUE'}
                                      </span>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                          className="btn-action-sm"
                                          onClick={() => setSelectedBillForView(b)}
                                          style={{ fontSize: '0.65rem', padding: '4px 10px' }}
                                        >
                                          <FileText size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                          VIEW
                                        </button>
                                        {!isPaid && isDelivered && (
                                          <button
                                            className="btn-action-sm"
                                            onClick={() => handleMarkBillPaid(b._id)}
                                            disabled={isSubmitting}
                                            style={{ fontSize: '0.65rem', padding: '4px 10px', background: '#10b981', border: 'none', color: 'white' }}
                                          >
                                            <DollarSign size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            MARK PAID
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state-panel">
                <Building2 size={40} className="text-dim" />
                <h3>No locations registered</h3>
                <p>Create locations in the Super Admin dashboard first.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: BANK DATABASE (READ-ONLY VIEW) ────────────────────── */}
        {activeTab === 'banks' && (
          <div className="finance-tab-content">
            <div className="table-wrapper">
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>BANK NAME</th>
                    <th>ACCOUNT NUMBER</th>
                    <th>BRANCH</th>
                    <th>IFSC CODE</th>
                    <th>MAPPED LOCATIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {banksList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">No bank accounts registered in bank master.</td>
                    </tr>
                  ) : (
                    banksList.map((b) => (
                      <tr key={b._id}>
                        <td className="text-left">
                          <div className="flex-center-align">
                            <Landmark size={14} className="text-primary mr-2" />
                            <strong>{b.bankName.toUpperCase()}</strong>
                          </div>
                        </td>
                        <td><code className="acc-code">{b.accountNumber}</code></td>
                        <td>{b.branch}</td>
                        <td><span className="ifsc-badge">{b.ifscCode}</span></td>
                        <td>
                          <div className="mapped-locations-badges">
                            {b.locations && b.locations.length > 0 ? (
                              b.locations.map((locId: string) => {
                                const lName = locations.find(l => l._id === locId)?.name;
                                return lName ? (
                                  <span key={locId} className="loc-badge-item">
                                    {lName.toUpperCase()}
                                  </span>
                                ) : null;
                              })
                            ) : (
                              <span className="unmapped-label">Not Mapped</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 4: STOCK PURCHASES ──────────────────────────────────── */}
        {activeTab === 'stock_purchases' && (
          <div className="finance-tab-content">
            <div className="panel">
              <div className="panel-header" style={{ justifyContent: 'space-between' }}>
                <h2><Landmark size={16} /> VENDOR BILLS AWAITING PAYMENT RECONCILIATION</h2>
                <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.65rem', padding: '2px 8px' }}>
                  AWAITING PAYMENT: {bills.filter(b => b.deliveryStatus === 'DELIVERED' && b.paymentStatus !== 'PAID').length}
                </span>
              </div>
              <div className="table-wrapper scroll-inside">
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>BILL CODE / PR</th>
                      <th>VENDOR</th>
                      <th>DELIVERY LOCATION</th>
                      <th>DATE DELIVERED</th>
                      <th>TOTAL VALUE</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.filter(b => b.deliveryStatus === 'DELIVERED').length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">No delivered vendor bills found.</td>
                      </tr>
                    ) : (
                      bills.filter(b => b.deliveryStatus === 'DELIVERED').map((bill) => {
                        const isPaid = bill.paymentStatus === 'PAID';
                        const deliveryLoc = locations.find(l => l._id === bill.destinationLocation);
                        return (
                          <tr key={bill._id} style={{ opacity: isPaid ? 0.7 : 1 }}>
                            <td><strong>{bill.purchaseRequest?.prCode || bill.billCode}</strong></td>
                            <td>{bill.vendor?.vendorName || 'UNKNOWN'}</td>
                            <td>{deliveryLoc ? deliveryLoc.name.toUpperCase() : 'UNKNOWN'}</td>
                            <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                            <td className="font-numeric">₹ {bill.totalAmount.toFixed(2)}</td>
                            <td>
                              <span className={`status-badge-inline ${isPaid ? 'closed' : 'open'}`}>
                                {isPaid ? 'PAID' : 'PAYMENT DUE'}
                              </span>
                            </td>
                            <td className="text-right">
                              {!isPaid ? (
                                <button 
                                  className="action-btn-mini"
                                  onClick={() => handleMarkBillPaid(bill._id)}
                                  disabled={isSubmitting}
                                  style={{ color: '#10b981', borderColor: '#10b981', marginLeft: 'auto' }}
                                >
                                  MARK PAID
                                </button>
                              ) : (
                                <span className="text-dim">—</span>
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
          </div>
        )}

        {/* ─── TAB 5: FUNCTION ORDERS RECONCILIATION ───────────────────── */}
        {activeTab === 'function_orders' && (
          <div className="finance-tab-content">
            <div className="panel">
              <div className="panel-header" style={{ justifyContent: 'space-between', borderBottom: 'none', paddingBottom: '0px' }}>
                <h2>RECONCILIATION FOR FUNCTION / EVENT ORDERS</h2>
              </div>

              <div className="sub-tabs-header" style={{ marginTop: '12px' }}>
                <button 
                  className={`sub-tab-btn ${foSubTab === 'advances' ? 'active' : ''}`}
                  onClick={() => setFoSubTab('advances')}
                >
                  ADVANCE PAYMENTS ({pendingAdvances.length} pending)
                </button>
                <button 
                  className={`sub-tab-btn ${foSubTab === 'final_payments' ? 'active' : ''}`}
                  onClick={() => setFoSubTab('final_payments')}
                >
                  FINAL SETTLEMENTS ({pendingFinalPayments.length} pending)
                </button>
                <button 
                  className={`sub-tab-btn ${foSubTab === 'all_orders' ? 'active' : ''}`}
                  onClick={() => setFoSubTab('all_orders')}
                >
                  ALL ORDERS HISTORY ({allFunctionOrders.length})
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                {foSubTab === 'advances' && (
                  <div className="table-wrapper scroll-inside">
                    <table className="sharp-table">
                      <thead>
                        <tr>
                          <th>FO CODE</th>
                          <th>LOCATION</th>
                          <th>BOOKING DATE</th>
                          <th>PAYMENT MODE</th>
                          <th>ADVANCE AMOUNT</th>
                          <th>ACKNOWLEDGMENT NOTE</th>
                          <th style={{ textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingAdvances.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="empty-state">No pending advance payments to reconcile.</td>
                          </tr>
                        ) : (
                          pendingAdvances.map((order) => (
                            <tr key={order._id}>
                              <td><strong>{order.foCode}</strong></td>
                              <td>{order.centerId?.name?.toUpperCase() || 'UNKNOWN'}</td>
                              <td>{new Date(order.bookingDate).toLocaleDateString()}</td>
                              <td>
                                <span className={`category-tag`}>
                                  {order.advancePaymentMode || 'N/A'}
                                </span>
                              </td>
                              <td className="font-numeric">₹ {(order.advanceAmount || 0).toFixed(2)}</td>
                              <td>
                                <input 
                                  type="text"
                                  placeholder="Optional note..."
                                  value={foNotes[order._id] || ''}
                                  onChange={e => setFoNotes({
                                    ...foNotes,
                                    [order._id]: e.target.value
                                  })}
                                  style={{ 
                                    background: 'var(--bg-main)', 
                                    border: '1px solid var(--border-main)', 
                                    color: 'var(--text-main)', 
                                    padding: '6px 10px', 
                                    fontSize: '0.78rem', 
                                    outline: 'none',
                                    width: '100%',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </td>
                              <td className="text-right">
                                <button 
                                  className="action-btn-mini"
                                  onClick={() => handleAcknowledgeAdvance(order._id, foNotes[order._id])}
                                  disabled={isSubmitting}
                                  style={{ color: '#10b981', borderColor: '#10b981', marginLeft: 'auto' }}
                                >
                                  APPROVE ADVANCE
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {foSubTab === 'final_payments' && (
                  <div className="table-wrapper scroll-inside">
                    <table className="sharp-table">
                      <thead>
                        <tr>
                          <th>FO CODE</th>
                          <th>LOCATION</th>
                          <th>EVENT DATE</th>
                          <th>PAYMENT MODE</th>
                          <th>FINAL PAYMENT AMOUNT</th>
                          <th>ACKNOWLEDGMENT NOTE</th>
                          <th style={{ textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingFinalPayments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="empty-state">No pending final payments to reconcile.</td>
                          </tr>
                        ) : (
                          pendingFinalPayments.map((order) => (
                            <tr key={order._id}>
                              <td><strong>{order.foCode}</strong></td>
                              <td>{order.centerId?.name?.toUpperCase() || 'UNKNOWN'}</td>
                              <td>{new Date(order.eventDate).toLocaleDateString()}</td>
                              <td>
                                <span className={`category-tag`}>
                                  {order.finalPaymentMode || 'N/A'}
                                </span>
                              </td>
                              <td className="font-numeric">₹ {(order.finalPaymentAmount || 0).toFixed(2)}</td>
                              <td>
                                <input 
                                  type="text"
                                  placeholder="Optional note..."
                                  value={foNotes[order._id] || ''}
                                  onChange={e => setFoNotes({
                                    ...foNotes,
                                    [order._id]: e.target.value
                                  })}
                                  style={{ 
                                    background: 'var(--bg-main)', 
                                    border: '1px solid var(--border-main)', 
                                    color: 'var(--text-main)', 
                                    padding: '6px 10px', 
                                    fontSize: '0.78rem', 
                                    outline: 'none',
                                    width: '100%',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </td>
                              <td className="text-right">
                                <button 
                                  className="action-btn-mini"
                                  onClick={() => handleAcknowledgeFinalPayment(order._id, foNotes[order._id])}
                                  disabled={isSubmitting}
                                  style={{ color: '#10b981', borderColor: '#10b981', marginLeft: 'auto' }}
                                >
                                  APPROVE PAYMENT
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── ALL ORDERS HISTORY ── */}
                {foSubTab === 'all_orders' && (
                  <div className="table-wrapper scroll-inside">
                    <table className="sharp-table">
                      <thead>
                        <tr>
                          <th>FO CODE</th>
                          <th>LOCATION</th>
                          <th>BOOKING DATE</th>
                          <th>ADVANCE</th>
                          <th>ADVANCE RECON</th>
                          <th>FINAL PMT</th>
                          <th>FINAL RECON</th>
                          <th>ORDER STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allFunctionOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="empty-state">No function orders found.</td>
                          </tr>
                        ) : (
                          allFunctionOrders.map((order: any) => {
                            const advanceAck = order.advanceFinanceAcknowledged;
                            const finalAck = order.finalFinanceAcknowledged;
                            const hasAdvance = (order.advanceAmount || 0) > 0;
                            const isSettled = ['SETTLED', 'CLOSED', 'COMPLETED'].includes(order.status);
                            return (
                              <tr key={order._id}>
                                <td><strong>{order.foCode}</strong></td>
                                <td>{order.centerId?.name?.toUpperCase() || 'UNKNOWN'}</td>
                                <td>{order.bookingDate ? new Date(order.bookingDate).toLocaleDateString() : '—'}</td>
                                <td className="font-numeric">
                                  {hasAdvance
                                    ? `₹ ${(order.advanceAmount || 0).toFixed(2)}`
                                    : <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>Not paid</span>}
                                </td>
                                <td>
                                  {!hasAdvance ? (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>N/A</span>
                                  ) : advanceAck ? (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', border: '1px solid rgba(16,185,129,0.25)' }}>
                                      ✓ RECONCILED
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', border: '1px solid rgba(245,158,11,0.25)' }}>
                                      PENDING
                                    </span>
                                  )}
                                </td>
                                <td className="font-numeric">
                                  {isSettled
                                    ? `₹ ${(order.finalPaymentAmount || order.totalOrderValue || 0).toFixed(2)}`
                                    : <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>Not settled</span>}
                                </td>
                                <td>
                                  {!isSettled ? (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>N/A</span>
                                  ) : finalAck ? (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', border: '1px solid rgba(16,185,129,0.25)' }}>
                                      ✓ RECONCILED
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', border: '1px solid rgba(245,158,11,0.25)' }}>
                                      PENDING
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px',
                                    background: order.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                    color: order.status === 'COMPLETED' ? '#34d399' : '#818cf8',
                                    border: order.status === 'COMPLETED' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(99,102,241,0.25)'
                                  }}>
                                    {order.status || 'ACTIVE'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .finance-console { padding: 0; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; border-bottom: 1px solid var(--border-main); padding-bottom: 16px; }
        
        .finance-tab-content { display: flex; flex-direction: column; gap: 24px; }
        
        /* Stats Dashboard */
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .stat-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 24px; display: flex; align-items: center; gap: 16px; }
        .stat-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border: 1px solid transparent; }
        .stat-icon.reported { color: #f97316; border-color: rgba(249,115,22,0.1); }
        .stat-icon.verified { color: #10b981; border-color: rgba(16,185,129,0.1); }
        .stat-icon.difference.gap { color: #ef4444; border-color: rgba(239,68,68,0.1); }
        .stat-icon.difference.reconciled { color: #10b981; border-color: rgba(16,185,129,0.1); }
        .stat-info label { display: block; font-size: 0.58rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; letter-spacing: 0.5px; }
        .stat-info h3 { font-size: 1.25rem; font-weight: 800; color: var(--text-main); }

        .dashboard-layout-split { display: grid; grid-template-columns: 1fr; gap: 24px; }
        .panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); display: flex; flex-direction: column; }
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; align-items: center; }
        .panel-header h2 { font-size: 0.75rem; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }

        .scroll-inside { overflow-y: auto; max-height: 500px; }
        .scroll-inside::-webkit-scrollbar { width: 4px; }
        .scroll-inside::-webkit-scrollbar-thumb { background: var(--border-main); }

        .sharp-table { width: 100%; border-collapse: collapse; text-align: left; }
        .sharp-table th { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); font-weight: 800; background: rgba(0,0,0,0.1); }
        .sharp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-main); font-size: 0.82rem; color: var(--text-muted); }
        .sharp-table tr:hover { background: var(--row-hover); }
        .text-right { text-align: right; }
        .subtext { display: block; font-size: 0.65rem; color: var(--text-dim); margin-top: 2px; }

        .mismatch-badge { font-family: monospace; font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border: 1px solid; }
        .mismatch-badge.active { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); }
        .mismatch-badge.reconciled { color: #10b981; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); }

        .action-btn-mini { background: none; border: 1px solid var(--border-main); color: var(--text-main); font-size: 0.65rem; font-weight: 800; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; margin-left: auto; text-decoration: none; }
        .action-btn-mini:hover { border-color: var(--primary); color: var(--primary); }

        .alert { display: flex; align-items: center; gap: 10px; padding: 12px 20px; font-size: 0.82rem; font-weight: 700; margin-bottom: 20px; }
        .alert-error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; }
        .alert-success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; }

        /* Location Details full page width */
        .location-detail-workspace-full { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
        
        .detail-header-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 24px; display: flex; justify-content: space-between; align-items: center; }
        .left-meta h2 { font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px; letter-spacing: -0.5px; }
        .left-meta p { font-size: 0.78rem; color: var(--text-dim); font-weight: 500; }
        .type-pill { font-size: 0.6rem; font-weight: 900; color: var(--primary); border: 1px solid rgba(249,115,22,0.2); background: rgba(249,115,22,0.04); padding: 2px 8px; margin-bottom: 6px; display: inline-block; letter-spacing: 0.5px; }
        
        .bank-mapping-indicator { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-main); padding: 12px 20px; max-width: 320px; }
        .indicator-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(249,115,22,0.05); color: var(--primary); border: 1px solid rgba(249,115,22,0.1); }
        .indicator-info { display: flex; flex-direction: column; }
        .indicator-info .label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; margin-bottom: 2px; }
        .indicator-info .value { font-size: 0.85rem; font-weight: 800; color: var(--text-main); }
        .indicator-info .value.unmapped { color: #f59e0b; font-size: 0.78rem; font-weight: 700; }
        .account-tag { font-family: monospace; font-size: 0.72rem; color: var(--primary); margin-left: 6px; }

        .sub-tabs-header { display: flex; border-bottom: 1px solid var(--border-main); margin-bottom: -12px; }
        .sub-tab-btn { background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-dim); padding: 10px 20px; font-size: 0.78rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .sub-tab-btn:hover { color: var(--text-main); }
        .sub-tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }

        .logs-accordion-container { display: flex; flex-direction: column; gap: 16px; margin-top: 12px; }
        .accordion-list { display: flex; flex-direction: column; gap: 12px; }

        /* Day Accordion Card */
        .accordion-day-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); transition: 0.2s; display: flex; flex-direction: column; }
        .accordion-day-card.card-acknowledged { border-color: rgba(16, 185, 129, 0.2); }
        .accordion-day-card:hover { border-color: var(--primary); }
        .accordion-day-card.card-acknowledged:hover { border-color: #10b981; }

        .card-header-clickable { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
        .card-header-clickable .left-info { display: flex; align-items: center; }
        .day-date { font-size: 0.88rem; font-weight: 800; color: var(--text-main); margin-right: 16px; }
        
        .status-badge-custom { display: inline-flex; align-items: center; gap: 6px; font-size: 0.62rem; font-weight: 800; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px; border: 1px solid; }
        .status-badge-custom.status-open { color: #f59e0b; border-color: rgba(245, 158, 11, 0.2); background: rgba(245, 158, 11, 0.05); }
        .status-badge-custom.status-closed { color: #818cf8; border-color: rgba(129, 140, 248, 0.2); background: rgba(129, 140, 248, 0.05); }
        .status-badge-custom.status-pending { color: #f97316; border-color: rgba(249, 115, 22, 0.2); background: rgba(249, 115, 22, 0.05); }
        .status-badge-custom.status-ack { color: #10b981; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); }

        .right-summary { display: flex; align-items: center; gap: 20px; }
        .summary-math-preview { display: flex; align-items: center; gap: 12px; font-size: 0.75rem; color: var(--text-dim); }
        .summary-math-preview strong { color: var(--text-main); }
        .spacer-dash { color: var(--border-main); }
        .diff-preview.gap strong { color: #ef4444; }
        .diff-preview.ok strong { color: #10b981; }

        .card-expanded-body { padding: 24px; border-top: 1px solid var(--border-main); background: rgba(0,0,0,0.1); }
        
        .detail-boxes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .detail-data-box { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .detail-data-box.reported-box { border-left: 3px solid var(--primary); }
        .detail-data-box.verification-box { border-left: 3px solid #3b82f6; }
        .detail-data-box.action-box { border-left: 3px solid #10b981; }
        
        .detail-data-box h3 { font-size: 0.68rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; border-bottom: 1px solid var(--border-main); padding-bottom: 8px; margin-bottom: 4px; }
        
        .box-fields-list { display: flex; flex-direction: column; gap: 8px; }
        .field-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; }
        .field-row span { color: var(--text-dim); }
        .field-row strong { color: var(--text-main); }
        .field-row.divider-row { border-top: 1px solid var(--border-main); padding-top: 8px; margin-top: 4px; }
        .font-large { font-size: 1rem; font-weight: 900; }
        
        .verification-form-inputs { display: flex; flex-direction: column; gap: 10px; }
        .input-group-finance { display: flex; flex-direction: column; gap: 4px; }
        .input-group-finance label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; text-transform: uppercase; }
        .input-group-finance input { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 8px 12px; font-size: 0.85rem; font-weight: 700; outline: none; transition: 0.2s; width: 100%; box-sizing: border-box; }
        .input-group-finance input:focus { border-color: var(--primary); background: #ffffff; color: #000000; }
        .input-group-finance input:disabled { opacity: 0.6; cursor: not-allowed; }

        .mismatch-large-display { text-align: center; background: rgba(0,0,0,0.15); padding: 14px; border: 1px solid var(--border-main); display: flex; flex-direction: column; gap: 6px; }
        .mismatch-large-display .label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .mismatch-large-display .value-badge { font-family: monospace; font-size: 1.15rem; font-weight: 900; padding: 4px 12px; display: inline-block; margin: 0 auto; border: 1px solid; }
        .mismatch-large-display .value-badge.mismatch { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); }
        .mismatch-large-display .value-badge.balanced { color: #10b981; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); }
        .mismatch-large-display .subtext { font-size: 0.58rem; font-weight: 800; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.5px; }

        .remarks-section-wrap { display: flex; flex-direction: column; gap: 6px; }
        .remarks-section-wrap label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .remarks-section-wrap textarea { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 8px 12px; font-size: 0.8rem; font-weight: 600; outline: none; width: 100%; height: 72px; resize: none; box-sizing: border-box; }
        .remarks-section-wrap textarea:focus { border-color: var(--primary); background: #ffffff; color: #000000; }
        .remarks-section-wrap textarea:disabled { opacity: 0.6; cursor: not-allowed; }
        .remarks-text { font-size: 0.78rem; color: var(--text-dim); line-height: 1.35; }

        .action-buttons-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: auto; }
        .btn-card-save { background: var(--border-strong); border: 1px solid var(--border-main); color: var(--text-main); padding: 10px; font-weight: 800; font-size: 0.68rem; cursor: pointer; transition: 0.2s; text-transform: uppercase; }
        .btn-card-save:hover { border-color: var(--text-main); }
        .btn-card-ack { background: #10b981; color: white; border: none; padding: 10px; font-weight: 800; font-size: 0.68rem; cursor: pointer; transition: 0.2s; text-transform: uppercase; }
        .btn-card-ack:hover { background: #059669; }

        .locked-card-ack-banner { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 800; font-size: 0.72rem; letter-spacing: 0.5px; margin-top: auto; }
        .warning-open-card-banner { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 800; font-size: 0.68rem; letter-spacing: 0.5px; margin-top: auto; text-align: center; }

        /* B2B table logs */
        .date-cell { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; }
        .status-badge-inline { font-size: 0.55rem; font-weight: 900; padding: 1px 6px; letter-spacing: 0.5px; border-radius: 2px; display: inline-block; vertical-align: middle; margin-left: 6px; }
        .status-badge-inline.closed { background: #10b981; color: white; }
        .status-badge-inline.open { background: #f97316; color: white; }

        /* Bank database read only styling */
        .mr-2 { margin-right: 8px; }
        .acc-code { font-family: monospace; font-size: 0.8rem; background: rgba(0,0,0,0.15); padding: 2px 6px; border: 1px solid var(--border-main); color: var(--text-main); }
        .ifsc-badge { font-family: monospace; font-size: 0.78rem; font-weight: 700; color: var(--primary); }
        .mapped-locations-badges { display: flex; flex-wrap: wrap; gap: 6px; }
        .loc-badge-item { font-size: 0.62rem; font-weight: 800; background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.2); color: var(--primary); padding: 2px 8px; letter-spacing: 0.5px; }
        .unmapped-label { font-size: 0.75rem; color: var(--text-dim); font-style: italic; }
        
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.82rem; }
        .empty-state-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 350px; background: var(--bg-sidebar); border: 1px solid var(--border-main); text-align: center; color: var(--text-dim); gap: 12px; }

        /* Expenses styling */
        .indicators-group { display: flex; gap: 16px; align-items: center; }
        .monthly-mismatch-indicator { display: flex; align-items: center; gap: 14px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-main); padding: 12px 20px; min-width: 220px; }
        .indicator-icon.mismatch { background: rgba(239,68,68,0.05); color: #ef4444; border: 1px solid rgba(239,68,68,0.1); }
        .text-error { color: #ef4444 !important; }
        .text-success { color: #10b981 !important; }
        .status-badge-inline.rejected { background: #ef4444; color: white; }
        .status-badge-inline.pending-fin { background: #3b82f6; color: white; }
        .category-tag { font-size: 0.72rem; color: var(--primary); background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.2); padding: 2px 6px; }
        .action-buttons-mini-flex { display: flex; gap: 8px; justify-content: flex-end; }
        .approve-btn { border-color: #10b981; color: #10b981; }
        .approve-btn:hover { background: rgba(16,185,129,0.1) !important; color: #10b981 !important; }
        .reject-btn { border-color: #ef4444; color: #ef4444; }
        .reject-btn:hover { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; }
      `}</style>

      {/* Bill View Modal — Finance read-only view with Mark Paid option */}
      {selectedBillForView && (
        <BillViewModal
          bill={selectedBillForView}
          isViewOnly={true}
          showMarkPaid={true}
          isInternal={false}
          onClose={() => setSelectedBillForView(null)}
          onMarkPaid={(billId) => {
            handleMarkBillPaid(billId);
            setSelectedBillForView(null);
          }}
          isProcessing={isSubmitting}
        />
      )}
    </MainLayout>
  );
};

export default FinancePage;
