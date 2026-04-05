import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

export default function ShopDetailScreen({ route }) {
  const { shopId } = route.params;
  const { user } = useAuth();
  const [shop, setShop] = useState(null);
  const [cart, setCart] = useState({});
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    api.get(`/shops/${shopId}`).then(r => setShop(r.data));
  }, [shopId]);

  if (!shop) return <View style={styles.center}><ActivityIndicator size="large" color="#6F4E37" /></View>;

  const addToCart = (product) => setCart(c => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }));
  const removeFromCart = (product) => setCart(c => {
    const qty = (c[product.id] || 0) - 1;
    if (qty <= 0) { const { [product.id]: _, ...rest } = c; return rest; }
    return { ...c, [product.id]: qty };
  });

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: shop.products.find(p => p.id === parseInt(id)), qty }))
    .filter(i => i.product);

  const subtotal = cartItems.reduce((s, i) => s + i.product.price * i.qty, 0);
  const total = subtotal + 15000;

  const placeOrder = async () => {
    if (!cartItems.length) { Alert.alert('Giỏ hàng trống'); return; }
    if (!deliveryAddress.trim()) { Alert.alert('Nhập địa chỉ giao hàng'); return; }
    setPlacing(true);
    try {
      await api.post('/orders', {
        shop_id: shopId,
        items: cartItems.map(i => ({ product_id: i.product.id, quantity: i.qty })),
        delivery_address: deliveryAddress.trim(),
      });
      setCart({});
      Alert.alert('✅ Đặt hàng thành công!', `Tổng: ${fmt(total)}`);
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.error || 'Không thể đặt hàng');
    } finally {
      setPlacing(false);
    }
  };

  const categories = [...new Set(shop.products.map(p => p.category || 'Khác'))];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.shopHeader}>
        <Text style={styles.shopName}>{shop.name}</Text>
        <Text style={styles.shopAddr}>📍 {shop.address}</Text>
      </View>

      {categories.map(cat => (
        <View key={cat}>
          <Text style={styles.catTitle}>{cat}</Text>
          {shop.products.filter(p => (p.category || 'Khác') === cat).map(product => (
            <View key={product.id} style={styles.productRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>{fmt(product.price)}</Text>
              </View>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(product)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qty}>{cart[product.id] || 0}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(product)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ))}

      {cartItems.length > 0 && (
        <View style={styles.cartSummary}>
          <Text style={styles.cartTitle}>🛒 Giỏ hàng</Text>
          {cartItems.map(i => (
            <Text key={i.product.id} style={styles.cartLine}>
              {i.product.name} × {i.qty} = {fmt(i.product.price * i.qty)}
            </Text>
          ))}
          <Text style={styles.cartLine}>🛵 Phí giao hàng: {fmt(15000)}</Text>
          <Text style={styles.cartTotal}>Tổng cộng: {fmt(total)}</Text>

          <Text style={styles.label}>Địa chỉ giao hàng *</Text>
          <View style={styles.addressInput}>
            <Text style={{ color: deliveryAddress ? '#333' : '#aaa' }} onPress={() => Alert.prompt(
              'Địa chỉ giao hàng',
              'Nhập địa chỉ của bạn:',
              (txt) => setDeliveryAddress(txt || ''),
              'plain-text',
              deliveryAddress
            )}>
              {deliveryAddress || 'Nhập địa chỉ giao hàng...'}
            </Text>
          </View>

          <TouchableOpacity style={[styles.orderBtn, placing && styles.btnDisabled]} onPress={placeOrder} disabled={placing}>
            <Text style={styles.orderBtnText}>{placing ? 'Đang đặt...' : '✅ Đặt hàng'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  shopHeader: { backgroundColor: '#6F4E37', padding: 20 },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  shopAddr: { fontSize: 13, color: '#ddd', marginTop: 4 },
  catTitle: { fontSize: 15, fontWeight: '700', color: '#6F4E37', backgroundColor: '#fef3c7', padding: 10, marginTop: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  productName: { fontSize: 15, fontWeight: '500', color: '#333' },
  productPrice: { fontSize: 14, color: '#6F4E37', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6F4E37', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 18, lineHeight: 20 },
  qty: { width: 30, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  cartSummary: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  cartTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  cartLine: { fontSize: 14, color: '#555', marginBottom: 4 },
  cartTotal: { fontSize: 16, fontWeight: '700', color: '#6F4E37', marginTop: 8, marginBottom: 12 },
  label: { fontSize: 13, color: '#888', marginBottom: 4 },
  addressInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 14, minHeight: 44 },
  orderBtn: { backgroundColor: '#6F4E37', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  orderBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
