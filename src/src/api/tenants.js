// src/api/tenants.js
import http from '@/api/http';

// Liste (admin)
export function listTenants(params) {
  return http.get('/v1/admin/tenants', { params });
}

// Création (admin)
export function createTenant(payload) {
  // payload.quotas = { cpu?, memoryMB?, storageMB?, vmCount?, networkCount? } (flat limits)
  return http.post('/v1/admin/tenants', payload);
}

// Mise à jour (admin)
export function updateTenant(tenantId, payload) {
  // payload.quotas idem ci-dessus si présent
  return http.patch(`/v1/admin/tenants/${encodeURIComponent(tenantId)}`, payload);
}

// Suppression (admin)
export function deleteTenant(tenantId) {
  return http.delete(`/v1/admin/tenants/${encodeURIComponent(tenantId)}`);
}

/* ===== Quotas (imbriqués sous tenant) ===== */

// GET /tenants/:tenantId/quotas  -> { cpu:{limit,used}, memoryMB:{...}, ... }
export function getTenantQuotas(tenantId) {
  return http.get(`/v1/admin/tenants/${encodeURIComponent(tenantId)}/quotas`);
}

// PATCH /tenants/:tenantId/quotas  Body: { limits: { cpu?, memoryMB?, ... } }
export function patchTenantQuotaLimits(tenantId, limits) {
  return http.patch(`/v1/admin/tenants/${encodeURIComponent(tenantId)}/quotas`, {
    limits,
  });
}

// (optionnel) Recalculate depuis inventaire (admin tool)
export function recalcTenantQuotas(tenantId, body) {
  // body: { tenantId, fullInventory, tenantResourceLinks? }
  return http.post(`/v1/admin/tenants/${encodeURIComponent(tenantId)}/quotas/recalculate`, body);
}
