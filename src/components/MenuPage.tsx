import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { menuApi, bomApi, userApi, foodRequestApi, functionOrderApi } from '../services/api';
import { ITEM_CATEGORIES } from '../constants/categories';
import ForgeLoader from './ForgeLoader';
import { Plus, Search, Loader2, X, Edit2, Trash2, BookOpen, ClipboardList, CheckSquare, Square, Send, ShoppingCart } from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

type TabType = 'all' | 'direct' | 'bom';

const MenuPage: React.FC = () => {
  const navigate = useNavigate();
  const { entityId } = useParams<{ entityId: string }>();
  const [menus, setMenus] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (user && user.role === 'KITCHEN') {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Locations filter state for corporate users
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedFoLocation, setSelectedFoLocation] = useState<string>('ALL');

  const { search } = useLocation();
  const isViewOnly = React.useMemo(() => {
    const queryParams = new URLSearchParams(search);
    return queryParams.get('viewOnly') === 'true' || user?.role === 'ADMIN';
  }, [search, user]);

  // BUG-C1: Checkbox multi-select and confirm modal state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  // Accumulate pending requests across multiple interactions
  const [pendingRequest, setPendingRequest] = useState<Record<string, { item: any; qty: number }>>({}); // key = "_id"
  const [manuallyAddedUnlistedIds, setManuallyAddedUnlistedIds] = useState<Set<string>>(new Set());
  const [isUnlistedModalOpen, setIsUnlistedModalOpen] = useState(false);
  const [selectedUnlistedIds, setSelectedUnlistedIds] = useState<Set<string>>(new Set());
  const [placedQuantities, setPlacedQuantities] = useState<Record<string, number>>({});
  const [isLoadingPlaced, setIsLoadingPlaced] = useState(false);
  const [foSearchTerm, setFoSearchTerm] = useState('');
  const [showFoSuggestions, setShowFoSuggestions] = useState(false);
  const [foEditingDishId, setFoEditingDishId] = useState<string | null>(null);
  const [foEditingDishQty, setFoEditingDishQty] = useState<number>(0);
  const [foEditingDetails, setFoEditingDetails] = useState(false);
  const [foEditDateVal, setFoEditDateVal] = useState('');
  const [foEditAdvanceVal, setFoEditAdvanceVal] = useState(0);
  const [foEditAdvanceModeVal, setFoEditAdvanceModeVal] = useState('Cash');

  // Ordering state
  const [orderQtys, setOrderQtys] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'kg',
    customUnit: '',
    mrpPrice: ''
  });

  const { pathname } = useLocation();
  const [viewMode, setViewMode] = useState<'regular' | 'functions'>(() => {
    return pathname.includes('function-bookings') ? 'functions' : 'regular';
  });

  useEffect(() => {
    if (pathname.includes('function-bookings')) {
      setViewMode('functions');
    } else {
      setViewMode('regular');
    }
  }, [pathname]);
  const [functionOrders, setFunctionOrders] = useState<any[]>([]);
  const [selectedFo, setSelectedFo] = useState<any>(null);

  const [isFoModalOpen, setIsFoModalOpen] = useState(false);
  const [foForm, setFoForm] = useState({
    eventDate: '',
    description: '',
    advanceAmount: 0,
    advancePaymentMode: 'Cash' as 'Cash' | 'UPI' | 'Card' | 'Bank Transfer',
    totalOrderValue: 0
  });

  const [foSelectedItem, setFoSelectedItem] = useState<string>('');
  const [foSelectedQty, setFoSelectedQty] = useState<number>(1);
  const [foDeliveryDate, setFoDeliveryDate] = useState('');
  const [showFoDeliveryModal, setShowFoDeliveryModal] = useState(false);

  const fetchFunctionOrders = async () => {
    try {
      const res = await functionOrderApi.getAll();
      const list = res.data.data || [];
      setFunctionOrders(list);
      if (selectedFo) {
        const updated = list.find((fo: any) => fo._id === selectedFo._id);
        if (updated) {
          setSelectedFo(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch function orders:', err);
    }
  };

  const handleCreateFo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foForm.eventDate || !foForm.description) {
      setError('Event date and description are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await functionOrderApi.create(foForm);
      setSuccess('Event booking created successfully!');
      setIsFoModalOpen(false);
      setFoForm({
        eventDate: '',
        description: '',
        advanceAmount: 0,
        advancePaymentMode: 'Cash',
        totalOrderValue: 0
      });
      await fetchFunctionOrders();
      if (res.data.data) {
        setSelectedFo(res.data.data);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create booking');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDishToFo = async () => {
    if (!selectedFo) return;
    if (!foSelectedItem || foSelectedQty <= 0) return;
    
    const matched = allItems.find(i => i._id === foSelectedItem);
    if (!matched) return;

    const dishesCopy = [...(selectedFo.dishes || [])];
    const existingIndex = dishesCopy.findIndex(d => d.menuId === foSelectedItem || d.bomId === foSelectedItem);

    if (existingIndex >= 0) {
      dishesCopy[existingIndex].qty += foSelectedQty;
    } else {
      dishesCopy.push({
        menuId: matched._source === 'DIRECT' ? matched._id : undefined,
        bomId: matched._source === 'BOM' ? matched._id : undefined,
        itemName: matched.name,
        qty: foSelectedQty,
        unit: matched.unit || 'pcs'
      });
    }

    try {
      const res = await functionOrderApi.updateDishes(selectedFo._id, dishesCopy);
      setSelectedFo(res.data.data);
      setSuccess('Dish added to function order!');
      setFoSelectedItem('');
      setFoSearchTerm('');
      setFoSelectedQty(1);
      await fetchFunctionOrders();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add dish');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleRemoveDishFromFo = async (dishId: string) => {
    if (!selectedFo) return;
    const dishesCopy = (selectedFo.dishes || []).filter((d: any) => d._id !== dishId);
    try {
      const res = await functionOrderApi.updateDishes(selectedFo._id, dishesCopy);
      setSelectedFo(res.data.data);
      setSuccess('Dish removed from function order');
      await fetchFunctionOrders();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove dish');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleUpdateDishQty = async (dishId: string, newQty: number) => {
    if (!selectedFo || newQty <= 0) return;
    const dishesCopy = (selectedFo.dishes || []).map((d: any) => {
      if (d._id === dishId) {
        return { ...d, qty: newQty };
      }
      return d;
    });
    try {
      const res = await functionOrderApi.updateDishes(selectedFo._id, dishesCopy);
      setSelectedFo(res.data.data);
      await fetchFunctionOrders();
      setFoEditingDishId(null);
      setFoEditingDishQty(0);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update dish quantity');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleSaveTotalValue = async (val: number) => {
    if (!selectedFo) return;
    try {
      const res = await functionOrderApi.setTotalValue(selectedFo._id, val);
      setSelectedFo(res.data.data);
      setSuccess('Total Order Value updated!');
      await fetchFunctionOrders();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update total order value');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleUpdateEventDetails = async () => {
    if (!selectedFo) return;
    if (!foEditDateVal) {
      setError('Event date is required');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await functionOrderApi.update(selectedFo._id, {
        eventDate: foEditDateVal,
        advanceAmount: foEditAdvanceVal,
        advancePaymentMode: foEditAdvanceModeVal
      });
      setSelectedFo(res.data.data);
      setSuccess('Event details updated successfully!');
      setFoEditingDetails(false);
      await fetchFunctionOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update event details');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceFoRequest = async () => {
    if (!selectedFo) return;
    if (!foDeliveryDate) {
      setError('Delivery date is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await functionOrderApi.placeRequest(selectedFo._id, foDeliveryDate);
      setSelectedFo(res.data.data);
      setSuccess('Stock request placed successfully! Linked to regular requests.');
      setShowFoDeliveryModal(false);
      await fetchFunctionOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to place request');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFunctionOrders();
    }
  }, [user]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [menuRes, bomRes, userRes, locRes] = await Promise.allSettled([
        menuApi.getAll(entityId),
        bomApi.getAll(entityId),
        userApi.getMe(),
        userApi.getLocations(entityId)
      ]);

      if (menuRes.status === 'fulfilled') {
        console.log('Menus fetched:', menuRes.value.data.data);
        setMenus(menuRes.value.data.data || []);
      }
      if (bomRes.status === 'fulfilled') {
        console.log('BOMs fetched:', bomRes.value.data.data);
        setBoms(bomRes.value.data.data || []);
      }
      if (userRes.status === 'fulfilled') setUser(userRes.value.data.data || null);
      if (locRes.status === 'fulfilled') setLocations(locRes.value.data.data || []);

      if (menuRes.status === 'rejected') {
        console.error('Menu fetch failed:', menuRes.reason);
        setError('Failed to load menu items');
      }
    } catch (err: any) {
      console.error('Initial fetch error:', err);
      setError(err.response?.data?.error || 'Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMenus = async () => {
    try {
      const [menuRes, bomRes] = await Promise.all([
        menuApi.getAll(entityId),
        bomApi.getAll(entityId)
      ]);
      setMenus(menuRes.data.data || []);
      setBoms(bomRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to refresh');
    }
  };

  const isRequestPage = React.useMemo(() => {
    return ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && viewMode === 'regular';
  }, [user, viewMode]);

  // ── Build display lists ──────────────────────────────────────────────
  // DIRECT: all items from menus array (no type filter needed)
  const directItems = React.useMemo(() => {
    return menus.map(m => {
      return { ...m, _source: 'DIRECT' };
    });
  }, [menus]);

  // BOM: from boms array — each BOM dish appears as a BOM-source item
  const bomItems = React.useMemo(() => {
    return boms.map(b => {
      const subBoms = (b.items || [])
        .filter((item: any) => item.type === 'BOM Item')
        .map((item: any) => item.itemName);

      return {
        _id: b._id,
        _source: 'BOM',
        name: b.dishName,
        unit: b.unit || 'pcs',
        customUnit: '',
        ingredientCount: b.items?.length || 0,
        createdAt: b.createdAt,
        isSoldB2C: b.isSoldB2C !== false,
        subBoms
      };
    });
  }, [boms]);

  const visibleBoms = React.useMemo(() => {
    return bomItems.filter(b => {
      if (isRequestPage) {
        return b.isSoldB2C !== false || manuallyAddedUnlistedIds.has(b._id);
      }
      return true;
    });
  }, [bomItems, isRequestPage, manuallyAddedUnlistedIds]);

  // Merge and sort A–Z
  const allItems = React.useMemo(() => {
    return [...directItems, ...visibleBoms].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [directItems, visibleBoms]);

  const filteredFoSearchItems = React.useMemo(() => {
    if (!foSearchTerm) return allItems;
    return allItems.filter(item =>
      item.name?.toLowerCase().includes(foSearchTerm.toLowerCase())
    );
  }, [allItems, foSearchTerm]);

  const directCount = directItems.length;
  const bomCount = visibleBoms.length;

  const filtered = React.useMemo(() => {
    return allItems.filter(item => {
      const matchSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
      if (activeTab === 'direct') return matchSearch && item._source === 'DIRECT';
      if (activeTab === 'bom') return matchSearch && item._source === 'BOM';
      return matchSearch;
    });
  }, [allItems, searchTerm, activeTab]);

  const handleQtyChange = (itemId: string, qty: string) => {
    setOrderQtys(prev => ({
      ...prev,
      [itemId]: parseInt(qty) || 0
    }));
  };

  // BUG-C1: Toggle checkbox for an item
  const toggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // BUG-C1: Open confirm modal — merge new qtys into pendingRequest accumulator
  const handleOpenConfirmModal = async () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item and enter a quantity.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const hasQty = [...selectedItems].some(id => (orderQtys[id] || 0) > 0);
    if (!hasQty) {
      setError('Please enter a quantity for at least one selected item.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setIsLoadingPlaced(true);
      const centerId = user?._id || user?.id;
      const res = await foodRequestApi.getAll(entityId, centerId);
      const allRequests = res.data.data || [];
      
      const selectedDateStr = new Date(deliveryDate).toDateString();
      const matchingRequests = allRequests.filter((req: any) => {
        return req.status !== 'REJECTED' && req.deliveryDate && new Date(req.deliveryDate).toDateString() === selectedDateStr;
      });

      const qtyMap: Record<string, number> = {};
      for (const req of matchingRequests) {
        if (req.requestedItems) {
          for (const item of req.requestedItems) {
            if (item.approvalStatus !== 'REJECTED') {
              const key = (item.bomId && (typeof item.bomId === 'object' ? item.bomId._id : item.bomId)) || item.menuId;
              if (key) {
                qtyMap[key.toString()] = (qtyMap[key.toString()] || 0) + (item.requestedQty || 0);
              }
            }
          }
        }
      }
      setPlacedQuantities(qtyMap);
    } catch (err) {
      console.error('Failed to fetch placed requests:', err);
    } finally {
      setIsLoadingPlaced(false);
    }

    // Merge into pending accumulator
    const updated = { ...pendingRequest };
    for (const id of selectedItems) {
      const qty = orderQtys[id] || 0;
      if (qty <= 0) continue;
      const item = allItems.find(i => i._id === id);
      if (!item) continue;
      if (updated[id]) {
        updated[id] = { item, qty: updated[id].qty + qty };
      } else {
        updated[id] = { item, qty };
      }
    }
    setPendingRequest(updated);
    setConfirmModalOpen(true);
  };

  // BUG-C1: Confirm and submit all accumulated items as one request
  const handleConfirmRequest = async () => {
    const entries = Object.values(pendingRequest).filter(e => e.qty > 0);
    if (entries.length === 0) return;

    try {
      setIsSubmitting(true);
      const payload = {
        centerName: user.name || 'Unknown Center',
        centerId: user._id || user.id,
        entity: user.entity?._id || user.entity || null,
        deliveryDate: deliveryDate || new Date().toISOString(),
        requestedItems: entries.map(e => ({
          materialName: e.item.name || e.item.dishName || 'Unknown Item',
          requestedQty: Number(e.qty),
          unit: e.item.unit ? (e.item.unit === 'custom' ? e.item.customUnit : e.item.unit) : 'unit',
          isMenuItem: true,
          menuId: e.item._source === 'DIRECT' ? e.item._id : null,
          bomId: e.item._source === 'BOM' ? e.item._id : null
        })),
        notes: `Center Bulk Request: ${entries.length} item(s) for ${deliveryDate}`
      };

      await foodRequestApi.create(payload);
      setSuccess(`Request submitted for ${entries.length} item(s) successfully.`);
      // Reset accumulator and selections
      setPendingRequest({});
      setSelectedItems(new Set());
      setOrderQtys({});
      setConfirmModalOpen(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (menu: any) => {
    setEditingId(menu._id);
    setFormData({
      name: menu.name,
      category: menu.category || '',
      unit: menu.unit,
      customUnit: menu.customUnit || '',
      mrpPrice: menu.mrpPrice !== undefined ? String(menu.mrpPrice) : ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteDirect = async (id: string) => {
    if (!window.confirm('Delete this menu item?')) return;
    try {
      await menuApi.delete(id);
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete menu item');
    }
  };

  const handleDeleteBom = async (id: string) => {
    if (!window.confirm('Delete this BOM dish?')) return;
    try {
      await bomApi.delete(id);
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete BOM');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '', category: '', unit: 'kg', customUnit: '', mrpPrice: '' });
    setIsModalOpen(true);
  };

  // Price editing removed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mrp = parseFloat(formData.mrpPrice);
    if (isNaN(mrp) || mrp < 0) {
      setError('Please enter a valid MRP price (0 or greater).');
      return;
    }
    try {
      setIsSubmitting(true);
      setError('');
      const payload: any = {
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        mrpPrice: mrp,
        ...(formData.unit === 'custom' && { customUnit: formData.customUnit })
      };
      if (editingId) {
        await menuApi.update(editingId, payload);
      } else {
        await menuApi.create(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', category: '', unit: 'kg', customUnit: '', mrpPrice: '' });
      fetchMenus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <header className="page-header">
        <div className="header-title">
          <h1>{viewMode === 'functions' ? 'FUNCTION BOOKINGS' : (['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) ? 'NEW REQUEST' : 'MENU MANAGEMENT')}</h1>
          <p className="subtitle">
            {viewMode === 'functions' ? 'MANAGE EVENT ORDERS, ADVANCE PAYMENTS AND DISH REQUESTS' : (['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) ? 'SELECT ITEMS, ENTER QUANTITIES AND SUBMIT REQUEST' : 'PRODUCT CATALOG — DIRECT & BOM DISHES')}
          </p>
        </div>
        {['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && viewMode === 'regular' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="header-date-picker" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.65rem', marginRight: '6px', fontWeight: 800 }}>DELIVERY DATE:</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{ background: 'var(--bg-main)', border: '1px solid var(--border-main)', padding: '6px', color: 'var(--text-main)' }}
              />
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setIsUnlistedModalOpen(true)}
              style={{ padding: '8px 16px', fontSize: '0.75rem', height: 'fit-content' }}
            >
              + ADD UNLISTED ITEM
            </button>
          </div>
        )}
        {viewMode === 'regular' && !['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && (
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> ADD MENU ITEM
          </button>
        )}
      </header>

      {error && !isModalOpen && <div className="error-message">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {viewMode !== 'functions' && !['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && (
        <div className="info-banner" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '12px 20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '20px' }}>
          <div style={{ fontWeight: 800, marginBottom: '4px' }}>💡 Menu Guidelines:</div>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.4' }}>
            <li>BOM Dishes will be automatically added to Menu once when Created from BOM Page.</li>
            <li>For BOM Dishes, set the Pricing in Pricing Console.</li>
          </ol>
        </div>
      )}

      {/* Summary Strip */}
      {viewMode !== 'functions' && (
        <div className="menu-summary">
          <div className="msm-stat">
            <span className="msm-val">{allItems.length}</span>
            <span className="msm-label">TOTAL ITEMS</span>
          </div>
          <div className="msm-divider" />
          <div className="msm-stat">
            <BookOpen size={14} />
            <span className="msm-val">{directCount}</span>
            <span className="msm-label">DIRECT</span>
          </div>
          <div className="msm-divider" />
          <div className="msm-stat">
            <ClipboardList size={14} />
            <span className="msm-val">{bomCount}</span>
            <span className="msm-label">FROM BOM</span>
          </div>
        </div>
      )}

      <div className="data-panel">
        {viewMode === 'functions' ? (
          <div style={{ display: 'flex', gap: '20px', minHeight: '500px' }}>
             {/* Left Column: Event List */}
            <div style={{ width: '30%', borderRight: '1px solid var(--border-main)', paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '0.5px', margin: 0 }}>EVENT BOOKINGS</h3>
                {['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly && (
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setFoForm({
                        eventDate: '',
                        description: '',
                        advanceAmount: 0,
                        advancePaymentMode: 'Cash',
                        totalOrderValue: 0
                      });
                      setIsFoModalOpen(true);
                    }} 
                    style={{ padding: '6px 12px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> BOOK EVENT
                  </button>
                )}
              </div>
              
              {/* Location filter dropdown for corporate users (Admin / COO) */}
              {(user?.role === 'ADMIN' || user?.role === 'COO') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-main)', padding: '6px 12px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.5px' }}>LOCATION:</span>
                  <select 
                    value={selectedFoLocation}
                    onChange={(e) => setSelectedFoLocation(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem', outline: 'none', cursor: 'pointer', flex: 1 }}
                  >
                    <option value="ALL">ALL LOCATIONS</option>
                    {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px' }}>
                {(() => {
                  const filteredFo = functionOrders.filter(fo => selectedFoLocation === 'ALL' || fo.centerId === selectedFoLocation);
                  if (filteredFo.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>No events booked yet.</div>;
                  }
                  return filteredFo.map((fo) => {
                    const centerName = locations.find(l => l._id === fo.centerId)?.name || 'Unknown Location';
                    return (
                      <div 
                        key={fo._id}
                        onClick={() => {
                          setSelectedFo(fo);
                          setFoDeliveryDate(fo.eventDate ? fo.eventDate.split('T')[0] : '');
                        }}
                        style={{
                          padding: '12px',
                          background: selectedFo?._id === fo._id ? 'rgba(249,115,22,0.1)' : 'var(--bg-sidebar)',
                          border: selectedFo?._id === fo._id ? '1px solid var(--primary)' : '1px solid var(--border-main)',
                          cursor: 'pointer',
                          transition: '0.2s',
                          borderRadius: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            {new Date(fo.eventDate).toLocaleDateString()}
                          </span>
                          <span className={`status-pill status-${fo.status.toLowerCase().replace('_', '')}`} style={{ fontSize: '0.55rem', padding: '2px 6px', borderRadius: '2px' }}>
                            {fo.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', margin: '0 0 4px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {fo.description}
                        </p>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                          📍 {centerName}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                          <span>Advance: ₹{fo.advanceAmount}</span>
                          <span>Dishes: {fo.dishes?.length || 0}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Right Column: Details Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '10px' }}>
              {selectedFo ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-main)', paddingBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>EVENT DETAILS</h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--text-dim)' }}>({selectedFo.foCode})</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px', marginBottom: 0 }}>{selectedFo.description}</p>
                      {selectedFo.status === 'OPEN' && ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly && (
                        <div style={{ marginTop: '8px' }}>
                          {foEditingDetails ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={handleUpdateEventDetails}
                                style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, borderRadius: '2px' }}
                              >
                                SAVE DETAILS
                              </button>
                              <button 
                                onClick={() => setFoEditingDetails(false)}
                                style={{ background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-dim)', padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, borderRadius: '2px' }}
                              >
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setFoEditingDetails(true);
                                setFoEditDateVal(selectedFo.eventDate ? selectedFo.eventDate.split('T')[0] : '');
                                setFoEditAdvanceVal(selectedFo.advanceAmount || 0);
                                setFoEditAdvanceModeVal(selectedFo.advancePaymentMode || 'Cash');
                              }}
                              style={{ background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--primary)', padding: '4px 10px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, borderRadius: '2px' }}
                            >
                              EDIT DETAILS
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`status-pill status-${selectedFo.status.toLowerCase().replace('_', '')}`} style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '2px' }}>
                        {selectedFo.status.replace('_', ' ')}
                      </span>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '6px', marginBottom: 0 }}>Booked: {new Date(selectedFo.bookingDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Grid stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>ADVANCE PAID</div>
                      {foEditingDetails ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <input 
                            type="number"
                            value={foEditAdvanceVal}
                            onChange={(e) => setFoEditAdvanceVal(Number(e.target.value))}
                            style={{ width: '100%', padding: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 900 }}
                          />
                          <select 
                            value={foEditAdvanceModeVal}
                            onChange={(e) => setFoEditAdvanceModeVal(e.target.value)}
                            style={{ width: '100%', padding: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 800 }}
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                          </select>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>₹{selectedFo.advanceAmount}</div>
                          <div style={{ fontSize: '0.55rem', color: 'var(--primary)', marginTop: '2px', fontWeight: 800 }}>Mode: {selectedFo.advancePaymentMode}</div>
                        </>
                      )}
                    </div>
                    <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>TOTAL ORDER VALUE</div>
                      {selectedFo.status === 'OPEN' && ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>₹</span>
                          <input
                            type="number"
                            defaultValue={selectedFo.totalOrderValue || 0}
                            onBlur={(e) => handleSaveTotalValue(Number(e.target.value))}
                            style={{ width: '100%', padding: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 900 }}
                          />
                        </div>
                      ) : (
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>₹{selectedFo.totalOrderValue}</div>
                      )}
                    </div>
                    <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>PENDING RECEIVABLE</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>₹{selectedFo.pendingReceivable}</div>
                    </div>
                    <div style={{ background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 800 }}>EVENT DATE</div>
                      {foEditingDetails ? (
                        <input 
                          type="date"
                          value={foEditDateVal}
                          onChange={(e) => setFoEditDateVal(e.target.value)}
                          style={{ width: '100%', padding: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 800, marginTop: '4px' }}
                        />
                      ) : (
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>{new Date(selectedFo.eventDate).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>

                  {/* Dishes list */}
                  <div>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.5px' }}>DISHES INCLUDED</h3>
                    
                    {selectedFo.status === 'OPEN' && ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly && (
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'var(--bg-sidebar)', padding: '12px', border: '1px solid var(--border-main)', borderRadius: '4px', position: 'relative' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input 
                            type="text"
                            placeholder="TYPE DISH NAME OR SEARCH..."
                            value={foSearchTerm}
                            onChange={(e) => {
                              setFoSearchTerm(e.target.value);
                              setFoSelectedItem('');
                              setShowFoSuggestions(true);
                            }}
                            onFocus={() => setShowFoSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowFoSuggestions(false), 200)}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                          />
                          {showFoSuggestions && (
                            <div style={{ 
                              position: 'absolute', 
                              top: '100%', 
                              left: 0, 
                              right: 0, 
                              background: 'var(--bg-sidebar)', 
                              border: '1px solid var(--border-main)', 
                              maxHeight: '200px', 
                              overflowY: 'auto', 
                              zIndex: 50,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}>
                              {filteredFoSearchItems.map(i => (
                                <div 
                                  key={i._id}
                                  onMouseDown={() => {
                                    setFoSelectedItem(i._id);
                                    setFoSearchTerm(`${i.name.toUpperCase()} (${i._source})`);
                                    setShowFoSuggestions(false);
                                  }}
                                  style={{ 
                                    padding: '8px 12px', 
                                    cursor: 'pointer', 
                                    borderBottom: '1px solid var(--border-main)',
                                    fontSize: '0.75rem',
                                    background: foSelectedItem === i._id ? 'rgba(249,115,22,0.15)' : 'transparent',
                                    color: 'var(--text-main)'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span><strong>{i.name.toUpperCase()}</strong></span>
                                    <span className={`source-tag ${i._source === 'BOM' ? 'bom' : 'direct'}`} style={{ fontSize: '0.55rem' }}>{i._source}</span>
                                  </div>
                                </div>
                              ))}
                              {filteredFoSearchItems.length === 0 && (
                                <div style={{ padding: '8px 12px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>No matching items.</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ width: '100px' }}>
                          <input 
                            type="number"
                            min="1"
                            value={foSelectedQty}
                            onChange={(e) => setFoSelectedQty(Number(e.target.value))}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', outline: 'none' }}
                          />
                        </div>
                        <button className="btn-primary" onClick={handleAddDishToFo} disabled={!foSelectedItem} style={{ padding: '8px 16px' }}>
                          + ADD
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(selectedFo.dishes || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', border: '1px dashed var(--border-main)', borderRadius: '4px' }}>
                          No dishes added to this booking yet.
                        </div>
                      ) : (
                        (selectedFo.dishes || []).map((dish: any) => {
                          const matchedBom = boms.find(b => b._id === dish.bomId);
                          const subBoms = matchedBom 
                            ? (matchedBom.items || [])
                                .filter((item: any) => item.type === 'BOM Item')
                                .map((item: any) => item.itemName)
                            : [];
                          return (
                            <div 
                              key={dish._id || dish.itemName}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                padding: '12px 16px', 
                                background: 'var(--bg-sidebar)', 
                                border: '1px solid var(--border-main)', 
                                borderRadius: '4px',
                                gap: '16px'
                              }}
                            >
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{dish.itemName.toUpperCase()}</strong>
                                  <span style={{ fontSize: '0.65rem', background: 'rgba(249,115,22,0.1)', color: 'var(--primary)', border: '1px solid rgba(249,115,22,0.2)', padding: '2px 6px', fontWeight: 800, textTransform: 'uppercase' }}>
                                    {(dish.unit || 'PCS').toUpperCase()}
                                  </span>
                                </div>
                                {subBoms.length > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontStyle: 'italic', textTransform: 'uppercase' }}>
                                    Ingredients: {subBoms.join(', ')}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dim)' }}>QTY:</span>
                                  {foEditingDishId === dish._id && selectedFo.status === 'OPEN' && ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly ? (
                                    <input 
                                      type="number"
                                      min="1"
                                      value={foEditingDishQty}
                                      onChange={(e) => setFoEditingDishQty(Number(e.target.value))}
                                      style={{ width: '70px', padding: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: 800, textAlign: 'center' }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{dish.qty}</span>
                                  )}
                                </div>

                                {selectedFo.status === 'OPEN' && ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly && (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {foEditingDishId === dish._id ? (
                                      <>
                                        <button
                                          onClick={() => handleUpdateDishQty(dish._id, foEditingDishQty)}
                                          style={{ 
                                            background: 'var(--primary)', 
                                            border: 'none', 
                                            color: 'white',
                                            padding: '4px 10px', 
                                            cursor: 'pointer', 
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            borderRadius: '2px'
                                          }}
                                          title="Save Quantity"
                                        >
                                          SAVE
                                        </button>
                                        <button
                                          onClick={() => { setFoEditingDishId(null); setFoEditingDishQty(0); }}
                                          style={{ 
                                            background: 'transparent', 
                                            border: '1px solid var(--border-main)', 
                                            color: 'var(--text-dim)',
                                            padding: '4px 10px', 
                                            cursor: 'pointer', 
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            borderRadius: '2px'
                                          }}
                                          title="Cancel"
                                        >
                                          CANCEL
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => { setFoEditingDishId(dish._id); setFoEditingDishQty(dish.qty); }}
                                          style={{ 
                                            background: 'transparent', 
                                            border: '1px solid var(--border-main)', 
                                            color: 'var(--primary)',
                                            padding: '4px 10px', 
                                            cursor: 'pointer', 
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            borderRadius: '2px'
                                          }}
                                          title="Edit Quantity"
                                        >
                                          EDIT
                                        </button>
                                        <button 
                                          className="btn-remove"
                                          onClick={() => handleRemoveDishFromFo(dish._id)}
                                          style={{ 
                                            background: 'none', 
                                            border: '1px solid var(--border-main)', 
                                            padding: '6px', 
                                            cursor: 'pointer', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            transition: '0.2s',
                                            color: 'var(--text-dim)'
                                          }}
                                          title="Remove Dish"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Place request button */}
                  {selectedFo.status === 'OPEN' && ['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && !isViewOnly && (
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-main)', paddingTop: '16px' }}>
                      <button 
                        className="btn-primary" 
                        onClick={() => {
                          setFoDeliveryDate(selectedFo.eventDate ? selectedFo.eventDate.split('T')[0] : '');
                          setShowFoDeliveryModal(true);
                        }}
                        disabled={isSubmitting || (selectedFo.dishes || []).length === 0}
                        style={{ padding: '10px 24px', fontSize: '0.8rem' }}
                      >
                        {isSubmitting ? 'PLACING...' : 'PLACE REQUEST'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dim)', gap: '12px' }}>
                  <ClipboardList size={40} style={{ opacity: 0.3 }} />
                  <span>Select a function order from the left to view event details and manage dishes.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabs + Search */}
            <div className="panel-header">
              <div className="tab-group">
                {(['all', 'direct', 'bom'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'all' ? 'ALL ITEMS' : tab === 'direct' ? 'DIRECT' : 'FROM BOM'}
                    <span className="tab-count">
                      {tab === 'all' ? allItems.length : tab === 'direct' ? directCount : bomCount}
                    </span>
                  </button>
                ))}
              </div>
              <div className="search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? <ForgeLoader /> : (
              <div className="table-wrapper">

                {/* BUG-C1: Bulk action bar for Center/Restaurant users */}
                {['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) && (
                  <div className="bulk-request-bar">
                    <span className="bulk-count">
                      <CheckSquare size={14} />
                      {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      className="btn-request-selected"
                      onClick={handleOpenConfirmModal}
                      disabled={selectedItems.size === 0 || isSubmitting}
                    >
                      <Send size={14} /> REQUEST SELECTED
                    </button>
                  </div>
                )}

                <table className="sharp-table">
                  <thead>
                    <tr>
                      <th>SOURCE</th>
                      <th style={{ textAlign: 'left' }}>ITEM / DISH NAME</th>
                      <th>UNIT</th>
                      {['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) ? (
                        <>
                          <th style={{ width: '150px' }}>REQUEST QTY</th>
                          <th style={{ width: '140px', textAlign: 'center' }}>SELECT TO REQUEST</th>
                        </>
                      ) : (
                        <>
                          <th style={{ textAlign: 'right' }}>MRP (₹)</th>
                          <th>DATE ADDED</th>
                          <th>ACTIONS</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={`${item._source}-${item._id}`} className={selectedItems.has(item._id) ? 'row-selected' : ''}>
                        <td>
                          <span className={`source-tag ${item._source === 'BOM' ? 'bom' : 'direct'}`}>
                            {item._source === 'BOM' ? <ClipboardList size={10} /> : <BookOpen size={10} />}
                            {item._source}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left' }}>
                          <strong className="item-name">{item.name?.toUpperCase()}</strong>
                          {item._source === 'BOM' && item.subBoms && item.subBoms.length > 0 && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px', fontStyle: 'italic', textTransform: 'uppercase' }}>
                              Ingredients: {item.subBoms.join(', ')}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="unit-tag">
                            {(item.unit === 'custom' ? item.customUnit : item.unit)?.toUpperCase() || '—'}
                          </span>
                        </td>
                        {['CENTERS', 'RESTAURANT', 'AGGREGATE', 'KITCHEN'].includes(user?.role) ? (
                          <>
                            <td>
                              <input
                                type="number"
                                className="qty-input"
                                placeholder="Qty"
                                value={orderQtys[item._id] || ''}
                                onChange={(e) => handleQtyChange(item._id, e.target.value)}
                                min="0"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="checkbox-btn"
                                onClick={() => toggleSelect(item._id)}
                              >
                                {selectedItems.has(item._id) ? <CheckSquare size={16} style={{color:'var(--primary)'}} /> : <Square size={16} style={{color:'var(--text-dim)'}} />}
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ textAlign: 'right' }}>
                              {item._source === 'DIRECT' ? (
                                <span className="price-cell selling">
                                  {item.mrpPrice !== undefined && item.mrpPrice !== null
                                    ? `₹ ${Number(item.mrpPrice).toFixed(2)}`
                                    : <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>Not set</span>}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>N/A (BOM)</span>
                              )}
                            </td>
                            <td className="date-cell">{new Date(item.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className="action-buttons">
                                {item._source === 'DIRECT' && (
                                  <button className="icon-btn edit" onClick={() => handleEdit(item)} title="Edit">
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                <button
                                  className="icon-btn delete"
                                  onClick={() => item._source === 'DIRECT' ? handleDeleteDirect(item._id) : handleDeleteBom(item._id)}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty-state">
                    {searchTerm ? `No results for "${searchTerm}"` : 'No menu items found.'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* BUG-C1: Request Confirm Modal */}
      {confirmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content confirm-request-modal" style={{ maxWidth: '550px', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)' }}>
            <button className="close-btn" onClick={() => setConfirmModalOpen(false)} style={{ top: '24px', right: '24px' }}><X size={20} /></button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-main)', paddingBottom: '16px' }}>
              <div>
                <div className="modal-tag" style={{ color: 'var(--primary)', borderColor: 'rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.05)', margin: '0 0 8px 0', width: 'fit-content' }}>
                  <ShoppingCart size={12} style={{ marginRight: '4px' }} /> REQUEST SUMMARY
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Confirm Order Request</h2>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '0.5px', marginTop: '4px', textTransform: 'uppercase' }}>
                  Delivery Date: <span style={{ color: 'var(--primary)' }}>{new Date(deliveryDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            </div>

            <div className="confirm-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '380px', overflowY: 'auto' }}>
              {isLoadingPlaced ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ marginRight: '10px' }} />
                  <span>Loading existing requests...</span>
                </div>
              ) : (
                Object.values(pendingRequest).filter(e => e.qty > 0).map(e => {
                  const alreadyPlaced = placedQuantities[e.item._id] || 0;
                  const unitStr = (e.item.unit === 'custom' ? e.item.customUnit : e.item.unit)?.toUpperCase() || 'UNIT';
                  return (
                    <div key={e.item._id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-main)', background: 'var(--bg-sidebar)', padding: '16px', borderRadius: '6px' }}>
                      <div className="ci-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span className={`source-tag ${e.item._source === 'BOM' ? 'bom' : 'direct'}`} style={{ marginTop: '2px' }}>{e.item._source}</span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{e.item.name?.toUpperCase()}</strong>
                            {e.item._source === 'BOM' && e.item.subBoms && e.item.subBoms.length > 0 && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '2px', textTransform: 'uppercase' }}>
                                Ingredients: {e.item.subBoms.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Already Placed</span>
                          <span style={{ fontWeight: 700, color: alreadyPlaced > 0 ? 'var(--primary)' : 'var(--text-dim)' }}>{alreadyPlaced} {unitStr}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(249,115,22,0.04)', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(249,115,22,0.1)' }}>
                          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>New Request</span>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>+{e.qty} {unitStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="cdm-actions" style={{ marginTop: '24px', borderTop: '1px solid var(--border-main)', paddingTop: '20px' }}>
              <button className="btn-cancel-modal" onClick={() => setConfirmModalOpen(false)} disabled={isSubmitting}>
                <X size={14} /> CANCEL
              </button>
              <button className="btn-confirm-close" style={{ background: 'var(--primary)' }} onClick={handleConfirmRequest} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                {isSubmitting ? 'SUBMITTING...' : 'CONFIRM & SUBMIT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Unlisted Items Modal */}
      {isUnlistedModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content confirm-request-modal" style={{ maxWidth: '500px' }}>
            <button className="close-btn" onClick={() => { setIsUnlistedModalOpen(false); setSelectedUnlistedIds(new Set()); }}><X size={20} /></button>
            <div className="modal-tag direct-tag" style={{ color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' }}>
              <ClipboardList size={12} /> UNLISTED ITEMS
            </div>
            <h2>Add Unlisted Items</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '16px' }}>
              Select items that are not sold B2C to temporarily add them to your request form.
            </p>
            <div className="confirm-items-list" style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bomItems.filter(b => b.isSoldB2C === false && !manuallyAddedUnlistedIds.has(b._id)).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  No unlisted items available to add.
                </div>
              ) : (
                bomItems.filter(b => b.isSoldB2C === false && !manuallyAddedUnlistedIds.has(b._id)).map(b => (
                  <label key={b._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', cursor: 'pointer', borderRadius: '4px', margin: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{b.name.toUpperCase()}</span>
                    <input
                      type="checkbox"
                      checked={selectedUnlistedIds.has(b._id)}
                      onChange={() => {
                        setSelectedUnlistedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(b._id)) next.delete(b._id);
                          else next.add(b._id);
                          return next;
                        });
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                  </label>
                ))
              )}
            </div>
            <div className="cdm-actions" style={{ marginTop: '24px' }}>
              <button className="btn-cancel-modal" onClick={() => { setIsUnlistedModalOpen(false); setSelectedUnlistedIds(new Set()); }}>
                CANCEL
              </button>
              <button 
                className="btn-confirm-close" 
                style={{ background: 'var(--primary)' }} 
                onClick={() => {
                  setManuallyAddedUnlistedIds(prev => {
                    const next = new Set(prev);
                    selectedUnlistedIds.forEach(id => next.add(id));
                    return next;
                  });
                  setIsUnlistedModalOpen(false);
                  setSelectedUnlistedIds(new Set());
                }}
                disabled={selectedUnlistedIds.size === 0}
              >
                ADD SELECTED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Direct Menu Item Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            <div className="modal-tag direct-tag"><BookOpen size={12} /> DIRECT MENU ITEM</div>
            <h2>{editingId ? 'Edit Menu Item' : 'Add Direct Item'}</h2>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="standard-form">
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Bread, Milk, Oil" />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  <option value="">Select Category</option>
                  {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Unit of Measure</label>
                <select name="unit" value={formData.unit} onChange={handleInputChange}>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ltr">Liter (ltr)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="gm">Gram (gm)</option>
                  <option value="ml">Milliliter (ml)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {formData.unit === 'custom' && (
                <div className="form-group slide-down">
                  <label>Custom Unit Name</label>
                  <input type="text" name="customUnit" value={formData.customUnit} onChange={handleInputChange} required placeholder="e.g. Box, Plate, Dozen" />
                </div>
              )}

              <div className="form-group">
                <label>MRP Price per Unit (₹) <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="input-with-icon">
                  <input
                    type="number"
                    name="mrpPrice"
                    value={formData.mrpPrice}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="e.g. 50.00"
                  />
                </div>
                <p className="margin-hint" style={{ color: 'var(--text-dim)' }}>This price will appear as the selling price in the revenue console for this item.</p>
              </div>

              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : editingId ? 'UPDATE ITEM' : 'SAVE ITEM'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
        .btn-primary { background: var(--primary); color: white; border: none; padding: 10px 20px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

        /* Summary strip */
        .menu-summary { display: flex; align-items: center; gap: 0; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 16px 24px; margin-bottom: 24px; }
        .msm-stat { display: flex; align-items: center; gap: 8px; }
        .msm-val { font-size: 1.4rem; font-weight: 800; color: var(--text-main); }
        .msm-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .msm-divider { width: 1px; height: 32px; background: var(--border-main); margin: 0 24px; }
        .msm-stat svg { color: var(--primary); }

        /* Tabs */
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        .tab-group { display: flex; gap: 4px; }
        .tab-btn { background: none; border: 1px solid transparent; color: var(--text-dim); font-size: 0.7rem; font-weight: 800; padding: 6px 14px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
        .tab-btn:hover { color: var(--text-main); border-color: var(--border-main); }
        .tab-btn.active { color: var(--primary); border-color: var(--primary); background: rgba(249,115,22,0.06); }
        .tab-count { font-size: 0.6rem; background: var(--border-main); padding: 1px 5px; border-radius: 10px; }
        .tab-btn.active .tab-count { background: rgba(249,115,22,0.15); color: var(--primary); }

        .search-box { position: relative; display: flex; align-items: center; }
        .search-box input { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 8px 12px 8px 36px; font-size: 0.75rem; color: var(--text-main); width: 220px; transition: 0.2s; outline: none; }
        .search-box input:focus { border-color: var(--primary); }
        .search-box svg { position: absolute; left: 12px; color: var(--text-dim); }

        .sharp-table th, .sharp-table td { text-align: center; vertical-align: middle; }

        /* Item type toggle */
        .type-toggle { display: flex; gap: 8px; margin-top: 4px; }
        .type-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border-main); background: none; color: var(--text-muted); font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .type-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .type-btn.active { border-color: var(--primary); color: var(--primary); background: rgba(249,115,22,0.06); }
        .field-hint { font-size: 0.68rem; color: #a855f7; font-weight: 600; margin-top: 8px; }

        /* Source tags */
        .source-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 0.62rem; font-weight: 800; padding: 3px 8px; border: 1px solid; }
        .source-tag.direct { color: #3b82f6; border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.06); }
        .source-tag.bom { color: #a855f7; border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.06); }

        .item-name { font-size: 0.88rem; color: var(--text-main); }
        .price-cell { color: #10b981; font-weight: 800; font-size: 0.9rem; }
        .unit-tag { background: rgba(249,115,22,0.1); color: var(--primary); font-size: 0.7rem; font-weight: 800; padding: 4px 8px; border: 1px solid rgba(249,115,22,0.2); }
        .ing-count { font-size: 0.72rem; font-weight: 700; color: #a855f7; background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.2); padding: 3px 8px; }
        .date-cell { color: var(--text-dim); font-size: 0.8rem; font-weight: 500; }

        .action-buttons { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-main); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: var(--text-dim); }
        .icon-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        .icon-btn.edit:hover { color: #3b82f6; border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .icon-btn.delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239,68,68,0.1); }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-content { background: var(--bg-main); border: 1px solid var(--border-main); width: 100%; max-width: 500px; padding: 32px; position: relative; }
        .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .close-btn:hover { color: var(--primary); }
        .modal-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 0.6rem; font-weight: 800; padding: 3px 8px; margin-bottom: 12px; }
        .direct-tag { color: #3b82f6; border: 1px solid rgba(59,130,246,0.3); background: rgba(59,130,246,0.06); }
        .modal-content h2 { margin-bottom: 24px; font-size: 1.25rem; font-weight: 800; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .standard-form .form-group { margin-bottom: 20px; }
        .standard-form label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; }
        .standard-form input, .standard-form select { width: 100%; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 12px; font-size: 0.85rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .standard-form input:focus, .standard-form select:focus { border-color: var(--primary); }

        .btn-submit { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-submit:hover:not(:disabled) { background: #ea580c; }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.85rem; font-weight: 500; }
        .slide-down { animation: slideDown 0.3s ease-out forwards; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .success-banner { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981; padding: 12px 20px; font-size: 0.85rem; font-weight: 700; margin-bottom: 24px; }
        
        .header-date-picker { display: flex; align-items: center; gap: 12px; background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 8px 16px; }
        .header-date-picker label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }
        .header-date-picker input { background: transparent; border: none; color: var(--primary); font-size: 0.85rem; font-weight: 800; outline: none; cursor: pointer; }
        
        .order-cell { display: flex; align-items: center; gap: 8px; justify-content: center; }
        .qty-input { width: 70px; background: var(--bg-sidebar); border: 1px solid var(--border-main); color: var(--text-main); padding: 8px; font-size: 0.8rem; font-weight: 700; outline: none; }
        .qty-input:focus { border-color: var(--primary); }
        .btn-order { background: var(--primary); color: white; border: none; padding: 8px 12px; font-size: 0.65rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-order:hover:not(:disabled) { background: #ea580c; }
        .btn-order:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Rates */
        .price-cell.buying { color: #3b82f6; }
        .price-cell.selling { color: #10b981; }
        .selling-price-wrap { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icon-btn-mini { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #10b981; padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: 0.2s; }
        .icon-btn-mini:hover { background: #10b981; color: white; }

        .rate-modal { max-width: 420px !important; }
        .selling-tag { color: #10b981; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.06); }
        .item-hint { font-size: 0.75rem; color: var(--text-dim); margin-top: -16px; margin-bottom: 24px; font-weight: 700; }
        
        .rate-comparison { display: flex; align-items: center; gap: 12px; background: var(--bg-sidebar); padding: 16px; border: 1px solid var(--border-main); margin-bottom: 24px; }
        .rc-box { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .rc-label { font-size: 0.55rem; font-weight: 800; color: var(--text-dim); letter-spacing: 0.5px; }
        .rc-val { font-size: 1rem; font-weight: 800; color: var(--text-main); }
        .rc-box.highlight .rc-val { color: #10b981; }
        .rc-arrow { color: var(--text-dim); font-weight: 800; }

        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-with-icon svg { position: absolute; left: 12px; color: var(--text-dim); }
        .input-with-icon input { padding-left: 36px !important; }
        .margin-hint { font-size: 0.65rem; color: #10b981; font-weight: 700; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* BUG-C1 — Checkbox + Bulk request bar */
        .checkbox-btn { background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; }
        .row-selected { background: rgba(249,115,22,0.04) !important; outline: 1px solid rgba(249,115,22,0.2); }
        .bulk-request-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--border-main); background: rgba(249,115,22,0.03); }
        .bulk-count { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; font-weight: 800; color: var(--text-dim); }
        .btn-request-selected { background: var(--primary); color: white; border: none; padding: 8px 20px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-request-selected:hover:not(:disabled) { background: #ea580c; }
        .btn-request-selected:disabled { opacity: 0.4; cursor: not-allowed; }

        /* BUG-C1 — Confirm modal items */
        .confirm-request-modal { max-width: 520px !important; }
        .confirm-items-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; margin-bottom: 4px; }
        .confirm-item-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-sidebar); border: 1px solid var(--border-main); }
        .ci-info { display: flex; align-items: center; gap: 10px; }
        .ci-qty { display: flex; align-items: center; gap: 8px; }
        .qty-badge { font-size: 1.1rem; font-weight: 800; color: var(--primary); }
        .ci-unit { font-size: 0.7rem; color: var(--text-dim); font-weight: 700; }

        /* Shared modal action row */
        .cdm-actions { display: flex; gap: 12px; width: 100%; }
        .btn-cancel-modal { flex: 1; background: transparent; border: 1px solid var(--border-main); color: var(--text-dim); padding: 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-cancel-modal:hover:not(:disabled) { border-color: var(--text-main); color: var(--text-main); }
        .btn-confirm-close { flex: 2; border: none; color: white; padding: 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-confirm-close:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      {/* Create Event Booking Modal */}
      {isFoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <button className="close-btn" onClick={() => setIsFoModalOpen(false)}><X size={20} /></button>
            <div className="modal-tag" style={{ color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' }}>
              <BookOpen size={12} /> NEW EVENT BOOKING
            </div>
            <h2>Book New Event</h2>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleCreateFo} className="standard-form">
              <div className="form-group">
                <label>Event Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  value={foForm.eventDate}
                  onChange={(e) => setFoForm({ ...foForm, eventDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description of Event / Party <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={foForm.description}
                  onChange={(e) => setFoForm({ ...foForm, description: e.target.value })}
                  required
                  placeholder="e.g. Birthday Party for 50 Pax"
                />
              </div>

              <div className="form-group">
                <label>Advance Amount (₹)</label>
                <input
                  type="number"
                  value={foForm.advanceAmount || ''}
                  onChange={(e) => setFoForm({ ...foForm, advanceAmount: Number(e.target.value) })}
                  min="0"
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Mode of Payment</label>
                <select
                  value={foForm.advancePaymentMode}
                  onChange={(e) => setFoForm({ ...foForm, advancePaymentMode: e.target.value as any })}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Total Order Value (₹)</label>
                <input
                  type="number"
                  value={foForm.totalOrderValue || ''}
                  onChange={(e) => setFoForm({ ...foForm, totalOrderValue: Number(e.target.value) })}
                  min="0"
                  placeholder="0"
                />
              </div>

              <button type="submit" className="btn-submit" disabled={isSubmitting} style={{ background: '#a855f7' }}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'CREATE EVENT BOOKING'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delivery Date / Place Request Modal */}
      {showFoDeliveryModal && selectedFo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <button className="close-btn" onClick={() => setShowFoDeliveryModal(false)}><X size={20} /></button>
            <div className="modal-tag" style={{ color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' }}>
              <ShoppingCart size={12} /> CONFIRM REQUEST
            </div>
            <h2>Confirm Delivery Details</h2>
            {error && <div className="error-message">{error}</div>}

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
                Please select the delivery date for this function order.
              </p>
              
              <div className="standard-form">
                <div className="form-group">
                  <label>Delivery Date</label>
                  <input
                    type="date"
                    value={foDeliveryDate}
                    onChange={(e) => setFoDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    style={{ width: '100%', background: 'var(--bg-sidebar)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '12px' }}
                  />
                </div>
              </div>

              {foDeliveryDate && selectedFo.eventDate && foDeliveryDate !== selectedFo.eventDate.split('T')[0] && (
                <div className="error-message" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '10px', fontSize: '0.75rem', marginTop: '12px' }}>
                  ⚠️ Warning: The chosen delivery date ({new Date(foDeliveryDate).toLocaleDateString()}) is different from the scheduled event date ({new Date(selectedFo.eventDate).toLocaleDateString()})!
                </div>
              )}
            </div>

            <div className="cdm-actions">
              <button className="btn-cancel-modal" onClick={() => setShowFoDeliveryModal(false)} disabled={isSubmitting}>
                <X size={14} /> CANCEL
              </button>
              <button 
                className="btn-confirm-close" 
                style={{ background: '#a855f7' }} 
                onClick={handlePlaceFoRequest} 
                disabled={isSubmitting || !foDeliveryDate}
              >
                {isSubmitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                {isSubmitting ? 'PLACING...' : 'PLACE REQUEST'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default MenuPage;