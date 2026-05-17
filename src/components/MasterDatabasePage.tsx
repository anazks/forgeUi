import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { vendorApi, employeeApi, bankApi, eventApi, expenseApi } from '../services/api';
import { ITEM_CATEGORIES } from '../constants/categories';
import ForgeLoader from './ForgeLoader';
import { 
  Database, Users, Building2, Landmark, 
  Calendar, Layers, Search, Plus, Filter,
  Phone, MapPin, Briefcase, CalendarDays,
  X, Check, Mail, CreditCard, ShieldCheck,
  UserPlus, HardHat, Building, Bell, Tag, Trash2
} from 'lucide-react';

type MasterTab = 'vendors' | 'employees' | 'banks' | 'calendar' | 'expenses';

const MasterDatabasePage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
  }, []);

  const [activeTab, setActiveTab] = useState<MasterTab>('vendors');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [expenseCats, setExpenseCats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<any>({
    // Vendor fields
    vendorCode: '', vendorName: '', address: '', gstNumber: '',
    vendorCategories: [] as string[], contactPersonName: '', contactNumber: '',
    contactEmail: '', creditPeriodType: 'Days', creditDays: 0,
    bankName: '', accountNumber: '', ifscCode: '', status: 'Active',
    // Employee fields
    employeeCode: '', employeeName: '', designation: '', department: 'Finance',
    dateOfJoining: '', locationType: 'Head Office', locationName: '',
    systemRole: '', status_emp: 'Active',
    // Bank fields
    bankName_bank: '', ifscCode_bank: '', branch_bank: '', accountNumber_bank: '',
    // Event fields
    eventName: '', eventDate: '', description: '', type: 'Others',
    // Expense Category fields
    categoryName_exp: '', applicableLocations: [] as string[], status_exp: 'Active', expenseType_exp: 'Production'
  });

  useEffect(() => {
    if (activeTab === 'vendors') fetchVendors();
    if (activeTab === 'employees') fetchEmployees();
    if (activeTab === 'banks') fetchBanks();
    if (activeTab === 'calendar') fetchEvents();
    if (activeTab === 'expenses') fetchExpenseCats();
  }, [activeTab, entityId]);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const res = await vendorApi.getAll(entityId);
      setVendors(res.data.data || []);
    } catch (err) { console.error('Failed to fetch vendors'); }
    finally { setIsLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const res = await employeeApi.getAll(entityId);
      setEmployees(res.data.data || []);
    } catch (err) { console.error('Failed to fetch employees'); }
    finally { setIsLoading(false); }
  };

  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      const res = await bankApi.getAll(entityId);
      setBanks(res.data.data || []);
    } catch (err) { console.error('Failed to fetch banks'); }
    finally { setIsLoading(false); }
  };

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const res = await eventApi.getAll(entityId);
      setEvents(res.data.data || []);
    } catch (err) { console.error('Failed to fetch events'); }
    finally { setIsLoading(false); }
  };

  const fetchExpenseCats = async () => {
    try {
      setIsLoading(true);
      const res = await expenseApi.getAll(entityId);
      setExpenseCats(res.data.data || []);
    } catch (err) { console.error('Failed to fetch expenses'); }
    finally { setIsLoading(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      if (activeTab === 'vendors') {
        await vendorApi.create(formData);
        fetchVendors();
      } else if (activeTab === 'employees') {
        await employeeApi.create({ ...formData, status: formData.status_emp });
        fetchEmployees();
      } else if (activeTab === 'banks') {
        await bankApi.create({
          bankName: formData.bankName_bank,
          ifscCode: formData.ifscCode_bank,
          branch: formData.branch_bank,
          accountNumber: formData.accountNumber_bank
        });
        fetchBanks();
      } else if (activeTab === 'calendar') {
        await eventApi.create({
          eventName: formData.eventName,
          eventDate: formData.eventDate,
          description: formData.description,
          type: formData.type
        });
        fetchEvents();
      } else if (activeTab === 'expenses') {
        await expenseApi.create({
          categoryName: formData.categoryName_exp,
          applicableLocations: formData.applicableLocations,
          status: formData.status_exp,
          expenseType: formData.expenseType_exp
        });
        fetchExpenseCats();
      }
      
      setShowModal(false);
      setFormData({
        vendorCode: '', vendorName: '', address: '', gstNumber: '',
        vendorCategories: [] as string[], contactPersonName: '', contactNumber: '',
        contactEmail: '', creditPeriodType: 'Days', creditDays: 0,
        bankName: '', accountNumber: '', ifscCode: '', status: 'Active',
        employeeCode: '', employeeName: '', designation: '', department: 'Finance',
        dateOfJoining: '', locationType: 'Head Office', locationName: '',
        systemRole: '', status_emp: 'Active',
        bankName_bank: '', ifscCode_bank: '', branch_bank: '', accountNumber_bank: '',
        eventName: '', eventDate: '', description: '', type: 'Others',
        categoryName_exp: '', applicableLocations: [] as string[], status_exp: 'Active', expenseType_exp: 'Production'
      });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationChange = (loc: string) => {
    const current = [...formData.applicableLocations];
    if (current.includes(loc)) {
      setFormData({ ...formData, applicableLocations: current.filter(l => l !== loc) });
    } else {
      setFormData({ ...formData, applicableLocations: [...current, loc] });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;

    try {
      if (activeTab === 'vendors') {
        await vendorApi.delete(id);
        fetchVendors();
      } else if (activeTab === 'employees') {
        await employeeApi.delete(id);
        fetchEmployees();
      } else if (activeTab === 'banks') {
        await bankApi.delete(id);
        fetchBanks();
      } else if (activeTab === 'calendar') {
        await eventApi.delete(id);
        fetchEvents();
      } else if (activeTab === 'expenses') {
        await expenseApi.delete(id);
        fetchExpenseCats();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete record');
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>MASTER DATABASE</h1>
          <p className="subtitle">CENTRAL REPOSITORY FOR CORE SYSTEM ENTITIES</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> ADD NEW {activeTab.slice(0, -1).toUpperCase()}
        </button>
      </header>

      {/* Navigation Tabs */}
      <div className="master-nav">
        <button className={`master-tab-btn ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => setActiveTab('vendors')}>
          <Building2 size={16} /> <span>VENDORS</span>
        </button>
        
        {user?.role !== 'STORE' && (
          <>
            <button className={`master-tab-btn ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => setActiveTab('employees')}>
              <Users size={16} /> <span>EMPLOYEES</span>
            </button>
            <button className={`master-tab-btn ${activeTab === 'banks' ? 'active' : ''}`} onClick={() => setActiveTab('banks')}>
              <Landmark size={16} /> <span>BANKS</span>
            </button>
            <button className={`master-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
              <Calendar size={16} /> <span>CALENDAR</span>
            </button>
            <button className={`master-tab-btn ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
              <Layers size={16} /> <span>EXPENSES</span>
            </button>
          </>
        )}
      </div>

      <div className="data-panel">
        <div className="panel-header">
          <div className="search-box">
            <Search size={14} />
            <input type="text" placeholder={`Search ${activeTab}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="panel-actions">
            <button className="icon-btn"><Filter size={14} /></button>
          </div>
        </div>

        <div className="table-wrapper">
          {isLoading ? <ForgeLoader /> : (
            <>
              {activeTab === 'vendors' && (
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>CODE</th>
                      <th>VENDOR NAME</th>
                      <th>CATEGORY</th>
                      <th>GSTIN</th>
                      <th>CREDIT</th>
                      <th>CONTACT</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8 text-dim">No vendors found. Click Add New to create one.</td></tr>
                    ) : vendors.map(v => (
                      <tr key={v._id}>
                        <td><span className="code-badge">{v.vendorCode}</span></td>
                        <td className="text-left">
                          <div className="vendor-cell">
                            <strong>{v.vendorName.toUpperCase()}</strong>
                            <span className="person-sub">{v.contactPersonName || '—'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex-wrap gap-1" style={{ justifyContent: 'center' }}>
                            {(v.vendorCategories || (v.vendorCategory ? [v.vendorCategory] : [])).map((cat: string) => (
                              <span key={cat} className="unit-tag" style={{ fontSize: '10px', margin: '2px' }}>{cat}</span>
                            ))}
                            {(!v.vendorCategories?.length && !v.vendorCategory) && <span className="text-dim">—</span>}
                          </div>
                        </td>
                        <td><span className="gst-badge">{v.gstNumber || '—'}</span></td>
                        <td>
                          <div className="credit-cell">
                            <strong>{v.creditDays}</strong>
                            <span>{v.creditPeriodType}</span>
                          </div>
                        </td>
                        <td>
                          <div className="contact-mini">
                            <span><Phone size={10} /> {v.contactNumber}</span>
                            <span><Mail size={10} /> {v.contactEmail || '—'}</span>
                          </div>
                        </td>
                        <td><span className={`status-pill ${v.status.toLowerCase()}`}>{v.status}</span></td>
                        <td>
                          <button className="delete-action-btn" onClick={() => handleDelete(v._id, v.vendorName)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'employees' && (
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>CODE</th>
                      <th>NAME</th>
                      <th>DESIGNATION</th>
                      <th>DEPT</th>
                      <th>JOINING</th>
                      <th>LOCATION</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-dim">No employees found. Click Add New to register.</td></tr>
                    ) : employees.map(e => (
                      <tr key={e._id}>
                        <td><span className="code-badge">{e.employeeCode}</span></td>
                        <td className="text-left">
                          <div className="vendor-cell">
                            <strong>{e.employeeName.toUpperCase()}</strong>
                            <span className="person-sub"><Phone size={10} /> {e.contactNumber}</span>
                          </div>
                        </td>
                        <td><span className="unit-tag">{e.designation}</span></td>
                        <td>{e.department}</td>
                        <td><span className="gst-badge">{new Date(e.dateOfJoining).toLocaleDateString()}</span></td>
                        <td>
                          <div className="credit-cell">
                            <strong>{e.locationType}</strong>
                            <span>{e.locationName}</span>
                          </div>
                        </td>
                        <td>{e.systemRole || '—'}</td>
                        <td><span className={`status-pill ${e.status.toLowerCase().replace(' ', '-')}`}>{e.status}</span></td>
                        <td>
                          <button className="delete-action-btn" onClick={() => handleDelete(e._id, e.employeeName)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'banks' && (
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>BANK NAME</th>
                      <th>ACCOUNT NUMBER</th>
                      <th>BRANCH</th>
                      <th>IFSC CODE</th>
                      <th>DATE ADDED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-dim">No bank accounts registered.</td></tr>
                    ) : banks.map(b => (
                      <tr key={b._id}>
                        <td className="text-left">
                          <div className="flex-center gap-1">
                            <Landmark size={14} className="text-primary"/> 
                            <strong>{b.bankName.toUpperCase()}</strong>
                          </div>
                        </td>
                        <td><code className="acc-code">{b.accountNumber}</code></td>
                        <td>{b.branch}</td>
                        <td><span className="ifsc-badge">{b.ifscCode}</span></td>
                        <td><span className="text-dim">{new Date(b.createdAt).toLocaleDateString()}</span></td>
                        <td>
                          <button className="delete-action-btn" onClick={() => handleDelete(b._id, b.bankName)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'calendar' && (
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>EVENT DATE</th>
                      <th>EVENT NAME</th>
                      <th>CATEGORY</th>
                      <th>DESCRIPTION</th>
                      <th>NOTIFICATION</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-dim">No events registered in calendar.</td></tr>
                    ) : events.map(ev => (
                      <tr key={ev._id}>
                        <td><strong>{new Date(ev.eventDate).toDateString()}</strong></td>
                        <td className="text-left"><strong>{ev.eventName.toUpperCase()}</strong></td>
                        <td><span className={`type-tag ${ev.type.toLowerCase().replace(' ', '-')}`}>{ev.type}</span></td>
                        <td><p className="desc-text">{ev.description || 'No description'}</p></td>
                        <td>
                          <div className="flex-center gap-1 text-primary">
                            <Bell size={12} />
                            <span className="text-dim" style={{ fontSize: '0.65rem', fontWeight: 800 }}>Auto-Alert Enabled</span>
                          </div>
                        </td>
                        <td>
                          <button className="delete-action-btn" onClick={() => handleDelete(ev._id, ev.eventName)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'expenses' && (
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>CODE</th>
                      <th>CATEGORY NAME</th>
                      <th>TYPE</th>
                      <th>LOCATIONS</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseCats.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-dim">No expense categories defined.</td></tr>
                    ) : expenseCats.map(ex => (
                      <tr key={ex._id}>
                        <td><span className="code-badge">{ex.categoryCode}</span></td>
                        <td className="text-left"><strong>{ex.categoryName.toUpperCase()}</strong></td>
                        <td><span className={`type-pill ${ex.expenseType.toLowerCase()}`}>{ex.expenseType}</span></td>
                        <td>
                          <div className="flex-wrap gap-1">
                            {ex.applicableLocations.map((loc: string) => (
                              <span key={loc} className="unit-tag" style={{ fontSize: '10px' }}>{loc}</span>
                            ))}
                          </div>
                        </td>
                        <td><span className={`status-pill ${ex.status.toLowerCase()}`}>{ex.status}</span></td>
                        <td>
                          <button className="delete-action-btn" onClick={() => handleDelete(ex._id, ex.categoryName)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Other tabs follow same pattern... */}
            </>
          )}
        </div>
      </div>

      {/* Vendor Modal */}
      {showModal && activeTab === 'vendors' && (
        <div className="modal-overlay">
          <div className="modal-content vendor-modal">
            <div className="modal-header">
              <h2><Plus size={18} /> REGISTER NEW VENDOR</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="vendor-form">
              <div className="form-section">
                <h3><ShieldCheck size={14} /> CORE INFORMATION</h3>
                <div className="form-grid">
                  <div className="input-group">
                    <label>VENDOR CODE</label>
                    <input name="vendorCode" value={formData.vendorCode} onChange={handleInputChange} required placeholder="VND-001" />
                  </div>
                  <div className="input-group">
                    <label>VENDOR NAME</label>
                    <input name="vendorName" value={formData.vendorName} onChange={handleInputChange} required placeholder="Acme Supplies Ltd" />
                  </div>
                  <div className="input-group">
                    <label>CATEGORIES <span style={{ fontWeight: 400, fontSize: '0.6rem' }}>(select all that apply)</span></label>
                    <div className="category-checkboxes">
                      {ITEM_CATEGORIES.map(cat => (
                        <label key={cat} className="cat-check-label">
                          <input
                            type="checkbox"
                            checked={formData.vendorCategories?.includes(cat) || false}
                            onChange={() => {
                              const current = formData.vendorCategories || [];
                              const updated = current.includes(cat)
                                ? current.filter((c: string) => c !== cat)
                                : [...current, cat];
                              setFormData((prev: any) => ({ ...prev, vendorCategories: updated }));
                            }}
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="input-group">
                    <label>GST NUMBER</label>
                    <input name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} placeholder="22AAAAA0000A1Z5" />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3><Mail size={14} /> CONTACT DETAILS</h3>
                <div className="form-grid">
                  <div className="input-group">
                    <label>CONTACT PERSON</label>
                    <input name="contactPersonName" value={formData.contactPersonName} onChange={handleInputChange} placeholder="John Doe" />
                  </div>
                  <div className="input-group">
                    <label>CONTACT NUMBER</label>
                    <input name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} required placeholder="9876543210" />
                  </div>
                  <div className="input-group full-width">
                    <label>EMAIL ID</label>
                    <input name="contactEmail" type="email" value={formData.contactEmail} onChange={handleInputChange} placeholder="vendor@example.com" />
                  </div>
                  <div className="input-group full-width">
                    <label>ADDRESS</label>
                    <input name="address" value={formData.address} onChange={handleInputChange} placeholder="123 Business Park, City" />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-section half">
                  <h3><CreditCard size={14} /> CREDIT TERMS</h3>
                  <div className="form-grid">
                    <div className="input-group">
                      <label>PERIOD TYPE</label>
                      <select name="creditPeriodType" value={formData.creditPeriodType} onChange={handleInputChange}>
                        <option value="Days">Days</option>
                        <option value="Weeks">Weeks</option>
                        <option value="Months">Months</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>DURATION</label>
                      <input name="creditDays" type="number" value={formData.creditDays} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>
                <div className="form-section half">
                  <h3><Landmark size={14} /> BANKING DETAILS</h3>
                  <div className="form-grid">
                    <div className="input-group">
                      <label>BANK NAME</label>
                      <input name="bankName" value={formData.bankName} onChange={handleInputChange} placeholder="HDFC Bank" />
                    </div>
                    <div className="input-group">
                      <label>ACCOUNT NO</label>
                      <input name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} placeholder="50100..." />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <ForgeLoader size={16} /> : <Check size={16} />}
                  SAVE VENDOR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showModal && activeTab === 'employees' && (
        <div className="modal-overlay">
          <div className="modal-content vendor-modal">
            <div className="modal-header">
              <h2><UserPlus size={18} /> REGISTER NEW EMPLOYEE</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="vendor-form">
              <div className="form-section">
                <h3><ShieldCheck size={14} /> EMPLOYEE IDENTITY</h3>
                <div className="form-grid">
                  <div className="input-group">
                    <label>EMPLOYEE CODE</label>
                    <input name="employeeCode" value={formData.employeeCode} onChange={handleInputChange} required placeholder="EMP-101" />
                  </div>
                  <div className="input-group">
                    <label>EMPLOYEE NAME</label>
                    <input name="employeeName" value={formData.employeeName} onChange={handleInputChange} required placeholder="Rahul Sharma" />
                  </div>
                  <div className="input-group">
                    <label>DESIGNATION</label>
                    <input name="designation" value={formData.designation} onChange={handleInputChange} required placeholder="Operations Head" />
                  </div>
                  <div className="input-group">
                    <label>DEPARTMENT</label>
                    <select name="department" value={formData.department} onChange={handleInputChange} required>
                      <option value="Finance">Finance</option>
                      <option value="Kitchen Operations">Kitchen Operations</option>
                      <option value="Center Operations">Center Operations</option>
                      <option value="Store Operations">Store Operations</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3><Briefcase size={14} /> DEPLOYMENT DETAILS</h3>
                <div className="form-grid">
                  <div className="input-group">
                    <label>DATE OF JOINING</label>
                    <input name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>CONTACT NUMBER</label>
                    <input name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} required placeholder="9876543210" />
                  </div>
                  <div className="input-group">
                    <label>LOCATION TYPE</label>
                    <select name="locationType" value={formData.locationType} onChange={handleInputChange} required>
                      <option value="Head Office">Head Office</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Center">Center</option>
                      <option value="Resort">Resort</option>
                      <option value="On Contract">On Contract</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>LOCATION NAME</label>
                    <input name="locationName" value={formData.locationName} onChange={handleInputChange} required placeholder="Main Center / North Kitchen" />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3><HardHat size={14} /> SYSTEM STATUS</h3>
                <div className="form-grid">
                  <div className="input-group">
                    <label>SYSTEM ROLE (OPTIONAL)</label>
                    <input name="systemRole" value={formData.systemRole} onChange={handleInputChange} placeholder="Admin / Manager / User" />
                  </div>
                  <div className="input-group">
                    <label>EMPLOYMENT STATUS</label>
                    <select name="status_emp" value={formData.status_emp} onChange={handleInputChange} required>
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Terminated">Terminated</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <ForgeLoader size={16} /> : <Check size={16} />}
                  REGISTER EMPLOYEE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Modal */}
      {showModal && activeTab === 'banks' && (
        <div className="modal-overlay">
          <div className="modal-content vendor-modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2><Landmark size={18} /> ADD BANK ACCOUNT</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="vendor-form">
              <div className="form-section">
                <h3><Building size={14} /> BANK DETAILS</h3>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="input-group">
                    <label>BANK NAME</label>
                    <input name="bankName_bank" value={formData.bankName_bank} onChange={handleInputChange} required placeholder="State Bank of India" />
                  </div>
                  <div className="input-group">
                    <label>ACCOUNT NUMBER</label>
                    <input name="accountNumber_bank" value={formData.accountNumber_bank} onChange={handleInputChange} required placeholder="32145566778" />
                  </div>
                  <div className="input-group">
                    <label>BRANCH NAME</label>
                    <input name="branch_bank" value={formData.branch_bank} onChange={handleInputChange} required placeholder="Cyber City Branch" />
                  </div>
                  <div className="input-group">
                    <label>IFSC CODE</label>
                    <input name="ifscCode_bank" value={formData.ifscCode_bank} onChange={handleInputChange} required placeholder="SBIN0001234" />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <ForgeLoader size={16} /> : <Check size={16} />}
                  SAVE BANK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showModal && activeTab === 'calendar' && (
        <div className="modal-overlay">
          <div className="modal-content vendor-modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2><Calendar size={18} /> REGISTER SPECIAL DAY</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="vendor-form">
              <div className="form-section">
                <h3><Bell size={14} /> EVENT DETAILS</h3>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="input-group">
                    <label>EVENT NAME</label>
                    <input name="eventName" value={formData.eventName} onChange={handleInputChange} required placeholder="Independence Day / Annual Meet" />
                  </div>
                  <div className="input-group">
                    <label>EVENT DATE</label>
                    <input name="eventDate" type="date" value={formData.eventDate} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>EVENT TYPE</label>
                    <select name="type" value={formData.type} onChange={handleInputChange} required>
                      <option value="Public Holiday">Public Holiday</option>
                      <option value="Festival">Festival</option>
                      <option value="Operational">Operational</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>DESCRIPTION & NOTES</label>
                    <textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="Add event details..."
                      style={{ 
                        width: '100%', 
                        background: 'var(--bg-main)', 
                        border: '1px solid var(--border-main)', 
                        padding: '10px', 
                        color: 'var(--text-main)', 
                        minHeight: '100px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <ForgeLoader size={16} /> : <Check size={16} />}
                  SAVE EVENT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showModal && activeTab === 'expenses' && (
        <div className="modal-overlay">
          <div className="modal-content vendor-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2><Layers size={18} /> DEFINE EXPENSE CATEGORY</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="vendor-form">
              <div className="form-section">
                <h3><Tag size={14} /> CATEGORY IDENTITY</h3>
                <div className="form-grid">
                  <div className="input-group">
                    <label>CATEGORY CODE</label>
                    <input value="AUTO-GENERATED" disabled style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--primary)', fontWeight: 800 }} />
                  </div>
                  <div className="input-group">
                    <label>CATEGORY NAME</label>
                    <input 
                      name="categoryName_exp" 
                      value={formData.categoryName_exp} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="e.g. Kitchen Supplies" 
                    />
                  </div>
                  <div className="input-group full-width">
                    <label>APPLICABLE LOCATIONS</label>
                    <div className="checkbox-grid" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 1fr', 
                      gap: '12px',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '12px',
                      border: '1px solid var(--border-main)'
                    }}>
                      {['ALL', 'Kitchen', 'Center', 'Restaurant', 'Resort', 'Head Office'].map(loc => (
                        <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>
                          <input 
                            type="checkbox" 
                            checked={formData.applicableLocations.includes(loc)}
                            onChange={() => handleLocationChange(loc)}
                          />
                          {loc.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="input-group" style={{ flex: 1 }}>
                      <label>EXPENSE TYPE</label>
                      <select name="expenseType_exp" value={formData.expenseType_exp} onChange={handleInputChange} required>
                        <option value="Production">Production</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label>STATUS</label>
                      <select name="status_exp" value={formData.status_exp} onChange={handleInputChange}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <ForgeLoader size={16} /> : <Check size={16} />}
                  SAVE CATEGORY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; }
        
        .master-nav { display: flex; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 4px; gap: 4px; margin-bottom: 24px; }
        .master-tab-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.72rem; font-weight: 800; }
        .master-tab-btn.active { color: var(--primary); background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); }
        
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.1); }
        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: var(--bg-main); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 280px; outline: none; transition: 0.2s; }
        .search-box input:focus { border-color: var(--primary); background: rgba(249,115,22,0.02); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }
        .icon-btn { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-dim); padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .icon-btn:hover { color: var(--primary); border-color: var(--primary); background: rgba(249,115,22,0.05); }

        .vendor-cell { display: flex; flex-direction: column; gap: 2px; }
        .person-sub { font-size: 0.7rem; color: var(--text-dim); }
        .gst-badge { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 2px 6px; }
        .credit-cell { display: flex; flex-direction: column; align-items: center; }
        .credit-cell span { font-size: 0.6rem; color: var(--text-dim); font-weight: 800; }
        .contact-mini { display: flex; flex-direction: column; font-size: 0.72rem; color: var(--text-muted); gap: 2px; align-items: flex-start; }
        
        .status-pill { font-size: 0.6rem; font-weight: 800; padding: 2px 8px; border: 1px solid; }
        .status-pill.active { color: #10b981; border-color: #10b98144; background: #10b98111; }
        .status-pill.inactive { color: #ef4444; border-color: #ef444444; background: #ef444411; }

        .delete-action-btn { background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 6px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .delete-action-btn:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .type-pill { font-size: 0.6rem; font-weight: 900; padding: 2px 6px; border: 1px solid; letter-spacing: 0.5px; }
        .type-pill.production { color: #8b5cf6; border-color: #8b5cf644; background: #8b5cf611; }
        .type-pill.maintenance { color: #f59e0b; border-color: #f59e0b44; background: #f59e0b11; }
        .type-pill.other { color: var(--text-dim); border-color: var(--border-main); background: rgba(0,0,0,0.1); }

        /* Modal & Form */
        .vendor-modal { max-width: 800px; width: 90%; background: var(--bg-card); border: 1px solid var(--border-strong); padding: 0; }
        .modal-header { padding: 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
        .modal-header h2 { font-size: 1rem; color: var(--primary); display: flex; align-items: center; gap: 10px; }
        .close-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; }
        
        .vendor-form { padding: 24px; display: flex; flex-direction: column; gap: 24px; max-height: 70vh; overflow-y: auto; }
        .form-section { border: 1px solid var(--border-main); padding: 16px; position: relative; }
        .form-section h3 { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); background: var(--bg-card); position: absolute; top: -8px; left: 12px; padding: 0 8px; display: flex; align-items: center; gap: 6px; letter-spacing: 1px; }
        
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .full-width { grid-column: span 2; }
        .form-row { display: flex; gap: 16px; }
        .form-section.half { flex: 1; }
        
        .input-group label { display: block; font-size: 0.65rem; font-weight: 800; color: var(--text-dim); margin-bottom: 6px; }
        .input-group input, .input-group select { width: 100%; background: var(--bg-main); border: 1px solid var(--border-main); padding: 10px; color: var(--text-main); font-size: 0.85rem; outline: none; }
        .input-group input:focus { border-color: var(--primary); }
        .category-checkboxes { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 0; }
        .cat-check-label { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; color: var(--text-muted); cursor: pointer; background: var(--bg-main); border: 1px solid var(--border-main); padding: 4px 8px; transition: 0.15s; }
        .cat-check-label:hover { border-color: var(--primary); color: var(--primary); }
        .cat-check-label input[type=checkbox] { accent-color: var(--primary); width: 12px; height: 12px; }

        .modal-footer { padding: 20px; border-top: 1px solid var(--border-main); display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.1); }
        .btn-cancel { background: transparent; border: 1px solid var(--border-main); color: var(--text-muted); padding: 10px 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; }
        .btn-save { background: var(--primary); color: white; border: none; padding: 10px 24px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-save:hover { background: var(--primary-dark); }
        .btn-save:disabled { opacity: 0.5; }

        .code-badge { font-family: monospace; font-size: 0.8rem; font-weight: 800; color: var(--primary); background: rgba(249,115,22,0.05); border: 1px solid rgba(249,115,22,0.1); padding: 2px 6px; }
        .text-left { text-align: left !important; }
      `}</style>
    </MainLayout>
  );
};

export default MasterDatabasePage;
