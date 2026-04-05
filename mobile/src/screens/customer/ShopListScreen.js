import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import api from '../../services/api';

export default function ShopListScreen({ navigation }) {
  const [shops, setShops] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchShops = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    try {
      const { data } = await api.get('/shops');
      setShops(data);
      setFiltered(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) { setFiltered(shops); return; }
    const q = text.toLowerCase();
    setFiltered(shops.filter(s =>
      s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    ));
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#6F4E37" />
    </View>
  );

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="🔍 Tìm quán cà phê..." value={search} onChangeText={handleSearch} />
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchShops(true)} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, !item.is_open && styles.cardClosed]}
            onPress={() => navigation.navigate('ShopDetail', { shopId: item.id, shopName: item.name })}
            disabled={!item.is_open}>
            <Text style={styles.shopName}>{item.name}</Text>
            <Text style={styles.shopAddr}>📍 {item.address}</Text>
            {item.phone && <Text style={styles.shopPhone}>📞 {item.phone}</Text>}
            <View style={[styles.badge, item.is_open ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={styles.badgeText}>{item.is_open ? 'Đang mở' : 'Đã đóng'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy quán nào.</Text>}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  search: { margin: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 },
  cardClosed: { opacity: 0.5 },
  shopName: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  shopAddr: { fontSize: 13, color: '#666', marginBottom: 2 },
  shopPhone: { fontSize: 13, color: '#666', marginBottom: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeOpen: { backgroundColor: '#d1fae5' },
  badgeClosed: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#065f46' },
  empty: { textAlign: 'center', marginTop: 40, color: '#aaa' },
});
