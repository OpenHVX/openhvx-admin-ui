// src/api/resources.js
import http from './http';

/* ----------------------- ADMIN: UNASSIGNED ----------------------- */
export const listUnassigned = (params) =>
  http.get('/v1/admin/resources/unassigned', { params });

export const adminUnassignedBulkDelete = (payload /* { type, ids } */) =>
  http.post('/v1/admin/resources/unassigned/bulk-delete', payload);

/* --------------------- ADMIN: TENANT RESOURCES -------------------- */
export const adminTenantResources = (tenantId, params) => {
  if (!tenantId) throw new Error('tenantId requis');
  return http.get(`/v1/admin/tenants/${encodeURIComponent(tenantId)}/resources`, { params });
};

export const adminClaimResources = (tenantId, payload /* { type, ids } */) => {
  if (!tenantId) throw new Error('tenantId requis');
  return http.post(`/v1/admin/tenants/${encodeURIComponent(tenantId)}/resources/claim`, payload);
};

export const adminDeleteTenantResource = (tenantId, resourceId) => {
  if (!tenantId) throw new Error('tenantId requis');
  if (!resourceId) throw new Error('resourceId requis');
  return http.delete(`/v1/admin/tenants/${encodeURIComponent(tenantId)}/resources/${encodeURIComponent(resourceId)}`);
};

/* --------------------------- IMAGES (ADMIN) ----------------------- */
export const adminImages = () => http.get('/v1/admin/images');
