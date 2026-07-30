import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ca_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Only redirect to login on 401 (Unauthorized) — NOT on 500 or other errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only wipe session when the server explicitly says the token is invalid/missing
    if (err.response?.status === 401) {
      const detail = err.response?.data?.detail ?? '';
      // Ignore 401s that are just "wrong password" on the login endpoint itself
      const isLoginEndpoint = (err.config?.url ?? '').includes('/auth/login');
      if (!isLoginEndpoint) {
        localStorage.removeItem('ca_token');
        localStorage.removeItem('ca_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
