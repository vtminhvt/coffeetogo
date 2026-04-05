import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView, Modal } from 'react-native';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function ShopOwnerMenuScreen() {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [showAddShop, setShowAddShop] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', address: '', description: '', phone: '' });
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Coffee', description: '' });

  const fetchShops = useCallback(async () => {
    const { data } = await api.get('/shops');
    const mine = data.filter(s => s.owner_name === user.name);
    setShops(mine);
    if (mine.length && !selectedShop) setSelectedShop(mine[0]);
  }, [user.name, selectedShop]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const createShop = async () => {
    if (!newShop.name || !newShop.address) { Alert.alert('Thiếu thông tin', 'Tên và địa chỉ là bắt buộc'); return; }
    try {
      await api.post('/shops', { ...newShop, commission_rate: 0.1 });
      setNewShop({ name: '', address: '', description: '', phone: '' });
      setShowAddShop(false);
      fetchShops();
      Alert.alert('✅ Đã tạo quán!');
    } catch (err) { Alert.alert('Lỗi', err.response?.data?.error || 'Không thể tạo quán'); }
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.price || !selectedShop) { Alert.alert('Thiếu thông tin'); return; }
    try {
      await api.post(`/shops/${selectedShop.id}/products`, {
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        category: newProduct.category,
        description: newProduct.description,
      });
      setNewProduct({ name: '', price: '', category: 'Coffee', description: '' });
      setShowAddProduct(false);
      fetchShops();
      Alert.alert('✅ Đã thêm sản phẩm!');
    } catch (err) { Alert.alert('Lỗi', err.response?.data?.error || 'Không thể thêm sản phẩm'); }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.sectionTitle}>🏪 Quán của tôi ({shops.length})</Text>
        <TouchableOpacity onPress={() => setShowAddShop(true)}>
          <Text style={styles.addBtn}>+ Thêm quán</Text>
        </TouchableOpacity>
      </View>

      {shops.map(s => (
        <TouchableOpacity key={s.id} style={[styles.shopCard, selectedShop?.id === s.id && styles.shopCardSelected]}
          onPress={() => setSelectedShop(s)}>
          <Text style={styles.shopName}>{s.name}</Text>
          <Text style={styles.shopAddr}>📍 {s.address}</Text>
          <View style={[styles.badge, s.is_open ? styles.badgeOpen : styles.badgeClosed]}>
            <Text style={styles.badgeText}>{s.is_open ? 'Mở' : 'Đóng'}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {selectedShop && (
        <View>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>☕ Menu — {selectedShop.name}</Text>
            <TouchableOpacity onPress={() => setShowAddProduct(true)}>
              <Text style={styles.addBtn}>+ Thêm món</Text>
            </TouchableOpacity>
          </View>
          {/* Products are fetched fresh from shop detail */}
          <ProductList shopId={selectedShop.id} />
        </View>
      )}

      {/* Add Shop Modal */}
      <Modal visible={showAddShop} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal}>
          <Text style={styles.modalTitle}>Tạo quán mới</Text>
          <TextInput style={styles.input} placeholder="Tên quán *" value={newShop.name} onChangeText={v => setNewShop(s => ({ ...s, name: v }))} />
          <TextInput style={styles.input} placeholder="Địa chỉ *" value={newShop.address} onChangeText={v => setNewShop(s => ({ ...s, address: v }))} />
          <TextInput style={styles.input} placeholder="Mô tả" value={newShop.description} onChangeText={v => setNewShop(s => ({ ...s, description: v }))} />
          <TextInput style={styles.input} placeholder="Điện thoại" value={newShop.phone} onChangeText={v => setNewShop(s => ({ ...s, phone: v }))} keyboardType="phone-pad" />
          <TouchableOpacity style={styles.submitBtn} onPress={createShop}><Text style={styles.submitBtnText}>Tạo quán</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddShop(false)}><Text style={styles.cancelBtnText}>Hủy</Text></TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={showAddProduct} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal}>
          <Text style={styles.modalTitle}>Thêm sản phẩm vào {selectedShop?.name}</Text>
          <TextInput style={styles.input} placeholder="Tên sản phẩm *" value={newProduct.name} onChangeText={v => setNewProduct(p => ({ ...p, name: v }))} />
          <TextInput style={styles.input} placeholder="Giá (VNĐ) *" value={newProduct.price} onChangeText={v => setNewProduct(p => ({ ...p, price: v }))} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Danh mục (vd: Coffee, Juice)" value={newProduct.category} onChangeText={v => setNewProduct(p => ({ ...p, category: v }))} />
          <TextInput style={styles.input} placeholder="Mô tả" value={newProduct.description} onChangeText={v => setNewProduct(p => ({ ...p, description: v }))} />
          <TouchableOpacity style={styles.submitBtn} onPress={addProduct}><Text style={styles.submitBtnText}>Thêm sản phẩm</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddProduct(false)}><Text style={styles.cancelBtnText}>Hủy</Text></TouchableOpacity>
        </ScrollView>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ProductList({ shopId }) {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api.get(`/shops/${shopId}`).then(r => setProducts(r.data.products || []));
  }, [shopId]);
  if (!products.length) return <Text style={{ color: '#aaa', padding: 16 }}>Chưa có sản phẩm nào.</Text>;
  return (
    <View>
      {products.map(p => (
        <View key={p.id} style={styles.productRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{p.name}</Text>
            {p.category && <Text style={styles.productCat}>{p.category}</Text>}
          </View>
          <Text style={styles.productPrice}>{(p.price || 0).toLocaleString('vi-VN')}đ</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  addBtn: { color: '#6F4E37', fontWeight: '600', fontSize: 14 },
  shopCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  shopCardSelected: { borderColor: '#6F4E37' },
  shopName: { fontWeight: '700', fontSize: 15, color: '#333' },
  shopAddr: { fontSize: 13, color: '#666', marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 6 },
  badgeOpen: { backgroundColor: '#d1fae5' },
  badgeClosed: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#065f46' },
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginBottom: 4, borderRadius: 8 },
  productName: { fontSize: 14, fontWeight: '500', color: '#333' },
  productCat: { fontSize: 12, color: '#aaa' },
  productPrice: { fontWeight: '600', color: '#6F4E37' },
  modal: { padding: 20, backgroundColor: '#fff', flex: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 20, marginTop: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 },
  submitBtn: { backgroundColor: '#6F4E37', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontWeight: '600' },
});
