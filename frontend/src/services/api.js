import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Automatically refresh access token on 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            (process.env.REACT_APP_API_URL || 'http://localhost:4000/api') + '/auth/refresh',
            { refreshToken }
          );
          localStorage.setItem('token', data.token);
          original.headers.Authorization = `Bearer ${data.token}`;
          return api(original);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

