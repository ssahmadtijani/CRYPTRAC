import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import TransactionDetail from './pages/TransactionDetail';
import Wallets from './pages/Wallets';
import Compliance from './pages/Compliance';
import Exchanges from './pages/Exchanges';
import Tax from './pages/Tax';
import Authority from './pages/Authority';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import Notifications from './pages/Notifications';
import AlertRules from './pages/AlertRules';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes wrapped in Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/wallets" element={<Wallets />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/alert-rules" element={<AlertRules />} />
            <Route path="/exchanges" element={<Exchanges />} />
            <Route path="/tax" element={<Tax />} />
            <Route path="/authority" element={<Authority />} />
            <Route path="/authority/*" element={<Authority />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
