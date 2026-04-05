import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  const fetchOrders = () => {
    api.get('/orders').then(r => setOrders(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();

    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    // Refresh list when any order becomes 'ready' or changes status
    socketRef.current.on('order:status', ({ status }) => {
      if (status === 'ready') fetchOrders();
    });

    return () => { socketRef.current?.disconnect(); };
  }, []); // eslint-disable-line

  const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';

  const handleAction = async (orderId, status) => {
    await api.patch(`/orders/${orderId}/status`, { status });
    fetchOrders();
  };

  const available = orders.filter(o => o.status === 'ready');
  const myDeliveries = orders.filter(o => o.status === 'delivering');
  const completed = orders.filter(o => o.status === 'delivered');

  if (loading) return <div className="page-loading">Đang tải...</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Trang Shipper — {user.name} 🛵</h1>
      </div>

      <div className="stats-row">
        <div className="stat-card"><span>Đơn sẵn sàng</span><strong>{available.length}</strong></div>
        <div className="stat-card stat-card-orange"><span>Đang giao</span><strong>{myDeliveries.length}</strong></div>
        <div className="stat-card stat-card-green"><span>Đã hoàn thành</span><strong>{completed.length}</strong></div>
      </div>

      {myDeliveries.length > 0 && (
        <>
          <h2 className="section-title">🚴 Đơn đang giao ({myDeliveries.length})</h2>
          <div className="order-list">
            {myDeliveries.map(order => (
              <div key={order.id} className="order-card order-card-active">
                <div className="order-card-header">
                  <span className="order-id">Đơn #{order.id} — {order.customer_name}</span>
                  <span className="badge badge-orange">Đang giao</span>
                </div>
                <div className="order-card-body">
                  <p>🏪 Lấy tại: <strong>{order.shop_name}</strong> — {order.shop_address}</p>
                  <p>📍 Giao đến: {order.delivery_address}</p>
                  <p>💰 Tổng: <strong>{fmt(order.total)}</strong></p>
                </div>
                <button className="btn-action btn-green" onClick={() => handleAction(order.id, 'delivered')}>
                  ✅ Giao thành công
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">📦 Đơn sẵn sàng nhận ({available.length})</h2>
      {available.length === 0 ? (
        <p className="empty-state">Không có đơn hàng nào để giao. Tự động cập nhật mỗi 15 giây.</p>
      ) : (
        <div className="order-list">
          {available.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-card-header">
                <span className="order-id">Đơn #{order.id} — {order.customer_name}</span>
                <span className="badge badge-open">Sẵn sàng</span>
              </div>
              <div className="order-card-body">
                <p>🏪 Lấy tại: <strong>{order.shop_name}</strong></p>
                <p>📍 Giao đến: {order.delivery_address}</p>
                <p>💰 Tổng: <strong>{fmt(order.total)}</strong></p>
                <p>🕐 {new Date(order.created_at).toLocaleString('vi-VN')}</p>
              </div>
              <button className="btn-action" onClick={() => handleAction(order.id, 'delivering')}>
                🛵 Nhận đơn này
              </button>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="section-title" style={{marginTop:'2rem'}}>✅ Đã hoàn thành ({completed.length})</h2>
          <div className="order-list">
            {completed.slice(0, 5).map(order => (
              <div key={order.id} className="order-card order-card-past">
                <div className="order-card-header">
                  <span className="order-id">Đơn #{order.id}</span>
                  <span className="badge badge-open">Hoàn thành</span>
                </div>
                <p style={{margin:'0.3rem 0', fontSize:'0.9rem'}}>
                  📍 {order.delivery_address} — 💰 {fmt(order.total)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
