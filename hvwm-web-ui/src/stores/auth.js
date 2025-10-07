// src/stores/auth.js
import { defineStore } from 'pinia';
import { login as apiLogin, me as apiMe } from '@/api/auth';
import { setAuthToken } from '@/api/http';

const TOKEN_KEY = 'openhvx.admin.token';

export const useAuth = defineStore('auth', {
  state: () => ({
    token: null,
    user: null,
    _initialized: false,
    _initPromise: null,
  }),

  actions: {
    async login({ email, password, remember }) {
      const { data } = await apiLogin({ email, password });
      const tok = data.access_token || data.token || data.jwt;
      if (!tok) throw new Error('Token manquant');

      this.token = tok;
      // laisse http.js gérer persistance + header Authorization
      setAuthToken(tok, { persist: remember ? 'local' : 'session' });

      await this.fetchMe();
    },

    async fetchMe() {
      const me = await apiMe();
      this.user = me.data;
      // admin SPA : pas de x-tenant-id ici
    },

    async fetchMeIfNeeded() {
      if (this.token && !this.user) {
        try { await this.fetchMe(); } catch { /* 401 géré par l’interceptor http */ }
      }
    },

    restore() {
      const saved =
        localStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem(TOKEN_KEY);

      if (saved) {
        this.token = saved;
        setAuthToken(saved); // remet le header Authorization
      }
    },

    async init() {
      if (this._initialized) return;
      if (this._initPromise) return this._initPromise;

      this._initPromise = (async () => {
        this.restore();
        await this.fetchMeIfNeeded(); // récupère l’utilisateur au reload si token présent
        this._initialized = true;
      })();

      return this._initPromise;
    },

    logout() {
      this.user = null;
      this.token = null;

      // purge complète (headers + storages) via http.js
      setAuthToken(null);

      // par sécurité, on nettoie aussi ici la clé admin
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);

      this._initialized = false;
      this._initPromise = null;
    },
  },
});
