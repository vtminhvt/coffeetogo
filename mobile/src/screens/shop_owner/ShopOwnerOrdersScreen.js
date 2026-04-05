import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { io } from 'socket.io-client';
import api from '../../services/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:4000';

const STATUS_LABELS = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận',
  preparing: 'Đang pha chế', ready: 'Sẵn sàng giao',
  delivering: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy',
};

const NEXT_STATUS = {
  pending: { label: 'Xác nhận', status: 'confirmed' },
  confirmed: { label: 'Bắt đầu pha chế', status: 'preparing' },
  preparing: { label: 'Sẵn sàng giao', status: 'ready' },
};

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function ShopOwnerOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [myShopIds, setMyShopIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [ordersRes, shopsRes] = await Promise.all([api.get('/orders'), api.get('/shops')]);
      setOrders(ordersRes.data);
      const ids = shopsRes.data.map(s => s.id);
      setMyShopIds(ids);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    socketRef.current = io(BASE_URL, { transports: ['websocket'] });
    return () => socketRef.current?.disconnect();
  }, [fetchOrders]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !myShopIds.length) return;
    myShopIds.forEach(id => socket.emit('join:shop', id));
    socket.on('order:new', () => fetchOrders(true));
    socket.on('order:status', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    });
    return () => { socket.off('order:new'); socket.off('order:status'); };
  }, [myShopIds, fetchOrders]);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchOrders(true);
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.error || 'Không thể cập nhật');
    }
  };

  const active = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const past = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  return (
    <FlatList
      data={[{ key: 'active' }, { key: 'past' }]}
      keyExtractor={i => i.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />}
      renderItem={({ item }) => item.key === 'active' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Đơn đang xử lý ({active.length})</Text>
          {active.length === 0 && <Text style={styles.empty}>Không có đơn hàng nào.</Text>}
          {active.map(order => {
            const next = NEXT_STATUS[order.status];
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderId}>Đơn #{order.id} — {order.customer_name}</Text>
                  <Text style={styles.status}>{STATUS_LABELS[order.status]}</Text>
                </View>
                <Text style={styles.detail}>📍 {order.delivery_address}</Text>
                <Text style={styles.total}>💰 {fmt(order.total)}</Text>
                {next && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus(order.id, next.status)}>
                    <Text style={styles.actionBtnText}>{next.label}</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'pending' && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => updateStatus(order.id, 'cancelled')}>
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Lịch sử ({past.length})</Text>
          {past.slice(0, 10).map(order => (
            <View key={order.id} style={[styles.card, { opacity: 0.7 }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Đơn #{order.id}</Text>
                <Text style={styles.status}>{STATUS_LABELS[order.status]}</Text>
              </View>
              <Text style={styles.total}>💰 {fmt(order.total)}</Text>
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  section: { padding: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderId: { fontWeight: '600', fontSize: 14, color: '#333', flex: 1 },
  status: { fontSize: 12, color: '#6F4E37', fontWeight: '600' },
  detail: { fontSize: 13, color: '#666', marginBottom: 4 },
  total: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  actionBtn: { backgroundColor: '#6F4E37', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 6 },
  actionBtnText: { color: '#fff', fontWeight: '600' },
  cancelBtn: { backgroundColor: '#fee2e2', padding: 8, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: '#aaa', paddingVertical: 20 },
});
