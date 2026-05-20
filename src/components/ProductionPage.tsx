import React, { useState, useEffect } from 'react';
import { Package, ChefHat, Info, AlertTriangle } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { productionApi, userApi, bomApi } from '../services/api';
import ForgeLoader from './ForgeLoader';

const ProductionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PRODUCE' | 'SEND'>('SEND');
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [boms, setBoms] = useState<any[]>([]);
  const [selectedProduceItem, setSelectedProduceItem] = useState<any | null>(null);
  
  // User context
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'COO';

  // Forms
  const [dispatchForm, setDispatchForm] = useState<Record<string, number>>({});
  const [selectedForDispatch, setSelectedForDispatch] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      if (isAdmin && locations.length === 0) {
        const locRes = await userApi.getLocations();
        setLocations(locRes.data.data || []);
      }

      if (boms.length === 0) {
        const bomRes = await bomApi.getAll(user?.entity);
        setBoms(bomRes.data.data || []);
      }

      if (activeTab === 'PRODUCE') {
        const locId = filterLocation === 'ALL' ? undefined : filterLocation;
        const res = await productionApi.getOrders('send', locId);
        const allOrders = res.data.data || [];
        const activeOrders = allOrders.filter((o: any) => o.status === 'PENDING' || o.status === 'PARTIAL_DISPATCH');
        setOrders(activeOrders);
      } else {
        const locId = filterLocation === 'ALL' ? undefined : filterLocation;
        const res = await productionApi.getOrders('send', locId);
        setOrders(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch internal orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab, filterLocation]);

  const openDispatchModal = (order: any) => {
    setSelectedOrder(order);
    const qtys: Record<string, number> = {};
    order.items.forEach((item: any) => {
      qtys[item._id] = item.requestedQty - item.dispatchedQty;
    });
    setDispatchForm(qtys);
    setSelectedForDispatch({}); // Start unchecked
    setShowDispatchModal(true);
  };

  const handleDispatch = async () => {
    if (!selectedOrder) return;
    try {
      setIsProcessing(true);
      
      const itemsToDispatch = selectedOrder.items
        .filter((i: any) => selectedForDispatch[i._id])
        .map((i: any) => ({
          itemId: i._id,
          dispatchQty: dispatchForm[i._id] !== undefined ? dispatchForm[i._id] : (i.requestedQty - i.dispatchedQty)
        }))
        .filter((i: any) => i.dispatchQty > 0);

      if (itemsToDispatch.length === 0) {
        alert('Please select at least one item to dispatch.');
        return;
      }

      await productionApi.dispatch(selectedOrder._id, itemsToDispatch);
      setShowDispatchModal(false);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to dispatch order');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'status-pending';
      case 'PARTIAL_DISPATCH': return 'status-pending';
      case 'DISPATCHED': return 'status-billed';
      case 'PARTIAL_RECEIPT': return 'status-delivered';
      case 'RECEIVED': return 'status-paid';
      default: return 'status-default';
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>PRODUCTION HUB</h1>
          <p className="subtitle">Manage Produce and Send workflows</p>
        </div>
      </header>

      <div className="workflow-tabs">
        <button 
          className={`tab-item ${activeTab === 'PRODUCE' ? 'active' : ''}`}
          onClick={() => setActiveTab('PRODUCE')}
        >
          <ChefHat size={14} /> PRODUCE
        </button>
        <button 
          className={`tab-item ${activeTab === 'SEND' ? 'active' : ''}`}
          onClick={() => setActiveTab('SEND')}
        >
          <Package size={14} /> SEND
        </button>
      </div>

      <div className="data-panel">
        {isAdmin && (
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

        {isLoading ? <ForgeLoader /> : activeTab === 'PRODUCE' ? (
          <div className="produce-grid">
            {(() => {
              const consolidatedMap: Record<string, { itemName: string; bomId: string; unit: string; totalPendingQty: number }> = {};
              orders.forEach((order: any) => {
                (order.items || []).forEach((item: any) => {
                  const pending = item.requestedQty - item.dispatchedQty;
                  if (pending > 0) {
                    const key = item.bomId || item.itemName;
                    if (!consolidatedMap[key]) {
                      consolidatedMap[key] = {
                        itemName: item.itemName,
                        bomId: item.bomId,
                        unit: item.unit || 'pcs',
                        totalPendingQty: 0
                      };
                    }
                    consolidatedMap[key].totalPendingQty += pending;
                  }
                });
              });
              const consolidatedList = Object.values(consolidatedMap);

              if (consolidatedList.length === 0) {
                return <div className="text-center py-12 text-dim" style={{ width: '100%' }}>No items pending production. All internal orders are fully dispatched!</div>;
              }

              return consolidatedList.map((item: any, idx: number) => (
                <div 
                  key={idx} 
                  className="produce-card"
                  onClick={() => setSelectedProduceItem(item)}
                >
                  <div className="produce-card-icon">
                    <ChefHat size={28} />
                  </div>
                  <div className="produce-card-content">
                    <h3 className="produce-card-title">{item.itemName.toUpperCase()}</h3>
                    <div className="produce-card-stat">
                      <span className="stat-label">TOTAL TO PRODUCE</span>
                      <span className="stat-value">{item.totalPendingQty} {item.unit.toUpperCase()}</span>
                    </div>
                    <div className="produce-card-footer">
                      <Info size={12} /> Click to view raw material recipe
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>PO CODE</th>
                  <th>RECEIVING LOCATION</th>
                  <th>NUMBER OF ITEMS</th>
                  <th>DATE OF DISPATCH</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-dim">No orders found.</td></tr>
                ) : (
                  orders.map((order, idx) => (
                    <tr key={idx}>
                      <td><strong>{order.orderCode}</strong></td>
                      <td>
                        {order.destinationLocation?.name?.toUpperCase() || 'UNKNOWN'}
                      </td>
                      <td>{order.items?.length || 0}</td>
                      <td>
                        {order.dispatchedAt 
                          ? new Date(order.dispatchedAt).toLocaleDateString() 
                          : new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`status-pill ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-action-sm payment" 
                          style={{ margin: '0 auto' }}
                          onClick={() => openDispatchModal(order)}
                        >
                          <Package size={14} /> OPEN
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDispatchModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content workflow-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>DISPATCH ORDER: {selectedOrder.orderCode}</h2>
              <button className="btn-close" onClick={() => setShowDispatchModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-dim)', marginBottom: '12px' }}>
                WARNING: DISPATCHING ITEMS WILL DEDUCT RAW MATERIALS FROM INVENTORY.
              </p>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '50px' }}>SELECT</th>
                    <th>ITEM NAME</th>
                    <th>PENDING QTY</th>
                    <th>DISPATCH QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((i: any, idx: number) => {
                    const pendingQty = i.requestedQty - i.dispatchedQty;
                    if (pendingQty <= 0) return null;
                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={selectedForDispatch[i._id] || false}
                            onChange={(e) => setSelectedForDispatch({...selectedForDispatch, [i._id]: e.target.checked})}
                            style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                          />
                        </td>
                        <td><strong>{i.itemName}</strong></td>
                        <td>{pendingQty} {i.unit}</td>
                        <td>
                          <input 
                            type="number"
                            value={dispatchForm[i._id] ?? pendingQty}
                            onChange={(e) => setDispatchForm({...dispatchForm, [i._id]: Number(e.target.value)})}
                            max={pendingQty}
                            min="0"
                            disabled={!selectedForDispatch[i._id]}
                            style={{ width: '80px', padding: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none', opacity: selectedForDispatch[i._id] ? 1 : 0.5 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDispatchModal(false)}>CANCEL</button>
              <button className="btn-action-sm payment" onClick={handleDispatch} disabled={isProcessing || Object.keys(selectedForDispatch).filter(k => selectedForDispatch[k]).length === 0}>
                {isProcessing ? 'PROCESSING...' : 'SET DISPATCH'}
              </button>
            </div>
          </div>
        </div>
      )}

    {selectedProduceItem && (() => {
      const matchingBom = boms.find((b: any) => 
        (selectedProduceItem.bomId && b._id === selectedProduceItem.bomId) || 
        b.dishName.toLowerCase() === selectedProduceItem.itemName.toLowerCase()
      );
      return (
        <div className="modal-overlay">
          <div className="modal-content workflow-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>RECIPE BREAKDOWN: {selectedProduceItem.itemName.toUpperCase()}</h2>
              <button className="btn-close" onClick={() => setSelectedProduceItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#8b5cf6', letterSpacing: '0.5px' }}>PRODUCTION VOLUME REQUIRED</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                  {selectedProduceItem.totalPendingQty} {selectedProduceItem.unit.toUpperCase()}
                </h3>
              </div>

              {matchingBom ? (
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 800, marginBottom: '12px' }}>
                    RAW MATERIALS NEEDED FOR THIS VOLUME (Yield Unit: 1 {matchingBom.unit.toUpperCase()}):
                  </p>
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>INGREDIENT NAME</th>
                        <th>QTY PER UNIT</th>
                        <th style={{ textAlign: 'right' }}>TOTAL REQUIRED QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matchingBom.items || []).map((ingredient: any, idx: number) => {
                        const totalRequired = ingredient.quantity * selectedProduceItem.totalPendingQty;
                        return (
                          <tr key={idx}>
                            <td><strong>{ingredient.itemName}</strong></td>
                            <td>{ingredient.quantity} {ingredient.unit}</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 800 }}>
                              {totalRequired.toFixed(2)} {ingredient.unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px' }}>
                  <AlertTriangle size={32} style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontSize: '0.8rem', fontWeight: 900, margin: 0 }}>NO BILL OF MATERIALS (BOM) CONFIGURED</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
                    Please configure a Bill of Materials for "{selectedProduceItem.itemName}" under settings to view recipe calculations.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSelectedProduceItem(null)}>CLOSE</button>
            </div>
          </div>
        </div>
      );
    })()}

    <style>{`
      /* Produce Tab Styles */
      .produce-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; padding: 16px 0; }
      .produce-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); border-radius: 6px; padding: 20px; display: flex; gap: 16px; cursor: pointer; transition: all 0.2s ease-in-out; }
      .produce-card:hover { transform: translateY(-2px); border-color: var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      .produce-card-icon { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; padding: 12px; border-radius: 6px; display: flex; align-items: center; justify-content: center; height: fit-content; }
      .produce-card-content { flex: 1; display: flex; flex-direction: column; }
      .produce-card-title { font-size: 0.95rem; font-weight: 900; color: var(--text-main); margin: 0 0 12px 0; }
      .produce-card-stat { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
      .stat-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
      .stat-value { font-size: 1.25rem; font-weight: 900; color: var(--primary); }
      .produce-card-footer { font-size: 0.65rem; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }

      .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }

        .workflow-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-main); padding-bottom: 2px; }
        .tab-item { background: none; border: none; padding: 12px 24px; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; position: relative; }
        .tab-item:hover { color: var(--text-main); }
        .tab-item.active { color: var(--primary); }
        .tab-item.active::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background: var(--primary); }

        .status-pill { font-size: 0.65rem; font-weight: 900; padding: 4px 10px; letter-spacing: 0.5px; }
        .status-pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-billed { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        .status-paid { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-delivered { background: rgba(16,185,129,0.1); color: #10b981; }

        .btn-action-sm { border: none; padding: 6px 12px; font-size: 0.65rem; font-weight: 900; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px;}
        .btn-action-sm.payment { background: #8b5cf6; color: white; }
        .btn-action-sm.received { background: #10b981; color: white; }
        .btn-action-sm:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-action-sm:disabled { opacity: 0.5; cursor: not-allowed; }

        .workflow-modal { border-radius: 0; padding: 0; }
        .modal-body { padding: 24px; max-height: 70vh; overflow-y: auto; }

        .mini-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 24px; }
        .mini-table th { text-align: left; font-size: 0.65rem; font-weight: 900; color: var(--text-dim); border-bottom: 1px solid var(--border-main); padding: 8px; }
        .mini-table td { padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      `}</style>
    </MainLayout>
  );
};

export default ProductionPage;
