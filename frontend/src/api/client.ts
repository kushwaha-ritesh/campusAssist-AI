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

// Never redirect to login — bypass mode keeps the app always accessible
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export default api;
