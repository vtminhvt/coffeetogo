import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function AdminSummaryScreen() {
  const { logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [commissions, setCommissions] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [statsRes, commRes] = await Promise.all([
        api.get('/commissions/summary'),
        api.get('/commissions'),
      ]);
      setStats(statsRes.data);
      setCommissions(commRes.data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />}
    >
      <Text style={styles.pageTitle}>📊 Tổng quan hệ thống</Text>

      {stats && (
        <>
          <View style={styles.row}>
            <StatCard label="Tổng đơn hàng" value={stats.totalOrders} />
            <StatCard label="Đã giao" value={stats.deliveredOrders} color="#10b981" />
          </View>
          <View style={styles.row}>
            <StatCard label="Doanh thu HH" value={fmt(stats.totalRevenue)} color="#6F4E37" />
            <StatCard label="HH chờ thu" value={fmt(stats.pendingRevenue)} color="#f59e0b" />
          </View>
          <View style={styles.row}>
            <StatCard label="Quán đang mở" value={stats.activeShops} />
            <StatCard label="Tổng người dùng" value={stats.totalUsers} />
          </View>
        </>
      )}

      {commissions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Hoa hồng gần đây</Text>
          {commissions.commissions.slice(0, 5).map(c => (
            <View key={c.id} style={styles.commRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.commShop}>{c.shop_name}</Text>
                <Text style={styles.commDate}>{new Date(c.created_at).toLocaleDateString('vi-VN')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.commAmount}>{fmt(c.amount)}</Text>
                <View style={[styles.badge, c.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
                  <Text style={styles.badgeText}>{c.status === 'paid' ? 'Đã TT' : 'Chờ'}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color = '#333' }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#333', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  statLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 10, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  commRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  commShop: { fontWeight: '600', color: '#333' },
  commDate: { fontSize: 12, color: '#aaa', marginTop: 2 },
  commAmount: { fontWeight: '700', color: '#6F4E37' },
  badge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePaid: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#065f46' },
});
