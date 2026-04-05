import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Update this to your deployed backend URL before building for production.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Automatic token refresh on 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) return Promise.reject(error);

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync('token', data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
