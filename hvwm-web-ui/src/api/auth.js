// src/api/auth.js
import http from '@/api/http';

export const login = (body) => http.post('/v1/admin/auth/login', body);
export const me    = () => http.get('/v1/admin/auth/me');

