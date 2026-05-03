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
  getAll: () => api.get('/users'),
  getMyCenters: () => api.get('/users/my-centers'),
  getMyKitchens: () => api.get('/users/my-kitchens'),
  getMyStores: () => api.get('/users/my-stores'),
  getMyResorts: () => api.get('/users/my-resorts'),
  getMyAggregates: () => api.get('/users/my-aggrigates'),
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
  getAll: () => api.get('/menus'),
  create: (data: any) => api.post('/menus', data),
  update: (id: string, data: any) => api.put(`/menus/${id}`, data),
  delete: (id: string) => api.delete(`/menus/${id}`),
};

export const bomApi = {
  getAll: () => api.get('/boms'),
  create: (data: any) => api.post('/boms', data),
  update: (id: string, data: any) => api.put(`/boms/${id}`, data),
  delete: (id: string) => api.delete(`/boms/${id}`),
};

export default api;
