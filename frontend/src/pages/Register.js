import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export default function Register() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') || 'customer';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: defaultRole });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const roleLabels = { customer: 'Khách hàng', shop_owner: 'Chủ quán', delivery: 'Shipper' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      if (user.role === 'customer') navigate('/customer');
      else if (user.role === 'shop_owner') navigate('/shop-owner');
      else if (user.role === 'delivery') navigate('/delivery');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>☕ Đăng ký CoffeeToGo</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Họ tên</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <label>Số điện thoại</label>
          <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <label>Mật khẩu</label>
          <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />
          <label>Đăng ký với tư cách</label>
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            {Object.entries(roleLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
        </form>
        <p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </div>
    </div>
  );
}
