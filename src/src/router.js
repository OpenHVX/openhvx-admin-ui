// src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/stores/auth';

const routes = [
  // Public
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { public: true },
  },

  // Admin area (protégé par rôle)
  {
    path: '/admin',
    component: () => import('@/layouts/AdminShell.vue'),
    meta: { roles: ['global-admin'] },
    children: [
      { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/views/admin/Dashboard.vue') },
      { path: 'agents', name: 'admin-agents', component: () => import('@/views/admin/Agents.vue') },
      { path: 'unassigned', name: 'admin-unassigned', component: () => import('@/views/admin/Unassigned.vue') },
      { path: 'tenants', name: 'admin-tenants', component: () => import('@/views/admin/Tenants.vue') },
      { path: 'tenants/:tenantId/resources', name: 'admin-tenant-resources', component: () => import('@/views/admin/TenantResources.vue') },
      // 404 locale pour /admin/*
      { path: ':pathMatch(.*)*', name: 'admin-not-found', component: () => import('@/views/misc/NotFound.vue') },
    ],
  },

  // Forbidden / Not found
  { path: '/403', name: 'forbidden', component: () => import('@/views/misc/Forbidden.vue') },

  // Root -> admin dashboard
  { path: '/', redirect: { name: 'admin-dashboard' } },

  // Catch-all
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/misc/NotFound.vue') },
];

const router = createRouter({
  history: createWebHistory(), // ou createWebHistory(import.meta.env.BASE_URL)
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuth();

  // 1) Init (restaure token + /me si nécessaire)
  await auth.init?.();

  // 2) Public → OK
  if (to.meta?.public) return true;

  // 3) Pas de token → login
  if (!auth.token) {
    return { path: '/login', query: { r: to.fullPath } };
  }

  // 4) S’assurer d’avoir l’utilisateur
  if (!auth.user && auth.fetchMeIfNeeded) {
    await auth.fetchMeIfNeeded();
  }

  // 5) Garde par rôle (admin only ici)
  const need = to.meta?.roles || [];
  if (need.length > 0) {
    const roles = new Set(auth.user?.roles || []);
    if (!need.some((r) => roles.has(r))) {
      return { path: '/403' };
    }
  }

  return true;
});

router.afterEach((to) => {
  // Ajoute une classe au body sur la page de login (utile pour le style)
  document.body.classList.toggle('login', to.path.startsWith('/login'));
});

export default router;
