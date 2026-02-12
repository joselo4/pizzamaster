
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

import Login from './pages/Login';
import POS from './pages/POS';
import Kitchen from './pages/Kitchen';
import Delivery from './pages/Delivery';
import Cashier from './pages/Cashier';
import Admin from './pages/admin';

import CustomerOrder from './pages/CustomerOrder';
import Validation from './pages/Validation';
import Track from './pages/Track';
import Promo from './pages/Promo';
import PromoInfo from './pages/PromoInfo';

import MobileLayout from './components/MobileLayout';
import AppIdentityLoader from './components/AppIdentityLoader';

const getSmartRedirect = (user: any) => {
  if (!user) return '/login';
  const p = user.permissions || [];
  // Admin ve todo y entra primero a Validación
  if (user.role === 'Admin') return '/validacion';
  if (p.includes('access_validation')) return '/validacion';
  if (p.includes('access_pos')) return '/pos';
  if (p.includes('access_cashier')) return '/cashier';
  if (p.includes('access_kitchen')) return '/kitchen';
  if (p.includes('access_delivery')) return '/delivery';
  if (p.includes('access_admin')) return '/admin';
  return '/login';
};

const ProtectedRoute = ({ children, permission }: { children: React.ReactNode; permission?: string }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Admin siempre pasa
  if (permission && user.role !== 'Admin' && !user.permissions?.includes(permission)) {
    return <Navigate to={getSmartRedirect(user)} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppIdentityLoader />
        <Routes>
          {/* Inicio siempre en Pedido (Cliente) */}
          <Route path="/" element={<Navigate to="/pedido" replace />} />

          {/* Público: Cliente */}
          <Route path="/pedido" element={<CustomerOrder />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:token" element={<Track />} />
          <Route path="/promo" element={<Promo />} />
        <Route path="/promo/:id" element={<PromoInfo />} />

          {/* Público: Login operador */}
          <Route path="/login" element={<Login />} />

          {/* Privado: Operador */}
          <Route element={<ProtectedRoute><MobileLayout /></ProtectedRoute>}>
            <Route path="/validacion" element={<ProtectedRoute permission="access_validation"><Validation /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute permission="access_pos"><POS /></ProtectedRoute>} />
            <Route path="/kitchen" element={<ProtectedRoute permission="access_kitchen"><Kitchen /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute permission="access_delivery"><Delivery /></ProtectedRoute>} />
            <Route path="/cashier" element={<ProtectedRoute permission="access_cashier"><Cashier /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute permission="access_admin"><Admin /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/pedido" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}