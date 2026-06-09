import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { purchaseApi, rawMaterialApi, vendorApi, userApi, menuApi, productionApi, expenseApi, expenseCategoryApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import BillViewModal from './BillViewModal';
import { 
  ShoppingBag, Plus, Trash2, X, 
  DollarSign, Package, Truck,
  Calendar, Tag, FileText, CreditCard, Coins
} from 'lucide-react';

const PurchasePage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  
  // User context
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isViewOnly = queryParams.get('viewOnly') === 'true' || user?.role === 'ADMIN';

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isStore = user?.role === 'STORE';
  const isLocationUser = ['STORE', 'CENTERS', 'RESTAURANT', 'RESORT', 'AGGREGATE', 'KITCHEN'].includes(user?.role);

  // Data states
  const [bills, setBills] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'VENDOR' | 'INTERNAL'>('VENDOR');
  const [internalOrders, setInternalOrders] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: '',
    amount: 0,
    paymentMethod: 'Cash'
  });
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiveForm, setReceiveForm] = useState<Record<string, number>>({});
  const [selectedForReceive, setSelectedForReceive] = useState<Record<string, boolean>>({});
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [filterDate, setFilterDate] = useState<string>('');

  // Form states for New Request
  const [requestForm, setRequestForm] = useState({
    items: [] as any[],
    notes: '',
    vendorId: '',
    destinationLocation: ''
  });



  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [bRes, iRes, vRes, locRes, mRes, intRes, expRes, catRes] = await Promise.all([
        purchaseApi.getBills(),
        rawMaterialApi.getAll(entityId),
        vendorApi.getAll(entityId),
        userApi.getLocations(entityId),
        menuApi.getAll(entityId),
        productionApi.getOrders('receive'),
        expenseApi.getAll(),
        expenseCategoryApi.getAll(entityId)
      ]);
      setBills(bRes.data.data || []);
      setItems(iRes.data.data || []);
      setVendors(vRes.data.data || []);
      setLocations(locRes.data.data || []);
      setMenuItems(mRes.data.data || []);
      setInternalOrders(intRes.data.data || []);
      setExpenses(expRes.data.data || []);
      setExpenseCategories(catRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch purchase data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [entityId]);

  useEffect(() => {
    if (expenseCategories.length > 0) {
      setExpenseForm(prev => ({ ...prev, category: expenseCategories[0].categoryName }));
    }
  }, [expenseCategories]);

  // --- Purchase Request Logic ---

  const handleAddItemToRequest = (item: any) => {
    if (requestForm.items.find(i => i.item === item._id)) return;
    setRequestForm(prev => ({
      ...prev,
      items: [...prev.items, { 
        item: item._id, 
        itemName: item.name, 
        requestedQty: 1, 
        unitPrice: 0,
        unit: item.unit 
      }]
    }));
  };

  const handleRemoveItemFromRequest = (itemId: string) => {
    setRequestForm(prev => ({
      ...prev,
      items: prev.items.filter(i => i.item !== itemId)
    }));
  };

  const handleUpdateQtyInRequest = (itemId: string, qty: number) => {
    setRequestForm(prev => ({
      ...prev,
      items: prev.items.map(i => i.item === itemId ? { ...i, requestedQty: qty } : i)
    }));
  };

  const handleUpdatePriceInRequest = (itemId: string, price: number) => {
    setRequestForm(prev => ({
      ...prev,
      items: prev.items.map(i => i.item === itemId ? { ...i, unitPrice: price } : i)
    }));
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestForm.items.length === 0) return alert('Please add at least one item');
    
    const zeroPriceItem = requestForm.items.find(i => !i.unitPrice || Number(i.unitPrice) <= 0);
    if (zeroPriceItem) {
      return alert(`Please specify a valid unit price greater than 0 for "${zeroPriceItem.itemName}".`);
    }

    try {
      setIsProcessing(true);
      await purchaseApi.createRequest(requestForm);
      setShowRequestModal(false);
      setRequestForm({ items: [], notes: '', vendorId: '', destinationLocation: '' });
      fetchData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        const confirmForce = window.confirm(
          `${err.response?.data?.error || 'A duplicate pending request already exists.'}\n\nDo you want to proceed and raise an additional Purchase Request for these items?`
        );
        if (confirmForce) {
          try {
            await purchaseApi.createRequest({ ...requestForm, allowDuplicate: true });
            setShowRequestModal(false);
            setRequestForm({ items: [], notes: '', vendorId: '', destinationLocation: '' });
            fetchData();
            return;
          } catch (retryErr: any) {
            alert(retryErr.response?.data?.error || 'Failed to submit request');
          }
        }
      } else {
        alert(err.response?.data?.error || 'Failed to submit request');
      }
    } finally {
      setIsProcessing(false);
    }
  };



  // --- Manual Expense Logic ---
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || expenseForm.amount <= 0) {
      return alert('Please fill in all fields correctly');
    }
    try {
      setIsProcessing(true);
      await expenseApi.create(expenseForm);
      setShowExpenseModal(false);
      setExpenseForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: expenseCategories[0]?.categoryName || '',
        amount: 0,
        paymentMethod: 'Cash'
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateBillDirect = async (billId: string, updates: any) => {
    try {
      setIsProcessing(true);
      await purchaseApi.updateBill(billId, updates);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update bill');
    } finally {
      setIsProcessing(false);
    }
  };

  const openReceiveModal = (bill: any) => {
    setSelectedBill(bill);
    const qtys: Record<string, number> = {};
    bill.items.forEach((item: any) => {
      qtys[item.item] = item.receivedQty !== undefined ? item.receivedQty : item.quantity;
    });
    setReceiveForm(qtys);
    setShowReceiveModal(true);
  };

  const handleConfirmReceive = async () => {
    if (!selectedBill) return;
    try {
      setIsProcessing(true);
      
      if (activeTab === 'INTERNAL') {
        const itemsToReceive = selectedBill.items
          .filter((i: any) => selectedForReceive[i._id])
          .map((i: any) => ({
            itemId: i._id,
            receiveQty: receiveForm[i._id] !== undefined ? receiveForm[i._id] : (i.dispatchedQty - i.receivedQty)
          }))
          .filter((i: any) => i.receiveQty > 0);

        if (itemsToReceive.length === 0) {
          alert('Please select at least one item to receive.');
          return;
        }

        await productionApi.receive(selectedBill._id, itemsToReceive);
      } else {
        const updatedItems = selectedBill.items.map((i: any) => ({
          ...i,
          receivedQty: receiveForm[i.item] !== undefined ? receiveForm[i.item] : i.quantity,
          unitPrice: i.unitPrice
        }));
        
        const newTotal = updatedItems.reduce((acc: number, curr: any) => acc + ((curr.receivedQty || 0) * (curr.unitPrice || 0)), 0);

        await purchaseApi.updateBill(selectedBill._id, {
          deliveryStatus: 'DELIVERED',
          items: updatedItems,
          totalAmount: newTotal
        });
      }

      setShowReceiveModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to receive delivery');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'status-pending';
      case 'APPROVED': return 'status-approved';
      case 'BILLED': return 'status-billed';
      case 'REJECTED': return 'status-rejected';
      case 'PAID': return 'status-paid';
      case 'UNPAID': return 'status-unpaid';
      case 'DELIVERED': return 'status-delivered';
      case 'PARTIAL_DISPATCH': return 'status-pending';
      case 'DISPATCHED': return 'status-billed';
      case 'PARTIAL_RECEIPT': return 'status-delivered';
      case 'RECEIVED': return 'status-paid';
      default: return 'status-default';
    }
  };

  const combinedItems = [
    ...items.map(i => ({ _id: i._id, name: i.name, unit: i.unit, type: 'RAW MATERIAL' })),
    ...menuItems.map(m => ({ _id: m._id, name: m.name, unit: m.unit, type: 'DIRECT ITEM' }))
  ];

  const filteredItems = combinedItems.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>PURCHASE WORKFLOW</h1>
          <p className="subtitle">Accept deliveries and update inventory</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          {isStore && activeTab === 'VENDOR' && !isViewOnly && (
            <button className="btn-primary" onClick={() => setShowRequestModal(true)}>
              <Plus size={16} /> NEW PURCHASE REQUEST
            </button>
          )}
          {isLocationUser && activeTab === 'VENDOR' && !isViewOnly && (
            <button className="btn-secondary" onClick={() => setShowExpenseModal(true)}>
              <Plus size={16} /> ADD EXPENSE
            </button>
          )}
        </div>
      </header>

      <div className="workflow-tabs">
        <button 
          className={`tab-item ${activeTab === 'VENDOR' ? 'active' : ''}`}
          onClick={() => setActiveTab('VENDOR')}
        >
          <ShoppingBag size={14} /> VENDOR PURCHASES &amp; EXPENSES
        </button>
        {!isStore && (
          <button 
            className={`tab-item ${activeTab === 'INTERNAL' ? 'active' : ''}`}
            onClick={() => setActiveTab('INTERNAL')}
          >
            <Truck size={14} /> INTERNAL PURCHASES
          </button>
        )}
      </div>

      <div className="data-panel">
        {isLoading ? (
          <ForgeLoader />
        ) : (
          <>
            {/* Unified Filters Bar */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-main)', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
              {activeTab === 'VENDOR' && (isStore || user?.role === 'ADMIN' || user?.role === 'COO' || isViewOnly) && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)' }}>FILTER BY LOCATION:</label>
                  <select 
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', padding: '6px 12px', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="ALL">ALL LOCATIONS</option>
                    {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)' }}>FILTER BY DATE:</label>
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', padding: '5px 12px', color: 'var(--text-main)', outline: 'none', fontSize: '0.8rem' }}
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate('')}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-strong)', padding: '5px 12px', color: 'var(--text-dim)', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'VENDOR' ? (
              <div className="table-wrapper">
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>PR-CODE</th>
                      <th>VENDOR</th>
                      {isStore && <th>DELIVERY LOCATION</th>}
                      <th>NUMBER OF ITEMS</th>
                      <th>DATE</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'center' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const locationFiltered = filterLocation === 'ALL' ? bills : bills.filter(b => b.destinationLocation === filterLocation);
                      const dateFiltered = locationFiltered.filter(bill => {
                        if (!filterDate) return true;
                        const billDateStr = new Date(bill.createdAt).toISOString().split('T')[0];
                        return billDateStr === filterDate;
                      });

                      if (dateFiltered.length === 0) {
                        return <tr><td colSpan={isStore ? 7 : 6} className="text-center py-12 text-dim">No purchases found.</td></tr>;
                      }

                      return dateFiltered.map((bill, idx) => {
                        let displayStatus = 'PR RAISED';
                        let statusClass = 'status-billed';
                        if (bill.deliveryStatus === 'DELIVERED') {
                          if (!isStore && !isAdmin) {
                            displayStatus = 'DELIVERY RECEIVED';
                            statusClass = 'status-delivered';
                          } else {
                            if (bill.paymentStatus === 'PAID') {
                              displayStatus = 'PAYMENT DONE';
                              statusClass = 'status-paid';
                            } else {
                              displayStatus = 'PAYMENT DUE';
                              statusClass = 'status-pending';
                            }
                          }
                        }

                        const deliveryLoc = locations.find(l => l._id === bill.destinationLocation);

                        return (
                          <tr key={idx}>
                            <td>{bill.purchaseRequest?.prCode || bill.billCode}</td>
                            <td>{bill.vendor?.vendorName || 'UNKNOWN'}</td>
                            {isStore && <td>{deliveryLoc ? deliveryLoc.name : 'Unknown'}</td>}
                            <td>{bill.items ? bill.items.length : 0}</td>
                            <td>{new Date(bill.createdAt).toLocaleDateString()}</td>
                            <td>
                              <span className={`status-pill ${statusClass}`}>
                                {displayStatus}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                <button 
                                  className="btn-action-sm edit" 
                                  onClick={() => openReceiveModal(bill)}
                                >
                                  <Package size={14} /> OPEN
                                </button>
                                {(isAdmin || user?.role === 'FINANCE' || user?.role === 'COO') && bill.deliveryStatus === 'DELIVERED' && bill.paymentStatus !== 'PAID' && !isViewOnly && (
                                  <button 
                                    className="btn-action-sm received" 
                                    onClick={() => handleUpdateBillDirect(bill._id, { paymentStatus: 'PAID' })}
                                    title="Mark Paid"
                                  >
                                    <DollarSign size={14} /> MARK PAID
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

                {/* Manual Expenses Section */}
                <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-main)', paddingTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 16px' }}>
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.5px' }}>MANUAL EXPENSES LOG</h2>
                  </div>
                  <table className="sharp-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>CATEGORY</th>
                        <th>DESCRIPTION</th>
                        <th>AMOUNT (₹)</th>
                        <th>PAYMENT METHOD</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const dateFiltered = expenses.filter(exp => {
                          if (!filterDate) return true;
                          const expDateStr = new Date(exp.date).toISOString().split('T')[0];
                          return expDateStr === filterDate;
                        });

                        if (dateFiltered.length === 0) {
                          return <tr><td colSpan={6} className="text-center py-8 text-dim">No manual expenses logged.</td></tr>;
                        }

                        return dateFiltered.map((exp, idx) => {
                          let statusClass = 'status-pending';
                          if (exp.status === 'APPROVED') statusClass = 'status-paid';
                          if (exp.status === 'REJECTED') statusClass = 'status-rejected';
                          if (exp.status === 'PENDING_FINANCE') statusClass = 'status-billed';

                          return (
                            <tr key={idx}>
                              <td>{new Date(exp.date).toLocaleDateString()}</td>
                              <td><strong>{exp.category}</strong></td>
                              <td>{exp.description}</td>
                              <td>₹ {exp.amount.toFixed(2)}</td>
                              <td>{exp.paymentMethod}</td>
                              <td>
                                <span className={`status-pill ${statusClass}`}>
                                  {exp.status.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>PO CODE</th>
                      <th>SENDING LOCATION</th>
                      <th>NUMBER OF ITEMS</th>
                      <th>DATE OF RECEPTION</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const dateFiltered = internalOrders.filter(order => {
                        if (!filterDate) return true;
                        const orderDateStr = new Date(order.receivedAt || order.dispatchedAt || order.createdAt).toISOString().split('T')[0];
                        return orderDateStr === filterDate;
                      });

                      if (dateFiltered.length === 0) {
                        return <tr><td colSpan={6} className="text-center py-12 text-dim">No internal purchases found.</td></tr>
                      }

                      return dateFiltered.map((order: any, idx: number) => {
                        const receptionDate = order.receivedAt 
                          ? new Date(order.receivedAt).toLocaleDateString()
                          : (order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleDateString() : 'PENDING');
                        return (
                          <tr key={idx}>
                            <td><strong>{order.orderCode}</strong></td>
                            <td>{order.sourceLocation?.name?.toUpperCase() || 'UNKNOWN'}</td>
                            <td>{order.items?.length || 0}</td>
                            <td>{receptionDate}</td>
                            <td>
                              <span className={`status-pill ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className="btn-action-sm received" 
                                style={{ margin: '0 auto' }}
                                onClick={() => {
                                  setSelectedBill(order);
                                  const qtys: Record<string, number> = {};
                                  order.items.forEach((item: any) => {
                                    qtys[item._id] = item.dispatchedQty - item.receivedQty;
                                  });
                                  setReceiveForm(qtys);
                                  setSelectedForReceive({}); // Start unchecked
                                  setShowReceiveModal(true);
                                }}
                              >
                                <Package size={14} /> OPEN
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. Store: New Request Modal */}
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content workflow-modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2><Plus size={18} /> CREATE PURCHASE REQUEST</h2>
              <button className="close-btn" onClick={() => setShowRequestModal(false)}><X size={20} /></button>
            </div>
            
            <div className="modal-body pr-modal-body">
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>VENDOR</label>
                  <select 
                    value={requestForm.vendorId} 
                    onChange={(e) => setRequestForm({...requestForm, vendorId: e.target.value})}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="">SELECT VENDOR...</option>
                    {vendors.map(v => (
                      <option key={v._id} value={v._id}>{v.vendorName.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>DELIVERY LOCATION</label>
                  <select 
                    value={requestForm.destinationLocation} 
                    onChange={(e) => setRequestForm({...requestForm, destinationLocation: e.target.value})}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="">SELECT LOCATION...</option>
                    {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.name.toUpperCase()} ({loc.roleType})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="item-selector-section" style={{ position: 'relative' }}>
                <label>ADD ITEMS TO REQUEST</label>
                <input 
                  type="text" 
                  placeholder="Search materials or direct items..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginBottom: '12px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                />
                {searchQuery.trim().length > 0 && (
                  <div className="item-search-grid" style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-main)', border: '1px solid var(--primary)', zIndex: 10, padding: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    {filteredItems.map(i => (
                      <button 
                        key={i._id} 
                        className={`selector-pill ${requestForm.items.find(ri => ri.item === i._id) ? 'selected' : ''}`}
                        onClick={() => {
                          handleAddItemToRequest(i);
                          setSearchQuery('');
                        }}
                        title={i.type}
                        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 12px', marginBottom: '4px', textAlign: 'left', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)' }}
                      >
                        <span>{i.name.toUpperCase()}</span>
                        <span style={{fontSize: '0.6rem', opacity: 0.7, color: 'var(--primary)'}}>{i.type}</span>
                      </button>
                    ))}
                    {filteredItems.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '10px' }}>No items found.</div>}
                  </div>
                )}
              </div>

              <div className="selected-items-table">
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>REQUESTED QTY</th>
                      <th>UNIT PRICE (₹)</th>
                      <th>UNIT</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestForm.items.map(ri => (
                      <tr key={ri.item}>
                        <td>{ri.itemName}</td>
                        <td>
                           <input 
                             type="number" 
                             value={ri.requestedQty} 
                             onChange={(e) => handleUpdateQtyInRequest(ri.item, Number(e.target.value))}
                             min="1"
                           />
                        </td>
                        <td>
                           <input 
                             type="number" 
                             value={ri.unitPrice || ''} 
                             placeholder="0.00"
                             onChange={(e) => handleUpdatePriceInRequest(ri.item, Number(e.target.value))}
                             min="0"
                             style={{ width: '80px', padding: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}
                           />
                        </td>
                        <td>{ri.unit}</td>
                        <td>
                          <button className="btn-remove" onClick={() => handleRemoveItemFromRequest(ri.item)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {requestForm.items.length === 0 && (
                      <tr><td colSpan={5} className="empty-mini">Select items above to add to request</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="notes-section">
                <label>ADDITIONAL NOTES</label>
                <textarea 
                  placeholder="Reason for purchase, urgency, etc."
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowRequestModal(false)}>CANCEL</button>
              <button className="btn-save" onClick={handleSubmitRequest} disabled={isProcessing || requestForm.items.length === 0}>
                {isProcessing ? 'SUBMITTING...' : 'SUBMIT PURCHASE REQUEST'}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Delivery Receipt Modal — via shared BillViewModal */}
      {showReceiveModal && selectedBill && (
        <BillViewModal
          bill={selectedBill}
          isViewOnly={isViewOnly}
          showMarkPaid={false}
          isInternal={activeTab === 'INTERNAL'}
          onClose={() => setShowReceiveModal(false)}
          onAcceptDelivery={handleConfirmReceive}
          receiveForm={receiveForm}
          onReceiveFormChange={setReceiveForm}
          selectedForReceive={selectedForReceive}
          onSelectedForReceiveChange={setSelectedForReceive}
          isProcessing={isProcessing}
        />
      )}


      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content premium-expense-modal" style={{ maxWidth: '650px', width: '100%' }}>
            <div className="modal-header">
              <h2>
                <Coins size={18} style={{ color: 'var(--primary)', marginRight: '8px', verticalAlign: 'middle' }} />
                MANUALLY RECORD EXPENSE
              </h2>
              <button className="close-btn" onClick={() => setShowExpenseModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitExpense}>
              <div className="modal-body expense-grid-body">
                
                {/* Row 1: Date and Category */}
                <div className="expense-row-two-col">
                  <div className="input-group-premium">
                    <label>
                      <Calendar size={12} style={{ marginRight: '6px' }} />
                      EXPENSE DATE
                    </label>
                    <input 
                      type="date" 
                      value={expenseForm.date} 
                      onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                      required
                      className="premium-input-field"
                    />
                  </div>
                  <div className="input-group-premium">
                    <label>
                      <Tag size={12} style={{ marginRight: '6px' }} />
                      CATEGORY
                    </label>
                    <select 
                      value={expenseForm.category} 
                      onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                      required
                      className="premium-select-field"
                    >
                      {expenseCategories.length === 0 ? (
                        <option value="">No categories available</option>
                      ) : (
                        expenseCategories.map(cat => (
                          <option key={cat._id} value={cat.categoryName}>
                            {cat.categoryName.toUpperCase()}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Row 2: Amount and Payment Method */}
                <div className="expense-row-two-col">
                  <div className="input-group-premium">
                    <label>
                      <DollarSign size={12} style={{ marginRight: '6px' }} />
                      AMOUNT (₹)
                    </label>
                    <div className="premium-input-wrapper">
                      <span className="currency-prefix">₹</span>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        value={expenseForm.amount || ''} 
                        onChange={e => setExpenseForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        min="0.01"
                        step="0.01"
                        required
                        className="premium-input-field with-prefix"
                      />
                    </div>
                  </div>
                  <div className="input-group-premium">
                    <label>
                      <CreditCard size={12} style={{ marginRight: '6px' }} />
                      PAYMENT METHOD
                    </label>
                    <select 
                      value={expenseForm.paymentMethod} 
                      onChange={e => setExpenseForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      required
                      className="premium-select-field"
                    >
                      {['Cash'].map(m => (
                        <option key={m} value={m}>{m.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Description (Full Width) */}
                <div className="input-group-premium full-width">
                  <label>
                    <FileText size={12} style={{ marginRight: '6px' }} />
                    DESCRIPTION
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter details about this expense..."
                    value={expenseForm.description} 
                    onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                    required
                    className="premium-input-field"
                  />
                </div>

              </div>
              <div className="modal-footer premium-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-cancel-premium" onClick={() => setShowExpenseModal(false)}>CANCEL</button>
                <button type="submit" className="btn-save-premium" disabled={isProcessing}>
                  {isProcessing ? 'SAVING...' : 'RECORD EXPENSE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }

        .workflow-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-main); padding-bottom: 2px; }
        .tab-item { background: none; border: none; padding: 12px 24px; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; position: relative; }
        .tab-item:hover { color: var(--text-main); }
        .tab-item.active { color: var(--primary); }
        .tab-item.active::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background: var(--primary); }

        .item-summary-pill { font-size: 0.7rem; font-weight: 800; background: var(--bg-main); border: 1px solid var(--border-main); padding: 4px 10px; display: inline-block; }

        .status-pill { font-size: 0.65rem; font-weight: 900; padding: 4px 10px; letter-spacing: 0.5px; }
        .status-pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-billed { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        .status-paid { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-unpaid { background: rgba(239,68,68,0.1); color: #ef4444; }
        .status-delivered { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-rejected { background: rgba(239,68,68,0.1); color: #ef4444; }

        .btn-action-sm { border: none; padding: 6px 12px; font-size: 0.65rem; font-weight: 900; cursor: pointer; transition: 0.2s; }
        .btn-action-sm.approve { background: var(--primary); color: white; }
        .btn-action-sm.payment { background: #8b5cf6; color: white; }
        .btn-action-sm.received { background: #10b981; color: white; display: flex; align-items: center; gap: 6px; }
        .btn-action-sm:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-action-sm:disabled { opacity: 0.5; cursor: not-allowed; }

        .info-text { font-size: 0.65rem; color: var(--text-dim); font-weight: 700; display: flex; align-items: center; gap: 4px; }
        .info-text.text-delivered { color: #10b981; }
        .info-text.text-billed { color: #8b5cf6; }
        .code-badge.bill { color: #8b5cf6; border-color: rgba(139,92,246,0.3); background: rgba(139,92,246,0.05); }

        /* Modal Specifics */
        .workflow-modal { border-radius: 0; padding: 0; }
        .modal-body { padding: 24px; max-height: 70vh; overflow-y: auto; }
        
        .item-selector-section label, .notes-section label { display: block; font-size: 0.65rem; font-weight: 900; color: var(--text-dim); margin-bottom: 12px; letter-spacing: 1px; }
        .item-search-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
        .selector-pill { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-dim); padding: 6px 12px; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .selector-pill:hover { border-color: var(--primary); color: var(--primary); }
        .selector-pill.selected { background: var(--primary); color: white; border-color: var(--primary); }

        .mini-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 24px; }
        .mini-table th { text-align: left; font-size: 0.65rem; font-weight: 900; color: var(--text-dim); border-bottom: 1px solid var(--border-main); padding: 8px; }
        .mini-table td { padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .mini-table input { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 4px 8px; width: 80px; font-weight: 700; }
        .btn-remove { background: none; border: none; color: #ef4444; cursor: pointer; opacity: 0.6; }
        .btn-remove:hover { opacity: 1; }
        .empty-mini { text-align: center; color: var(--text-dim); font-style: italic; padding: 32px !important; }

        .notes-section textarea { width: 100%; height: 80px; background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; outline: none; resize: none; }

        .approval-header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .info-group label { display: block; font-size: 0.6rem; font-weight: 900; color: var(--text-dim); margin-bottom: 4px; }
        .info-group span { font-weight: 800; font-size: 1rem; color: var(--text-main); }
        .info-group select { width: 100%; background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 10px; font-weight: 800; }

        .approval-summary-banner { background: var(--bg-main); border: 1px solid var(--primary); padding: 20px; display: flex; justify-content: space-between; align-items: center; }
        .approval-summary-banner label { font-size: 0.75rem; font-weight: 900; color: var(--text-dim); }
        .approval-summary-banner span { font-size: 1.5rem; font-weight: 900; color: var(--primary); }

        .bill-detail-card { background: var(--bg-main); border: 1px solid var(--border-main); padding: 20px; margin-bottom: 24px; }
        .bill-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .bill-row label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); }
        .bill-row span { font-weight: 800; }
        .bill-row.highlight span { color: #8b5cf6; font-size: 1.25rem; }

        .bill-management-form { display: flex; flex-direction: column; gap: 20px; }
        .bill-management-form .input-group label { font-size: 0.65rem; font-weight: 900; color: var(--text-dim); margin-bottom: 6px; }
        .bill-management-form select, .bill-management-form input { background: var(--bg-main); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; font-weight: 800; }

        .text-primary { color: var(--primary); font-weight: 800; }

        /* Premium Modals and Inputs Styling */
        .expense-grid-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px;
        }
        .expense-row-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .input-group-premium {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .input-group-premium.full-width {
          grid-column: span 2;
        }
        .input-group-premium label {
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.8px;
          display: flex;
          align-items: center;
          text-transform: uppercase;
        }
        .premium-input-field, .premium-select-field {
          background: var(--bg-input);
          border: 1px solid var(--border-main);
          padding: 10px 14px;
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 500;
          width: 100%;
          outline: none;
          transition: all 0.2s ease-in-out;
        }
        .premium-input-field:focus, .premium-select-field:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
        }
        .premium-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .currency-prefix {
          position: absolute;
          left: 14px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .premium-input-field.with-prefix {
          padding-left: 30px;
        }
        .btn-cancel-premium {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-main);
          color: var(--text-muted);
          padding: 10px 20px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-cancel-premium:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-main);
        }
        .btn-save-premium {
          background: var(--primary);
          border: none;
          color: white;
          padding: 10px 24px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-save-premium:hover:not(:disabled) {
          background: var(--primary-dark);
          transform: translateY(-1px);
        }
        .btn-save-premium:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Custom styled checkbox overlay */
        .premium-checkbox-container {
          display: inline-block;
          position: relative;
          width: 20px;
          height: 20px;
          cursor: pointer;
          user-select: none;
        }
        .premium-checkbox-container input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }
        .premium-checkmark {
          position: absolute;
          top: 0;
          left: 0;
          height: 20px;
          width: 20px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-strong);
          transition: all 0.2s;
        }
        .premium-checkbox-container:hover input ~ .premium-checkmark {
          border-color: var(--primary);
        }
        .premium-checkbox-container input:checked ~ .premium-checkmark {
          background-color: var(--primary);
          border-color: var(--primary);
        }
        .premium-checkmark:after {
          content: "";
          position: absolute;
          display: none;
        }
        .premium-checkbox-container input:checked ~ .premium-checkmark:after {
          display: block;
        }
        .premium-checkbox-container .premium-checkmark:after {
          left: 6px;
          top: 2px;
          width: 5px;
          height: 10px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        /* Premium Accept Delivery button & animations */
        .btn-premium-accept {
          background: #10b981;
          color: white;
          border: none;
          padding: 10px 24px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-premium-accept:hover:not(:disabled) {
          background: #059669;
          transform: scale(1.03);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }
        .btn-premium-accept:active:not(:disabled) {
          transform: scale(0.98);
        }
        .btn-premium-accept:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .spinner-loader {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.6s linear infinite;
        }
      `}</style>
    </MainLayout>
  );
};

export default PurchasePage;
