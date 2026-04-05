import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const dashboardLink = () => {
    if (!user) return null;
    if (user.role === 'customer') return { to: '/customer', label: 'Trang khách hàng' };
    if (user.role === 'shop_owner') return { to: '/shop-owner', label: 'Quản lý quán' };
    if (user.role === 'delivery') return { to: '/delivery', label: 'Giao hàng' };
    if (user.role === 'admin') return { to: '/admin', label: 'Admin' };
    return null;
  };

  const dash = dashboardLink();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">☕ CoffeeToGo</Link>
      <div className="navbar-links">
        <Link to="/shops">Quán cà phê</Link>
        {user ? (
          <>
            {dash && <Link to={dash.to}>{dash.label}</Link>}
            <span className="navbar-user">Xin chào, {user.name}</span>
            <button onClick={handleLogout} className="btn-link">Đăng xuất</button>
          </>
        ) : (
          <>
            <Link to="/login">Đăng nhập</Link>
            <Link to="/register" className="btn-primary">Đăng ký</Link>
          </>
        )}
      </div>
    </nav>
  );
}
