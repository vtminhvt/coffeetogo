import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './ShopDetail.css';

export default function ShopDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [cart, setCart] = useState({});
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/shops/${id}`).then(r => setShop(r.data));
  }, [id]);

  if (!shop) return <div className="page-loading">Đang tải menu...</div>;

  const categories = [...new Set(shop.products.map(p => p.category || 'Khác'))];

  const addToCart = (productId) => setCart(c => ({ ...c, [productId]: (c[productId] || 0) + 1 }));
  const removeFromCart = (productId) => setCart(c => {
    const next = { ...c };
    if (next[productId] > 1) next[productId]--;
    else delete next[productId];
    return next;
  });

  const cartItems = Object.entries(cart).map(([pid, qty]) => {
    const product = shop.products.find(p => p.id === parseInt(pid));
    return { product, qty, lineTotal: product.price * qty };
  });
  const subtotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = 15000;
  const total = subtotal + deliveryFee;

  const handleOrder = async () => {
    if (!user) { navigate('/login'); return; }
    if (!address.trim()) { setError('Vui lòng nhập địa chỉ giao hàng'); return; }
    if (cartItems.length === 0) { setError('Giỏ hàng trống'); return; }
    setError('');
    setOrdering(true);
    try {
      const res = await api.post('/orders', {
        shop_id: shop.id,
        items: cartItems.map(i => ({ product_id: i.product.id, quantity: i.qty })),
        delivery_address: address,
        notes,
      });
      setOrderSuccess(res.data);
      setCart({});
    } catch (err) {
      setError(err.response?.data?.error || 'Đặt hàng thất bại');
    } finally {
      setOrdering(false);
    }
  };

  const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';

  return (
    <div className="shop-detail">
      <div className="shop-detail-header">
        <div className="shop-detail-info">
          <h1>{shop.name}</h1>
          <p>📍 {shop.address}</p>
          {shop.description && <p>{shop.description}</p>}
          <span className={`badge ${shop.is_open ? 'badge-open' : 'badge-closed'}`}>
            {shop.is_open ? 'Đang mở cửa' : 'Đóng cửa'}
          </span>
        </div>
      </div>

      <div className="shop-detail-body">
        <div className="menu-section">
          <h2>Thực đơn</h2>
          {categories.map(cat => (
            <div key={cat} className="menu-category">
              <h3>{cat}</h3>
              <div className="menu-items">
                {shop.products.filter(p => (p.category || 'Khác') === cat && p.is_available).map(product => (
                  <div key={product.id} className="menu-item">
                    {product.image_url && <img src={product.image_url} alt={product.name} className="menu-item-img" />}
                    <div className="menu-item-info">
                      <span className="menu-item-name">{product.name}</span>
                      {product.description && <span className="menu-item-desc">{product.description}</span>}
                      <span className="menu-item-price">{fmt(product.price)}</span>
                    </div>
                    <div className="menu-item-actions">
                      {cart[product.id] ? (
                        <div className="qty-control">
                          <button onClick={() => removeFromCart(product.id)}>−</button>
                          <span>{cart[product.id]}</span>
                          <button onClick={() => addToCart(product.id)}>+</button>
                        </div>
                      ) : (
                        <button className="add-btn" onClick={() => addToCart(product.id)}>+ Thêm</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="cart-section">
          <h2>Giỏ hàng</h2>
          {orderSuccess ? (
            <div className="order-success">
              <div className="success-icon">✅</div>
              <h3>Đặt hàng thành công!</h3>
              <p>Mã đơn: <strong>#{orderSuccess.id}</strong></p>
              <p>Tổng cộng: <strong>{fmt(orderSuccess.total)}</strong></p>
              <button className="btn-place-order" onClick={() => navigate('/customer')}>
                Xem đơn hàng
              </button>
            </div>
          ) : (
            <>
              {cartItems.length === 0 ? (
                <p className="cart-empty">Chưa có sản phẩm nào</p>
              ) : (
                <>
                  <div className="cart-items">
                    {cartItems.map(({ product, qty, lineTotal }) => (
                      <div key={product.id} className="cart-item">
                        <span>{product.name} x{qty}</span>
                        <span>{fmt(lineTotal)}</span>
                      </div>
                    ))}
                    <div className="cart-item cart-delivery">
                      <span>Phí giao hàng</span>
                      <span>{fmt(deliveryFee)}</span>
                    </div>
                    <div className="cart-item cart-total">
                      <strong>Tổng cộng</strong>
                      <strong>{fmt(total)}</strong>
                    </div>
                  </div>
                  <label className="cart-label">Địa chỉ giao hàng *</label>
                  <input
                    className="cart-input"
                    placeholder="Nhập địa chỉ giao hàng..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                  <label className="cart-label">Ghi chú</label>
                  <input
                    className="cart-input"
                    placeholder="Ít đá, ít đường..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  {error && <div className="alert alert-error">{error}</div>}
                  <button
                    className="btn-place-order"
                    onClick={handleOrder}
                    disabled={ordering || !shop.is_open}
                  >
                    {ordering ? 'Đang xử lý...' : shop.is_open ? 'Đặt hàng' : 'Quán đang đóng cửa'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
