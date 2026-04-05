import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { io } from 'socket.io-client';
import api from '../../services/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:4000';

const STATUS_LABELS = {
  pending:    { label: 'Chờ xác nhận', color: '#f59e0b' },
  confirmed:  { label: 'Đã xác nhận',  color: '#3b82f6' },
  preparing:  { label: 'Đang pha chế', color: '#8b5cf6' },
  ready:      { label: 'Sẵn sàng giao', color: '#06b6d4' },
  delivering: { label: 'Đang giao',    color: '#f97316' },
  delivered:  { label: 'Đã giao',      color: '#10b981' },
  cancelled:  { label: 'Đã hủy',       color: '#6b7280' },
};

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    // Connect to Socket.IO for real-time status updates
    socketRef.current = io(BASE_URL, { transports: ['websocket'] });

    return () => { socketRef.current?.disconnect(); };
  }, [fetchOrders]);

  // Join/leave Socket.IO rooms when orders change
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    orders.forEach(o => socket.emit('join:order', o.id));
    socket.on('order:status', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    });
    return () => { socket.off('order:status'); };
  }, [orders]);

  const handleCancel = (orderId) => {
    Alert.alert('Hủy đơn hàng', 'Bạn chắc chắn muốn hủy?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn', style: 'destructive',
        onPress: async () => {
          await api.patch(`/orders/${orderId}/status`, { status: 'cancelled' });
          fetchOrders(true);
        },
      },
    ]);
  };

  const renderOrder = ({ item }) => {
    const st = STATUS_LABELS[item.status] || { label: item.status, color: '#888' };
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Đơn #{item.id}</Text>
          <Text style={[styles.statusBadge, { borderColor: st.color, color: st.color }]}>{st.label}</Text>
        </View>
        <Text style={styles.shopName}>{item.shop_name}</Text>
        <Text style={styles.detail}>📍 {item.delivery_address}</Text>
        <Text style={styles.total}>💰 {fmt(item.total)}</Text>
        <Text style={styles.date}>🕐 {new Date(item.created_at).toLocaleString('vi-VN')}</Text>
        {item.status === 'pending' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
            <Text style={styles.cancelBtnText}>Hủy đơn</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={orders}
      keyExtractor={item => String(item.id)}
      renderItem={renderOrder}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />}
      contentContainerStyle={{ padding: 12 }}
      ListEmptyComponent={<Text style={styles.empty}>Bạn chưa có đơn hàng nào.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontWeight: '700', fontSize: 15, color: '#333' },
  statusBadge: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2, fontSize: 12, fontWeight: '600' },
  shopName: { fontWeight: '600', fontSize: 15, color: '#6F4E37', marginBottom: 4 },
  detail: { fontSize: 13, color: '#666', marginBottom: 2 },
  total: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  date: { fontSize: 12, color: '#aaa', marginBottom: 8 },
  cancelBtn: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: '#dc2626', fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa', fontSize: 15 },
});
