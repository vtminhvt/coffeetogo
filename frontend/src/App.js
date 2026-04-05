import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ShopList from './pages/ShopList';
import ShopDetail from './pages/ShopDetail';
import CustomerDashboard from './pages/CustomerDashboard';
import ShopOwnerDashboard from './pages/ShopOwnerDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/shops" element={<ShopList />} />
            <Route path="/shops/:id" element={<ShopDetail />} />
            <Route path="/customer" element={
              <ProtectedRoute roles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/shop-owner" element={
              <ProtectedRoute roles={['shop_owner']}>
                <ShopOwnerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/delivery" element={
              <ProtectedRoute roles={['delivery']}>
                <DeliveryDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}

