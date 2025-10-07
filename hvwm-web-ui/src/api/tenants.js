// src/api/tenants.js
import http from '@/api/http';

// Liste (admin)
export function listTenants(params) {
  // Ajuste le chemin si ton gateway est prefixé (/api/v1/...)
  return http.get('/v1/admin/tenants', { params });
}

// Création (admin)
export function createTenant(payload) {
  return http.post('/v1/admin/tenants', payload);
}

// Mise à jour (admin)
export function updateTenant(tenantId, payload) {
  return http.patch(`/v1/admin/tenants/${encodeURIComponent(tenantId)}`, payload);
}

// Suppression (admin)
export function deleteTenant(tenantId) {
  return http.delete(`/v1/admin/tenants/${encodeURIComponent(tenantId)}`);
}
