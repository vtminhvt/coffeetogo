import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import api from '../../services/api';

const STATUS_LABELS = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang pha chế',
  ready: 'Sẵn sàng giao', delivering: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy',
};
const STATUS_COLORS = {
  pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
  ready: '#06b6d4', delivering: '#f97316', delivered: '#10b981', cancelled: '#9ca3af',
};

const NEXT_STATUS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing'],
  preparing: ['ready'],
  ready: ['delivering'],
  delivering: ['delivered'],
};

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = (orderId, newStatus) => {
    Alert.alert('Cập nhật trạng thái', `Chuyển sang "${STATUS_LABELS[newStatus]}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          try {
            await api.patch(`/orders/${orderId}/status`, { status: newStatus });
            fetchOrders(true);
          } catch (err) {
            Alert.alert('Lỗi', err.response?.data?.error || 'Không thể cập nhật');
          }
        },
      },
    ]);
  };

  return (
    <FlatList
      data={orders}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />}
      contentContainerStyle={{ padding: 12 }}
      ListEmptyComponent={<Text style={styles.empty}>Không có đơn hàng nào.</Text>}
      renderItem={({ item }) => {
        const next = NEXT_STATUS[item.status] || [];
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Đơn #{item.id}</Text>
              <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
            <Text style={styles.detail}>🏪 {item.shop_name} — 👤 {item.customer_name}</Text>
            <Text style={styles.detail}>📍 {item.delivery_address}</Text>
            <Text style={styles.total}>💰 {fmt(item.total)}</Text>
            {next.length > 0 && (
              <View style={styles.btnRow}>
                {next.map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.btn, s === 'cancelled' ? styles.btnRed : styles.btnPrimary]}
                    onPress={() => updateStatus(item.id, s)}>
                    <Text style={styles.btnText}>{STATUS_LABELS[s]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontWeight: '700', fontSize: 14, color: '#333' },
  status: { fontWeight: '600', fontSize: 13 },
  detail: { fontSize: 13, color: '#555', marginBottom: 2 },
  total: { fontWeight: '600', color: '#333', marginTop: 4, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#6F4E37' },
  btnRed: { backgroundColor: '#fee2e2' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 60, color: '#aaa' },
});
