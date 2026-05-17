import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { purchaseApi, rawMaterialApi, vendorApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { 
  ShoppingBag, Plus, Search, Filter, 
  Trash2, Check, X, Calendar, 
  DollarSign, Package, TrendingUp,
  ArrowRight, Tag, Truck, CreditCard,
  FileText, Edit3, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp
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
  const [vendors, setVendors] = useState<any[]>([]);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'BILLS'>(isStore ? 'REQUESTS' : 'REQUESTS');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states for New Request
  const [requestForm, setRequestForm] = useState({
    items: [] as any[],
    notes: ''
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
      const [rRes, bRes, iRes, vRes] = await Promise.all([
        purchaseApi.getRequests(),
        purchaseApi.getBills(),
        rawMaterialApi.getAll(entityId),
        vendorApi.getAll(entityId)
      ]);
      setRequests(rRes.data.data || []);
      setBills(bRes.data.data || []);
      setItems(iRes.data.data || []);
      setVendors(vRes.data.data || []);
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

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestForm.items.length === 0) return alert('Please add at least one item');
    try {
      setIsProcessing(true);
      await purchaseApi.createRequest(requestForm);
      setShowRequestModal(false);
      setRequestForm({ items: [], notes: '' });
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

  const handleUpdateBillDirect = async (id: string, data: any) => {
    if (!window.confirm('Mark these items as received? This will update inventory stock.')) return;
    try {
      setIsProcessing(true);
      await purchaseApi.updateBill(id, data);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update bill');
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
      default: return 'status-default';
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>PURCHASE WORKFLOW</h1>
          <p className="subtitle">From Request to Bill Payment &amp; Inventory Update</p>
        </div>
        <div className="header-actions">
          {isStore && (
            <button className="btn-primary" onClick={() => setShowRequestModal(true)}>
              <Plus size={16} /> NEW PURCHASE REQUEST
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="workflow-tabs">
        <button 
          className={`tab-item ${activeTab === 'REQUESTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('REQUESTS')}
        >
          <FileText size={16} /> PURCHASE REQUESTS
        </button>
        <button 
          className={`tab-item ${activeTab === 'BILLS' ? 'active' : ''}`}
          onClick={() => setActiveTab('BILLS')}
        >
          <CreditCard size={16} /> BILLS &amp; PAYMENTS
        </button>
      </div>

      <div className="data-panel">
        {isLoading ? <ForgeLoader /> : (
          <div className="table-wrapper">
            {activeTab === 'REQUESTS' ? (
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>PR-CODE</th>
                    <th>REQUESTED BY</th>
                    <th>ITEMS</th>
                    <th>DATE</th>
                    <th>VENDOR</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-dim">No purchase requests found.</td></tr>
                  ) : requests.map(r => (
                    <tr key={r._id}>
                      <td><span className="code-badge">{r.prCode}</span></td>
                      <td>{r.requestedBy?.name || 'Store'}</td>
                      <td>
                        <div className="item-summary-pill">
                          {r.items.length} Items
                        </div>
                      </td>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>{r.vendor?.vendorName || <span className="dim">Not Assigned</span>}</td>
                      <td><span className={`status-pill ${getStatusColor(r.status)}`}>{r.status}</span></td>
                      <td>
                        {isAdmin && r.status === 'PENDING' && (
                          <button className="btn-action-sm approve" onClick={() => openApprovalModal(r)}>
                            REVIEW &amp; BILL
                          </button>
                        )}
                        {r.status === 'BILLED' && (
                          <span className="info-text text-billed"><CheckCircle size={12} /> Billed Generated</span>
                        )}
                        {r.status === 'PENDING' && !isAdmin && (
                          <span className="info-text"><AlertCircle size={12} /> Awaiting Approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="sharp-table">
                <thead>
                  <tr>
                    <th>BILL-CODE</th>
                    <th>VENDOR</th>
                    <th>AMOUNT</th>
                    <th>PAID</th>
                    <th>PAYMENT</th>
                    <th>DELIVERY</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-dim">No bills generated yet.</td></tr>
                  ) : bills.map(b => (
                    <tr key={b._id}>
                      <td><span className="code-badge bill">{b.billCode}</span></td>
                      <td><strong>{b.vendor?.vendorName}</strong></td>
                      <td>₹{b.totalAmount.toLocaleString()}</td>
                      <td className={b.paidAmount >= b.totalAmount ? 'text-success' : 'text-danger'}>
                        ₹{b.paidAmount.toLocaleString()}
                      </td>
                      <td><span className={`status-pill ${getStatusColor(b.paymentStatus)}`}>{b.paymentStatus}</span></td>
                      <td><span className={`status-pill ${getStatusColor(b.deliveryStatus)}`}>{b.deliveryStatus}</span></td>
                      <td>
                        {isAdmin ? (
                          <button className="btn-action-sm payment" onClick={() => openBillModal(b)}>
                            MANAGE BILL
                          </button>
                        ) : (
                          b.deliveryStatus === 'PENDING' ? (
                            <button 
                              className="btn-action-sm received" 
                              onClick={() => {
                                setSelectedBill(b);
                                setPaymentForm({
                                  paidAmount: b.paidAmount,
                                  paymentStatus: b.paymentStatus,
                                  deliveryStatus: 'DELIVERED'
                                });
                                // Automatically trigger update for Store
                                handleUpdateBillDirect(b._id, { deliveryStatus: 'DELIVERED' });
                              }}
                            >
                              <Truck size={14} /> MARK RECEIVED
                            </button>
                          ) : (
                            <span className="info-text text-delivered">
                              <CheckCircle size={12} /> Items Received
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
              <div className="item-selector-section">
                <label>ADD ITEMS FROM CONFIG</label>
                <div className="item-search-grid">
                  {items.map(i => (
                    <button 
                      key={i._id} 
                      className={`selector-pill ${requestForm.items.find(ri => ri.item === i._id) ? 'selected' : ''}`}
                      onClick={() => handleAddItemToRequest(i)}
                    >
                      {i.name.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="selected-items-table">
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>REQUESTED QTY</th>
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
                        <td>{ri.unit}</td>
                        <td>
                          <button className="btn-remove" onClick={() => handleRemoveItemFromRequest(ri.item)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {requestForm.items.length === 0 && (
                      <tr><td colSpan={4} className="empty-mini">Select items above to add to request</td></tr>
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
        .btn-action-sm:hover { filter: brightness(1.1); transform: translateY(-1px); }

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
