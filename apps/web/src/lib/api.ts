import axios from 'axios';

/**
 * Endereço base da API.
 * - Vercel (services) e `vercel dev`: a API é servida na mesma origem em /api, então o padrão é '/api'.
 * - `next dev` isolado, ou API hospedada em outro domínio: defina NEXT_PUBLIC_API_URL
 *   (ex.: http://localhost:3333 ou https://checkon-api.onrender.com), sem barra no final.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 6000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
