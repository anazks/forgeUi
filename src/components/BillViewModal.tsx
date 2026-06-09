import React, { useState } from 'react';
import { Package, DollarSign } from 'lucide-react';

interface BillViewModalProps {
  bill: any;
  /** true  = Finance / COO / Admin view-only mode (receive inputs disabled, no ACCEPT DELIVERY) */
  isViewOnly: boolean;
  /** true  = show MARK PAID button in footer (Finance use-case) */
  showMarkPaid?: boolean;
  onClose: () => void;
  onMarkPaid?: (billId: string) => void;
  /** true = show INTERNAL TRANSFER badge, false = EXTERNAL VENDOR badge */
  isInternal?: boolean;
  /** called when user clicks ACCEPT DELIVERY (PurchasePage use-case) */
  onAcceptDelivery?: () => void;
  /** receive qty form state — used only when isViewOnly=false */
  receiveForm?: Record<string, number>;
  onReceiveFormChange?: (form: Record<string, number>) => void;
  selectedForReceive?: Record<string, boolean>;
  onSelectedForReceiveChange?: (sel: Record<string, boolean>) => void;
  isProcessing?: boolean;
}

const BillViewModal: React.FC<BillViewModalProps> = ({
  bill,
  isViewOnly,
  showMarkPaid = false,
  onClose,
  onMarkPaid,
  isInternal = false,
  onAcceptDelivery,
  receiveForm = {},
  onReceiveFormChange,
  selectedForReceive = {},
  onSelectedForReceiveChange,
  isProcessing = false,
}) => {
  const isDelivered = bill.deliveryStatus === 'DELIVERED';
  const isInternalCompleted = isInternal ? bill.status === 'RECEIVED' : false;
  const isCompleted = isInternal ? isInternalCompleted : isDelivered;

  const receivableItems = bill.items.filter((i: any) => {
    const pending = isInternal
      ? (i.dispatchedQty - i.receivedQty)
      : (i.quantity - (i.receivedQty || 0));
    return pending > 0;
  });

  const allSelected =
    receivableItems.length > 0 &&
    receivableItems.every((i: any) => selectedForReceive[i._id]);

  const isOrderFullyReceived = bill.items.every((i: any) => {
    const pending = isInternal
      ? (i.dispatchedQty - i.receivedQty)
      : (i.quantity - (i.receivedQty || 0));
    return pending <= 0;
  });

  const isPaid = bill.paymentStatus === 'PAID';

  const handleToggleAll = (checked: boolean) => {
    if (!onSelectedForReceiveChange) return;
    const updated = { ...selectedForReceive };
    receivableItems.forEach((i: any) => { updated[i._id] = checked; });
    onSelectedForReceiveChange(updated);
  };

  const handleToggleItem = (id: string, checked: boolean) => {
    if (!onSelectedForReceiveChange) return;
    onSelectedForReceiveChange({ ...selectedForReceive, [id]: checked });
  };

  const handleQtyChange = (key: string, val: number) => {
    if (!onReceiveFormChange) return;
    onReceiveFormChange({ ...receiveForm, [key]: val });
  };

  const showActionRow = !isViewOnly && !isCompleted && !isOrderFullyReceived;

  return (
    <div className="modal-overlay">
      <div className="modal-content workflow-modal" style={{ maxWidth: '750px', width: '100%' }}>

        {/* Header */}
        <div className="modal-header">
          <h2>{isCompleted || isViewOnly || isOrderFullyReceived ? 'VIEW DELIVERY' : 'ACCEPT DELIVERY'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Bill meta card */}
          <div className="premium-delivery-header-card" style={{ marginBottom: '20px', padding: '18px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid var(--border-strong)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {isInternal ? (
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '2px 6px', letterSpacing: '0.5px' }}>
                      INTERNAL TRANSFER
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 6px', letterSpacing: '0.5px' }}>
                      EXTERNAL VENDOR
                    </span>
                  )}
                  {/* Delivery & Payment status badges */}
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', letterSpacing: '0.5px',
                    background: isDelivered ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: isDelivered ? '#34d399' : '#f59e0b',
                    border: isDelivered ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)'
                  }}>
                    {isDelivered ? '✓ DELIVERED' : 'PENDING DELIVERY'}
                  </span>
                  {!isInternal && (
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', letterSpacing: '0.5px',
                      background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                      color: isPaid ? '#34d399' : '#f87171',
                      border: isPaid ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.25)'
                    }}>
                      {isPaid ? '✓ PAID' : 'PAYMENT DUE'}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  {isInternal ? 'SOURCE LOCATION' : 'VENDOR NAME'}
                </span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>
                  {isInternal
                    ? (bill.sourceLocation?.name?.toUpperCase() || 'UNKNOWN')
                    : (bill.vendor?.vendorName?.toUpperCase() || 'UNKNOWN')}
                </strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                {bill.purchaseRequest?.prCode && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>PR REFERENCE</span>
                    <strong className="code-badge" style={{ display: 'inline-block', padding: '3px 8px', background: 'rgba(249, 115, 22, 0.08)', color: 'var(--primary)', border: '1px solid rgba(249, 115, 22, 0.25)', fontSize: '0.75rem', fontWeight: 900 }}>
                      {bill.purchaseRequest.prCode}
                    </strong>
                  </div>
                )}
                {bill.createdAt && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                      ORDERED ON {new Date(bill.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {!isInternal && bill.totalAmount !== undefined && (
                  <div style={{ textAlign: 'right', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', display: 'block' }}>TOTAL AMOUNT</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                      ₹ {bill.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items table label */}
          <p style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-dim)', marginBottom: '12px' }}>
            {isInternal
              ? (showActionRow ? 'SELECT ITEMS AND QUANTITIES TO RECEIVE' : 'DELIVERY ITEMS')
              : (showActionRow ? 'VERIFY RECEIVED QUANTITIES (UPDATES INVENTORY)' : 'ORDER ITEMS')}
          </p>

          {/* Items table */}
          <table className="mini-table">
            <thead>
              <tr>
                {isInternal && (
                  <th style={{ textAlign: 'center', width: '60px' }}>
                    {showActionRow ? (
                      <label className="premium-checkbox-container" style={{ margin: '0 auto' }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleToggleAll(e.target.checked)}
                        />
                        <span className="premium-checkmark"></span>
                      </label>
                    ) : 'SELECT'}
                  </th>
                )}
                <th>ITEM NAME</th>
                <th>{isInternal ? 'DISPATCHED QTY' : 'ORDERED QTY'}</th>
                <th>RECEIVED QTY</th>
                <th>PENDING QTY</th>
                {!isViewOnly && <th>RECEIVE NOW</th>}
                {isViewOnly && !isInternal && <th>UNIT PRICE</th>}
                {isViewOnly && !isInternal && <th>TOTAL</th>}
              </tr>
            </thead>
            <tbody>
              {bill.items.map((i: any, idx: number) => {
                const pendingQty = isInternal
                  ? (i.dispatchedQty - i.receivedQty)
                  : (i.quantity - (i.receivedQty || 0));
                const isCompletedItem = pendingQty <= 0;
                const idKey = isInternal ? i._id : i.item;
                const isItemSelected = isInternal ? (selectedForReceive[i._id] || false) : true;
                const enteredQty = isCompleted || isCompletedItem ? 0 : (receiveForm[idKey] ?? pendingQty);
                const hasMismatch = showActionRow && isItemSelected && (enteredQty !== pendingQty);
                const isPerfectMatch = showActionRow && isItemSelected && (enteredQty === pendingQty) && enteredQty > 0;

                let rowBg = 'transparent';
                let rowBorderLeft = 'none';
                if (isItemSelected && showActionRow) {
                  if (hasMismatch) { rowBg = 'rgba(234, 179, 8, 0.04)'; rowBorderLeft = '3px solid #eab308'; }
                  else if (isPerfectMatch) { rowBg = 'rgba(16, 185, 129, 0.04)'; rowBorderLeft = '3px solid #10b981'; }
                }

                return (
                  <tr key={idx} style={{ background: rowBg, borderLeft: rowBorderLeft, opacity: (isCompleted || isCompletedItem) ? 0.6 : 1 }}>
                    {isInternal && (
                      <td style={{ textAlign: 'center' }}>
                        <label className="premium-checkbox-container">
                          <input
                            type="checkbox"
                            checked={!isCompletedItem && isItemSelected}
                            onChange={(e) => handleToggleItem(i._id, e.target.checked)}
                            disabled={isCompleted || isCompletedItem || isViewOnly}
                          />
                          <span className="premium-checkmark" style={{ opacity: (isCompleted || isCompletedItem) ? 0.5 : 1 }}></span>
                        </label>
                      </td>
                    )}
                    <td>
                      <strong>{i.itemName.toUpperCase()}</strong>
                      {isCompleted || isCompletedItem ? (
                        <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, marginLeft: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-block', verticalAlign: 'middle' }}>✓ FULLY RECEIVED</span>
                      ) : hasMismatch ? (
                        <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 800, marginTop: '2px' }}>⚠️ QUANTITY MISMATCH (DIFF: {(enteredQty - pendingQty).toFixed(2)})</div>
                      ) : isItemSelected && showActionRow ? (
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, marginTop: '2px' }}>✓ QUANTITIES MATCH PERFECTLY</div>
                      ) : null}
                    </td>
                    <td><strong>{isInternal ? i.dispatchedQty : i.quantity} {i.unit?.toUpperCase() || 'PCS'}</strong></td>
                    <td><strong>{i.receivedQty || 0} {i.unit?.toUpperCase() || 'PCS'}</strong></td>
                    <td><strong>{pendingQty} {i.unit?.toUpperCase() || 'PCS'}</strong></td>
                    {!isViewOnly && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            value={isCompleted || isCompletedItem ? 0 : enteredQty}
                            onChange={(e) => handleQtyChange(idKey, Number(e.target.value))}
                            disabled={(isInternal && !selectedForReceive[i._id]) || isCompleted || isCompletedItem}
                            max={pendingQty}
                            min={0}
                            style={{ width: '80px', padding: '6px', background: 'var(--bg-main)', border: hasMismatch ? '1px solid #eab308' : '1px solid var(--border-main)', color: hasMismatch ? '#eab308' : 'var(--text-main)', outline: 'none', fontWeight: 900, opacity: ((isInternal && !selectedForReceive[i._id]) || isCompleted || isCompletedItem) ? 0.5 : 1 }}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800 }}>{i.unit?.toUpperCase() || 'PCS'}</span>
                        </div>
                      </td>
                    )}
                    {isViewOnly && !isInternal && (
                      <td><strong>₹ {(i.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                    )}
                    {isViewOnly && !isInternal && (
                      <td><strong>₹ {((i.unitPrice || 0) * ((i.receivedQty ?? i.quantity) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {/* Finance / View-only footer */}
          {isViewOnly && (
            <>
              <button className="btn-cancel" onClick={onClose}>CLOSE</button>
              {showMarkPaid && !isPaid && isDelivered && onMarkPaid && (
                <button
                  className="btn-premium-accept"
                  onClick={() => onMarkPaid(bill._id)}
                  disabled={isProcessing}
                  style={{ background: '#10b981', border: 'none' }}
                >
                  {isProcessing ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="spinner-loader"></span>PROCESSING...
                    </span>
                  ) : (
                    <><DollarSign size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />MARK PAID</>
                  )}
                </button>
              )}
            </>
          )}

          {/* Operational footer — Store / Centers / Kitchen */}
          {!isViewOnly && (isCompleted || isOrderFullyReceived) && (
            <button className="btn-cancel" onClick={onClose}>CLOSE</button>
          )}
          {!isViewOnly && !isCompleted && !isOrderFullyReceived && (
            <>
              <button className="btn-cancel" onClick={onClose}>CANCEL</button>
              {isInternal && (
                <button className="btn-action-sm" disabled style={{ background: '#ef4444', color: 'white', opacity: 0.5, cursor: 'not-allowed' }}>
                  REJECT DELIVERY
                </button>
              )}
              <button
                className="btn-premium-accept"
                onClick={onAcceptDelivery}
                disabled={isProcessing || (isInternal && Object.keys(selectedForReceive).filter(k => selectedForReceive[k]).length === 0)}
              >
                {isProcessing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <span className="spinner-loader"></span>PROCESSING...
                  </span>
                ) : (
                  <><Package size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />ACCEPT DELIVERY</>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default BillViewModal;
