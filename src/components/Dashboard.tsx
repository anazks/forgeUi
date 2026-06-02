import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronRight, Loader2,
  Building, Activity, Users, Bell, Check,
  AlertTriangle, TrendingUp, DollarSign, Lock,
  ShoppingBag, Package, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip as ChartTooltip, Legend as ChartLegend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components globally
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, ChartTooltip, ChartLegend);

import {
  userApi, entityApi, rawMaterialApi,
  foodRequestApi, employeeApi, productionApi, purchaseApi,
  inventoryApi, revenueApi, expenseApi, functionOrderApi
} from '../services/api';
import MainLayout from '../layouts/MainLayout';

// ── Module-level sub-components (stable references, not recreated on render) ──
const KpiCard = ({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string
}) => (
  <div className="kpi-card">
    <div className="kpi-icon" style={accent ? { background: `${accent}18`, borderColor: `${accent}40`, color: accent } : undefined}>{icon}</div>
    <div className="kpi-body">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  </div>
);

const WorkflowBubble = ({ label, done }: { label: string; done: boolean }) => (
  <div className={`wf-bubble ${done ? 'done' : 'pending'}`}>
    <Check size={11} /><span>{label}</span>
  </div>
);

const WorkflowLine = ({ done }: { done: boolean }) => <div className={`wf-line ${done ? 'done' : ''}`} />;

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;


const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Slicer Filters (Corporate Only)
  const [locations, setLocations] = useState<any[]>([]);
  const [checkedLocations, setCheckedLocations] = useState<string[]>([]);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState<string>(getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState<string>(getLocalDateString(new Date()));

  // Corporate Tabs: 'business' | 'operations' | 'hr'
  const [activeTab, setActiveTab] = useState<'business' | 'operations' | 'hr'>('business');

  // Fetched Datasets
  const [revenueData, setRevenueData] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [functionOrders, setFunctionOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [foodRequests, setFoodRequests] = useState<any[]>([]);
  const [internalOrders, setInternalOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [hrDashboardMetrics, setHrDashboardMetrics] = useState<any>(null);

  // Single-Login Dashboard states (Center, Kitchen, etc.)
  const [localTodayRevenue, setLocalTodayRevenue] = useState<any>(null);
  const [localYesterdayRevenue, setLocalYesterdayRevenue] = useState<any>(null);
  const [localTomorrowRequest, setLocalTomorrowRequest] = useState<any>(null);

  // Audit state for Notification bar & Workflows
  const [todayStr] = useState<string>(getLocalDateString(new Date()));
  const [yesterdayStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  });
  const [tomorrowStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  });

  // Provision modal state
  const [isAdding, setIsAdding] = useState(false);
  const [newEntity, setNewEntity] = useState({ username: '', name: '', location: '' });

  // 1. Fetch user on mount & redirect if Store (merged now)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    const userStr = localStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    setUser(userData);
  }, [navigate]);

  // 2. Fetch locations when user is loaded (Corporate Roles)
  useEffect(() => {
    if (!user) return;
    const isCorporate = ['SUPER_ADMIN', 'ADMIN', 'COO', 'PARTNER'].includes(user.role);
    if (!isCorporate) return;

    const fetchLocs = async () => {
      try {
        const res = await userApi.getLocations(user.entity?._id || user.entity);
        const locs = res.data.data || [];
        setLocations(locs);
        // Default to checking all locations
        setCheckedLocations(locs.map((l: any) => l._id));
      } catch (err) {
        console.error('Failed to load locations', err);
      }
    };
    fetchLocs();
  }, [user]);

  // 3. Centralized Dashboard Data Fetching
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError('');

    const isCorporate = ['SUPER_ADMIN', 'ADMIN', 'COO', 'PARTNER'].includes(user.role);
    const entityId = user.entity?._id || user.entity;

    try {
      if (isCorporate) {
        // Enforce at least one location checked
        if (checkedLocations.length === 0) {
          setIsLoading(false);
          return;
        }

        // Fetch parallel datasets
        const [
          revRes, expRes, billRes, purchRes, foRes, empRes, frRes, ioRes, rmRes, invRes
        ] = await Promise.all([
          revenueApi.getDaily("", checkedLocations.join(','), startDate, endDate),
          expenseApi.getAll({ startDate, endDate, locationId: checkedLocations.join(',') }),
          purchaseApi.getBills(),
          purchaseApi.getAll(),
          functionOrderApi.getAll(),
          employeeApi.getAll(entityId),
          foodRequestApi.getAll(entityId),
          productionApi.getOrders('send'),
          rawMaterialApi.getAll(entityId),
          inventoryApi.getAll()
        ]);

        setRevenueData(revRes.data.data);
        setExpenses(expRes.data.data || []);
        setBills(billRes.data.data || []);
        setPurchases(purchRes.data.data || []);
        setFunctionOrders(foRes.data.data || []);
        setEmployees(empRes.data.data || []);
        setFoodRequests(frRes.data.data || []);
        setInternalOrders(ioRes.data.data || []);
        setRawMaterials(rmRes.data.data || []);
        setInventory(invRes.data.data || []);

        if (activeTab === 'hr') {
          try {
            const hrDash = await employeeApi.getHrDashboard(entityId);
            setHrDashboardMetrics(hrDash.data.data);
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        // Individual Login dashboard loads localized info
        const locationId = user._id;

        const [
          todayRevRes,
          yesterdayRevRes,
          tomorrowFrRes,
          expRes,
          billRes,
          purchRes,
          frRes,
          ioRes,
          invRes,
          rmRes
        ] = await Promise.all([
          revenueApi.getDaily(todayStr, undefined).catch(() => ({ data: { data: null } })),
          revenueApi.getDaily(yesterdayStr, undefined).catch(() => ({ data: { data: null } })),
          foodRequestApi.getAll(entityId, locationId),
          expenseApi.getAll({ locationId }),
          purchaseApi.getBills(),
          purchaseApi.getAll(),
          foodRequestApi.getAll(entityId),
          productionApi.getOrders('send'),
          inventoryApi.getAll(locationId),
          rawMaterialApi.getAll(entityId)
        ]);

        setLocalTodayRevenue(todayRevRes.data?.data || null);
        setLocalYesterdayRevenue(yesterdayRevRes.data?.data || null);
        setExpenses(expRes.data.data || []);
        setBills(billRes.data.data || []);
        setPurchases(purchRes.data.data || []);
        setFoodRequests(frRes.data.data || []);
        setInternalOrders(ioRes.data.data || []);
        setInventory(invRes.data.data || []);
        setRawMaterials(rmRes.data.data || []);

        // tomorrow request
        const tomorrowRequest = (tomorrowFrRes.data.data || []).find((fr: any) => {
          const dStr = getLocalDateString(new Date(fr.deliveryDate));
          return dStr === tomorrowStr;
        });
        setLocalTomorrowRequest(tomorrowRequest || null);

        if (user.role === 'HR') {
          const hrDash = await employeeApi.getHrDashboard(entityId);
          setHrDashboardMetrics(hrDash.data.data);
          const empRes = await employeeApi.getAll(entityId);
          setEmployees(empRes.data.data || []);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to sync dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  }, [user, checkedLocations, startDate, endDate, activeTab, todayStr, yesterdayStr, tomorrowStr]);

  // Fetch when slicers, tab, or user changes
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Helper: toggle checked location check state
  const handleToggleLocation = (locId: string) => {
    setCheckedLocations(prev => {
      if (prev.includes(locId)) {
        if (prev.length === 1) return prev; // Enforce at least one checked
        return prev.filter(id => id !== locId);
      } else {
        return [...prev, locId];
      }
    });
  };

  // Helper: check all / none
  const handleToggleAllLocations = () => {
    if (checkedLocations.length === locations.length) {
      // Keep only the first checked to prevent empty state
      setCheckedLocations([locations[0]?._id]);
    } else {
      setCheckedLocations(locations.map(l => l._id));
    }
  };

  // Provisioning admin handlers
  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await entityApi.create(newEntity);
      setNewEntity({ username: '', name: '', location: '' });
      setIsAdding(false);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to provision unit');
    }
  };

  // ------------------------------------------------------------------------
  // A. CUSTOM DATA CALCULATIONS & COMPUTATIONS
  // ------------------------------------------------------------------------

  // 1. Filtered Daily Revenues matching Checked locations
  const filteredDailyRevenues = useMemo(() => {
    if (!revenueData || !revenueData.records) return [];
    return (revenueData.records as any[]).filter((record: any) => {
      const locId = record.locationId?._id || record.locationId;
      return checkedLocations.includes(locId);
    });
  }, [revenueData, checkedLocations]);

  // 2. Business metrics: Sales
  const businessStats = useMemo(() => {
    let sales = 0;
    let b2cSales = 0;
    let onlineSales = 0;
    let functionSales = 0;

    let expensesTotal = 0;
    let otherExpenses = 0;
    let stockExpenses = 0;
    let payrollExpenses = 0;

    // Filter locations by checked IDs
    const checkedLocationsDetails = locations.filter(l => checkedLocations.includes(l._id));
    const checkedKitchenIds = checkedLocationsDetails.filter(l => l.role === 'KITCHEN').map(l => l._id);
    const checkedCenterIds = checkedLocationsDetails.filter(l => ['CENTERS', 'RESTAURANT', 'AGGREGATE'].includes(l.role)).map(l => l._id);
    const checkedNames = checkedLocationsDetails.map(l => l.name?.toUpperCase());

    // --- SALES ---
    // Daily Revenue: B2C, Online, and Kitchen B2B (must be cooApproved = true)
    filteredDailyRevenues.forEach((record: any) => {
      if (!record.cooApproved) return;

      const locId = record.locationId?._id || record.locationId;
      const isKitchen = checkedKitchenIds.includes(locId);

      if (isKitchen) {
        // Kitchen: count B2B dispatches
        const b2bVal = (record.b2bSales || []).reduce((acc: number, curr: any) => acc + (curr.totalVal || 0), 0);
        sales += b2bVal;
      } else {
        // Centers / Restaurants: count B2C & Online
        const b2cVal = (record.b2cSales || []).reduce((acc: number, curr: any) => acc + (curr.totalVal || 0), 0);
        const onlineVal = record.onlineSales?.totalSaleValue || 0;
        
        sales += b2cVal + onlineVal;
        b2cSales += b2cVal;
        onlineSales += onlineVal;
      }
    });

    // Function Bookings: eventDate overlaps range and centerId is in checked locations
    const startRange = new Date(startDate);
    startRange.setHours(0,0,0,0);
    const endRange = new Date(endDate);
    endRange.setHours(23,59,59,999);

    functionOrders.forEach((fo: any) => {
      const evDate = new Date(fo.eventDate);
      const isCenterChecked = checkedCenterIds.includes(fo.centerId?._id || fo.centerId);
      if (isCenterChecked && evDate >= startRange && evDate <= endRange) {
        sales += fo.totalOrderValue || 0;
        functionSales += fo.totalOrderValue || 0;
      }
    });

    // --- EXPENSES ---
    // Other approved expenses
    expenses.forEach((exp: any) => {
      const expDate = new Date(exp.date);
      const isLocChecked = checkedLocations.includes(exp.locationId?._id || exp.locationId);
      const isApproved = ['PENDING_FINANCE', 'APPROVED'].includes(exp.status);
      if (isLocChecked && expDate >= startRange && expDate <= endRange && isApproved) {
        otherExpenses += exp.approvedAmount !== undefined ? exp.approvedAmount : exp.amount;
      }
    });

    // Stock/purchase expenses: Bills and Purchases
    bills.forEach((b: any) => {
      const billDate = new Date(b.createdAt);
      const isDestChecked = checkedLocations.includes(b.destinationLocation?._id || b.destinationLocation);
      if (isDestChecked && billDate >= startRange && billDate <= endRange) {
        stockExpenses += b.totalAmount || 0;
      }
    });
    purchases.forEach((p: any) => {
      const purchaseDate = new Date(p.purchaseDate || p.createdAt);
      const isLocChecked = checkedLocations.includes(p.user?._id || p.user);
      if (isLocChecked && purchaseDate >= startRange && purchaseDate <= endRange) {
        stockExpenses += p.totalCost || 0;
      }
    });

    // Payroll: Employee monthly records
    const startYear = startRange.getFullYear();
    const startMonth = startRange.getMonth() + 1;
    const endYear = endRange.getFullYear();
    const endMonth = endRange.getMonth() + 1;

    // Filter employees mapped to checked locations
    const matchedEmployees = employees.filter(emp => checkedNames.includes(emp.locationName?.toUpperCase()));

    // We sum acknowledged employee records overlapping month/year period
    // Simple sum of records matching the list of employees, year, and month boundaries
    // In production we can pro-rate, but direct sum matches monthly budget dashboard expectations
    // Let's implement dynamic monthly filter matching the range
    matchedEmployees.forEach(emp => {
      // If we don't have monthly records loaded, fall back to takeHomeSalary * months count
      // Let's check how many months overlap
      const monthsOverlapCount = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      payrollExpenses += (emp.monthlyTakeHomeSalary || 0) * monthsOverlapCount;
    });

    expensesTotal = otherExpenses + stockExpenses + payrollExpenses;

    const netProfit = sales - expensesTotal;
    const netMargin = sales > 0 ? (netProfit / sales) * 100 : 0;

    return {
      sales,
      b2cSales,
      onlineSales,
      functionSales,
      expensesTotal,
      otherExpenses,
      stockExpenses,
      payrollExpenses,
      netProfit,
      netMargin
    };
  }, [revenueData, checkedLocations, startDate, endDate, functionOrders, expenses, bills, purchases, employees, locations, filteredDailyRevenues]);

  // 3. Operational metrics calculations
  const operationalStats = useMemo(() => {
    // Collect B2C Sales entries
    const b2cItems: any[] = [];
    filteredDailyRevenues.forEach((record: any) => {
      if (record.b2cSales) {
        b2cItems.push(...record.b2cSales);
      }
    });

    // Aggregates quantities & revenues by item name
    const dishSalesMap: { [key: string]: { qty: number; value: number } } = {};
    b2cItems.forEach((item: any) => {
      const name = (item.itemName || 'unknown').toUpperCase();
      if (!dishSalesMap[name]) {
        dishSalesMap[name] = { qty: 0, value: 0 };
      }
      dishSalesMap[name].qty += item.soldQty || 0;
      dishSalesMap[name].value += item.totalVal || 0;
    });

    const dishList = Object.entries(dishSalesMap).map(([name, stats]) => ({
      name,
      qty: stats.qty,
      value: stats.value
    })).filter(d => d.qty > 0);

    // Sort to find top/least
    const topSold = dishList.length > 0 ? [...dishList].sort((a,b) => b.qty - a.qty)[0] : null;
    const leastSold = dishList.length > 0 ? [...dishList].sort((a,b) => a.qty - b.qty)[0] : null;
    const topRevenue = dishList.length > 0 ? [...dishList].sort((a,b) => b.value - a.value)[0] : null;
    const leastRevenue = dishList.length > 0 ? [...dishList].sort((a,b) => a.value - b.value)[0] : null;

    // Mathematical Wastage: stockQty - soldQty
    const wastageMap: { [key: string]: { qty: number; cost: number } } = {};
    let totalWastageCost = 0;
    let hasOnlineSalesEnabled = false;

    // Check if any checked locations have online sales enabled
    const checkedLocationsDetails = locations.filter(l => checkedLocations.includes(l._id));
    hasOnlineSalesEnabled = checkedLocationsDetails.some(l => l.onlineSalesEnabled === true);

    filteredDailyRevenues.forEach((record: any) => {
      if (record.b2cSales) {
        record.b2cSales.forEach((item: any) => {
          const name = (item.itemName || 'unknown').toUpperCase();
          const wQty = Math.max(0, (item.stockQty || 0) - (item.soldQty || 0));
          const wCost = wQty * (item.unitPrice || 0);

          if (!wastageMap[name]) {
            wastageMap[name] = { qty: 0, cost: 0 };
          }
          wastageMap[name].qty += wQty;
          wastageMap[name].cost += wCost;
          totalWastageCost += wCost;
        });
      }
      if (record.onlineSales?.totalSaleValue > 0) {
        hasOnlineSalesEnabled = true;
      }
    });

    const wastageList = Object.entries(wastageMap).map(([name, stats]) => ({
      name,
      qty: stats.qty,
      cost: stats.cost
    })).filter(w => w.qty > 0);

    const highestWastageDish = wastageList.length > 0 ? [...wastageList].sort((a,b) => b.cost - a.cost)[0] : null;

    // Operational efficiency: order vs sold
    // Sum requestedQty in FoodRequests vs soldQty in DailyRevenues
    let totalOrderedQty = 0;
    let totalSoldQty = 0;

    const startRange = new Date(startDate);
    startRange.setHours(0,0,0,0);
    const endRange = new Date(endDate);
    endRange.setHours(23,59,59,999);

    foodRequests.forEach((fr: any) => {
      const isLocChecked = checkedLocations.includes(fr.centerId?._id || fr.centerId);
      const reqDate = new Date(fr.createdAt);
      if (isLocChecked && reqDate >= startRange && reqDate <= endRange) {
        (fr.requestedItems || []).forEach((item: any) => {
          totalOrderedQty += item.requestedQty || 0;
        });
      }
    });

    totalSoldQty = dishList.reduce((acc, curr) => acc + curr.qty, 0);
    const operationalEfficiency = totalOrderedQty > 0 ? (totalSoldQty / totalOrderedQty) * 100 : 0;

    return {
      topSold,
      leastSold,
      topRevenue,
      leastRevenue,
      highestWastageDish,
      totalWastageCost,
      hasOnlineSalesEnabled,
      totalOrderedQty,
      totalSoldQty,
      operationalEfficiency
    };
  }, [filteredDailyRevenues, foodRequests, checkedLocations, startDate, endDate, locations]);

  // 4. HR metrics calculations
  const hrStats = useMemo(() => {
    // Filter employees mapped to checked locations
    const checkedLocationsDetails = locations.filter(l => checkedLocations.includes(l._id));
    const checkedNames = checkedLocationsDetails.map(l => l.name?.toUpperCase());
    const matchedEmployees = employees.filter(emp => checkedNames.includes(emp.locationName?.toUpperCase()));

    // Employee split by designation
    const designationMap: { [key: string]: number } = {};
    matchedEmployees.forEach(emp => {
      const des = (emp.designation || 'Staff').toUpperCase();
      designationMap[des] = (designationMap[des] || 0) + 1;
    });

    // Outstanding advances
    // For matched employees, count configured advances
    let outstandingAdvances = hrDashboardMetrics?.totalAdvancesActive || 0;

    // Payroll by Staff designation
    const payrollMap: { [key: string]: number } = {};
    matchedEmployees.forEach(emp => {
      const des = (emp.designation || 'Staff').toUpperCase();
      payrollMap[des] = (payrollMap[des] || 0) + (emp.monthlyTakeHomeSalary || 0);
    });

    return {
      headcount: matchedEmployees.length,
      outstandingAdvances,
      designationMap,
      payrollMap
    };
  }, [employees, checkedLocations, locations, hrDashboardMetrics]);

  // 5. Audit Single Location (Yesterday/Today/Tomorrow Statuses)
  const auditStatuses = useMemo(() => {
    if (!user) return null;

    // Helper to evaluate center workflow conditions
    const checkCenterTimeline = (targetDateStr: string, revRecord: any) => {
      const frs = foodRequests.filter(fr => {
        const dStr = getLocalDateString(new Date(fr.deliveryDate));
        return dStr === targetDateStr && (fr.centerId?._id || fr.centerId) === user._id;
      });

      const hasRequest = frs.length > 0;
      const isApproved = frs.length > 0 && frs.some(fr => ['APPROVED', 'PARTIAL', 'RECEIVED'].includes(fr.status));
      
      const orders = internalOrders.filter(o => {
        const dStr = getLocalDateString(new Date(o.createdAt));
        return dStr === targetDateStr && (o.destinationLocation?._id || o.destinationLocation) === user._id;
      });
      const inProd = orders.length > 0;
      const received = orders.length > 0 && orders.every(o => o.status === 'RECEIVED');
      
      const closed = revRecord && revRecord.status === 'CLOSED' && revRecord.cashClosure?.submittedForCOO;

      return {
        hasRequest,
        isApproved,
        inProd,
        received,
        closed
      };
    };

    // Evaluate kitchen timeline
    const checkKitchenTimeline = (targetDateStr: string) => {
      const kitchenOrders = internalOrders.filter(o => {
        const dStr = getLocalDateString(new Date(o.createdAt));
        return dStr === targetDateStr && (o.sourceLocation?._id || o.sourceLocation) === user._id;
      });

      const hasOrders = kitchenOrders.length > 0;
      const allDispatched = kitchenOrders.length > 0 && kitchenOrders.every(o => o.status === 'DISPATCHED' || o.status === 'RECEIVED');

      return {
        hasOrders,
        allDispatched
      };
    };

    return {
      todayCenter: checkCenterTimeline(todayStr, localTodayRevenue),
      yesterdayCenter: checkCenterTimeline(yesterdayStr, localYesterdayRevenue),
      todayKitchen: checkKitchenTimeline(todayStr),
      yesterdayKitchen: checkKitchenTimeline(yesterdayStr)
    };
  }, [user, foodRequests, internalOrders, todayStr, yesterdayStr, localTodayRevenue, localYesterdayRevenue]);

  // ------------------------------------------------------------------------
  // B. DYNAMIC NOTIFICATION GENERATORS
  // ------------------------------------------------------------------------
  const notifications = useMemo(() => {
    const alerts: { id: string; text: string; severity: 'warning' | 'info' | 'critical' }[] = [];

    if (!user) return [];

    const isCorporate = ['SUPER_ADMIN', 'ADMIN', 'COO', 'PARTNER'].includes(user.role);

    if (isCorporate) {
      // 1. Day closures pending executive approval
      const pendingApprovalCount = filteredDailyRevenues.filter(r => r.status === 'CLOSED' && !r.cooApproved).length;
      if (pendingApprovalCount > 0) {
        alerts.push({
          id: 'coo_pending_closures',
          text: `👑 ${pendingApprovalCount} location day closure(s) are pending executive approval.`,
          severity: 'critical'
        });
      }

      // 2. Pending food/stock requests
      const pendingFrs = foodRequests.filter(fr => fr.status === 'PENDING').length;
      if (pendingFrs > 0) {
        alerts.push({
          id: 'coo_pending_requests',
          text: `🛒 ${pendingFrs} food / stock requests are awaiting review and approval.`,
          severity: 'warning'
        });
      }
    } else {
      // Individual Login Notifications
      const myId = user._id;

      if (['CENTERS', 'RESTAURANT', 'AGGREGATE'].includes(user.role)) {
        // Food request tomorrow created
        const hasTomorrowFr = foodRequests.some(fr => {
          const dStr = getLocalDateString(new Date(fr.deliveryDate));
          return dStr === tomorrowStr && (fr.centerId?._id || fr.centerId) === myId;
        });
        if (!hasTomorrowFr) {
          alerts.push({
            id: 'center_tomorrow_request',
            text: `⚠️ Food request for tomorrow (${tomorrowStr}) is not yet created!`,
            severity: 'warning'
          });
        }

        // Incoming deliveries pending
        const pendingDeliveries = internalOrders.filter(o => 
          (o.destinationLocation?._id || o.destinationLocation) === myId && o.status === 'DISPATCHED'
        ).length;
        if (pendingDeliveries > 0) {
          alerts.push({
            id: 'center_pending_delivery',
            text: `🚚 You have ${pendingDeliveries} incoming delivery shipment(s) from Kitchen pending receipt.`,
            severity: 'info'
          });
        }

        // Daily revenue closure pending
        if (localTodayRevenue && localTodayRevenue.status === 'OPEN') {
          alerts.push({
            id: 'center_today_closure',
            text: `📝 Daily revenue closure for today (${todayStr}) is pending closure!`,
            severity: 'warning'
          });
        }

        // Cash closure submission pending
        if (localTodayRevenue && localTodayRevenue.status === 'CLOSED' && !localTodayRevenue.cashClosure?.submittedForCOO) {
          alerts.push({
            id: 'center_cash_submission',
            text: `💵 Cash closure submission to COO is pending for today's logs.`,
            severity: 'warning'
          });
        }
      }

      if (user.role === 'KITCHEN') {
        // Orders pending production/dispatch
        const pendingProd = internalOrders.filter(o =>
          (o.sourceLocation?._id || o.sourceLocation) === myId && o.status === 'PENDING'
        ).length;
        if (pendingProd > 0) {
          alerts.push({
            id: 'kitchen_pending_production',
            text: `🍳 You have ${pendingProd} center food order(s) pending production / dispatch.`,
            severity: 'warning'
          });
        }
      }

      if (user.role === 'STORE') {
        // Stock gaps requiring PRs
        const safetyGaps = inventory.filter(inv => {
          const rm = rawMaterials.find(m => m._id === (inv.materialId?._id || inv.materialId));
          return rm && inv.currentStock < rm.minimumStock;
        }).length;
        if (safetyGaps > 0) {
          alerts.push({
            id: 'store_stock_gaps',
            text: `🚨 ${safetyGaps} raw material inventory item(s) are below minimum safety stock levels.`,
            severity: 'critical'
          });
        }

        // PRs pending approval
        const pendingPrs = bills.filter(b => b.deliveryStatus === 'PENDING').length;
        if (pendingPrs > 0) {
          alerts.push({
            id: 'store_pending_bills',
            text: `📦 ${pendingPrs} outstanding purchase orders are pending vendor delivery.`,
            severity: 'info'
          });
        }
      }

      if (user.role === 'FINANCE') {
        // Closures awaiting reconciliation
        // Closed, cooApproved, not financeReconciled
        const pendingReconcile = filteredDailyRevenues.filter(r => 
          r.status === 'CLOSED' && r.cooApproved && !r.financeReconciled
        ).length;
        if (pendingReconcile > 0) {
          alerts.push({
            id: 'finance_pending_reconcile',
            text: `🔍 ${pendingReconcile} location daily closure(s) are awaiting bank deposits reconciliation review.`,
            severity: 'warning'
          });
        }
      }

      if (user.role === 'HR') {
        // Monthly record draft
        alerts.push({
          id: 'hr_payroll_console',
          text: `📅 Payroll console is active. Review outstanding salary configurations in the console.`,
          severity: 'info'
        });
      }
    }

    return alerts;
  }, [user, foodRequests, internalOrders, tomorrowStr, localTodayRevenue, todayStr, filteredDailyRevenues, inventory, rawMaterials, bills]);

  // ── 5-min auto-refresh for individual logins only ──
  useEffect(() => {
    const isCorporate = ['SUPER_ADMIN', 'ADMIN', 'COO', 'PARTNER'].includes(user?.role || '');
    if (isCorporate || !user) return;
    const timer = setInterval(() => { fetchDashboardData(); }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user, fetchDashboardData]);

  // ── Chart data derivations ──
  const revenueChartData = useMemo(() => {
    const map: { [k: string]: { b2c: number; online: number; func: number } } = {};
    filteredDailyRevenues.forEach((r: any) => {
      const key = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      if (!map[key]) map[key] = { b2c: 0, online: 0, func: 0 };
      const b2c = (r.b2cSales || []).reduce((a: number, s: any) => a + (s.totalVal || 0), 0);
      const online = r.onlineSales?.totalSaleValue || 0;
      map[key].b2c += b2c;
      map[key].online += online;
    });
    const startRange = new Date(startDate); startRange.setHours(0,0,0,0);
    const endRange = new Date(endDate); endRange.setHours(23,59,59,999);
    functionOrders.forEach((fo: any) => {
      const evDate = new Date(fo.eventDate);
      if (evDate >= startRange && evDate <= endRange) {
        const key = evDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (!map[key]) map[key] = { b2c: 0, online: 0, func: 0 };
        map[key].func += fo.totalOrderValue || 0;
      }
    });
    return Object.entries(map).map(([date, v]) => ({ date, ...v, total: v.b2c + v.online + v.func }));
  }, [filteredDailyRevenues, functionOrders, startDate, endDate]);

  const expensePieData = useMemo(() => [
    { name: 'Payroll', value: businessStats.payrollExpenses, fill: '#f97316' },
    { name: 'Stock', value: businessStats.stockExpenses, fill: '#3b82f6' },
    { name: 'Operations', value: businessStats.otherExpenses, fill: '#10b981' },
  ].filter(d => d.value > 0), [businessStats]);

  const revChannelPieData = useMemo(() => [
    { name: 'Direct (B2C)', value: businessStats.b2cSales, fill: '#f97316' },
    { name: 'Online (Zomato/Swiggy)', value: businessStats.onlineSales, fill: '#a855f7' },
    { name: 'Function Events', value: businessStats.functionSales, fill: '#10b981' },
  ].filter(d => d.value > 0), [businessStats]);

  const designationPieData = useMemo(() =>
    Object.entries(hrStats.designationMap).map(([name, value], i) => ({
      name, value, fill: ['#f97316','#3b82f6','#10b981','#a855f7','#f59e0b','#06b6d4'][i % 6]
    }))
  , [hrStats.designationMap]);

  const payrollBarData = useMemo(() =>
    Object.entries(hrStats.payrollMap).map(([name, value]) => ({ name, value }))
  , [hrStats.payrollMap]);

  // Loading Indicator
  if (isLoading || !user) {
    return (
      <MainLayout>
        <div className="db-loading">
          <div className="db-spinner"><Loader2 size={36} className="spin-icon" /></div>
          <p className="db-loading-txt">Syncing dashboard metrics…</p>
        </div>
      </MainLayout>
    );
  }

  const isCorporate = ['SUPER_ADMIN', 'ADMIN', 'COO', 'PARTNER'].includes(user.role);

  return (
    <MainLayout>

      {/* ── NOTIFICATION BAR ── */}
      {notifications.length > 0 && (
        <div className="notif-bar">
          {notifications.map(n => (
            <div key={n.id} className={`notif-item sev-${n.severity}`}>
              <Bell size={13} className="notif-icon" />
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="db-header">
        <div className="db-header-left">
          <h1 className="db-title">
            {user.role === 'SUPER_ADMIN' ? '⚡ ENTERPRISE OPS' : `${user.role} DASHBOARD`}
          </h1>
          <p className="db-subtitle">Welcome back, {user.name?.toUpperCase()} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {isCorporate ? (
          <div className="db-slicers">
            {/* Fixed-position location dropdown */}
            <div className="loc-dd-wrap" id="loc-dd-root">
              <button
                className="dd-trigger"
                onClick={() => setIsLocationDropdownOpen(v => !v)}
              >
                <Building size={13} />
                <span>{checkedLocations.length === locations.length ? 'ALL LOCATIONS' : `${checkedLocations.length} LOCATION${checkedLocations.length !== 1 ? 'S' : ''}`}</span>
                <ChevronRight size={13} className={`dd-arrow ${isLocationDropdownOpen ? 'open' : ''}`} />
              </button>
              {isLocationDropdownOpen && (
                <div className="dd-panel">
                  <label className="dd-row dd-all">
                    <input type="checkbox" checked={checkedLocations.length === locations.length} onChange={handleToggleAllLocations} />
                    <span>Toggle All Locations</span>
                  </label>
                  <div className="dd-divider" />
                  <div className="dd-scroll">
                    {locations.map((loc: any) => (
                      <label key={loc._id} className="dd-row">
                        <input type="checkbox" checked={checkedLocations.includes(loc._id)} onChange={() => handleToggleLocation(loc._id)} />
                        <span>{loc.name?.toUpperCase()} <span className="dd-role-tag">{loc.role}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="date-slicer">
              <div className="date-field">
                <label>FROM</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="date-field">
                <label>TO</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <button className="btn-refresh" onClick={fetchDashboardData} title="Refresh data">
              <Activity size={14} /> REFRESH
            </button>

            {user.role === 'SUPER_ADMIN' && (
              <button className="btn-primary-sm" onClick={() => setIsAdding(true)}>
                <Plus size={13} /> REGISTER UNIT
              </button>
            )}
          </div>
        ) : (
          <div className="db-individual-meta">
            <span className="auto-refresh-badge">🔄 Auto-refresh every 5 min</span>
            <button className="btn-refresh" onClick={fetchDashboardData}><Activity size={14} /> REFRESH</button>
          </div>
        )}
      </header>

      {error && <div className="db-error">{error}</div>}

      {/* ═══════════════════════════════════════════════
          CORPORATE VIEW
      ═══════════════════════════════════════════════ */}
      {isCorporate ? (
        <div className="corp-dash">
          {/* Tab Nav */}
          <nav className="tab-bar">
            <button className={`tab-btn ${activeTab === 'business' ? 'active' : ''}`} onClick={() => setActiveTab('business')}>
              <TrendingUp size={15} /> BUSINESS
            </button>
            <button className={`tab-btn ${activeTab === 'operations' ? 'active' : ''}`} onClick={() => setActiveTab('operations')}>
              <Activity size={15} /> OPERATIONS
            </button>
            <button className={`tab-btn ${activeTab === 'hr' ? 'active' : ''}`} onClick={() => setActiveTab('hr')}>
              <Users size={15} /> HUMAN RESOURCES
            </button>
          </nav>

          {/* ─── BUSINESS TAB ─── */}
          {activeTab === 'business' && (
            <div className="tab-content">
              {/* KPI Row */}
              <div className="kpi-grid-4">
                <KpiCard icon={<DollarSign size={18} />} label="TOTAL GROUP SALES" value={fmt(businessStats.sales)} sub="B2C + Online + Functions" />
                <KpiCard icon={<ArrowDownRight size={18} />} label="TOTAL EXPENSES" value={fmt(businessStats.expensesTotal)} sub="Payroll + Stock + Opex" accent="#ef4444" />
                <KpiCard icon={<TrendingUp size={18} />} label="NET MARGIN" value={`${businessStats.netMargin.toFixed(1)}%`} sub="Profit / Sales ratio" accent={businessStats.netMargin >= 0 ? '#10b981' : '#ef4444'} />
                <KpiCard
                  icon={businessStats.netProfit >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  label="NET PROFIT"
                  value={fmt(businessStats.netProfit)}
                  sub="Sales minus Expenses"
                  accent={businessStats.netProfit >= 0 ? '#10b981' : '#ef4444'}
                />
              </div>

              {/* Charts Row 1: Revenue Trend + Revenue Channel Pie */}
              <div className="chart-row-2">
                <div className="chart-card">
                  <div className="chart-hdr">
                    <h2>REVENUE TREND</h2>
                    <span className="chart-sub">B2C · Online · Functions split by day</span>
                  </div>
                  <div className="chart-body">
                    {revenueChartData.length === 0 ? (
                      <div className="empty-chart">No closed revenue records in selected range</div>
                    ) : (
                      <Bar
                        data={{
                          labels: revenueChartData.map(d => d.date),
                          datasets: [
                            { label: 'Direct (B2C)', data: revenueChartData.map(d => d.b2c), backgroundColor: '#f97316', stack: 'a' },
                            { label: 'Online', data: revenueChartData.map(d => d.online), backgroundColor: '#a855f7', stack: 'a' },
                            { label: 'Function', data: revenueChartData.map(d => d.func), backgroundColor: '#10b981', stack: 'a' },
                          ]
                        }}
                        options={{
                          responsive: true, maintainAspectRatio: false,
                          plugins: {
                            legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
                            tooltip: { callbacks: { label: ctx => `₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
                          },
                          scales: {
                            x: { stacked: true, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
                            y: { stacked: true, ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v: any) => `₹${(v/1000).toFixed(0)}k` }, grid: { color: 'rgba(255,255,255,0.06)' } }
                          }
                        }}
                        height={220}
                      />
                    )}
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-hdr">
                    <h2>REVENUE CHANNEL SPLIT</h2>
                    <span className="chart-sub">Distribution by sales type</span>
                  </div>
                  <div className="chart-body pie-center">
                    {revChannelPieData.length === 0 ? (
                      <div className="empty-chart">No sales data</div>
                    ) : (
                      <div style={{ width: 240, height: 220 }}>
                        <Pie
                          data={{
                            labels: revChannelPieData.map(d => d.name),
                            datasets: [{ data: revChannelPieData.map(d => d.value), backgroundColor: revChannelPieData.map(d => d.fill), borderWidth: 0 }]
                          }}
                          options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 10 } },
                              tooltip: { callbacks: { label: ctx => `₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Row 2: Expense Pie + Daily Summary Table */}
              <div className="chart-row-2" style={{ marginTop: 24 }}>
                <div className="chart-card">
                  <div className="chart-hdr">
                    <h2>EXPENSE BREAKDOWN</h2>
                    <span className="chart-sub">Payroll · Stock · Operations</span>
                  </div>
                  <div className="chart-body pie-center">
                    {expensePieData.length === 0 ? (
                      <div className="empty-chart">No expense records found</div>
                    ) : (
                      <div style={{ width: 240, height: 200 }}>
                        <Pie
                          data={{
                            labels: expensePieData.map(d => d.name),
                            datasets: [{ data: expensePieData.map(d => d.value), backgroundColor: expensePieData.map(d => d.fill), borderWidth: 0, hoverOffset: 4 }]
                          }}
                          options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } },
                              tooltip: { callbacks: { label: ctx => `₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
                            },
                            cutout: '55%'
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="expense-legend">
                    {expensePieData.map(e => (
                      <div key={e.name} className="exp-row">
                        <span className="exp-dot" style={{ background: e.fill }} />
                        <span className="exp-name">{e.name}</span>
                        <span className="exp-val">{fmt(e.value)}</span>
                        <span className="exp-pct">({businessStats.expensesTotal > 0 ? ((e.value / businessStats.expensesTotal) * 100).toFixed(1) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-hdr">
                    <h2>DAILY LOCATION SUMMARY</h2>
                    <span className="chart-sub">{filteredDailyRevenues.length} records in range</span>
                  </div>
                  <div className="tbl-wrapper">
                    <table className="dash-table">
                      <thead><tr><th>DATE</th><th>LOCATION</th><th>STATUS</th><th style={{ textAlign: 'right' }}>SALES</th><th style={{ textAlign: 'right' }}>CASH</th></tr></thead>
                      <tbody>
                        {filteredDailyRevenues.slice(0, 10).map((rec: any, idx: number) => {
                          const statusText = rec.financeReconciled ? 'RECONCILED' : rec.cooApproved ? 'COO APPROVED' : rec.status === 'CLOSED' ? 'PENDING COO' : rec.status;
                          const statusCls = rec.financeReconciled ? 'bdg-green' : rec.cooApproved ? 'bdg-amber' : rec.status === 'CLOSED' ? 'bdg-blue' : 'bdg-grey';
                          return (
                            <tr key={rec._id || idx}>
                              <td>{new Date(rec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                              <td>{rec.locationId?.name?.toUpperCase()}</td>
                              <td><span className={`bdg ${statusCls}`}>{statusText}</span></td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(rec.totalAmount || 0)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(rec.cashClosure?.cashInHand || 0)}</td>
                            </tr>
                          );
                        })}
                        {filteredDailyRevenues.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>No records match selected filters</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── OPERATIONS TAB ─── */}
          {activeTab === 'operations' && (
            <div className="tab-content">
              <div className="kpi-grid-3">
                <KpiCard icon={<Activity size={18} />} label="PENDING FOOD REQUESTS" value={`${foodRequests.filter(fr => fr.status === 'PENDING').length}`} sub="Awaiting approval" />
                <KpiCard icon={<Clock size={18} />} label="ACTIVE DISPATCHES IN TRANSIT" value={`${internalOrders.filter(o => ['DISPATCHED','PARTIAL_DISPATCH'].includes(o.status)).length}`} sub="Logistics in motion" />
                <KpiCard icon={<TrendingUp size={18} />} label="OPERATIONAL EFFICIENCY" value={`${operationalStats.operationalEfficiency.toFixed(1)}%`} sub="Sold qty / Ordered qty" accent="#10b981" />
              </div>

              {/* Dish Rankings */}
              <div className="dish-rank-grid">
                <div className="dish-rank-card border-green">
                  <span className="dish-rank-lbl">🏆 TOP SOLD DISH</span>
                  <span className="dish-rank-name">{operationalStats.topSold?.name || '—'}</span>
                  <span className="dish-rank-val text-green">{operationalStats.topSold ? `${operationalStats.topSold.qty} units` : 'No records'}</span>
                </div>
                <div className="dish-rank-card border-red">
                  <span className="dish-rank-lbl">📉 LEAST SOLD DISH</span>
                  <span className="dish-rank-name">{operationalStats.leastSold?.name || '—'}</span>
                  <span className="dish-rank-val text-red">{operationalStats.leastSold ? `${operationalStats.leastSold.qty} units` : 'No records'}</span>
                </div>
                <div className="dish-rank-card border-green">
                  <span className="dish-rank-lbl">💰 TOP REVENUE DISH</span>
                  <span className="dish-rank-name">{operationalStats.topRevenue?.name || '—'}</span>
                  <span className="dish-rank-val text-green">{operationalStats.topRevenue ? fmt(operationalStats.topRevenue.value) : 'No records'}</span>
                </div>
                <div className="dish-rank-card border-red">
                  <span className="dish-rank-lbl">🔻 LEAST REVENUE DISH</span>
                  <span className="dish-rank-name">{operationalStats.leastRevenue?.name || '—'}</span>
                  <span className="dish-rank-val text-red">{operationalStats.leastRevenue ? fmt(operationalStats.leastRevenue.value) : 'No records'}</span>
                </div>
              </div>

              <div className="chart-row-2" style={{ marginTop: 24 }}>
                {/* Wastage Table */}
                <div className="chart-card">
                  <div className="chart-hdr"><h2>DISH WASTAGE ANALYSIS</h2><span className="chart-sub">Stock - Sold quantity · B2C records only</span></div>
                  {operationalStats.hasOnlineSalesEnabled && (
                    <div className="warn-banner"><AlertTriangle size={13} /> Wastage data is indicative only — online sales (Swiggy/Zomato) quantities are not itemized in closures.</div>
                  )}
                  <div className="tbl-wrapper">
                    <table className="dash-table">
                      <thead><tr><th>DISH NAME</th><th style={{ textAlign: 'right' }}>WASTAGE QTY</th><th style={{ textAlign: 'right' }}>EST. COST</th></tr></thead>
                      <tbody>
                        {(() => {
                          const map: { [k: string]: { qty: number; cost: number } } = {};
                          filteredDailyRevenues.forEach((r: any) => {
                            (r.b2cSales || []).forEach((item: any) => {
                              const k = (item.itemName || '').toUpperCase();
                              const wq = Math.max(0, (item.stockQty || 0) - (item.soldQty || 0));
                              if (wq > 0) {
                                if (!map[k]) map[k] = { qty: 0, cost: 0 };
                                map[k].qty += wq;
                                map[k].cost += wq * (item.unitPrice || 0);
                              }
                            });
                          });
                          const rows = Object.entries(map).sort((a, b) => b[1].cost - a[1].cost);
                          if (rows.length === 0) return <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No wastage recorded</td></tr>;
                          return rows.map(([name, v], i) => (
                            <tr key={i}><td>{name}</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{v.qty} pcs</td><td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>{fmt(v.cost)}</td></tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <div className="chart-footer">Total Wastage Cost: <strong style={{ color: '#ef4444' }}>{fmt(operationalStats.totalWastageCost)}</strong></div>
                </div>

                {/* Dispatch Board */}
                <div className="chart-card">
                  <div className="chart-hdr"><h2>ACTIVE DISPATCH BOARD</h2><span className="chart-sub">Logistics orders in motion</span></div>
                  <div className="tbl-wrapper">
                    <table className="dash-table">
                      <thead><tr><th>ORDER CODE</th><th>DESTINATION</th><th>STATUS</th></tr></thead>
                      <tbody>
                        {internalOrders.slice(0, 10).map((o: any) => (
                          <tr key={o._id}>
                            <td><code className="u-code">{o.orderCode}</code></td>
                            <td>{o.destinationLocation?.name?.toUpperCase()}</td>
                            <td><span className={`bdg ${o.status === 'RECEIVED' ? 'bdg-green' : o.status === 'DISPATCHED' ? 'bdg-blue' : 'bdg-grey'}`}>{o.status}</span></td>
                          </tr>
                        ))}
                        {internalOrders.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No active orders</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── HR TAB ─── */}
          {activeTab === 'hr' && (
            <div className="tab-content">
              <div className="kpi-grid-3">
                <KpiCard icon={<Users size={18} />} label="GROUP HEADCOUNT" value={`${hrStats.headcount}`} sub="Active employees mapped to selected locations" />
                <KpiCard icon={<DollarSign size={18} />} label="OUTSTANDING SALARY ADVANCES" value={fmt(hrStats.outstandingAdvances)} sub="Active advance balances" accent="#f59e0b" />
                <KpiCard icon={<Lock size={18} />} label="PAYROLL MONTHS LOCKED" value={`${hrDashboardMetrics?.closedMonthsCount || 0} / 12`} sub="Closed months in yearly record" />
              </div>

              <div className="chart-row-2" style={{ marginTop: 24 }}>
                <div className="chart-card">
                  <div className="chart-hdr"><h2>STAFF BY DESIGNATION</h2><span className="chart-sub">Headcount distribution</span></div>
                  <div className="chart-body pie-center">
                    {designationPieData.length === 0 ? (
                      <div className="empty-chart">No employee data for selected locations</div>
                    ) : (
                      <div style={{ width: 260, height: 220 }}>
                        <Pie
                          data={{
                            labels: designationPieData.map(d => d.name),
                            datasets: [{ data: designationPieData.map(d => d.value), backgroundColor: designationPieData.map(d => d.fill), borderWidth: 0 }]
                          }}
                          options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } },
                              tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} staff` } }
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-hdr"><h2>MONTHLY PAYROLL BY DESIGNATION</h2><span className="chart-sub">Salary expenditure allocation</span></div>
                  <div className="chart-body">
                    {payrollBarData.length === 0 ? (
                      <div className="empty-chart">No payroll data</div>
                    ) : (
                      <Bar
                        data={{
                          labels: payrollBarData.map(d => d.name),
                          datasets: [{ label: 'Monthly Payroll', data: payrollBarData.map(d => d.value), backgroundColor: '#f97316', borderRadius: 4 }]
                        }}
                        options={{
                          responsive: true, maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: ctx => `₹${Number(ctx.raw).toLocaleString('en-IN')}` } }
                          },
                          scales: {
                            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
                            y: { ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v: any) => `₹${(v/1000).toFixed(0)}k` }, grid: { color: 'rgba(255,255,255,0.06)' } }
                          }
                        }}
                        height={220}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      ) : (
      /* ═══════════════════════════════════════════════
         INDIVIDUAL ROLE DASHBOARD
      ═══════════════════════════════════════════════ */
        <div className="indiv-dash">

          {/* ── 3-DAY WORKFLOW PIPELINE (all except HR) ── */}
          {user.role !== 'HR' && (
            <div className="wf-card">
              <h2 className="wf-title">DAILY OPERATIONAL PIPELINE</h2>
              <div className="wf-rows">
                {[
                  { label: `YESTERDAY  (${yesterdayStr})`, highlight: false, isToday: false, isYesterday: true },
                  { label: `TODAY  (${todayStr})`, highlight: true, isToday: true, isYesterday: false },
                  { label: `TOMORROW  (${tomorrowStr})`, highlight: false, isToday: false, isYesterday: false },
                ].map(({ label, highlight, isToday, isYesterday }) => {
                  const kitchStatus = isYesterday ? auditStatuses?.yesterdayKitchen : isToday ? auditStatuses?.todayKitchen : null;
                  const centerStatus = isYesterday ? auditStatuses?.yesterdayCenter : isToday ? auditStatuses?.todayCenter : null;
                  return (
                    <div key={label} className="wf-row">
                      <span className={`wf-day-label ${highlight ? 'highlight' : ''}`}>{label}</span>
                      <div className="wf-steps">
                        {user.role === 'KITCHEN' ? (
                          <>
                            <WorkflowBubble label="Orders Received" done={kitchStatus?.hasOrders || false} />
                            <WorkflowLine done={kitchStatus?.allDispatched || false} />
                            <WorkflowBubble label="All Dispatched" done={kitchStatus?.allDispatched || false} />
                            {isToday && <WorkflowLine done={false} />}
                            {isToday && <WorkflowBubble label="Report Submitted" done={false} />}
                          </>
                        ) : isToday || isYesterday ? (
                          <>
                            <WorkflowBubble label="Request Created" done={centerStatus?.hasRequest || false} />
                            <WorkflowLine done={centerStatus?.isApproved || false} />
                            <WorkflowBubble label="Approved" done={centerStatus?.isApproved || false} />
                            <WorkflowLine done={centerStatus?.inProd || false} />
                            <WorkflowBubble label="In Production" done={centerStatus?.inProd || false} />
                            <WorkflowLine done={centerStatus?.received || false} />
                            <WorkflowBubble label="Delivered" done={centerStatus?.received || false} />
                            <WorkflowLine done={centerStatus?.closed || false} />
                            <WorkflowBubble label="Accounts Closed" done={centerStatus?.closed || false} />
                          </>
                        ) : (
                          <WorkflowBubble label="Food Request Planned" done={!!localTomorrowRequest} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── CENTER / RESTAURANT / AGGREGATE ── */}
          {['CENTERS', 'RESTAURANT', 'AGGREGATE'].includes(user.role) && (
            <div>
              <div className="kpi-grid-3" style={{ marginTop: 24 }}>
                <KpiCard icon={<DollarSign size={18} />} label="TODAY'S GROSS SALES" value={fmt(localTodayRevenue?.totalAmount || 0)} sub="Daily counter closures" />
                <KpiCard icon={<AlertTriangle size={18} />} label="DAILY WASTAGE ESTIMATE" value={fmt(operationalStats.totalWastageCost)} sub="Stock minus Sold valuation" accent="#f59e0b" />
                <KpiCard icon={<Clock size={18} />} label="PENDING INCOMING DELIVERIES" value={`${internalOrders.filter(o => (o.destinationLocation?._id || o.destinationLocation) === user._id && o.status === 'DISPATCHED').length}`} sub="Awaiting kitchen receipt" />
              </div>

              <div className="dish-rank-grid" style={{ marginTop: 20 }}>
                <div className="dish-rank-card border-green"><span className="dish-rank-lbl">🏆 TOP SOLD TODAY</span><span className="dish-rank-name">{operationalStats.topSold?.name || '—'}</span><span className="dish-rank-val text-green">{operationalStats.topSold ? `${operationalStats.topSold.qty} units` : 'No logs'}</span></div>
                <div className="dish-rank-card border-red"><span className="dish-rank-lbl">📉 LEAST SOLD TODAY</span><span className="dish-rank-name">{operationalStats.leastSold?.name || '—'}</span><span className="dish-rank-val text-red">{operationalStats.leastSold ? `${operationalStats.leastSold.qty} units` : 'No logs'}</span></div>
                <div className="dish-rank-card border-green"><span className="dish-rank-lbl">💰 TOP REVENUE DISH</span><span className="dish-rank-name">{operationalStats.topRevenue?.name || '—'}</span><span className="dish-rank-val text-green">{operationalStats.topRevenue ? fmt(operationalStats.topRevenue.value) : 'No logs'}</span></div>
                <div className="dish-rank-card border-red"><span className="dish-rank-lbl">🔻 LEAST REVENUE DISH</span><span className="dish-rank-name">{operationalStats.leastRevenue?.name || '—'}</span><span className="dish-rank-val text-red">{operationalStats.leastRevenue ? fmt(operationalStats.leastRevenue.value) : 'No logs'}</span></div>
              </div>
            </div>
          )}

          {/* ── KITCHEN MANAGER ── */}
          {user.role === 'KITCHEN' && (
            <div className="chart-card" style={{ marginTop: 24 }}>
              <div className="chart-hdr"><h2>TODAY'S FOOD REQUEST QUEUE</h2><span className="chart-sub">Approved center requests requiring production</span></div>
              <div className="tbl-wrapper">
                <table className="dash-table">
                  <thead><tr><th>CENTER</th><th>REQUEST ID</th><th>ITEMS</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {foodRequests.filter(fr => ['PENDING','APPROVED'].includes(fr.status)).slice(0, 12).map((fr: any, idx: number) => (
                      <tr key={idx}>
                        <td>{fr.centerName?.toUpperCase() || 'UNKNOWN'}</td>
                        <td><code className="u-code">#{fr._id?.slice(-6)}</code></td>
                        <td>{fr.requestedItems?.length || 0} items</td>
                        <td><span className={`bdg ${fr.status === 'APPROVED' ? 'bdg-green' : 'bdg-amber'}`}>{fr.status}</span></td>
                      </tr>
                    ))}
                    {foodRequests.filter(fr => ['PENDING','APPROVED'].includes(fr.status)).length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>No active food requests</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STORE MANAGER ── */}
          {user.role === 'STORE' && (
            <div>
              <div className="kpi-grid-2" style={{ marginTop: 24 }}>
                <KpiCard icon={<Package size={18} />} label="TOTAL INVENTORY ITEMS" value={`${inventory.length}`} sub="Materials tracked in warehouse" />
                <KpiCard icon={<ShoppingBag size={18} />} label="PENDING PO BILLS" value={`${bills.filter(b => b.deliveryStatus === 'PENDING').length}`} sub="Awaiting vendor delivery" accent="#f59e0b" />
              </div>
              <div className="chart-card" style={{ marginTop: 24 }}>
                <div className="chart-hdr"><h2>SAFETY STOCK GAPS</h2><span className="chart-sub">Items below minimum threshold</span></div>
                <div className="tbl-wrapper">
                  <table className="dash-table">
                    <thead><tr><th>MATERIAL</th><th style={{ textAlign: 'right' }}>CURRENT STOCK</th><th>STATUS</th></tr></thead>
                    <tbody>
                      {inventory.map((inv: any, idx: number) => (
                        <tr key={idx}>
                          <td>{(inv.materialId?.name || inv.name || 'ITEM').toUpperCase()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{inv.currentStock} {inv.unit}</td>
                          <td><span className={`bdg ${inv.currentStock <= 0 ? 'bdg-red' : 'bdg-green'}`}>{inv.currentStock <= 0 ? 'OUT OF STOCK' : 'IN STOCK'}</span></td>
                        </tr>
                      ))}
                      {inventory.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No inventory data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── FINANCE MANAGER ── */}
          {user.role === 'FINANCE' && (
            <div className="chart-row-2" style={{ marginTop: 24 }}>
              <div className="chart-card">
                <div className="chart-hdr"><h2>RECONCILIATION QUEUE</h2><span className="chart-sub">COO-approved, pending bank reconciliation</span></div>
                <div className="tbl-wrapper">
                  <table className="dash-table">
                    <thead><tr><th>LOCATION</th><th>DATE</th><th style={{ textAlign: 'right' }}>REPORTED SALES</th><th style={{ textAlign: 'right' }}>CASH IN HAND</th></tr></thead>
                    <tbody>
                      {filteredDailyRevenues.filter(r => r.cooApproved && !r.financeReconciled).map((rec: any, i: number) => (
                        <tr key={i}>
                          <td>{rec.locationId?.name?.toUpperCase()}</td>
                          <td>{new Date(rec.date).toLocaleDateString('en-IN')}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(rec.totalAmount || 0)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(rec.cashClosure?.cashInHand || 0)}</td>
                        </tr>
                      ))}
                      {filteredDailyRevenues.filter(r => r.cooApproved && !r.financeReconciled).length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>No pending reconciliations</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="chart-card">
                <div className="chart-hdr"><h2>UNPAID BILLS QUEUE</h2><span className="chart-sub">Outstanding vendor payments</span></div>
                <div className="tbl-wrapper">
                  <table className="dash-table">
                    <thead><tr><th>BILL CODE</th><th>DESTINATION</th><th style={{ textAlign: 'right' }}>AMOUNT DUE</th></tr></thead>
                    <tbody>
                      {bills.filter(b => b.paymentStatus === 'UNPAID').slice(0, 10).map((b: any, i: number) => (
                        <tr key={i}>
                          <td><code className="u-code">{b.billCode}</code></td>
                          <td>{b.destinationLocation?.name?.toUpperCase() || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>{fmt(b.totalAmount || 0)}</td>
                        </tr>
                      ))}
                      {bills.filter(b => b.paymentStatus === 'UNPAID').length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No unpaid bills</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── HR MANAGER ── */}
          {user.role === 'HR' && (
            <div>
              <div className="wf-card" style={{ marginBottom: 24 }}>
                <h2 className="wf-title">PAYROLL MONTHLY WORKFLOW</h2>
                <div className="wf-steps" style={{ marginTop: 16 }}>
                  <WorkflowBubble label="Leaves Applied" done={true} />
                  <WorkflowLine done={true} />
                  <WorkflowBubble label="Advance Deductions" done={true} />
                  <WorkflowLine done={!!(hrDashboardMetrics?.closedMonthsCount > 0)} />
                  <WorkflowBubble label="Salary Acknowledged" done={!!(hrDashboardMetrics?.closedMonthsCount > 0)} />
                </div>
              </div>
              <div className="kpi-grid-2">
                <KpiCard icon={<Users size={18} />} label="ACTIVE HEADCOUNT" value={`${employees.length}`} sub="Registered employees at your location" />
                <KpiCard icon={<DollarSign size={18} />} label="OUTSTANDING ADVANCES" value={fmt(hrDashboardMetrics?.totalAdvancesActive || 0)} sub="Active advance balances" accent="#f59e0b" />
              </div>
              {designationPieData.length > 0 && (
                <div className="chart-card" style={{ marginTop: 24 }}>
                  <div className="chart-hdr"><h2>STAFF DESIGNATION MIX</h2></div>
                  <div className="chart-body pie-center">
                    <PieChart width={300} height={200}>
                      <Pie data={designationPieData} cx={150} cy={95} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`} fontSize={9}>
                        {designationPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} />
                    </PieChart>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PROVISION MODAL (SUPER_ADMIN) ── */}
      {isAdding && (
        <div className="modal-overlay" onClick={() => setIsAdding(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">PROVISION NEW UNIT</h2>
            <form onSubmit={handleAddEntity}>
              <div className="modal-fields">
                <div className="modal-field">
                  <label>ENTITY NAME</label>
                  <input className="modal-input" value={newEntity.name} onChange={e => setNewEntity({ ...newEntity, name: e.target.value })} required />
                </div>
                <div className="modal-field">
                  <label>LOCATION</label>
                  <input className="modal-input" value={newEntity.location} onChange={e => setNewEntity({ ...newEntity, location: e.target.value })} required />
                </div>
                <div className="modal-field">
                  <label>IDENTIFIER (USERNAME)</label>
                  <input className="modal-input" value={newEntity.username} onChange={e => setNewEntity({ ...newEntity, username: e.target.value })} required />
                </div>
              </div>
              {error && <div className="db-error" style={{ marginTop: 12 }}>{error}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => { setIsAdding(false); setError(''); }}>CANCEL</button>
                <button type="submit" className="btn-primary-sm">CREATE UNIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        /* ─── Base Layout ─── */
        .db-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:420px; gap:16px; }
        .db-spinner { width:60px; height:60px; border-radius:50%; background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.2); display:flex; align-items:center; justify-content:center; }
        .spin-icon { color:#f97316; animation: spin 1s linear infinite; }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .db-loading-txt { font-size:.8rem; color:#64748b; font-weight:600; letter-spacing:1px; }

        /* ─── Notification Bar ─── */
        .notif-bar { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
        .notif-item { display:flex; align-items:center; gap:12px; padding:10px 18px; font-size:.78rem; font-weight:600; border-left:3px solid transparent; backdrop-filter:blur(10px); }
        .sev-warning { border-color:#f59e0b; background:rgba(245,158,11,0.05); color:#fcd34d; }
        .sev-info { border-color:#3b82f6; background:rgba(59,130,246,0.05); color:#93c5fd; }
        .sev-critical { border-color:#ef4444; background:rgba(239,68,68,0.05); color:#fca5a5; animation:pulse-crit 2s infinite; }
        @keyframes pulse-crit { 0%,100%{opacity:1} 50%{opacity:.7} }
        .notif-icon { flex-shrink:0; }

        /* ─── Header ─── */
        .db-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; margin-bottom:20px; background:#111827; border:1px solid #1e3a5f; border-radius:8px !important; }
        .db-title { font-size:1.1rem; font-weight:900; letter-spacing:2px; color:#f1f5f9; }
        .db-subtitle { font-size:.72rem; color:#64748b; margin-top:3px; letter-spacing:.5px; }
        .db-error { padding:12px 20px; background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; color:#fca5a5; font-size:.8rem; margin-bottom:16px; }

        /* ─── Slicers ─── */
        .db-slicers { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .db-individual-meta { display:flex; align-items:center; gap:12px; }
        .auto-refresh-badge { font-size:.7rem; color:#64748b; font-weight:600; letter-spacing:.5px; }

        /* ─── Location Dropdown (position:fixed to escape stacking) ─── */
        .loc-dd-wrap { position:relative; }
        .dd-trigger { background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; padding:8px 14px; font-size:.78rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; letter-spacing:.5px; border-radius:4px; }
        .dd-trigger:hover { border-color:#f97316; }
        .dd-arrow { transition:transform .2s ease; }
        .dd-arrow.open { transform:rotate(90deg); }
        .dd-panel { position:absolute; top:calc(100% + 6px); right:0; width:260px; background:#0f172a; border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:12px; z-index:9999; box-shadow:0 12px 40px rgba(0,0,0,0.7); display:flex; flex-direction:column; gap:8px; }
        .dd-row { display:flex; align-items:center; gap:10px; font-size:.78rem; color:#cbd5e1; cursor:pointer; padding:4px 0; }
        .dd-row input { cursor:pointer; accent-color:#f97316; }
        .dd-all { color:#f97316; font-weight:700; }
        .dd-divider { height:1px; background:rgba(255,255,255,0.08); margin:4px 0; }
        .dd-scroll { max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
        .dd-role-tag { font-size:.65rem; color:#475569; margin-left:4px; }

        /* ─── Date Slicer ─── */
        .date-slicer { display:flex; align-items:center; gap:10px; }
        .date-field { display:flex; flex-direction:column; gap:3px; }
        .date-field label { font-size:.6rem; font-weight:800; color:#475569; letter-spacing:.5px; }
        .date-field input { background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; padding:6px 10px; font-size:.78rem; border-radius:3px; outline:none; }
        .date-field input:focus { border-color:#f97316; }

        /* ─── Buttons ─── */
        .btn-refresh { background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; padding:8px 14px; font-size:.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; border-radius:4px; letter-spacing:.5px; }
        .btn-refresh:hover { border-color:#f97316; color:#f97316; }
        .btn-primary-sm { background:linear-gradient(135deg,#f97316,#ea580c); border:none; color:#fff; padding:8px 14px; font-size:.78rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; border-radius:4px; letter-spacing:.5px; }
        .btn-primary-sm:hover { filter:brightness(1.1); }
        .btn-ghost { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#94a3b8; padding:8px 14px; font-size:.8rem; font-weight:600; cursor:pointer; border-radius:4px; }
        .btn-ghost:hover { border-color:#f97316; color:#f97316; }

        /* ─── Tab Bar ─── */
        .corp-dash { }
        .tab-bar { display:flex; gap:4px; border-bottom:1px solid rgba(255,255,255,0.07); margin-bottom:24px; }
        .tab-btn { background:none; border:none; color:#64748b; padding:12px 20px; font-size:.8rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; border-bottom:2px solid transparent; transition:all .2s ease; letter-spacing:.5px; }
        .tab-btn:hover { color:#e2e8f0; }
        .tab-btn.active { color:#f97316; border-bottom-color:#f97316; }
        .tab-content { }

        /* ─── KPI Cards ─── */
        .kpi-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
        .kpi-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
        .kpi-grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        @media(max-width:900px){ .kpi-grid-4{grid-template-columns:repeat(2,1fr);} }
        .kpi-card { display:flex; align-items:center; gap:16px; padding:18px 20px; background:#111827; border:1px solid #1e3a5f; border-radius:8px !important; transition:border-color .25s,transform .2s; }
        .kpi-card:hover { border-color:#f97316; transform:translateY(-2px); }
        .kpi-icon { width:42px; height:42px; border-radius:8px; background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.15); display:flex; align-items:center; justify-content:center; color:#f97316; flex-shrink:0; }
        .kpi-body { display:flex; flex-direction:column; gap:2px; min-width:0; }
        .kpi-label { font-size:.6rem; font-weight:800; color:#475569; letter-spacing:.8px; text-transform:uppercase; }
        .kpi-value { font-size:1.15rem; font-weight:800; color:#f1f5f9; line-height:1.2; }
        .kpi-sub { font-size:.62rem; color:#64748b; }

        /* ─── Chart Cards ─── */
        .chart-row-2 { display:grid; grid-template-columns:3fr 2fr; gap:20px; }
        @media(max-width:900px){ .chart-row-2{grid-template-columns:1fr;} }
        .chart-card { background:#111827; border:1px solid #1e3a5f; border-radius:8px !important; overflow:hidden; }
        .chart-hdr { padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.07); }
        .chart-hdr h2 { font-size:.75rem; font-weight:800; letter-spacing:1px; color:#94a3b8; }
        .chart-sub { font-size:.65rem; color:#475569; margin-top:2px; display:block; }
        .chart-body { padding:16px 12px; overflow-x:auto; }
        .chart-body.pie-center { display:flex; justify-content:center; align-items:center; }
        .chart-footer { padding:10px 20px; border-top:1px solid rgba(255,255,255,0.07); font-size:.75rem; color:#64748b; }
        .empty-chart { color:#475569; font-size:.8rem; text-align:center; padding:40px 20px; }
        .warn-banner { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(245,158,11,0.05); border-bottom:1px solid rgba(245,158,11,0.15); font-size:.72rem; color:#fcd34d; }

        /* ─── Expense Legend ─── */
        .expense-legend { padding:12px 20px; display:flex; flex-direction:column; gap:8px; border-top:1px solid rgba(255,255,255,0.07); }
        .exp-row { display:flex; align-items:center; gap:8px; font-size:.75rem; }
        .exp-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .exp-name { flex:1; color:#94a3b8; }
        .exp-val { color:#e2e8f0; font-family:monospace; font-weight:600; }
        .exp-pct { color:#475569; font-size:.68rem; }

        /* ─── Dish Rankings ─── */
        .dish-rank-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        @media(max-width:900px){ .dish-rank-grid{grid-template-columns:repeat(2,1fr);} }
        .dish-rank-card { padding:16px 18px; background:#111827; border:1px solid #1e3a5f; border-radius:8px !important; display:flex; flex-direction:column; gap:6px; transition:border-color .2s; }
        .dish-rank-card:hover { border-color:rgba(249,115,22,0.4); }
        .border-green { border-left:3px solid #10b981 !important; }
        .border-red { border-left:3px solid #ef4444 !important; }
        .dish-rank-lbl { font-size:.6rem; font-weight:800; color:#64748b; letter-spacing:.5px; }
        .dish-rank-name { font-size:.95rem; font-weight:700; color:#f1f5f9; line-height:1.2; word-break:break-word; }
        .dish-rank-val { font-size:.75rem; font-weight:600; }
        .text-green { color:#10b981; }
        .text-red { color:#ef4444; }

        /* ─── Tables ─── */
        .tbl-wrapper { overflow-x:auto; max-height:300px; overflow-y:auto; }
        .dash-table { width:100%; border-collapse:collapse; font-size:.78rem; }
        .dash-table thead th { padding:10px 16px; text-align:left; font-size:.65rem; font-weight:800; color:#475569; letter-spacing:.7px; border-bottom:1px solid rgba(255,255,255,0.07); white-space:nowrap; background:rgba(15,23,42,0.4); position:sticky; top:0; z-index:1; }
        .dash-table tbody td { padding:9px 16px; border-bottom:1px solid rgba(255,255,255,0.04); color:#cbd5e1; }
        .dash-table tbody tr:hover { background:rgba(249,115,22,0.04); }

        /* ─── Badges ─── */
        .bdg { font-size:.62rem; font-weight:800; padding:3px 8px; border-radius:3px; text-transform:uppercase; letter-spacing:.3px; }
        .bdg-grey { background:rgba(255,255,255,0.05); color:#64748b; border:1px solid rgba(255,255,255,0.08); }
        .bdg-blue { background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.2); }
        .bdg-amber { background:rgba(245,158,11,0.12); color:#fbbf24; border:1px solid rgba(245,158,11,0.2); }
        .bdg-green { background:rgba(16,185,129,0.12); color:#34d399; border:1px solid rgba(16,185,129,0.2); }
        .bdg-red { background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.2); }
        .u-code { font-family:monospace; background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.2); color:#f97316; padding:2px 6px; border-radius:3px; font-size:.8em; }

        /* ─── Workflow Pipeline ─── */
        .wf-card { background:#111827; border:1px solid #1e3a5f; border-radius:8px !important; padding:20px 24px; }
        .wf-title { font-size:.75rem; font-weight:800; color:#64748b; letter-spacing:1px; margin-bottom:4px; }
        .wf-rows { display:flex; flex-direction:column; gap:16px; margin-top:16px; }
        .wf-row { display:flex; align-items:center; gap:20px; }
        .wf-day-label { width:190px; flex-shrink:0; font-size:.7rem; font-weight:800; color:#475569; letter-spacing:.8px; }
        .wf-day-label.highlight { color:#f97316; }
        .wf-steps { display:flex; align-items:center; gap:10px; overflow-x:auto; padding:4px 0; }
        .wf-bubble { display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.1); font-size:.7rem; font-weight:700; color:#475569; white-space:nowrap; flex-shrink:0; }
        .wf-bubble.done { border-color:#10b981; color:#10b981; background:rgba(16,185,129,0.08); }
        .wf-bubble.pending { }
        .wf-line { width:28px; height:2px; background:rgba(255,255,255,0.08); flex-shrink:0; }
        .wf-line.done { background:#10b981; }

        /* ─── Individual dashboard ─── */
        .indiv-dash { }

        /* ─── Modal ─── */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:10000; }
        .modal-box { background:#0f172a; border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:28px; width:100%; max-width:420px; }
        .modal-title { font-size:.9rem; font-weight:900; letter-spacing:1.5px; color:#f1f5f9; margin-bottom:20px; }
        .modal-fields { display:flex; flex-direction:column; gap:14px; }
        .modal-field { display:flex; flex-direction:column; gap:4px; }
        .modal-field label { font-size:.65rem; font-weight:800; color:#475569; letter-spacing:.5px; }
        .modal-input { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; padding:9px 12px; font-size:.82rem; border-radius:4px; outline:none; }
        .modal-input:focus { border-color:#f97316; }
        .modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
      `}</style>
    </MainLayout>
  );
};

export default Dashboard;
