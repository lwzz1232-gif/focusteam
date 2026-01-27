import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Splash } from './screens/Splash';
import { Landing } from './screens/Landing';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Splash onComplete={() => {}} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Splash onComplete={() => {}}/>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Splash />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>}
        />
        <Route
          path="/matching"
          element={<ProtectedRoute><Layout><Matching /></Layout></ProtectedRoute>}
        />
        <Route
          path="/negotiation"
          element={<ProtectedRoute><Layout><Negotiation /></Layout></ProtectedRoute>}
        />
        <Route
          path="/session"
          element={<ProtectedRoute><Layout><LiveSession /></Layout></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute><Layout><Admin /></Layout></ProtectedRoute>}
        />
      </Routes>
    </Router>
  );
};
