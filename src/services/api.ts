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
  getAll: (entityId?: string) => api.get(`/users${entityId ? `?entity=${entityId}` : ''}`),
  getMyCenters: (entityId?: string) => api.get(`/users/my-centers${entityId ? `?entity=${entityId}` : ''}`),
  getMyKitchens: (entityId?: string) => api.get(`/users/my-kitchens${entityId ? `?entity=${entityId}` : ''}`),
  getMyStores: (entityId?: string) => api.get(`/users/my-stores${entityId ? `?entity=${entityId}` : ''}`),
  getMyResorts: (entityId?: string) => api.get(`/users/my-resorts${entityId ? `?entity=${entityId}` : ''}`),
  getMyAggregates: (entityId?: string) => api.get(`/users/my-aggrigates${entityId ? `?entity=${entityId}` : ''}`),
  toggleStatus: (userId: string) => api.put(`/users/${userId}/toggle-status`),
  delete: (userId: string) => api.delete(`/users/${userId}`),
  update: (userId: string, data: any) => api.put(`/users/${userId}`, data),
};

export const entityApi = {
  getAll: () => api.get('/entities'),
  create: (data: any) => api.post('/entities', data),
  addAdmin: (entityId: string, data: any) => api.post(`/entities/${entityId}/add-admin`, data),
  getAdmins: (entityId: string) => api.get(`/entities/${entityId}/admins`),
};

export const paymentApi = {
  getStats: () => api.get('/payments/stats'),
  manualRenewal: (data: { adminId: string; amount: number; duration: number; paymentType?: string }) => 
    api.post('/payments/manual-renewal', data),
};

export const menuApi = {
  getAll: (entityId?: string) => api.get(`/menus${entityId ? `?entity=${entityId}` : ''}`),
  create: (data: any) => api.post('/menus', data),
  update: (id: string, data: any) => api.put(`/menus/${id}`, data),
  delete: (id: string) => api.delete(`/menus/${id}`),
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
  getAll: (entityId?: string) => api.get(`/foodrequests${entityId ? `?entity=${entityId}` : ''}`),
  create: (data: any) => api.post('/foodrequests', data),
  seedSample: (data?: any) => api.post('/foodrequests/seed-sample', data || {}),
  approve: (id: string) => api.put(`/foodrequests/${id}/approve`, {}),
  reject: (id: string, reason: string) => api.put(`/foodrequests/${id}/reject`, { reason }),
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

export const purchaseApi = {
  getAll: () => api.get('/purchases'),
  create: (data: any) => api.post('/purchases', data),
  delete: (id: string) => api.delete(`/purchases/${id}`),
};

export default api;
