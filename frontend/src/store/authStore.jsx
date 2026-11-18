import { create } from 'zustand';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ROLE_ALIASES = {
  Administrator: 'admin',
  Developer: 'developer',
  SecurityOfficer: 'security_lead',
  Approver: 'approver',
};

const normalizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.full_name,
  roles: (user.roles || []).map((role) => {
    const roleName = typeof role === 'string' ? role : role.name;
    return ROLE_ALIASES[roleName] || roleName;
  }),
  is_superuser: user.is_superuser,
});

const getStoredToken = () => localStorage.getItem('agentguard_token');
const getStoredRefreshToken = () => localStorage.getItem('agentguard_refresh_token');

export const useAuthStore = create((set, get) => ({
  user: null,
  token: getStoredToken(),
  refreshToken: getStoredRefreshToken(),
  isAuthenticated: false,
  isLoading: !!getStoredToken(),
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      // Backend may accept JSON body or form-data, handle JSON first
      const payload = {
        email: credentials.email || credentials.username,
        username: credentials.username || credentials.email,
        password: credentials.password,
      };

      const response = await axios.post(`${API_BASE_URL}/auth/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      const { access_token: validToken, refresh_token: validRefreshToken } = response.data;

      if (validToken) {
        const profileResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        const userInfo = normalizeUser(profileResponse.data);

        localStorage.setItem('agentguard_token', validToken);
        if (validRefreshToken) {
          localStorage.setItem('agentguard_refresh_token', validRefreshToken);
        }
        if (userInfo) {
          localStorage.setItem('agentguard_user', JSON.stringify(userInfo));
        }

        set({
          token: validToken,
          refreshToken: validRefreshToken,
          user: userInfo,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return { success: true, user: userInfo };
      } else {
        throw new Error('No authentication token received');
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Authentication failed. Please check your credentials.';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  loadCurrentUser: async () => {
    const currentToken = get().token || getStoredToken();
    if (!currentToken) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const userInfo = normalizeUser(response.data);
      localStorage.setItem('agentguard_user', JSON.stringify(userInfo));
      set({
        user: userInfo,
        token: currentToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      localStorage.removeItem('agentguard_token');
      localStorage.removeItem('agentguard_refresh_token');
      localStorage.removeItem('agentguard_user');
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error:
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          'Unable to verify your session.',
      });
    }
  },

  logout: async () => {
    try {
      const token = get().token;
      if (token) {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }
    } finally {
      localStorage.removeItem('agentguard_token');
      localStorage.removeItem('agentguard_refresh_token');
      localStorage.removeItem('agentguard_user');
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });
    }
  },

  refreshAuthToken: async () => {
    const currentRefreshToken = get().refreshToken || getStoredRefreshToken();
    if (!currentRefreshToken) {
      get().logout();
      return null;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: currentRefreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;
      if (access_token) {
        const profileResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const user = normalizeUser(profileResponse.data);
        localStorage.setItem('agentguard_token', access_token);
        if (newRefreshToken) {
          localStorage.setItem('agentguard_refresh_token', newRefreshToken);
        }
        localStorage.setItem('agentguard_user', JSON.stringify(user));

        set((state) => ({
          token: access_token,
          refreshToken: newRefreshToken || state.refreshToken,
          user,
          isAuthenticated: true,
        }));

        return access_token;
      }
      return null;
    } catch (err) {
      get().logout();
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
