import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import api from '../../services/api';

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function ShopOwnerCommissionsScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCommissions = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data: res } = await api.get('/commissions');
      setData(res);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  if (!data) return null;

  const { commissions, summary } = data;

  return (
    <FlatList
      data={commissions}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCommissions(true)} />}
      ListHeaderComponent={
        <View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Chờ xử lý</Text>
              <Text style={styles.statValue}>{fmt(summary.totalPending)}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={styles.statLabel}>Đã thanh toán</Text>
              <Text style={styles.statValue}>{fmt(summary.totalPaid)}</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Chi tiết hoa hồng</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>Đơn #{item.order_id}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{fmt(item.amount)}</Text>
            <Text style={styles.rate}>({(item.rate * 100).toFixed(0)}%)</Text>
            <View style={[styles.badge, item.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
              <Text style={styles.badgeText}>{item.status === 'paid' ? 'Đã TT' : 'Chờ'}</Text>
            </View>
          </View>
        </View>
      )}
      contentContainerStyle={{ padding: 12 }}
    />
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  statCardGreen: { backgroundColor: '#d1fae5' },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  row: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
  orderId: { fontWeight: '600', color: '#333' },
  meta: { fontSize: 12, color: '#aaa', marginTop: 2 },
  amount: { fontWeight: '700', color: '#6F4E37', fontSize: 15 },
  rate: { fontSize: 12, color: '#888' },
  badge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePaid: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#065f46' },
});
