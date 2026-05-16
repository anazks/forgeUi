import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Search, 
  Store, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  UtensilsCrossed,
  PackageMinus,
  RefreshCw,
  MapPin,
  Clock
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { userApi, wastageApi, foodRequestApi } from '../services/api';

const CentersDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { entityId } = useParams<{ entityId: string }>();
  
  const [view, setView] = useState<'total' | 'center'>('total');
  const [selectedCenter, setSelectedCenter] = useState<any>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [allWastage, setAllWastage] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Center detail state
  const [centerTab, setCenterTab] = useState<'dashboard' | 'requests' | 'wastage'>('dashboard');
  const [centerRequests, setCenterRequests] = useState<any[]>([]);
  const [centerWastage, setCenterWastage] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, [entityId]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [centersRes, wastageRes] = await Promise.all([
        userApi.getMyCenters(entityId),
        wastageApi.getAll()
      ]);
      setCenters(centersRes.data.data || []);
      setAllWastage(wastageRes.data.data || []);
    } catch (err: any) {
      setError('Failed to load center data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCenterClick = async (center: any) => {
    setSelectedCenter(center);
    setView('center');
    setCenterTab('dashboard');
    setIsLoading(true);
    try {
      const [reqRes, wastRes] = await Promise.all([
        foodRequestApi.getAll(entityId, center._id),
        wastageApi.getAll(center._id)
      ]);
      
      setCenterRequests(reqRes.data.data || []);
      setCenterWastage(wastRes.data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const backToTotal = () => {
    setView('total');
    setSelectedCenter(null);
  };

  // Filter wastage based on selected date
  const filteredWastage = selectedDate 
    ? allWastage.filter(r => r.date === selectedDate)
    : allWastage;

  // Aggregated Stats
  const totalSales = filteredWastage.reduce((sum, r) => sum + (r.totalSales || 0), 0);
  const totalCost = filteredWastage.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const totalMargin = filteredWastage.reduce((sum, r) => sum + (r.totalMargin || 0), 0);
  const totalWastage = filteredWastage.reduce((sum, r) => sum + (r.totalWastageCost || 0), 0);

  // Group by Month (using ALL wastage for the trend bar)
  const monthlyData = allWastage.reduce((acc: any, curr) => {
    const d = new Date(curr.date);
    const monthKey = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, sales: 0, margin: 0, count: 0, dateObj: new Date(d.getFullYear(), d.getMonth(), 1) };
    }
    acc[monthKey].sales += curr.totalSales || 0;
    acc[monthKey].margin += curr.totalMargin || 0;
    acc[monthKey].count += 1;
    return acc;
  }, {});

  const sortedMonthly = Object.values(monthlyData).sort((a: any, b: any) => b.dateObj.getTime() - a.dateObj.getTime());

  // Recent performance (Date Sorted - using filtered data)
  const sortedPerformance = [...filteredWastage].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (isLoading && view === 'total') return <ForgeLoader />;

  return (
    <MainLayout>
      <div className="centers-analytics">
        {view === 'total' ? (
          <>
            <header className="page-header">
              <div className="header-title">
                <h1>CENTERS ANALYTICS</h1>
                <p className="subtitle">{selectedDate ? `PERFORMANCE FOR ${new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}` : 'TOTAL PERFORMANCE & REVENUE TRACKING'}</p>
              </div>
              <div className="header-filters">
                <div className="date-filter-box">
                  <Calendar size={14} />
                  <label>FILTER BY DATE</label>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                  />
                  {selectedDate && (
                    <button className="btn-clear" onClick={() => setSelectedDate('')}>
                      <RefreshCw size={12} /> CLEAR
                    </button>
                  )}
                </div>
              </div>
            </header>

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon income"><DollarSign size={20} /></div>
                <div className="stat-info">
                  <label>TOTAL REVENUE</label>
                  <h3>₹ {totalSales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon cost"><TrendingDown size={20} /></div>
                <div className="stat-info">
                  <label>TOTAL COST</label>
                  <h3>₹ {totalCost.toLocaleString()}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon margin"><TrendingUp size={20} /></div>
                <div className="stat-info">
                  <label>TOTAL MARGIN</label>
                  <h3>₹ {totalMargin.toLocaleString()}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon wastage"><PackageMinus size={20} /></div>
                <div className="stat-info">
                  <label>WASTAGE LOSS</label>
                  <h3>₹ {totalWastage.toLocaleString()}</h3>
                </div>
              </div>
            </section>

            {/* Monthly Summary Bar */}
            <div className="monthly-performance-bar">
               <div className="mpb-header">
                  <Calendar size={14} /> 
                  <h2>MONTHLY PERFORMANCE OVERVIEW</h2>
               </div>
               <div className="mpb-scroll">
                  {sortedMonthly.map((m: any) => (
                    <div key={m.month} className="mpb-card">
                      <span className="mpb-month">{m.month.toUpperCase()}</span>
                      <div className="mpb-stats">
                        <div className="mpb-stat">
                          <span className="mpb-label">REVENUE</span>
                          <span className="mpb-val">₹{m.sales.toLocaleString()}</span>
                        </div>
                        <div className="mpb-stat">
                          <span className="mpb-label">MARGIN</span>
                          <span className={`mpb-val ${m.margin >= 0 ? 'plus' : 'minus'}`}>₹{m.margin.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="data-split">
              <div className="split-left">
                <div className="panel">
                  <div className="panel-header">
                    <h2><Store size={14} /> ACTIVE CENTERS ({centers.length})</h2>
                  </div>
                  <div className="center-list">
                    {centers.map(center => (
                      <div key={center._id} className="center-item" onClick={() => handleCenterClick(center)}>
                        <div className="ci-avatar">{center.name[0]}</div>
                        <div className="ci-info">
                          <h4>{center.name.toUpperCase()}</h4>
                          <span className="ci-loc"><MapPin size={10} /> {center.location || 'Default Location'}</span>
                        </div>
                        <ChevronRight size={16} className="ci-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="split-right">
                <div className="panel">
                  <div className="panel-header">
                    <h2><Clock size={14} /> RECENT PERFORMANCE (DATE SORTED)</h2>
                  </div>
                  <div className="performance-table-wrap scroll-inside">
                    <table className="sharp-table">
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>CENTER</th>
                          <th>REVENUE</th>
                          <th>MARGIN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPerformance.map(record => (
                          <tr key={record._id}>
                            <td className="date-cell">{new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                            <td><strong>{record.centerId?.name?.toUpperCase()}</strong></td>
                            <td className="income-cell">₹ {record.totalSales?.toFixed(2)}</td>
                            <td className={`margin-cell ${record.totalMargin >= 0 ? 'plus' : 'minus'}`}>
                              ₹ {record.totalMargin?.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sortedPerformance.length === 0 && <div className="empty-state">No performance records found.</div>}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="page-header center-header">
              <button className="btn-back" onClick={backToTotal}><ArrowLeft size={16} /> BACK</button>
              <div className="header-title">
                <h1>{selectedCenter?.name?.toUpperCase()}</h1>
                <p className="subtitle">CENTER PERFORMANCE DASHBOARD</p>
              </div>
            </header>

            <div className="center-tabs">
              <button className={`tab-btn ${centerTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCenterTab('dashboard')}>
                <LayoutDashboard size={14} /> DASHBOARD
              </button>
              <button className={`tab-btn ${centerTab === 'requests' ? 'active' : ''}`} onClick={() => setCenterTab('requests')}>
                <UtensilsCrossed size={14} /> FOOD REQUESTS
              </button>
              <button className={`tab-btn ${centerTab === 'wastage' ? 'active' : ''}`} onClick={() => setCenterTab('wastage')}>
                <PackageMinus size={14} /> WASTAGE & SALES
              </button>
            </div>

            <div className="tab-content">
              {isLoading ? <ForgeLoader /> : (
                <>
                  {centerTab === 'dashboard' && (
                    <div className="center-stats-view">
                      <section className="stats-grid mini">
                        <div className="stat-card compact">
                          <div className="stat-header">
                             <UtensilsCrossed size={14} />
                             <label>TOTAL ORDERS</label>
                          </div>
                          <h3>{centerRequests.length}</h3>
                          <div className="stat-footer">LIFETIME REQUESTS</div>
                        </div>
                        <div className="stat-card compact">
                          <div className="stat-header">
                             <DollarSign size={14} />
                             <label>TOTAL REVENUE</label>
                          </div>
                          <h3 className="income-text">₹ {centerWastage.reduce((s,r) => s + (r.totalSales || 0), 0).toLocaleString()}</h3>
                          <div className="stat-footer">LIFETIME REVENUE</div>
                        </div>
                        <div className="stat-card compact">
                          <div className="stat-header">
                             <TrendingUp size={14} />
                             <label>AVG MARGIN</label>
                          </div>
                          <h3 className="margin-text">₹ {(centerWastage.reduce((s,r) => s + (r.totalMargin || 0), 0) / (centerWastage.length || 1)).toFixed(2)}</h3>
                          <div className="stat-footer">PER DAY AVERAGE</div>
                        </div>
                        <div className="stat-card compact">
                          <div className="stat-header">
                             <PackageMinus size={14} />
                             <label>WASTAGE LOSS</label>
                          </div>
                          <h3 className="loss-text">₹ {centerWastage.reduce((s,r) => s + (r.totalWastageCost || 0), 0).toLocaleString()}</h3>
                          <div className="stat-footer">LIFETIME LOSS</div>
                        </div>
                      </section>

                      {/* Recent Trend for this center */}
                      <div className="panel center-trend-panel">
                        <div className="panel-header">
                          <h2><TrendingUp size={14} /> PERFORMANCE TREND (LAST 7 RECORDS)</h2>
                        </div>
                        <div className="trend-row-container">
                          {centerWastage.slice(0, 7).map((rec: any) => (
                            <div key={rec._id} className="trend-tile">
                              <span className="tt-date">{new Date(rec.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                              <div className="tt-bar-wrap">
                                <div className="tt-bar income" style={{ height: `${Math.min((rec.totalSales / 5000) * 100, 100)}%` }}></div>
                                <div className="tt-bar margin" style={{ height: `${Math.min((Math.max(rec.totalMargin, 0) / 5000) * 100, 100)}%` }}></div>
                              </div>
                              <span className="tt-val">₹{rec.totalSales > 1000 ? (rec.totalSales / 1000).toFixed(1) + 'k' : rec.totalSales}</span>
                            </div>
                          ))}
                          {centerWastage.length === 0 && <div className="empty-state">Not enough data for trends.</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  {centerTab === 'requests' && (
                    <div className="panel">
                       <div className="panel-header">
                        <h2><Clock size={14} /> REQUEST HISTORY (DATE WISE)</h2>
                      </div>
                      <div className="scroll-inside detail-scroll">
                        <table className="sharp-table">
                          <thead>
                            <tr>
                              <th>REQUEST DATE</th>
                              <th>DELIVERY DATE</th>
                              <th>ITEMS</th>
                              <th style={{ textAlign: 'center' }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...centerRequests].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(req => (
                              <tr key={req._id}>
                                <td className="date-cell">{new Date(req.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>{new Date(req.deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>
                                  <div className="req-items-list">
                                    {req.requestedItems.slice(0, 2).map((item: any, i: number) => (
                                      <span key={i} className="req-item-tag">{item.materialName} ({item.requestedQty})</span>
                                    ))}
                                    {req.requestedItems.length > 2 && <span className="req-item-more">+{req.requestedItems.length - 2} MORE</span>}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`status-badge ${req.status.toLowerCase()}`}>{req.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {centerRequests.length === 0 && <div className="empty-state">No requests found for this center.</div>}
                    </div>
                  )}

                  {centerTab === 'wastage' && (
                    <div className="panel">
                      <div className="panel-header">
                        <h2><PackageMinus size={14} /> WASTAGE & SALES HISTORY (DATE WISE)</h2>
                      </div>
                      <div className="scroll-inside detail-scroll">
                        <table className="sharp-table">
                          <thead>
                            <tr>
                              <th>DATE</th>
                              <th>TOTAL COST</th>
                              <th>TOTAL INCOME</th>
                              <th>WASTAGE LOSS</th>
                              <th style={{ textAlign: 'right' }}>DAILY MARGIN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...centerWastage].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(rec => (
                              <tr key={rec._id}>
                                <td className="date-cell">{new Date(rec.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>₹ {rec.totalCost?.toFixed(2)}</td>
                                <td className="income-cell">₹ {rec.totalSales?.toFixed(2)}</td>
                                <td style={{ color: '#ef4444', fontWeight: 700 }}>₹ {rec.totalWastageCost?.toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }} className={`margin-cell ${rec.totalMargin >= 0 ? 'plus' : 'minus'}`}>
                                  ₹ {rec.totalMargin?.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {centerWastage.length === 0 && <div className="empty-state">No wastage records found for this center.</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .centers-analytics { padding: 0; }
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .center-header { align-items: center; justify-content: flex-start; gap: 20px; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        
        .header-filters { display: flex; gap: 16px; align-items: flex-end; }
        .date-filter-box { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
        .date-filter-box label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .date-filter-box input { background: transparent; border: none; color: var(--primary); font-size: 0.8rem; font-weight: 800; outline: none; cursor: pointer; }
        .btn-clear { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.2); color: var(--primary); font-size: 0.6rem; font-weight: 800; padding: 4px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s; }
        .btn-clear:hover { background: var(--primary); color: white; }

        .btn-back { background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 8px 16px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-back:hover { border-color: var(--primary); color: var(--primary); }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 32px; }
        .stat-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 24px; display: flex; align-items: center; gap: 16px; }
        .stat-icon { width: 42px; height: 42px; background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.1); display: flex; align-items: center; justify-content: center; }
        .stat-icon.income { color: #10b981; background: rgba(16,185,129,0.05); border-color: rgba(16,185,129,0.1); }
        .stat-icon.cost { color: #3b82f6; background: rgba(59,130,246,0.05); border-color: rgba(59,130,246,0.1); }
        .stat-icon.margin { color: #f59e0b; background: rgba(245,158,11,0.05); border-color: rgba(245,158,11,0.1); }
        .stat-icon.wastage { color: #ef4444; background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.1); }
        
        .stat-info label { display: block; font-size: 0.6rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; letter-spacing: 0.5px; }
        .stat-info h3 { font-size: 1.3rem; font-weight: 800; color: var(--text-main); }

        .stats-grid.mini { gap: 12px; margin-bottom: 24px; }
        .stat-card.compact { padding: 16px; flex-direction: column; align-items: flex-start; gap: 8px; }
        .stat-header { display: flex; align-items: center; gap: 8px; width: 100%; }
        .stat-header label { margin-bottom: 0; }
        .stat-header svg { color: var(--primary); }
        .stat-card h3 { font-size: 1.1rem; margin: 4px 0; }
        .stat-footer { font-size: 0.5rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .income-text { color: #10b981; }
        .margin-text { color: #f59e0b; }
        .loss-text { color: #ef4444; }

        /* Trend Visualizer */
        .center-trend-panel { margin-top: 0; }
        .trend-row-container { display: flex; gap: 12px; padding: 24px; overflow-x: auto; min-height: 180px; align-items: flex-end; background: rgba(0,0,0,0.1); }
        .trend-tile { flex: 1; min-width: 60px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .tt-date { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); }
        .tt-bar-wrap { width: 24px; height: 80px; background: rgba(255,255,255,0.03); display: flex; align-items: flex-end; gap: 2px; position: relative; }
        .tt-bar { width: 100%; transition: height 0.6s ease-out; }
        .tt-bar.income { background: #10b981; opacity: 0.8; }
        .tt-bar.margin { background: #f59e0b; opacity: 0.8; }
        .tt-val { font-size: 0.6rem; font-weight: 800; color: var(--text-main); }

        /* Detail Tables */
        .detail-scroll { max-height: 400px; }
        .req-items-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .req-item-tag { font-size: 0.6rem; font-weight: 800; background: rgba(249,115,22,0.08); color: var(--primary); border: 1px solid rgba(249,115,22,0.2); padding: 2px 6px; }
        .req-item-more { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); align-self: center; }

        /* Monthly Bar */
        .monthly-performance-bar { background: var(--bg-sidebar); border: 1px solid var(--border-main); margin-bottom: 24px; }
        .mpb-header { padding: 12px 20px; border-bottom: 1px solid var(--border-main); display: flex; align-items: center; gap: 8px; }
        .mpb-header h2 { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .mpb-header svg { color: var(--primary); }
        .mpb-scroll { display: flex; overflow-x: auto; padding: 16px 20px; gap: 16px; scrollbar-width: thin; scrollbar-color: var(--border-main) transparent; }
        .mpb-card { min-width: 180px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 12px; }
        .mpb-month { font-size: 0.65rem; font-weight: 800; color: var(--primary); display: block; margin-bottom: 10px; letter-spacing: 0.5px; }
        .mpb-stats { display: flex; flex-direction: column; gap: 6px; }
        .mpb-stat { display: flex; justify-content: space-between; align-items: center; }
        .mpb-label { font-size: 0.55rem; font-weight: 700; color: var(--text-dim); }
        .mpb-val { font-size: 0.8rem; font-weight: 800; }
        .mpb-val.plus { color: #10b981; }
        .mpb-val.minus { color: #ef4444; }

        .data-split { display: grid; grid-template-columns: 350px 1fr; gap: 24px; }
        .panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); height: 100%; display: flex; flex-direction: column; }
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .panel-header h2 { font-size: 0.75rem; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }

        .center-list { display: flex; flex-direction: column; overflow-y: auto; max-height: 500px; }
        .center-item { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; align-items: center; gap: 16px; cursor: pointer; transition: 0.2s; position: relative; }
        .center-item:hover { background: rgba(249,115,22,0.03); }
        .center-item:last-child { border-bottom: none; }
        .ci-avatar { width: 36px; height: 36px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; }
        .ci-info h4 { font-size: 0.85rem; font-weight: 800; color: var(--text-main); margin-bottom: 2px; }
        .ci-loc { font-size: 0.65rem; color: var(--text-dim); font-weight: 700; display: flex; align-items: center; gap: 4px; }
        .ci-arrow { color: var(--text-dim); opacity: 0; transition: 0.2s; position: absolute; right: 20px; }
        .center-item:hover .ci-arrow { opacity: 1; transform: translateX(5px); }

        .performance-table-wrap { padding: 0; }
        .performance-table-wrap.scroll-inside { max-height: 500px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border-main) transparent; }
        .sharp-table { width: 100%; border-collapse: collapse; }
        .sharp-table thead { position: sticky; top: 0; background: var(--bg-sidebar); z-index: 10; }
        .sharp-table th { font-size: 0.65rem; color: var(--text-dim); font-weight: 800; text-transform: uppercase; padding: 12px 20px; text-align: left; border-bottom: 1px solid var(--border-main); }
        .sharp-table td { padding: 14px 20px; font-size: 0.8rem; border-bottom: 1px solid var(--border-main); }
        .date-cell { color: var(--text-dim); font-weight: 700; }
        .income-cell { color: #10b981; font-weight: 800; }
        .margin-cell { font-weight: 800; }
        .margin-cell.plus { color: #10b981; }
        .margin-cell.minus { color: #ef4444; }

        .center-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border-main); padding-bottom: 0; }
        .tab-btn { background: none; border: 1px solid transparent; color: var(--text-dim); font-size: 0.75rem; font-weight: 800; padding: 10px 20px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; position: relative; bottom: -1px; }
        .tab-btn:hover { color: var(--text-main); }
        .tab-btn.active { color: var(--primary); border: 1px solid var(--border-main); border-bottom-color: var(--bg-main); background: var(--bg-main); }

        .status-badge { font-size: 0.6rem; font-weight: 800; padding: 2px 8px; border-radius: 0; }
        .status-badge.approved { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }

        .empty-state { padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.8rem; font-weight: 700; }
      `}</style>
    </MainLayout>
  );
};

export default CentersDashboardPage;
