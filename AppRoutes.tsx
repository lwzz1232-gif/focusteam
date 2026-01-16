import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Splash } from './screens/Splash';
import { Landing } from './screens/Landing';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { useAuth } from './hooks/useAuth';
import { useSession } from './context/SessionContext';
import { Layout } from './components/Layout';

export const AppRoutes: React.FC = () => {
  const {
    sessionConfig,
    setSessionConfig,
    partner,
    setPartner,
    sessionId,
    setSessionId,
  } = useSession();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <Splash onComplete={() => {}} />;
  }

  const protectedRoutes = (
    <Layout user={user}>
      <Routes>
        <Route path="/dashboard" element={user ? <Dashboard user={user} onStartMatch={(config) => {
          setSessionConfig(config);
          navigate('/matching');
        }} /> : <Navigate to="/login" />} />
        <Route path="/matching" element={user ? <Matching user={user} config={sessionConfig} onMatched={(partner, sessionId) => {
          setPartner(partner);
          setSessionId(sessionId);
          navigate('/negotiation');
        }} onCancel={() => {
          navigate('/dashboard');
        }} /> : <Navigate to="/login" />} />
        <Route path="/negotiation" element={user && partner ? <Negotiation config={sessionConfig} partner={partner} sessionId={sessionId!} userId={user.id} onNegotiationComplete={(config) => {
          setSessionConfig(config);
          navigate('/session');
        }} onSkipMatch={() => {
          navigate('/dashboard');
        }} /> : <Navigate to="/dashboard" />} />
        <Route path="/session" element={user && partner && sessionId ? <LiveSession user={user} partner={partner} config={sessionConfig} sessionId={sessionId} onEndSession={() => {
          navigate('/dashboard');
        }} /> : <Navigate to="/dashboard" />} />
        <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/dashboard" />} />
      </Routes>
    </Layout>
  );

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={user ? protectedRoutes : <Navigate to="/login" />} />
    </Routes>
  );
};
