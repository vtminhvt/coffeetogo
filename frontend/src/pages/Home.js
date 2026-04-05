import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Home.css';

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>☕ CoffeeToGo</h1>
          <p className="hero-sub">Kết nối khách hàng với những quán cà phê yêu thích.<br />Giao hàng nhanh chóng – Hoa hồng minh bạch.</p>
          {!user ? (
            <div className="hero-cta">
              <Link to="/register" className="btn btn-primary">Đăng ký ngay</Link>
              <Link to="/shops" className="btn btn-secondary">Xem quán cà phê</Link>
            </div>
          ) : (
            <Link to="/shops" className="btn btn-primary">Đặt cà phê ngay</Link>
          )}
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <span className="feature-icon">🏪</span>
          <h3>Cho chủ quán</h3>
          <p>Đăng ký quán, quản lý menu và đơn hàng. Nhận hoa hồng minh bạch theo từng đơn.</p>
          {!user && <Link to="/register?role=shop_owner" className="btn btn-outline">Đăng ký quán</Link>}
        </div>
        <div className="feature-card">
          <span className="feature-icon">📱</span>
          <h3>Cho khách hàng</h3>
          <p>Duyệt menu, đặt hàng trong vài giây và theo dõi trạng thái đơn hàng theo thời gian thực.</p>
          {!user && <Link to="/register?role=customer" className="btn btn-outline">Đặt hàng ngay</Link>}
        </div>
        <div className="feature-card">
          <span className="feature-icon">🛵</span>
          <h3>Cho shipper</h3>
          <p>Nhận đơn giao hàng linh hoạt, thu nhập ổn định. Tham gia đội ngũ vận chuyển CoffeeToGo.</p>
          {!user && <Link to="/register?role=delivery" className="btn btn-outline">Gia nhập đội shipper</Link>}
        </div>
      </section>

      <section className="stats">
        <div className="stat"><span className="stat-num">500+</span><span>Quán đối tác</span></div>
        <div className="stat"><span className="stat-num">10.000+</span><span>Khách hàng</span></div>
        <div className="stat"><span className="stat-num">200+</span><span>Shipper</span></div>
        <div className="stat"><span className="stat-num">98%</span><span>Đơn giao đúng giờ</span></div>
      </section>
    </div>
  );
}
