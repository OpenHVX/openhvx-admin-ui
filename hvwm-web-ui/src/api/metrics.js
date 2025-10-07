// src/api/metrics.js
import http from './http';

// Admin-wide metrics
export const adminOverview   = () => http.get('/v1/admin/metrics/overview');
export const adminCompute    = () => http.get('/v1/admin/metrics/compute');
export const adminDatastores = () => http.get('/v1/admin/metrics/datastores');
export const adminVMs        = (agentId) =>
  http.get('/v1/admin/metrics/vms', { params: { agentId } });

// Tenant metrics (accessed by admin, tenantId obligatoire)
export function tenantOverview(tenantId) {
  if (!tenantId) throw new Error('tenantId requis');
  return http.get('/v1/admin/metrics/tenant/overview', { params: { tenantId } });
}
