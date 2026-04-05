# CoffeeToGo ☕

> Ứng dụng kết nối khách hàng với chủ tiệm cà phê và đội ngũ giao hàng.

**CoffeeToGo** là nền tảng giúp:
- 🏪 **Chủ quán** đăng ký quán, quản lý menu và theo dõi đơn hàng.
- 📱 **Khách hàng** duyệt menu, đặt cà phê và theo dõi trạng thái giao hàng.
- 🛵 **Shipper** nhận đơn và giao hàng linh hoạt.
- ⚙️ **Admin** quản lý toàn bộ nền tảng và theo dõi hoa hồng.

## Tính năng chính

| Vai trò | Chức năng |
|---------|-----------|
| Khách hàng | Duyệt quán, thêm vào giỏ hàng, đặt đơn, theo dõi trạng thái |
| Chủ quán | Quản lý menu, xác nhận/xử lý đơn, xem hoa hồng |
| Shipper | Nhận đơn sẵn sàng, giao hàng, xác nhận hoàn thành |
| Admin | Dashboard tổng quan, quản lý hoa hồng và đơn hàng |

## Cài đặt & Chạy

### Backend (Node.js/Express + SQLite)

```bash
cd backend
cp .env.example .env
npm install
npm start          # port 4000
```

### Frontend (React)

```bash
cd frontend
npm install
npm start          # port 3000
```

### Chạy test

```bash
cd backend
npm test
```

## Cấu trúc dự án

```
coffeetogo/
├── backend/
│   ├── src/
│   │   ├── config/database.js   # SQLite schema & connection
│   │   ├── middleware/auth.js   # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js          # Đăng ký / đăng nhập
│   │   │   ├── shops.js         # Quản lý quán & sản phẩm
│   │   │   ├── orders.js        # Đặt hàng & luồng trạng thái
│   │   │   └── commissions.js  # Hoa hồng
│   │   └── app.js / index.js
│   └── tests/api.test.js
└── frontend/
    └── src/
        ├── pages/
        │   ├── Home.js               # Trang chủ
        │   ├── ShopList.js           # Danh sách quán
        │   ├── ShopDetail.js         # Menu & đặt hàng
        │   ├── CustomerDashboard.js  # Khách hàng
        │   ├── ShopOwnerDashboard.js # Chủ quán
        │   ├── DeliveryDashboard.js  # Shipper
        │   └── AdminDashboard.js     # Admin
        └── contexts/AuthContext.js   # JWT auth state
```

## API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/shops` | Danh sách quán (public) |
| GET | `/api/shops/:id` | Chi tiết quán + menu |
| POST | `/api/shops` | Tạo quán (shop_owner) |
| POST | `/api/shops/:id/products` | Thêm sản phẩm |
| POST | `/api/orders` | Đặt hàng (customer) |
| GET | `/api/orders` | Danh sách đơn hàng |
| PATCH | `/api/orders/:id/status` | Cập nhật trạng thái đơn |
| GET | `/api/commissions` | Xem hoa hồng |
| GET | `/api/commissions/summary` | Tổng quan hoa hồng (admin) |
