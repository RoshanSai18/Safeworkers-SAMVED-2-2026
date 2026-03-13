import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Challenges from './components/Challenges';
import TrustBanner from './components/TrustBanner';
import Footer from './components/Footer';
import Login from './pages/Login';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import './index.css';

// Guard: redirect to /login if not authenticated
function PrivateRoute({ children, allowedRole }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRole && currentUser.role !== allowedRole) return <Navigate to="/login" replace />;
  return children;
}

// Landing page layout
function LandingLayout() {
  return (
    <div className="app">
      <Header />
      <main>
        <Hero />
        <TrustBanner />
        <Features />
        <Challenges />
      </main>
      <Footer />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingLayout />} />
      <Route path="/login" element={<Login />} />
      <Route path="/worker" element={
        <PrivateRoute allowedRole="worker"><WorkerDashboard /></PrivateRoute>
      } />
      <Route path="/supervisor" element={
        <PrivateRoute allowedRole="supervisor"><SupervisorDashboard /></PrivateRoute>
      } />
      <Route path="/admin" element={
        <PrivateRoute allowedRole="admin"><AdminDashboard /></PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
