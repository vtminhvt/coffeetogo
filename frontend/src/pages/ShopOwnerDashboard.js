import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang pha chế',
  ready: 'Sẵn sàng giao',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};

const NEXT_STATUS = {
  pending: { label: 'Xác nhận đơn', status: 'confirmed' },
  confirmed: { label: 'Bắt đầu pha chế', status: 'preparing' },
  preparing: { label: 'Sẵn sàng giao', status: 'ready' },
};

export default function ShopOwnerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [commissions, setCommissions] = useState(null);
  const [newShop, setNewShop] = useState({ name: '', address: '', description: '', phone: '' });
  const [newProduct, setNewProduct] = useState({ shopId: '', name: '', price: '', category: 'Coffee', description: '' });
  const [shopMsg, setShopMsg] = useState('');
  const [productMsg, setProductMsg] = useState('');

  const fetchData = () => {
    api.get('/orders').then(r => setOrders(r.data));
    api.get('/shops').then(r => setShops(r.data.filter(s => s.owner_name === user.name)));
    api.get('/commissions').then(r => setCommissions(r.data));
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

  const updateStatus = async (orderId, status) => {
    await api.patch(`/orders/${orderId}/status`, { status });
    fetchData();
  };

  const handleCreateShop = async (e) => {
    e.preventDefault();
    setShopMsg('');
    try {
      await api.post('/shops', { ...newShop, commission_rate: 0.1 });
      setShopMsg('✅ Đã tạo quán thành công!');
      setNewShop({ name: '', address: '', description: '', phone: '' });
      fetchData();
    } catch (err) {
      setShopMsg('❌ ' + (err.response?.data?.error || 'Lỗi'));
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setProductMsg('');
    try {
      await api.post(`/shops/${newProduct.shopId}/products`, {
        name: newProduct.name,
        price: parseFloat(newProduct.price),
        category: newProduct.category,
        description: newProduct.description,
      });
      setProductMsg('✅ Đã thêm sản phẩm!');
      setNewProduct({ shopId: newProduct.shopId, name: '', price: '', category: 'Coffee', description: '' });
      fetchData();
    } catch (err) {
      setProductMsg('❌ ' + (err.response?.data?.error || 'Lỗi'));
    }
  };

  const activeOrders = orders.filter(o => !['delivered','cancelled'].includes(o.status));
  const pastOrders = orders.filter(o => ['delivered','cancelled'].includes(o.status));

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Quản lý quán — {user.name}</h1>
      </div>

      <div className="tabs">
        {[['orders','📋 Đơn hàng'], ['shops','🏪 Quán của tôi'], ['commissions','💰 Hoa hồng']].map(([k,v]) => (
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <div>
          <h2 className="section-title">Đơn đang xử lý ({activeOrders.length})</h2>
          {activeOrders.length === 0 && <p className="empty-state">Không có đơn hàng nào.</p>}
          <div className="order-list">
            {activeOrders.map(order => {
              const next = NEXT_STATUS[order.status];
              return (
                <div key={order.id} className="order-card">
                  <div className="order-card-header">
                    <span className="order-id">Đơn #{order.id} — {order.customer_name}</span>
                    <span className="order-status-text">{STATUS_LABELS[order.status]}</span>
                  </div>
                  <div className="order-card-body">
                    <p>📍 Giao đến: {order.delivery_address}</p>
                    <p>💰 Tổng: <strong>{fmt(order.total)}</strong></p>
                    <p>🕐 {new Date(order.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  {next && (
                    <button className="btn-action" onClick={() => updateStatus(order.id, next.status)}>
                      {next.label}
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button className="btn-cancel" onClick={() => updateStatus(order.id, 'cancelled')}>Hủy</button>
                  )}
                </div>
              );
            })}
          </div>

          <h2 className="section-title" style={{marginTop:'2rem'}}>Lịch sử đơn hàng ({pastOrders.length})</h2>
          <div className="order-list">
            {pastOrders.slice(0, 10).map(order => (
              <div key={order.id} className="order-card order-card-past">
                <div className="order-card-header">
                  <span className="order-id">Đơn #{order.id}</span>
                  <span>{STATUS_LABELS[order.status]}</span>
                </div>
                <p style={{margin:'0.3rem 0'}}>💰 {fmt(order.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'shops' && (
        <div className="two-col">
          <div>
            <h2 className="section-title">Danh sách quán</h2>
            {shops.length === 0 && <p className="empty-state">Bạn chưa có quán nào.</p>}
            {shops.map(s => (
              <div key={s.id} className="shop-row">
                <strong>{s.name}</strong>
                <span>📍 {s.address}</span>
                <span className={`badge ${s.is_open ? 'badge-open' : 'badge-closed'}`}>
                  {s.is_open ? 'Mở' : 'Đóng'}
                </span>
              </div>
            ))}

            <h2 className="section-title" style={{marginTop:'2rem'}}>Tạo quán mới</h2>
            <form onSubmit={handleCreateShop} className="form-card">
              <label>Tên quán *</label>
              <input value={newShop.name} onChange={e => setNewShop({...newShop, name: e.target.value})} required />
              <label>Địa chỉ *</label>
              <input value={newShop.address} onChange={e => setNewShop({...newShop, address: e.target.value})} required />
              <label>Mô tả</label>
              <input value={newShop.description} onChange={e => setNewShop({...newShop, description: e.target.value})} />
              <label>Số điện thoại</label>
              <input value={newShop.phone} onChange={e => setNewShop({...newShop, phone: e.target.value})} />
              {shopMsg && <p>{shopMsg}</p>}
              <button type="submit" className="btn-submit-sm">Tạo quán</button>
            </form>
          </div>

          <div>
            <h2 className="section-title">Thêm sản phẩm</h2>
            <form onSubmit={handleAddProduct} className="form-card">
              <label>Chọn quán *</label>
              <select value={newProduct.shopId} onChange={e => setNewProduct({...newProduct, shopId: e.target.value})} required>
                <option value="">-- Chọn quán --</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label>Tên sản phẩm *</label>
              <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
              <label>Giá (VNĐ) *</label>
              <input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required min={0} />
              <label>Danh mục</label>
              <input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              <label>Mô tả</label>
              <input value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              {productMsg && <p>{productMsg}</p>}
              <button type="submit" className="btn-submit-sm">Thêm sản phẩm</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'commissions' && commissions && (
        <div>
          <div className="stats-row">
            <div className="stat-card">
              <span>Hoa hồng chờ xử lý</span>
              <strong>{fmt(commissions.summary.totalPending)}</strong>
            </div>
            <div className="stat-card stat-card-green">
              <span>Đã thanh toán</span>
              <strong>{fmt(commissions.summary.totalPaid)}</strong>
            </div>
            <div className="stat-card">
              <span>Tổng hoa hồng</span>
              <strong>{fmt(commissions.summary.total)}</strong>
            </div>
          </div>
          <h2 className="section-title">Chi tiết hoa hồng</h2>
          <table className="data-table">
            <thead>
              <tr><th>Đơn #</th><th>Tổng đơn</th><th>Hoa hồng</th><th>Tỷ lệ</th><th>Trạng thái</th><th>Ngày</th></tr>
            </thead>
            <tbody>
              {commissions.commissions.map(c => (
                <tr key={c.id}>
                  <td>#{c.order_id}</td>
                  <td>{fmt(c.order_total)}</td>
                  <td>{fmt(c.amount)}</td>
                  <td>{(c.rate * 100).toFixed(0)}%</td>
                  <td><span className={`badge ${c.status==='paid'?'badge-open':'badge-pending'}`}>{c.status==='paid'?'Đã thanh toán':'Chờ xử lý'}</span></td>
                  <td>{new Date(c.created_at).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
