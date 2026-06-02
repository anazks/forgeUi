import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { employeeApi, userApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { 
  Calendar, MapPin, Search, Edit, Check, Lock, Unlock, 
  AlertTriangle, DollarSign, Filter, Save, FileText, ChevronRight
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const HrYearViewPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const yearNum = Number(year);

  const [user, setUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [activeTab, setActiveTab] = useState<'yearly' | 'monthly'>('yearly');
  const [selectedMonth, setSelectedMonth] = useState<number>(1); // 1-12

  // Yearly view states
  const [yearlyConfigs, setYearlyConfigs] = useState<any[]>([]);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configEditForm, setConfigEditForm] = useState({
    advanceSalary: 0,
    monthlyDeduction: 0,
    totalLeaves: 12,
    advanceStartMonth: 1
  });

  // Monthly view states
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordEditForm, setRecordEditForm] = useState({
    leavesTaken: 0,
    finalSalary: 0
  });
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    fetchLocations();
  }, []);

  useEffect(() => {
    if (yearNum) {
      setSelectedRecordIds([]);
      fetchData();
    }
  }, [yearNum, activeTab, selectedMonth, selectedLocation]);

  const fetchLocations = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      const entityId = userData?.entity?._id || userData?.entity;
      const res = await userApi.getLocations(entityId);
      setLocations(res.data.data || []);
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  };

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      const entityId = userData?.entity?._id || userData?.entity;

      if (activeTab === 'yearly') {
        const res = await employeeApi.getYearlyConfigs(yearNum, selectedLocation || undefined, entityId);
        setYearlyConfigs(res.data.data || []);
      } else {
        const res = await employeeApi.getMonthlyRecords(yearNum, selectedMonth, selectedLocation || undefined, entityId);
        setMonthlyRecords(res.data.data.records || []);
        setIsMonthLocked(res.data.data.isClosed || false);
      }
    } catch (err: any) {
      showStatus(err.response?.data?.error || 'Failed to fetch payroll data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Yearly config edits
  const startEditConfig = (item: any) => {
    setEditingConfigId(item.config._id);
    setConfigEditForm({
      advanceSalary: item.config.advanceSalary,
      monthlyDeduction: item.config.monthlyDeduction,
      totalLeaves: item.config.totalLeaves,
      advanceStartMonth: item.config.advanceStartMonth || 1
    });
  };

  const saveConfig = async (configId: string) => {
    try {
      const userStr = localStorage.getItem('user');
      const userData = userStr ? JSON.parse(userStr) : null;
      const entityId = userData?.entity?._id || userData?.entity;

      await employeeApi.updateYearlyConfig(configId, {
        ...configEditForm,
        entity: entityId
      });
      setEditingConfigId(null);
      showStatus('Yearly employee configuration updated.');
      fetchData();
    } catch (err: any) {
      showStatus(err.response?.data?.error || 'Failed to save configuration', 'error');
    }
  };

  // Monthly record edits
  const startEditRecord = (record: any) => {
    setEditingRecordId(record._id);
    setRecordEditForm({
      leavesTaken: record.leavesTaken,
      finalSalary: record.finalSalary
    });
  };

  const saveRecord = async (recordId: string, status: 'DRAFT' | 'ACKNOWLEDGED') => {
    try {
      await employeeApi.acknowledgeMonthlyRecord(recordId, {
        ...recordEditForm,
        status
      });
      setEditingRecordId(null);
      showStatus(status === 'ACKNOWLEDGED' 
        ? 'Employee month record acknowledged and locked.' 
        : 'Draft changes saved successfully.'
      );
      fetchData();
    } catch (err: any) {
      showStatus(err.response?.data?.error || 'Failed to save record', 'error');
    }
  };

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecordIds(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId) 
        : [...prev, recordId]
    );
  };

  const handleBulkAcknowledge = async () => {
    if (selectedRecordIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to acknowledge the selected ${selectedRecordIds.length} employee records?`)) {
      return;
    }
    try {
      setIsLoading(true);
      await Promise.all(
        selectedRecordIds.map(id => 
          employeeApi.acknowledgeMonthlyRecord(id, { status: 'ACKNOWLEDGED' })
        )
      );
      setSelectedRecordIds([]);
      showStatus(`Successfully acknowledged selected records.`);
      fetchData();
    } catch (err: any) {
      showStatus(err.response?.data?.error || 'Failed to acknowledge records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Close month
  const handleCloseMonth = async () => {
    if (!window.confirm(`Are you sure you want to CLOSE ${MONTH_NAMES[selectedMonth - 1]} ${yearNum}? This will lock editing for all records in this month.`)) {
      return;
    }

    try {
      await employeeApi.closeMonth(yearNum, selectedMonth);
      showStatus(`${MONTH_NAMES[selectedMonth - 1]} closed successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to close month');
    }
  };

  // Unlock month (Only Admin role)
  const handleUnlockMonth = async () => {
    if (user?.role !== 'ADMIN') {
      alert('Only Admin users are authorized to unlock a closed month.');
      return;
    }

    if (!window.confirm(`Are you sure you want to UNLOCK ${MONTH_NAMES[selectedMonth - 1]} ${yearNum}?`)) {
      return;
    }

    try {
      await employeeApi.unlockMonth(yearNum, selectedMonth);
      showStatus(`${MONTH_NAMES[selectedMonth - 1]} unlocked successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to unlock month');
    }
  };

  const filteredYearly = yearlyConfigs.filter(item => 
    item.employee.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.employee.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMonthly = monthlyRecords.filter(rec => 
    rec.employee?.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rec.employee?.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const draftMonthlyRecords = filteredMonthly.filter(rec => rec.status === 'DRAFT');
  const allDraftsSelected = draftMonthlyRecords.length > 0 && draftMonthlyRecords.every(rec => selectedRecordIds.includes(rec._id));

  const handleSelectAll = () => {
    if (allDraftsSelected) {
      const draftIds = draftMonthlyRecords.map(r => r._id);
      setSelectedRecordIds(prev => prev.filter(id => !draftIds.includes(id)));
    } else {
      const draftIds = draftMonthlyRecords.map(r => r._id);
      setSelectedRecordIds(prev => Array.from(new Set([...prev, ...draftIds])));
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>{yearNum} PAYROLL & LEAVE CONSOLE</h1>
          <p className="subtitle">YEARLY AND MONTHLY COMPENSATION MATRIX</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'monthly' && (
            <>
              {selectedRecordIds.length > 0 && (
                <button className="btn-primary" onClick={handleBulkAcknowledge} style={{ backgroundColor: '#10b981' }}>
                  <Check size={16} /> ACKNOWLEDGE SELECTED ({selectedRecordIds.length})
                </button>
              )}
              <span className="gst-badge" style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', border: '1px dashed var(--primary)', padding: '6px 12px', background: 'rgba(249,115,22,0.03)' }}>
                SELECT EMPLOYEES AND ACKNOWLEDGE ONCE SALARY IS PAID
              </span>
            </>
          )}
        </div>
      </header>

      {statusMessage && (
        <div className={`status-banner ${statusMessage.type}`}>
          {statusMessage.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{statusMessage.text.toUpperCase()}</span>
        </div>
      )}

      {/* Controls & Nav */}
      <div className="console-nav">
        <div className="left-controls">
          <button 
            className={`console-tab-btn ${activeTab === 'yearly' ? 'active' : ''}`}
            onClick={() => { setActiveTab('yearly'); setEditingConfigId(null); }}
          >
            YEAR OVERVIEW CONFIG
          </button>
          <button 
            className={`console-tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => { setActiveTab('monthly'); setEditingRecordId(null); }}
          >
            MONTHLY COMPENSATION LOG
          </button>
        </div>
        
        <div className="right-controls">
          <div className="filter-select-wrap">
            <Filter size={12} />
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
              <option value="">ALL LOCATIONS</option>
              {locations.map(loc => (
                <option key={loc._id} value={loc.name}>{loc.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="search-box-console">
            <Search size={14} />
            <input 
              type="text" 
              placeholder="Search employee..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Month Tabs (if activeTab is monthly) */}
      {activeTab === 'monthly' && (
        <div className="month-tabs-grid">
          {MONTH_NAMES.map((mName, idx) => (
            <button
              key={idx}
              className={`month-tab-card ${selectedMonth === idx + 1 ? 'active' : ''}`}
              onClick={() => { setSelectedMonth(idx + 1); setEditingRecordId(null); }}
            >
              <Calendar size={14} />
              <span>{mName.slice(0, 3).toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Data Section */}
      <div className="data-panel" style={{ marginTop: '24px' }}>
        {isLoading ? <ForgeLoader /> : (
          <div className="table-wrapper">
            {activeTab === 'yearly' ? (
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>CODE</th>
                    <th>EMPLOYEE NAME</th>
                    <th>DESIGNATION</th>
                    <th>LOCATION</th>
                    <th className="text-right">ADVANCE SALARY (₹)</th>
                    <th className="text-right">MONTHLY ADVANCE RECOVERY (₹)</th>
                    <th className="text-center">ADVANCE RECOVERY START MONTH</th>
                    <th className="text-right">TOTAL LEAVES</th>
                    <th className="text-right">PENDING LEAVES</th>
                    <th className="text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredYearly.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-dim">No employee yearly configs found.</td></tr>
                  ) : filteredYearly.map(item => {
                    const isEditing = editingConfigId === item.config._id;
                    return (
                      <tr key={item.config._id}>
                        <td><span className="code-badge">{item.employee.employeeCode}</span></td>
                        <td className="text-left"><strong>{item.employee.employeeName.toUpperCase()}</strong></td>
                        <td><span className="unit-tag">{item.employee.designation}</span></td>
                        <td>{item.employee.locationName}</td>
                        <td className="text-right font-mono">
                          {isEditing ? (
                            <input 
                              type="number" 
                              className="edit-input-console"
                              value={configEditForm.advanceSalary} 
                              onChange={(e) => setConfigEditForm({...configEditForm, advanceSalary: Number(e.target.value)})}
                            />
                          ) : (
                            `₹${item.config.advanceSalary.toLocaleString()}`
                          )}
                        </td>
                        <td className="text-right font-mono">
                          {isEditing ? (
                            <input 
                              type="number" 
                              className="edit-input-console"
                              value={configEditForm.monthlyDeduction} 
                              onChange={(e) => setConfigEditForm({...configEditForm, monthlyDeduction: Number(e.target.value)})}
                            />
                          ) : (
                            `₹${item.config.monthlyDeduction.toLocaleString()}`
                          )}
                        </td>
                        <td className="text-center font-mono">
                          {isEditing ? (
                            <select 
                              className="edit-input-console"
                              style={{ width: '100px', textAlign: 'left' }}
                              value={configEditForm.advanceStartMonth} 
                              onChange={(e) => setConfigEditForm({...configEditForm, advanceStartMonth: Number(e.target.value)})}
                            >
                              {MONTH_NAMES.map((name, idx) => (
                                <option key={idx} value={idx + 1}>{name.toUpperCase()}</option>
                              ))}
                            </select>
                          ) : (
                            MONTH_NAMES[(item.config.advanceStartMonth || 1) - 1]?.toUpperCase()
                          )}
                        </td>
                        <td className="text-right font-mono">
                          {isEditing ? (
                            <input 
                              type="number" 
                              className="edit-input-console"
                              value={configEditForm.totalLeaves} 
                              onChange={(e) => setConfigEditForm({...configEditForm, totalLeaves: Number(e.target.value)})}
                            />
                          ) : (
                            item.config.totalLeaves
                          )}
                        </td>
                        <td className="text-right font-mono font-bold text-primary">{item.config.pendingLeaves}</td>
                        <td className="text-center">
                          {isEditing ? (
                            <button className="action-btn-save" onClick={() => saveConfig(item.config._id)}>
                              <Save size={14} /> SAVE
                            </button>
                          ) : (
                            <button className="action-btn-edit" onClick={() => startEditConfig(item)}>
                              <Edit size={14} /> EDIT
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              // Monthly compensation matrix
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={allDraftsSelected} 
                        onChange={handleSelectAll} 
                        disabled={draftMonthlyRecords.length === 0}
                      />
                    </th>
                    <th>CODE</th>
                    <th>EMPLOYEE NAME</th>
                    <th>REMAINING LEAVES</th>
                    <th>REMAINING ADVANCE</th>
                    <th className="text-right">LEAVES TAKEN</th>
                    <th className="text-right">BASE TAKEHOME (₹)</th>
                    <th className="text-right">ADV. DEDUCTION (₹)</th>
                    <th className="text-right">CALCULATED SALARY (₹)</th>
                    <th className="text-right">FINAL SALARY (₹)</th>
                    <th className="text-center">STATUS</th>
                    <th className="text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthly.length === 0 ? (
                    <tr><td colSpan={12} className="text-center py-8 text-dim">No monthly payroll logs for selected criteria.</td></tr>
                  ) : filteredMonthly.map(rec => {
                    const isEditing = editingRecordId === rec._id;
                    const isLocked = isMonthLocked || rec.status === 'ACKNOWLEDGED';
                    
                    return (
                      <tr key={rec._id}>
                        <td>
                          {rec.status === 'DRAFT' && !isMonthLocked ? (
                            <input 
                              type="checkbox" 
                              checked={selectedRecordIds.includes(rec._id)} 
                              onChange={() => handleSelectRecord(rec._id)} 
                            />
                          ) : (
                            <span className="text-dim" style={{ fontSize: '0.65rem' }}>—</span>
                          )}
                        </td>
                        <td><span className="code-badge">{rec.employee?.employeeCode}</span></td>
                        <td className="text-left">
                          <div className="emp-title-cell">
                            <strong>{rec.employee?.employeeName?.toUpperCase()}</strong>
                            <span className="person-sub">{rec.employee?.designation}</span>
                          </div>
                        </td>
                        {/* Pending Leaves before month */}
                        <td className="text-center font-mono">
                          {rec.pendingLeavesBeforeMonth}
                        </td>
                        {/* Remaining advance before month */}
                        <td className="text-center font-mono">
                          ₹{rec.remainingAdvanceBeforeMonth.toLocaleString()}
                        </td>
                        <td className="text-right font-mono">
                          {isEditing ? (
                            <input 
                              type="number" 
                              className="edit-input-console"
                              value={recordEditForm.leavesTaken} 
                              onChange={(e) => setRecordEditForm({...recordEditForm, leavesTaken: Number(e.target.value)})}
                            />
                          ) : (
                            rec.leavesTaken
                          )}
                          {rec.isLopApplicable && (
                            <span className="lop-badge" title={`${rec.lopLeaves} LOP leaves applicable`}>
                              LOP APPLICABLE
                            </span>
                          )}
                        </td>
                        <td className="text-right font-mono">₹{rec.employee?.monthlyTakeHomeSalary?.toLocaleString() || 0}</td>
                        <td className="text-right font-mono text-dim">-₹{rec.advanceDeductionApplied.toLocaleString()}</td>
                        <td className="text-right font-mono font-bold">₹{rec.calculatedSalary.toLocaleString()}</td>
                        <td className="text-right font-mono" style={{ color: rec.finalSalary !== rec.calculatedSalary ? 'var(--primary)' : 'inherit' }}>
                          {isEditing ? (
                            <input 
                              type="number" 
                              className="edit-input-console"
                              value={recordEditForm.finalSalary} 
                              onChange={(e) => setRecordEditForm({...recordEditForm, finalSalary: Number(e.target.value)})}
                            />
                          ) : (
                            `₹${rec.finalSalary.toLocaleString()}`
                          )}
                        </td>
                        <td className="text-center">
                          <span className={`status-pill ${rec.status.toLowerCase()}`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="text-center">
                          {isMonthLocked ? (
                            <span className="text-dim" style={{ fontSize: '0.7rem' }}><Lock size={10} style={{ display: 'inline', marginRight: 4 }} /> LOCKED</span>
                          ) : isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button className="action-btn-save" style={{ background: '#3b82f6' }} onClick={() => saveRecord(rec._id, 'DRAFT')}>
                                SAVE
                              </button>
                              <button className="action-btn-save" onClick={() => saveRecord(rec._id, 'ACKNOWLEDGED')}>
                                <Check size={12} /> ACKNOWLEDGE
                              </button>
                            </div>
                          ) : (
                            <button className="action-btn-edit" onClick={() => startEditRecord(rec)}>
                              <Edit size={14} /> EDIT
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <style>{`
        .console-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 32px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .left-controls {
          display: flex;
          gap: 2px;
        }
        .console-tab-btn {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-main);
          color: var(--text-muted);
          padding: 8px 16px;
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s;
        }
        .console-tab-btn.active {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(249, 115, 22, 0.05);
        }
        .right-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .filter-select-wrap {
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-main);
          padding: 0 10px;
          color: var(--text-dim);
        }
        .filter-select-wrap select {
          background: none;
          border: none;
          color: var(--text-main);
          padding: 8px 8px 8px 4px;
          font-size: 0.75rem;
          font-weight: 700;
          outline: none;
          cursor: pointer;
        }
        .search-box-console {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-box-console input {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-main);
          padding: 8px 12px 8px 32px;
          font-size: 0.75rem;
          color: var(--text-main);
          width: 220px;
          outline: none;
        }
        .search-box-console input:focus {
          border-color: var(--primary);
        }
        .search-box-console svg {
          position: absolute;
          left: 10px;
          color: var(--text-dim);
        }
        .month-tabs-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 4px;
          margin-top: 16px;
        }
        .month-tab-card {
          background: var(--bg-sidebar);
          border: 1px solid var(--border-main);
          color: var(--text-muted);
          padding: 10px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: 0.2s;
        }
        .month-tab-card:hover {
          border-color: var(--border-strong);
          color: var(--text-main);
        }
        .month-tab-card.active {
          border-color: var(--primary);
          background: rgba(249, 115, 22, 0.05);
          color: var(--primary);
        }
        .month-tab-card span {
          font-size: 0.65rem;
          font-weight: 800;
        }
        .edit-input-console {
          width: 100px;
          background: var(--bg-main);
          border: 1px solid var(--border-main);
          padding: 4px 8px;
          color: var(--text-main);
          font-size: 0.8rem;
          text-align: right;
          outline: none;
        }
        .edit-input-console:focus {
          border-color: var(--primary);
        }
        .action-btn-save {
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 12px;
          font-size: 0.7rem;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .action-btn-edit {
          background: none;
          border: 1px solid var(--border-main);
          color: var(--text-main);
          padding: 6px 12px;
          font-size: 0.7rem;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: 0.2s;
        }
        .action-btn-edit:hover {
          border-color: var(--primary);
          color: var(--primary);
        }
        .status-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          margin-top: 24px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .status-banner.success {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        .status-banner.error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        .emp-title-cell {
          display: flex;
          flex-direction: column;
        }
        .lop-badge {
          display: inline-block;
          font-size: 0.55rem;
          font-weight: 900;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 1px 4px;
          margin-left: 8px;
          vertical-align: middle;
        }
        .month-badge.closed {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 6px 12px;
          font-size: 0.75rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>
    </MainLayout>
  );
};

export default HrYearViewPage;
