import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agentguard_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Token Refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await useAuthStore.getState().refreshAuthToken();
        if (newToken) {
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          processQueue(new Error('Session expired'), null);
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// API Service Modules
// ============================================================================

export const authApi = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  refresh: async (refreshToken) => {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const agentsApi = {
  list: async () => {
    const response = await api.get('/agents');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/agents', data);
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/agents/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/agents/${id}`, data);
    return response.data;
  },
  toggle: async (id, enabled) => {
    const response = await api.post(`/agents/${id}/toggle`, { enabled });
    return response.data;
  },
  revokeCredentials: async (id, keyId) => {
    const response = await api.delete(`/agents/${id}/credentials/${keyId}`);
    return response.data;
  },
  generateCredential: async (id, data = {}) => {
    const response = await api.post(`/agents/${id}/credentials`, data);
    return response.data;
  },
};

export const toolsApi = {
  list: async () => {
    const response = await api.get('/tools');
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/tools/${id}`);
    return response.data;
  },
  toggle: async (id, enabled) => {
    const response = await api.post(`/tools/${id}/toggle`, { enabled });
    return response.data;
  },
  invokeTool: async (data) => {
    const response = await api.post('/tools/invoke', data);
    return response.data;
  },
  getMcpTools: async () => {
    const response = await api.get('/mcp/tools');
    return response.data;
  },
  getMcpStatus: async () => {
    const response = await api.get('/mcp/status');
    return response.data;
  },
};

export const policiesApi = {
  list: async () => {
    const response = await api.get('/policies');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/policies', data);
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/policies/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/policies/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/policies/${id}`);
    return response.data;
  },
  toggle: async (id, enabled) => {
    const response = await api.post(`/policies/${id}/toggle`, { enabled });
    return response.data;
  },
  evaluate: async (testPayload) => {
    const response = await api.post('/policies/evaluate', testPayload);
    return response.data;
  },
};

export const approvalsApi = {
  list: async (params = {}) => {
    const response = await api.get('/approvals', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/approvals/${id}`);
    return response.data;
  },
  decide: async (id, decision, reason = '') => {
    const response = await api.post(`/approvals/${id}/decide`, { decision, reason });
    return response.data;
  },
  listHistory: async (params = {}) => {
    const response = await api.get('/approvals/history', { params });
    return response.data;
  },
};

export const auditApi = {
  list: async (params = {}) => {
    const response = await api.get('/audit', { params });
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/audit/${id}`);
    return response.data;
  },
  export: async (params = {}) => {
    const response = await api.get('/audit/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
  getStats: async (timeframe = '7d') => {
    const response = await api.get('/audit/stats', { params: { timeframe } });
    return response.data;
  },
};

export const usersApi = {
  list: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/users', data);
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
  getRoles: async () => {
    const response = await api.get('/users/roles');
    return response.data;
  },
  addRole: async (userId, roleId) => {
    const response = await api.post(`/users/${userId}/roles`, { role_id: roleId });
    return response.data;
  },
  removeRole: async (userId, roleId) => {
    const response = await api.delete(`/users/${userId}/roles/${roleId}`);
    return response.data;
  },
};

export default api;
