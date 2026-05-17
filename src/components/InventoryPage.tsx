import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { inventoryApi, userApi } from '../services/api';
import ForgeLoader from './ForgeLoader';
import { Package, Search, Filter, Edit3, Save, X } from 'lucide-react';

const InventoryPage: React.FC = () => {
  const { entityId } = useParams<{ entityId: string }>();
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isStore = user?.role === 'STORE' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [inventory, setInventory] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInventory();
    if (isStore) {
      fetchLocations();
    }
  }, [entityId, selectedLocation]);

  const fetchLocations = async () => {
    try {
      const res = await userApi.getLocations(entityId);
      setLocations(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch locations', error);
    }
  };

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const locId = selectedLocation !== 'ALL' ? selectedLocation : '';
      const res = await inventoryApi.getAll(locId);
      setInventory(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch inventory', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (id: string) => {
    try {
      setIsSaving(true);
      await inventoryApi.update(id, { currentStock: editValue });
      setEditingId(null);
      fetchInventory();
    } catch (error) {
      alert('Failed to update stock');
    } finally {
      setIsSaving(false);
    }
  };

  const displayInventory = React.useMemo(() => {
    if (selectedLocation !== 'ALL') return inventory;
    
    const consolidated = new Map();
    inventory.forEach(item => {
      const matId = item.materialId?._id;
      if (!matId) return;
      if (consolidated.has(matId)) {
        const existing = consolidated.get(matId);
        existing.currentStock += (item.currentStock || 0);
      } else {
        consolidated.set(matId, { ...item }); 
      }
    });
    return Array.from(consolidated.values());
  }, [inventory, selectedLocation]);

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>INVENTORY MANAGEMENT</h1>
          <p className="subtitle">Real-time stock levels across locations</p>
        </div>
        {isStore && (
          <div className="header-actions">
            <div className="header-filter">
              <Filter size={14} />
              <select 
                value={selectedLocation} 
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="ALL">CONSOLIDATED (ALL LOCATIONS)</option>
                {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      <div className="data-panel">
        {isLoading ? <ForgeLoader /> : (
          <div className="table-wrapper">
            <table className="sharp-table">
              <thead>
                <tr>
                  <th>SL NO</th>
                  <th>MATERIAL NAME</th>
                  <th>CATEGORY</th>
                  <th>CURRENT STOCK</th>
                  <th>UNIT</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {displayInventory.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-dim">No inventory records found.</td></tr>
                ) : (
                  displayInventory.map((item, idx) => (
                    <tr key={item.materialId?._id || idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{item.materialId?.name?.toUpperCase()}</strong></td>
                      <td><span className="category-pill">{item.materialId?.category || 'RAW'}</span></td>
                      
                      <td style={{ fontWeight: 900, color: 'var(--primary)' }}>
                        {editingId === item._id ? (
                          <input 
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(Number(e.target.value))}
                            style={{ width: '80px', padding: '4px 8px', background: 'var(--bg-main)', border: '1px solid var(--primary)', color: 'var(--primary)', outline: 'none' }}
                          />
                        ) : (
                          item.currentStock?.toFixed(2)
                        )}
                      </td>
                      <td>{item.materialId?.unit?.toUpperCase()}</td>
                      
                      <td style={{ textAlign: 'center' }}>
                        {selectedLocation === 'ALL' ? (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Select location to edit</span>
                        ) : editingId === item._id ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-action-sm save" onClick={() => handleSave(item._id)} disabled={isSaving}>
                              {isSaving ? '...' : <Save size={14} />}
                            </button>
                            <button className="btn-action-sm cancel" onClick={() => setEditingId(null)}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button className="btn-action-sm edit" onClick={() => {
                            setEditingId(item._id);
                            setEditValue(item.currentStock);
                          }}>
                            <Edit3 size={14} /> EDIT STOCK
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-top: 4px; }
        
        .header-filter { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-main); padding: 8px 16px; border-radius: 4px; }
        .header-filter select { background: transparent; border: none; color: var(--primary); font-size: 0.75rem; font-weight: 800; outline: none; cursor: pointer; }
        
        .category-pill { font-size: 0.65rem; background: rgba(59,130,246,0.1); color: #3b82f6; padding: 2px 8px; border-radius: 12px; font-weight: 800; }
        .location-pill { font-size: 0.65rem; background: rgba(168,85,247,0.1); color: #a855f7; padding: 2px 8px; border-radius: 12px; font-weight: 800; }

        .btn-action-sm { border: none; padding: 6px 12px; font-size: 0.65rem; font-weight: 900; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .btn-action-sm.edit { background: rgba(249,115,22,0.1); color: var(--primary); border: 1px solid rgba(249,115,22,0.3); }
        .btn-action-sm.save { background: #10b981; color: white; }
        .btn-action-sm.cancel { background: #ef4444; color: white; }
        .btn-action-sm:hover { filter: brightness(1.2); }
      `}</style>
    </MainLayout>
  );
};

export default InventoryPage;
