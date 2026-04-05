import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const STATUS_LABELS = {
  pending: { label: 'Chờ xác nhận', color: '#f59e0b' },
  confirmed: { label: 'Đã xác nhận', color: '#3b82f6' },
  preparing: { label: 'Đang pha chế', color: '#8b5cf6' },
  ready: { label: 'Sẵn sàng giao', color: '#06b6d4' },
  delivering: { label: 'Đang giao', color: '#f97316' },
  delivered: { label: 'Đã giao', color: '#10b981' },
  cancelled: { label: 'Đã hủy', color: '#6b7280' },
};

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    api.get('/orders').then(r => setOrders(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';

  const handleCancel = async (orderId) => {
    await api.patch(`/orders/${orderId}/status`, { status: 'cancelled' });
    fetchOrders();
  };

  if (loading) return <div className="page-loading">Đang tải...</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Xin chào, {user.name} 👋</h1>
        <Link to="/shops" className="btn btn-primary">☕ Đặt hàng mới</Link>
      </div>

      <h2 className="section-title">Đơn hàng của bạn</h2>
      {orders.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link to="/shops" className="btn btn-primary">Đặt cà phê ngay</Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map(order => {
            const st = STATUS_LABELS[order.status] || { label: order.status, color: '#888' };
            return (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <span className="order-id">Đơn #{order.id}</span>
                  <span className="order-status" style={{ color: st.color, borderColor: st.color }}>
                    {st.label}
                  </span>
                </div>
                <div className="order-card-body">
                  <p><strong>{order.shop_name}</strong></p>
                  <p>📍 Giao đến: {order.delivery_address}</p>
                  <p>💰 Tổng: <strong>{fmt(order.total)}</strong></p>
                  <p className="order-date">🕐 {new Date(order.created_at).toLocaleString('vi-VN')}</p>
                </div>
                {order.status === 'pending' && (
                  <button className="btn-cancel" onClick={() => handleCancel(order.id)}>Hủy đơn</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
