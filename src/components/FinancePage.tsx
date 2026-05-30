import React, { useState, useEffect } from 'react';
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
  Building2
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { financeApi, userApi, bankApi, expenseApi } from '../services/api';

type TopTabType = 'dashboard' | 'location' | 'banks';
type LogTabType = 'b2c' | 'b2b' | 'expenses';

const FinancePage: React.FC = () => {
  const routerLocation = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TopTabType>('dashboard');
  const [logTab, setLogTab] = useState<LogTabType>('b2c');
  
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  
  // Dashboard rollups & logs
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [locationLogs, setLocationLogs] = useState<any[]>([]);
  const [locationExpenses, setLocationExpenses] = useState<any[]>([]);
  const [mappedBank, setMappedBank] = useState<any>(null);
  
  // Bank List states
  const [banksList, setBanksList] = useState<any[]>([]);

  // Expandable log card state (tracks which daily log date string is expanded)
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Local verification edits state indexed by date
  // e.g. { "2026-05-28": { cashDeposited: 100, remarks: "clear", ... } }
  const [localVerification, setLocalVerification] = useState<Record<string, any>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Parse parameters from search query
  const searchParams = new URLSearchParams(routerLocation.search);
  const tabParam = searchParams.get('tab') as TopTabType || 'dashboard';
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
    } else if (activeTab === 'location' && selectedLocationId) {
      fetchLocationLogs(selectedLocationId);
    } else if (activeTab === 'banks') {
      fetchBanks();
    }
  }, [activeTab, selectedLocationId]);

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
      
      const statsRes = await financeApi.getFinanceStats(entityId);
      setDashboardStats(statsRes.data.data);
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
      
      const { records, bank, expenses } = res.data.data;
      setLocationLogs(records || []);
      setLocationExpenses(expenses || []);
      setMappedBank(bank || null);
      setExpandedDate(null); // Reset expanded accordion day

      // Prepopulate verification inputs
      const initialVerifs: Record<string, any> = {};
      records.forEach((rec: any) => {
        initialVerifs[rec.date] = {
          cashDeposited: rec.verification?.cashDeposited || 0,
          onlinePayments: rec.verification?.onlinePayments || 0,
          onlineSalesReceivedAmount: rec.verification?.onlineSalesReceivedAmount || 0,
          onlineSalesCommission: rec.verification?.onlineSalesCommission || 0,
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

  const handleFinanceApprove = async (expenseId: string) => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await expenseApi.financeApprove(expenseId);
      setSuccess('Expense approved successfully!');
      if (selectedLocationId) {
        fetchLocationLogs(selectedLocationId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinanceReject = async (expenseId: string) => {
    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      await expenseApi.financeReject(expenseId);
      setSuccess('Expense rejected successfully!');
      if (selectedLocationId) {
        fetchLocationLogs(selectedLocationId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMonthlyMismatchSum = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let totalMismatch = 0;
    locationLogs.forEach(rec => {
      if (rec.status !== 'CLOSED') return;
      const recDate = new Date(rec.date);
      if (recDate.getFullYear() === currentYear && recDate.getMonth() === currentMonth) {
        const verif = localVerification[rec.date] || {};
        const isOnlineEnabled = !!selectedLoc?.onlineSalesEnabled;
        const math = getReconciliationMath(rec, verif, selectedLocRole, isOnlineEnabled);
        totalMismatch += math.difference;
      }
    });
    return totalMismatch;
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

  const calculateOnlineExpected = (record: any, role: string) => {
    const totalVal = record.onlineSales?.totalSaleValue || 0;
    const commPct = record.onlineSales?.aggregatorPercentage || 0;
    return role === 'AGGREGATE' ? totalVal * (1 - commPct / 100) : totalVal;
  };

  const getReconciliationMath = (record: any, verifInputs: any, role: string, isOnlineEnabled: boolean) => {
    const reportedCashVal = record.reportedCash || 0;
    const reportedOnlineVal = record.reportedOnline || 0;
    const onlineExpected = isOnlineEnabled ? calculateOnlineExpected(record, role) : 0;
    const reportedTotal = reportedCashVal + reportedOnlineVal + onlineExpected;

    const cashDep = Number(verifInputs?.cashDeposited) || 0;
    const onlinePay = Number(verifInputs?.onlinePayments) || 0;
    const salesRecv = isOnlineEnabled ? (Number(verifInputs?.onlineSalesReceivedAmount) || 0) : 0;
    const approvedExpenses = Number(record.approvedExpensesAmount) || 0;
    const verifiedTotal = cashDep + onlinePay + salesRecv + approvedExpenses;

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
    if (rec.verification?.cashDeposited > 0 || rec.verification?.onlinePayments > 0 || rec.verification?.onlineSalesReceivedAmount > 0) {
      return { text: 'ACKNOWLEDGEMENT PENDING', class: 'status-pending', icon: <Clock size={12} /> };
    }
    return { text: 'USER CLOSED SALES', class: 'status-closed', icon: <Lock size={12} /> };
  };

  if (isLoading && !dashboardStats) return <ForgeLoader />;

  return (
    <MainLayout>
      <div className="finance-console">
        <header className="page-header">
          <div className="header-title">
            <h1>FINANCIAL CONSOLE</h1>
            <p className="subtitle">
              {activeTab === 'dashboard' && 'RECONCILED ROLLUPS & PENDING ACTIONS'}
              {activeTab === 'location' && `DAILY REVENUE LOGS: ${selectedLoc?.name?.toUpperCase() || ''}`}
              {activeTab === 'banks' && 'BANK DATABASE REGISTER (READ-ONLY)'}
            </p>
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

        {/* ─── TAB 1: FINANCIAL DASHBOARD ───────────────────────────────── */}
        {activeTab === 'dashboard' && dashboardStats && (
          <div className="finance-tab-content">
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon reported"><DollarSign size={22} /></div>
                <div className="stat-info">
                  <label>REPORTED REVENUE (MONTH)</label>
                  <h3>₹ {dashboardStats.totalReported?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon verified"><CheckCircle2 size={22} /></div>
                <div className="stat-info">
                  <label>VERIFIED DEPOSITS</label>
                  <h3>₹ {dashboardStats.totalVerified?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className={`stat-icon difference ${dashboardStats.totalDifference !== 0 ? 'gap' : 'reconciled'}`}>
                  {dashboardStats.totalDifference !== 0 ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
                </div>
                <div className="stat-info">
                  <label>UNRECONCILED DIFFERENCE</label>
                  <h3 className={dashboardStats.totalDifference !== 0 ? "text-error" : "text-success"}>
                    ₹ {dashboardStats.totalDifference?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
              </div>
            </section>

            <div className="dashboard-layout-split">
              <div className="panel action-panel">
                <div className="panel-header">
                  <h2><Clock size={16} /> PENDING RECONCILIATIONS ({dashboardStats.pendingReconciliations?.length || 0})</h2>
                </div>
                
                <div className="table-wrapper scroll-inside">
                  <table className="sharp-table">
                    <thead>
                      <tr>
                        <th>LOCATION</th>
                        <th>DATE</th>
                        <th>REPORTED TOTAL</th>
                        <th>VERIFIED TOTAL</th>
                        <th>MISMATCH</th>
                        <th className="text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardStats.pendingReconciliations?.map((pr: any, idx: number) => (
                        <tr key={idx}>
                          <td>
                            <strong>{pr.locationName?.toUpperCase()}</strong>
                            <span className="subtext">{pr.locationRole}</span>
                          </td>
                          <td>{new Date(pr.date).toLocaleDateString()}</td>
                          <td>₹ {pr.reportedTotal?.toFixed(2)}</td>
                          <td>₹ {pr.verifiedTotal?.toFixed(2)}</td>
                          <td>
                            <span className={`mismatch-badge ${pr.difference !== 0 ? 'active' : 'reconciled'}`}>
                              ₹ {pr.difference?.toFixed(2)}
                            </span>
                          </td>
                          <td className="text-right">
                            <a 
                              className="action-btn-mini"
                              href={`/finance?tab=location&locationId=${pr.locationId}`}
                            >
                              Go Reconcile <ChevronRight size={12} />
                            </a>
                          </td>
                        </tr>
                      ))}
                      {(!dashboardStats.pendingReconciliations || dashboardStats.pendingReconciliations.length === 0) && (
                        <tr>
                          <td colSpan={6} className="empty-state">
                            <CheckCircle2 size={24} className="text-success" />
                            <p>All locations are reconciled and acknowledged!</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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

                  <div className="indicators-group">
                    <div className="monthly-mismatch-indicator">
                      <div className="indicator-icon mismatch">
                        <DollarSign size={18} />
                      </div>
                      <div className="indicator-info">
                        <span className="label">MONTHLY MISMATCH</span>
                        <strong className={`value ${getMonthlyMismatchSum() !== 0 ? 'text-error' : 'text-success'}`}>
                          ₹ {getMonthlyMismatchSum().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    <div className="bank-mapping-indicator">
                      <div className="indicator-icon">
                        <Landmark size={18} />
                      </div>
                      <div className="indicator-info">
                        <span className="label">BANK MASTER LINK</span>
                        {mappedBank ? (
                          <strong className="value">
                            {mappedBank.bankName.toUpperCase()} 
                            <span className="account-tag">({mappedBank.accountNumber})</span>
                          </strong>
                        ) : (
                          <span className="value unmapped">No bank account mapped</span>
                        )}
                      </div>
                    </div>
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
                    className={`sub-tab-btn ${logTab === 'expenses' ? 'active' : ''}`}
                    onClick={() => setLogTab('expenses')}
                  >
                    Expenses
                  </button>
                </div>

                <div className="logs-accordion-container">
                  {/* B2C logs rendered as accordion day cards */}
                  {logTab === 'b2c' && isB2CLocation && (
                    <div className="accordion-list">
                      {locationLogs.map((rec) => {
                        const verif = localVerification[rec.date] || {};
                        const isAck = verif.isAcknowledged;
                        const isOnlineEnabled = !!selectedLoc?.onlineSalesEnabled;
                        const math = getReconciliationMath(rec, verif, selectedLocRole, isOnlineEnabled);
                        const expectedOnline = calculateOnlineExpected(rec, selectedLocRole);
                        const b2bTotal = rec.b2bSales?.reduce((s: number, item: any) => s + (item.totalVal || 0), 0) || 0;
                        const b2cExpected = rec.b2cSales?.reduce((s: number, item: any) => s + (item.totalVal || 0), 0) || 0;
                        const isExpanded = expandedDate === rec.date;
                        const statusMeta = getLogStatus(rec);

                        return (
                          <div key={rec._id} className={`accordion-day-card ${isAck ? 'card-acknowledged' : ''} ${isExpanded ? 'expanded' : ''}`}>
                            {/* Card Header (Clickable) */}
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
                                    <span>Reported: <strong>₹ {math.reportedTotal.toFixed(2)}</strong></span>
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

                            {/* Card Body (Accordion Content) */}
                            {isExpanded && (
                              <div className="card-expanded-body">
                                <div className="detail-boxes-grid">
                                  {/* Box 1: Reported Sales data */}
                                  <div className="detail-data-box reported-box">
                                    <h3>REPORTED SALES (USER)</h3>
                                    <div className="box-fields-list">
                                      <div className="field-row">
                                        <span>B2C Expected Revenue</span>
                                        <strong>₹ {b2cExpected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div className="field-row">
                                        <span>B2C Cash Received</span>
                                        <strong>₹ {(rec.reportedCash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div className="field-row">
                                        <span>B2C Online Received</span>
                                        <strong>₹ {(rec.reportedOnline || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      {isOnlineEnabled && (
                                        <div className="field-row">
                                          <span>Online Sales (Expected Net Payout)</span>
                                          <strong>₹ {expectedOnline.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      )}
                                      {isB2BLocation && (
                                        <div className="field-row">
                                          <span>B2B Total Revenue</span>
                                          <strong>₹ {b2bTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      )}
                                      <div className="field-row divider-row">
                                        <span>Reported Total</span>
                                        <strong className="text-primary font-large">₹ {math.reportedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div className="field-row">
                                        <span>Counter Sale Mismatch</span>
                                        <strong className={(rec.reportedDifference || 0) !== 0 ? "text-error" : "text-success"}>
                                          ₹ {(rec.reportedDifference || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Box 2: Verification Data */}
                                  <div className="detail-data-box verification-box">
                                    <h3>VERIFICATION DETAILS (FINANCE)</h3>
                                    {isAck ? (
                                      <div className="box-fields-list">
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
                                        <div className="field-row divider-row">
                                          <span>Verified Deposit Total</span>
                                          <strong className="font-large">₹ {math.verifiedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="verification-form-inputs">
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
                                      </div>
                                    )}
                                  </div>

                                  {/* Box 3: Reconciliation and Remarks */}
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

                  {/* Expenses table logs */}
                  {logTab === 'expenses' && (
                    <div className="table-wrapper scroll-inside">
                      <table className="sharp-table">
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>DESCRIPTION</th>
                            <th>CATEGORY</th>
                            <th>AMOUNT</th>
                            <th>PAYMENT METHOD</th>
                            <th>STATUS</th>
                            <th className="text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {locationExpenses.map((exp: any) => (
                            <tr key={exp._id}>
                              <td>
                                <div className="date-cell">
                                  <CalendarIcon size={12} className="text-dim" />
                                  <strong>{new Date(exp.date).toLocaleDateString()}</strong>
                                </div>
                              </td>
                              <td>{exp.description}</td>
                              <td><span className="category-tag">{exp.category}</span></td>
                              <td className="font-numeric">₹ {exp.amount.toFixed(2)}</td>
                              <td>{exp.paymentMethod}</td>
                              <td>
                                <span className={`status-badge-inline ${
                                  exp.status === 'APPROVED' ? 'closed' :
                                  exp.status === 'REJECTED' ? 'rejected' :
                                  exp.status === 'PENDING_FINANCE' ? 'pending-fin' : 'open'
                                }`}>
                                  {exp.status === 'PENDING_COO' && 'PENDING COO'}
                                  {exp.status === 'PENDING_FINANCE' && 'PENDING FINANCE'}
                                  {exp.status === 'APPROVED' && 'APPROVED'}
                                  {exp.status === 'REJECTED' && 'REJECTED'}
                                </span>
                              </td>
                              <td className="text-right">
                                {exp.status === 'PENDING_FINANCE' ? (
                                  <div className="action-buttons-mini-flex">
                                    <button 
                                      className="action-btn-mini approve-btn"
                                      onClick={() => handleFinanceApprove(exp._id)}
                                      disabled={isSubmitting}
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      className="action-btn-mini reject-btn"
                                      onClick={() => handleFinanceReject(exp._id)}
                                      disabled={isSubmitting}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-dim">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {locationExpenses.length === 0 && (
                            <tr>
                              <td colSpan={7} className="empty-state">No expenses logged for this location.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
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
    </MainLayout>
  );
};

export default FinancePage;
