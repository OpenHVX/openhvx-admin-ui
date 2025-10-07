// src/api/http.js
import router from '@/router';
import axios from 'axios';

const TOKEN_KEY = 'openhvx.admin.token';
let CURRENT_TOKEN = null;

const http = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_BASE || '/api',
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const t =
    CURRENT_TOKEN ||
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY);

  if (t && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${t}`;
  } else if (!t && config.headers.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    if (status === 401) {
      // ✅ purge complète
      setAuthToken(null);
      const current = router.currentRoute.value?.fullPath || '/';
      if (!current.startsWith('/login')) {
        router.replace({ path: '/login', query: { r: current } });
      }
    } else if (status === 403) {
      if (router.currentRoute.value?.path !== '/403') {
        router.replace('/403');
      }
    }
    return Promise.reject(err);
  }
);

export function setAuthToken(token, { persist = 'local' } = {}) {
  CURRENT_TOKEN = token || null;

  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    if (persist === 'local') {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } else {
    delete http.defaults.headers.common.Authorization;
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function setTenantHeader() {
  delete http.defaults.headers.common['x-tenant-id'];
}

export default http;
