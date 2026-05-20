import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { purchaseApi, rawMaterialApi, vendorApi, userApi, menuApi, productionApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { 
  ShoppingBag, Plus, Trash2, Check, X, 
  DollarSign, Package, Truck, CreditCard,
  Edit3
} from 'lucide-react';

const PurchasePage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  
  // User context
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isStore = user?.role === 'STORE';

  // Data states
  const [requests, setRequests] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'VENDOR' | 'INTERNAL'>('VENDOR');
  const [internalOrders, setInternalOrders] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiveForm, setReceiveForm] = useState<Record<string, number>>({});
  const [receiveFormPrice, setReceiveFormPrice] = useState<Record<string, number>>({});
  const [selectedForReceive, setSelectedForReceive] = useState<Record<string, boolean>>({});
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for New Request
  const [requestForm, setRequestForm] = useState({
    items: [] as any[],
    notes: '',
    vendorId: '',
    destinationLocation: ''
  });

  // Form states for Approval
  const [approvalForm, setApprovalForm] = useState({
    vendor: '',
    items: [] as any[]
  });

  // Form states for Bill Payment
  const [paymentForm, setPaymentForm] = useState({
    paidAmount: 0,
    paymentStatus: 'UNPAID',
    deliveryStatus: 'PENDING'
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rRes, bRes, iRes, vRes, locRes, mRes, intRes] = await Promise.all([
        purchaseApi.getRequests(),
        purchaseApi.getBills(),
        rawMaterialApi.getAll(entityId),
        vendorApi.getAll(entityId),
        userApi.getLocations(entityId),
        menuApi.getAll(entityId),
        productionApi.getOrders('receive')
      ]);
      setRequests(rRes.data.data || []);
      setBills(bRes.data.data || []);
      setItems(iRes.data.data || []);
      setVendors(vRes.data.data || []);
      setLocations(locRes.data.data || []);
      setMenuItems(mRes.data.data || []);
      setInternalOrders(intRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch purchase data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [entityId]);

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
    try {
      setIsProcessing(true);
      await purchaseApi.createRequest(requestForm);
      setShowRequestModal(false);
      setRequestForm({ items: [], notes: '', vendorId: '', destinationLocation: '' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Admin Approval Logic ---

  const openApprovalModal = (pr: any) => {
    setSelectedPR(pr);
    setApprovalForm({
      vendor: pr.vendor || '',
      items: pr.items.map((i: any) => ({
        ...i,
        approvedQty: i.requestedQty,
        unitPrice: 0
      }))
    });
    setShowApprovalModal(true);
  };

  const handleApprovePR = async () => {
    if (!approvalForm.vendor) return alert('Please select a vendor');
    try {
      setIsProcessing(true);
      await purchaseApi.approveRequest(selectedPR._id, approvalForm);
      setShowApprovalModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Bill Management Logic ---

  const openBillModal = (bill: any) => {
    setSelectedBill(bill);
    setPaymentForm({
      paidAmount: bill.paidAmount,
      paymentStatus: bill.paymentStatus,
      deliveryStatus: bill.deliveryStatus
    });
    setShowBillModal(true);
  };

  const handleUpdateBill = async () => {
    try {
      setIsProcessing(true);
      await purchaseApi.updateBill(selectedBill._id, paymentForm);
      setShowBillModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update bill');
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
    const prices: Record<string, number> = {};
    bill.items.forEach((item: any) => {
      qtys[item.item] = item.receivedQty !== undefined ? item.receivedQty : item.quantity;
      prices[item.item] = item.unitPrice || 0;
    });
    setReceiveForm(qtys);
    setReceiveFormPrice(prices);
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
        <div className="header-actions">
          {isStore && activeTab === 'VENDOR' && (
            <button className="btn-primary" onClick={() => setShowRequestModal(true)}>
              <Plus size={16} /> NEW PURCHASE REQUEST
            </button>
          )}
        </div>
      </header>

      <div className="workflow-tabs">
        <button 
          className={`tab-item ${activeTab === 'VENDOR' ? 'active' : ''}`}
          onClick={() => setActiveTab('VENDOR')}
        >
          <ShoppingBag size={14} /> VENDOR PURCHASES
        </button>
        <button 
          className={`tab-item ${activeTab === 'INTERNAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('INTERNAL')}
        >
          <Truck size={14} /> INTERNAL PURCHASES
        </button>
      </div>

      <div className="data-panel">
        {isLoading ? <ForgeLoader /> : activeTab === 'VENDOR' ? (
          <div className="table-wrapper">
            {isStore && (
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border-main)', display: 'flex', gap: '16px', alignItems: 'center' }}>
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
                {(filterLocation === 'ALL' ? bills : bills.filter(b => b.destinationLocation === filterLocation)).length === 0 ? (
                  <tr><td colSpan={isStore ? 6 : 5} className="text-center py-12 text-dim">No purchases found.</td></tr>
                ) : (
                  (filterLocation === 'ALL' ? bills : bills.filter(b => b.destinationLocation === filterLocation)).map((bill, idx) => {
                    
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
                            {(isStore || isAdmin) && bill.deliveryStatus === 'DELIVERED' && bill.paymentStatus !== 'PAID' && (
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
                  })
                )}
              </tbody>
            </table>
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
                {internalOrders.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-dim">No internal purchases found.</td></tr>
                ) : (
                  internalOrders.map((order: any, idx: number) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>
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

      {/* 2. Admin: Approval Modal */}
      {showApprovalModal && selectedPR && (
        <div className="modal-overlay">
          <div className="modal-content workflow-modal" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2><Edit3 size={18} /> REVIEW PURCHASE REQUEST — {selectedPR.prCode}</h2>
              <button className="close-btn" onClick={() => setShowApprovalModal(false)}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="approval-header-info">
                <div className="info-group">
                  <label>REQUESTED BY</label>
                  <span>{selectedPR.requestedBy?.name}</span>
                </div>
                <div className="info-group">
                  <label>VENDOR SELECTION</label>
                  <select 
                    value={approvalForm.vendor} 
                    onChange={(e) => setApprovalForm(prev => ({ ...prev, vendor: e.target.value }))}
                  >
                    <option value="">SELECT VENDOR...</option>
                    <option value="NOT_NOW">NOT NOW (INTERNAL)</option>
                    {vendors.map(v => (
                      <option key={v._id} value={v._id}>{v.vendorName.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="approval-items-table">
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>REQUESTED</th>
                      <th>APPROVE QTY</th>
                      <th>UNIT PRICE (₹)</th>
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalForm.items.map((ai, idx) => (
                      <tr key={ai.item}>
                        <td>{ai.itemName}</td>
                        <td>{ai.requestedQty} {ai.unit}</td>
                        <td>
                          <input 
                            type="number" 
                            value={ai.approvedQty} 
                            onChange={(e) => {
                              const newItems = [...approvalForm.items];
                              newItems[idx].approvedQty = Number(e.target.value);
                              setApprovalForm(prev => ({ ...prev, items: newItems }));
                            }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            value={ai.unitPrice} 
                            onChange={(e) => {
                              const newItems = [...approvalForm.items];
                              newItems[idx].unitPrice = Number(e.target.value);
                              setApprovalForm(prev => ({ ...prev, items: newItems }));
                            }}
                          />
                        </td>
                        <td className="text-primary">₹{(ai.approvedQty * ai.unitPrice).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="approval-summary-banner">
                <label>TOTAL BILL AMOUNT</label>
                <span>₹{approvalForm.items.reduce((acc, curr) => acc + (curr.approvedQty * curr.unitPrice), 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowApprovalModal(false)}>CANCEL</button>
              <button className="btn-save" onClick={handleApprovePR} disabled={isProcessing || !approvalForm.vendor}>
                {isProcessing ? 'GENERATING BILL...' : 'APPROVE & GENERATE BILL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Receipt Modal */}
      {showReceiveModal && selectedBill && (
        <div className="modal-overlay">
          <div className="modal-content workflow-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{selectedBill.deliveryStatus === 'DELIVERED' ? 'VIEW DELIVERY' : 'ACCEPT DELIVERY'}</h2>
              <button className="btn-close" onClick={() => setShowReceiveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="bill-detail-card" style={{ marginBottom: '16px' }}>
                <div className="bill-row">
                  <label>{activeTab === 'INTERNAL' ? 'SOURCE KITCHEN' : 'VENDOR'}</label>
                  <span>
                    {activeTab === 'INTERNAL' 
                      ? (selectedBill.sourceLocation?.name || 'UNKNOWN') 
                      : (selectedBill.vendor?.vendorName || 'UNKNOWN')}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-dim)', marginBottom: '12px' }}>
                {activeTab === 'INTERNAL' 
                  ? 'SELECT ITEMS AND QUANTITIES TO RECEIVE' 
                  : 'VERIFY RECEIVED QUANTITIES (UPDATES INVENTORY)'}
              </p>
              <table className="mini-table">
                <thead>
                  <tr>
                    {activeTab === 'INTERNAL' && <th style={{ textAlign: 'center', width: '50px' }}>SELECT</th>}
                    <th>ITEM NAME</th>
                    <th>{activeTab === 'INTERNAL' ? 'DISPATCHED QTY' : 'ORDERED QTY'}</th>
                    <th>RECEIVED QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items.map((i: any, idx: number) => {
                    const maxQty = activeTab === 'INTERNAL' ? (i.dispatchedQty - i.receivedQty) : i.quantity;
                    const idKey = activeTab === 'INTERNAL' ? i._id : i.item;
                    if (activeTab === 'INTERNAL' && maxQty <= 0) return null;
                    return (
                      <tr key={idx}>
                        {activeTab === 'INTERNAL' && (
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={selectedForReceive[i._id] || false}
                              onChange={(e) => setSelectedForReceive({...selectedForReceive, [i._id]: e.target.checked})}
                              style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td><strong>{i.itemName}</strong></td>
                        <td>{maxQty}</td>
                        <td>
                          <input 
                            type="number"
                            value={receiveForm[idKey] ?? maxQty}
                            onChange={(e) => setReceiveForm({...receiveForm, [idKey]: Number(e.target.value)})}
                            disabled={(activeTab === 'INTERNAL' && !selectedForReceive[i._id]) || selectedBill.deliveryStatus === 'DELIVERED'}
                            style={{ 
                              width: '80px', 
                              padding: '6px', 
                              background: 'var(--bg-main)', 
                              border: '1px solid var(--border-main)', 
                              color: 'var(--text-main)', 
                              outline: 'none',
                              opacity: ((activeTab === 'INTERNAL' && !selectedForReceive[i._id]) || selectedBill.deliveryStatus === 'DELIVERED') ? 0.5 : 1
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {selectedBill.deliveryStatus === 'DELIVERED' ? (
                <button className="btn-cancel" onClick={() => setShowReceiveModal(false)}>CLOSE</button>
              ) : (
                <>
                  <button className="btn-cancel" onClick={() => setShowReceiveModal(false)}>CANCEL</button>
                  {activeTab === 'INTERNAL' && (
                    <button 
                      className="btn-action-sm" 
                      disabled 
                      style={{ background: '#ef4444', color: 'white', opacity: 0.5, cursor: 'not-allowed' }}
                    >
                      REJECT DELIVERY
                    </button>
                  )}
                  <button 
                    className="btn-action-sm received" 
                    onClick={handleConfirmReceive} 
                    disabled={isProcessing || (activeTab === 'INTERNAL' && Object.keys(selectedForReceive).filter(k => selectedForReceive[k]).length === 0)}
                  >
                    {isProcessing ? 'PROCESSING...' : 'ACCEPT DELIVERY'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Admin: Bill/Payment Modal */}
      {showBillModal && selectedBill && (
        <div className="modal-overlay">
          <div className="modal-content workflow-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2><CreditCard size={18} /> MANAGE BILL — {selectedBill.billCode}</h2>
              <button className="close-btn" onClick={() => setShowBillModal(false)}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="bill-detail-card">
                <div className="bill-row">
                  <label>VENDOR</label>
                  <span>{selectedBill.vendor?.vendorName}</span>
                </div>
                <div className="bill-row highlight">
                  <label>TOTAL AMOUNT</label>
                  <span>₹{selectedBill.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="bill-management-form">
                <div className="input-group">
                  <label>DELIVERY STATUS (UPDATES INVENTORY)</label>
                  <select 
                    value={paymentForm.deliveryStatus} 
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, deliveryStatus: e.target.value }))}
                  >
                    <option value="PENDING">PENDING (AWAITING SHIPMENT)</option>
                    <option value="DELIVERED">DELIVERED (ADD TO STOCK)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>PAYMENT STATUS</label>
                  <select 
                    value={paymentForm.paymentStatus} 
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                  >
                    <option value="UNPAID">UNPAID</option>
                    <option value="PARTIAL">PARTIAL PAYMENT</option>
                    <option value="PAID">FULLY PAID</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>AMOUNT PAID (₹)</label>
                  <input 
                    type="number" 
                    value={paymentForm.paidAmount} 
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paidAmount: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowBillModal(false)}>CANCEL</button>
              <button className="btn-save" onClick={handleUpdateBill} disabled={isProcessing}>
                {isProcessing ? 'UPDATING...' : 'CONFIRM UPDATES'}
              </button>
            </div>
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
      `}</style>
    </MainLayout>
  );
};

export default PurchasePage;
