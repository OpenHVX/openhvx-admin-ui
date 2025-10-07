import http from '@/api/http';
export const listAgents     = () => http.get('/v1/admin/agents');
export const agentInventory = (id) => http.get(`/v1/admin/agents/${id}/inventory`); // doit exister côté gateway
