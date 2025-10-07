// src/api/tasks.js
import http from './http';

/**
 * ADMIN scope only
 * payload attendu: { action, refId?, tenantId?, params? }
 */
export async function adminEnqueueTask(payload) {
  const { data } = await http.post('/v1/admin/tasks', payload);
  // normalise { success, data } → data
  return data?.data ?? data;
}

export async function adminGetTaskById(id) {
  const { data } = await http.get(`/v1/admin/tasks/${encodeURIComponent(id)}`);
  return data?.data ?? data;
}

/** (optionnel) petite factory pour garder la même ergonomie ailleurs */
export function makeTasksApi() {
  return {
    enqueueTask: adminEnqueueTask,
    getTaskById: adminGetTaskById,
    scope: 'admin',
  };
}
