import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { io } from 'socket.io-client';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.2:4000';
const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function DeliveryDashboardScreen() {
  const { user, logout } = useAuth();
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
    socketRef.current = io(BASE_URL, { transports: ['websocket'] });
    // Listen for any ready order broadcast
    socketRef.current.on('order:status', ({ status }) => {
      if (status === 'ready') fetchOrders(true);
    });
    return () => socketRef.current?.disconnect();
  }, [fetchOrders]);

  const handleAction = async (orderId, status) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchOrders(true);
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.error || 'Không thể cập nhật');
    }
  };

  const available = orders.filter(o => o.status === 'ready');
  const myDeliveries = orders.filter(o => o.status === 'delivering');
  const completed = orders.filter(o => o.status === 'delivered');

  return (
    <FlatList
      data={[{ key: 'stats' }, { key: 'active' }, { key: 'available' }, { key: 'done' }]}
      keyExtractor={i => i.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />}
      renderItem={({ item }) => {
        if (item.key === 'stats') return (
          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={styles.statLabel}>Sẵn sàng</Text><Text style={styles.statVal}>{available.length}</Text></View>
            <View style={[styles.statCard, styles.statOrange]}><Text style={styles.statLabel}>Đang giao</Text><Text style={styles.statVal}>{myDeliveries.length}</Text></View>
            <View style={[styles.statCard, styles.statGreen]}><Text style={styles.statLabel}>Hoàn thành</Text><Text style={styles.statVal}>{completed.length}</Text></View>
          </View>
        );

        if (item.key === 'active' && myDeliveries.length > 0) return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚴 Đơn đang giao ({myDeliveries.length})</Text>
            {myDeliveries.map(order => (
              <View key={order.id} style={[styles.card, styles.cardActive]}>
                <Text style={styles.orderId}>Đơn #{order.id} — {order.customer_name}</Text>
                <Text style={styles.detail}>🏪 {order.shop_name}</Text>
                <Text style={styles.detail}>📍 Giao đến: {order.delivery_address}</Text>
                <Text style={styles.total}>💰 {fmt(order.total)}</Text>
                <TouchableOpacity style={styles.greenBtn} onPress={() => handleAction(order.id, 'delivered')}>
                  <Text style={styles.greenBtnText}>✅ Giao thành công</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );

        if (item.key === 'available') return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Đơn sẵn sàng ({available.length})</Text>
            {available.length === 0
              ? <Text style={styles.empty}>Không có đơn hàng nào. Cập nhật tự động khi có đơn mới.</Text>
              : available.map(order => (
                  <View key={order.id} style={styles.card}>
                    <Text style={styles.orderId}>Đơn #{order.id} — {order.customer_name}</Text>
                    <Text style={styles.detail}>🏪 Lấy tại: {order.shop_name}</Text>
                    <Text style={styles.detail}>📍 Giao đến: {order.delivery_address}</Text>
                    <Text style={styles.total}>💰 {fmt(order.total)}</Text>
                    <Text style={styles.date}>🕐 {new Date(order.created_at).toLocaleString('vi-VN')}</Text>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(order.id, 'delivering')}>
                      <Text style={styles.actionBtnText}>🛵 Nhận đơn này</Text>
                    </TouchableOpacity>
                  </View>
                ))
            }
          </View>
        );

        if (item.key === 'done' && completed.length > 0) return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Đã hoàn thành ({completed.length})</Text>
            {completed.slice(0, 5).map(order => (
              <View key={order.id} style={[styles.card, { opacity: 0.7 }]}>
                <Text style={styles.orderId}>Đơn #{order.id}</Text>
                <Text style={styles.detail}>📍 {order.delivery_address} — 💰 {fmt(order.total)}</Text>
              </View>
            ))}
          </View>
        );

        return null;
      }}
    />
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', elevation: 1 },
  statOrange: { backgroundColor: '#fff7ed' },
  statGreen: { backgroundColor: '#f0fdf4' },
  statLabel: { fontSize: 11, color: '#888' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#333', marginTop: 2 },
  section: { paddingHorizontal: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  cardActive: { borderLeftWidth: 4, borderLeftColor: '#f97316' },
  orderId: { fontWeight: '700', fontSize: 14, color: '#333', marginBottom: 4 },
  detail: { fontSize: 13, color: '#555', marginBottom: 2 },
  total: { fontWeight: '600', color: '#333', marginBottom: 4 },
  date: { fontSize: 12, color: '#aaa', marginBottom: 8 },
  actionBtn: { backgroundColor: '#6F4E37', padding: 12, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700' },
  greenBtn: { backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' },
  greenBtnText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#aaa', paddingVertical: 20, fontSize: 13 },
});
