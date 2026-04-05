import { useState, useEffect } from 'react';
import api from '../services/api';
import './Dashboard.css';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [commissions, setCommissions] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/commissions/summary').then(r => setSummary(r.data));
    api.get('/commissions').then(r => setCommissions(r.data));
    api.get('/orders').then(r => setOrders(r.data));
  }, []);

  const fmt = (n) => (n || 0).toLocaleString('vi-VN') + 'đ';

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>⚙️ Admin Dashboard</h1>
      </div>

      {summary && (
        <div className="stats-row">
          <div className="stat-card"><span>Tổng đơn hàng</span><strong>{summary.totalOrders}</strong></div>
          <div className="stat-card stat-card-green"><span>Đơn đã giao</span><strong>{summary.deliveredOrders}</strong></div>
          <div className="stat-card stat-card-orange"><span>Hoa hồng đã thu</span><strong>{fmt(summary.totalRevenue)}</strong></div>
          <div className="stat-card"><span>Hoa hồng chờ</span><strong>{fmt(summary.pendingRevenue)}</strong></div>
          <div className="stat-card"><span>Quán đang mở</span><strong>{summary.activeShops}</strong></div>
          <div className="stat-card"><span>Tổng người dùng</span><strong>{summary.totalUsers}</strong></div>
        </div>
      )}

      {commissions && (
        <>
          <h2 className="section-title">Hoa hồng từ đối tác</h2>
          <table className="data-table">
            <thead>
              <tr><th>Đơn #</th><th>Quán</th><th>Tổng đơn</th><th>Hoa hồng</th><th>Tỷ lệ</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              {commissions.commissions.slice(0, 20).map(c => (
                <tr key={c.id}>
                  <td>#{c.order_id}</td>
                  <td>{c.shop_name}</td>
                  <td>{fmt(c.order_total)}</td>
                  <td>{fmt(c.amount)}</td>
                  <td>{(c.rate * 100).toFixed(0)}%</td>
                  <td><span className={`badge ${c.status==='paid'?'badge-open':'badge-pending'}`}>{c.status==='paid'?'Đã thu':'Chờ'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className="section-title" style={{marginTop:'2rem'}}>Tất cả đơn hàng</h2>
      <table className="data-table">
        <thead>
          <tr><th>Đơn #</th><th>Quán</th><th>Khách hàng</th><th>Tổng</th><th>Trạng thái</th><th>Ngày</th></tr>
        </thead>
        <tbody>
          {orders.slice(0, 20).map(o => (
            <tr key={o.id}>
              <td>#{o.id}</td>
              <td>{o.shop_name}</td>
              <td>{o.customer_name}</td>
              <td>{fmt(o.total)}</td>
              <td>{o.status}</td>
              <td>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
