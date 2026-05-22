import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authApi = {
  login: (credentials: any) => api.post('/users/login', credentials),
};

export const userApi = {
  getMe: () => api.get('/users/me'),
  getAll: (entityId?: string) => api.get(entityId ? `/users?entity=${entityId}` : '/users'),
  getLocations: (entityId?: string) => api.get(entityId ? `/users/my-locations?entity=${entityId}` : '/users/my-locations'),
  getMyCenters: (entityId?: string) => api.get(`/users/my-centers${entityId ? `?entity=${entityId}` : ''}`),
  getMyKitchens: (entityId?: string) => api.get(`/users/my-kitchens${entityId ? `?entity=${entityId}` : ''}`),
  getMyStores: (entityId?: string) => api.get(`/users/my-stores${entityId ? `?entity=${entityId}` : ''}`),
  getMyResorts: (entityId?: string) => api.get(`/users/my-resorts${entityId ? `?entity=${entityId}` : ''}`),
  getMyAggregates: (entityId?: string) => api.get(`/users/my-aggregates${entityId ? `?entity=${entityId}` : ''}`),
  getMyRestaurants: (entityId?: string) => api.get(`/users/my-restaurants${entityId ? `?entity=${entityId}` : ''}`),
  toggleStatus: (userId: string) => api.put(`/users/${userId}/toggle-status`),
  delete: (userId: string) => api.delete(`/users/${userId}`),
  update: (userId: string, data: any) => api.put(`/users/${userId}`, data),
};

export const entityApi = {
  getAll: () => api.get('/entities'),
  create: (data: any) => api.post('/entities', data),
  update: (entityId: string, data: any) => api.put(`/entities/${entityId}`, data),
  addAdmin: (entityId: string, data: any) => api.post(`/entities/${entityId}/add-admin`, data),
  getAdmins: (entityId: string) => api.get(`/entities/${entityId}/admins`),
  getUpcomingRenewals: () => api.get('/entities/upcoming-renewals'),
};

export const paymentApi = {
  getStats: () => api.get('/payments/stats'),
  getMonthlyRevenue: (year: number) => api.get(`/payments/monthly?year=${year}`),
  manualRenewal: (data: { adminId: string; amount: number; duration: number; paymentType?: string }) =>
    api.post('/payments/manual-renewal', data),
};

export const menuApi = {
  getAll: (entityId?: string) => api.get(`/menus${entityId ? `?entity=${entityId}` : ''}`),
  create: (data: any) => api.post('/menus', data),
  update: (id: string, data: any) => api.put(`/menus/${id}`, data),
  delete: (id: string) => api.delete(`/menus/${id}`),
  getRates: (entityId?: string) => api.get(`/menus/rates${entityId ? `?entity=${entityId}` : ''}`),
  updateRate: (data: { menuId?: string; bomId?: string; centerId: string; rate: number; entityId?: string }) =>
    api.post('/menus/rates', data),
};

export const bomApi = {
  getAll: (entityId?: string) => api.get(`/boms${entityId ? `?entity=${entityId}` : ''}`),
  create: (data: any) => api.post('/boms', data),
  update: (id: string, data: any) => api.put(`/boms/${id}`, data),
  delete: (id: string) => api.delete(`/boms/${id}`),
};

export const rawMaterialApi = {
  getAll: (entityId?: string) => api.get(`/rawmaterials${entityId ? `?entity=${entityId}` : ''}`),
  create: (data: any) => api.post('/rawmaterials', data),
  update: (id: string, data: any) => api.put(`/rawmaterials/${id}`, data),
  delete: (id: string) => api.delete(`/rawmaterials/${id}`),
  updateStock: (id: string, currentStock: number) => api.put(`/rawmaterials/${id}/stock`, { currentStock }),
};

export const foodRequestApi = {
  getAll: (entityId?: string, centerId?: string) => {
    let url = `/foodrequests?`;
    if (entityId) url += `entity=${entityId}&`;
    if (centerId) url += `centerId=${centerId}&`;
    return api.get(url);
  },
  create: (data: any) => api.post('/foodrequests', data),
  getDemandSummary: (entityId?: string, date?: string) => {
    let url = `/foodrequests/demand-summary?`;
    if (entityId) url += `entity=${entityId}&`;
    if (date) url += `date=${date}&`;
    return api.get(url);
  },

  // COO: edit a single item's qty
  updateItemQty: (requestId: string, itemId: string, qty: number) =>
    api.put(`/foodrequests/${requestId}/items`, { itemId, requestedQty: qty }),
  // COO: approve or reject selected items
  approveItems: (requestId: string, itemIds: string[], action: 'APPROVED' | 'REJECTED') =>
    api.put(`/foodrequests/${requestId}/approve`, { itemIds, action }),
  reject: (id: string, reason: string) => api.put(`/foodrequests/${id}/reject`, { reason }),
  receive: (id: string, items: any[]) => api.put(`/foodrequests/${id}/receive`, { items }),
};

export const vendorApi = {
  getAll: (entityId?: string) => api.get(`/vendors${entityId ? `?entity=${entityId}` : ''}`),
  getOne: (id: string) => api.get(`/vendors/${id}`),
  create: (data: any) => api.post('/vendors', data),
  update: (id: string, data: any) => api.put(`/vendors/${id}`, data),
  delete: (id: string) => api.delete(`/vendors/${id}`),
};

export const employeeApi = {
  getAll: (entityId?: string) => api.get(`/employees${entityId ? `?entity=${entityId}` : ''}`),
  getOne: (id: string) => api.get(`/employees/${id}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
};

export const bankApi = {
  getAll: (entityId?: string) => api.get(`/banks${entityId ? `?entity=${entityId}` : ''}`),
  getOne: (id: string) => api.get(`/banks/${id}`),
  create: (data: any) => api.post('/banks', data),
  update: (id: string, data: any) => api.put(`/banks/${id}`, data),
  delete: (id: string) => api.delete(`/banks/${id}`),
};

export const eventApi = {
  getAll: (entityId?: string) => api.get(`/events${entityId ? `?entity=${entityId}` : ''}`),
  getUpcoming: () => api.get('/events/upcoming'),
  create: (data: any) => api.post('/events', data),
  delete: (id: string) => api.delete(`/events/${id}`),
};

export const expenseApi = {
  getAll: (entityId?: string) => api.get(`/expense-categories${entityId ? `?entity=${entityId}` : ''}`),
  create: (data: any) => api.post('/expense-categories', data),
  delete: (id: string) => api.delete(`/expense-categories/${id}`),
};

export const productionApi = {
  getOrders: (type: 'send' | 'receive', locationId?: string) => {
    let url = `/production/orders?type=${type}`;
    if (locationId) url += `&locationId=${locationId}`;
    return api.get(url);
  },
  dispatch: (id: string, itemsToDispatch: { itemId: string; dispatchQty: number }[]) => 
    api.post(`/production/orders/${id}/dispatch`, { itemsToDispatch }),
  receive: (id: string, itemsToReceive: { itemId: string; receiveQty: number }[]) => 
    api.post(`/production/orders/${id}/receive`, { itemsToReceive }),
};

export const purchaseApi = {
  getAll: () => api.get('/purchases'),
  create: (data: any) => api.post('/purchases', data),
  delete: (id: string) => api.delete(`/purchases/${id}`),
  // Purchase Requests
  getRequests: () => api.get('/purchases/requests'),
  createRequest: (data: any) => api.post('/purchases/requests', data),
  approveRequest: (id: string, data: any) => api.put(`/purchases/requests/${id}/approve`, data),
  // Bills
  getBills: () => api.get('/purchases/bills'),
  updateBill: (id: string, data: any) => api.put(`/purchases/bills/${id}`, data),
};

export const wastageApi = {
  getToday: (date?: string) => api.get(`/wastage/today${date ? `?date=${date}` : ''}`),
  getAll: (centerId?: string, date?: string) => {
    let url = `/wastage?`;
    if (centerId) url += `centerId=${centerId}&`;
    if (date) url += `date=${date}&`;
    return api.get(url);
  },
  save: (data: any) => api.post('/wastage', data),
};

export const financeApi = {
  getStats: (entityId?: string) => api.get(`/finance/stats${entityId ? `?entityId=${entityId}` : ''}`),
  getAll: (entityId?: string) => api.get(`/finance${entityId ? `?entityId=${entityId}` : ''}`),
  create: (data: any) => api.post('/finance', data),
};

export const inventoryApi = {
  getAll: (locationId?: string) => api.get(`/inventory${locationId ? `?locationId=${locationId}` : ''}`),
  update: (id: string, data: any) => api.put(`/inventory/${id}`, data),
};

export default api;
