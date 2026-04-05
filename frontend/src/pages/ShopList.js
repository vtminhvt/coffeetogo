import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './Shops.css';

export default function ShopList() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/shops').then(r => setShops(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="page-loading">Đang tải danh sách quán...</div>;

  return (
    <div className="shops-page">
      <div className="shops-header">
        <h1>☕ Danh sách quán cà phê</h1>
        <input
          className="search-input"
          placeholder="Tìm kiếm quán, địa chỉ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">Không tìm thấy quán nào.</div>
      ) : (
        <div className="shops-grid">
          {filtered.map(shop => (
            <Link to={`/shops/${shop.id}`} key={shop.id} className="shop-card">
              <div className="shop-card-img">
                {shop.image_url ? (
                  <img src={shop.image_url} alt={shop.name} />
                ) : (
                  <div className="shop-img-placeholder">☕</div>
                )}
              </div>
              <div className="shop-card-body">
                <div className="shop-status">
                  <span className={`badge ${shop.is_open ? 'badge-open' : 'badge-closed'}`}>
                    {shop.is_open ? 'Đang mở' : 'Đóng cửa'}
                  </span>
                </div>
                <h3>{shop.name}</h3>
                <p className="shop-address">📍 {shop.address}</p>
                {shop.description && <p className="shop-desc">{shop.description}</p>}
                <p className="shop-owner">Chủ quán: {shop.owner_name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
