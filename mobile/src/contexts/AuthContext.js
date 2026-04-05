import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import api from '../services/api';

const AuthContext = createContext(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await SecureStore.setItemAsync('token', data.token);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    setUser(data.user);
    await _registerPushToken(data.user.id);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    await SecureStore.setItemAsync('token', data.token);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    setUser(data.user);
    await _registerPushToken(data.user.id);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch { /* ignore */ }
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

async function _registerPushToken(userId) {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
    // Send push token to backend for server-initiated notifications
    await api.post('/auth/push-token', { pushToken, userId }).catch(() => {});
  } catch { /* graceful fallback */ }
}

export function useAuth() {
  return useContext(AuthContext);
}
