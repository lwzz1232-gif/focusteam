import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Splash } from './screens/Splash';
import { Login } from './screens/Login';
import { Landing } from './screens/Landing';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { useAuth } from './hooks/useAuth';
import { SessionConfig, Partner, SessionType, SessionDuration, SessionMode, User } from './types';
import { handleLogout as firebaseLogout, checkBanStatus, createTestSession } from './services/firebaseService';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ProtectedLayout: React.FC<{ user: User | null; onLogout: () => void; }> = ({ user, onLogout }) => {
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return (
        <Layout user={user} onLogout={onLogout}>
            <Outlet />
        </Layout>
    );
};

const ProtectedRoute: React.FC<{ user: User | null; children: React.ReactElement }> = ({ user, children }) => {
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

export const AppRoutes: React.FC = () => {
    let authHook;
    try {
        authHook = useAuth();
    } catch (e) {
        console.error("Auth hook failed:", e);
        return (
            <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Critical Error</h3>
                    <p className="text-slate-300 mb-4">Authentication system failed to load</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} /> Reload App
                    </button>
                </div>
            </div>
        );
    }

    const { user, loading } = authHook;
    const navigate = useNavigate();
    const location = useLocation();

    const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
        type: SessionType.STUDY,
        duration: SessionDuration.MIN_30,
        mode: SessionMode.DEEP_WORK,
        preTalkMinutes: 5,
        postTalkMinutes: 5
    });
    const [partner, setPartner] = useState<Partner | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    const handleLogout = async () => {
        await firebaseLogout();
        setPartner(null);
        setSessionId(null);
        navigate('/login');
    };

    useEffect(() => {
        if (user) {
            const unsub = checkBanStatus(user, (reason) => {
                alert(`You have been banned.\nReason: ${reason}`);
                handleLogout();
            });
            return () => unsub();
        }
    }, [user]);

    useEffect(() => {
        if (!loading && user && ['/landing', '/login'].includes(location.pathname)) {
            navigate('/dashboard');
        }
    }, [user, loading, location.pathname, navigate]);

    const handleSplashComplete = () => {
        navigate(user ? '/dashboard' : '/landing');
    };

    const handleStartMatch = async (config: SessionConfig) => {
        setSessionConfig(config);
        const testSession = await createTestSession(user!, config);
        if (testSession) {
            setPartner(testSession.partner);
            setSessionId(testSession.sessionId);
            navigate('/session');
        } else {
            navigate('/matching');
        }
    };

    const handleMatched = (partner: Partner, sessionId: string) => {
        setPartner(partner);
        setSessionId(sessionId);
        navigate('/negotiation');
    };

    const handleNegotiationComplete = (finalConfig: SessionConfig) => {
        setSessionConfig(finalConfig);
        navigate('/session');
    };

    const handleCancel = () => {
        setPartner(null);
        setSessionId(null);
        navigate('/dashboard');
    };

    if (loading) {
        return <Splash onComplete={handleSplashComplete} />;
    }

    return (
        <Routes>
            <Route path="/" element={<Splash onComplete={handleSplashComplete} />} />
            <Route path="/landing" element={<Landing onGetStarted={() => navigate('/login')} onSignIn={() => navigate('/login')} />} />
            <Route path="/login" element={<Login onBack={() => navigate('/landing')} />} />

            <Route element={<ProtectedLayout user={user} onLogout={handleLogout} />}>
                <Route path="/dashboard" element={<Dashboard user={user!} onStartMatch={handleStartMatch} onLogout={handleLogout} />} />
                <Route path="/matching" element={<Matching user={user!} config={sessionConfig} onMatched={handleMatched} onCancel={handleCancel} />} />
                <Route path="/negotiation" element={partner && sessionId ? <Negotiation config={sessionConfig} partner={partner} sessionId={sessionId} userId={user!.id} onNegotiationComplete={handleNegotiationComplete} onSkipMatch={handleCancel} /> : <Navigate to="/dashboard" />} />
                <Route path="/admin" element={<Admin onBack={() => navigate('/dashboard')} />} />
            </Route>

            <Route
                path="/session"
                element={
                    <ProtectedRoute user={user}>
                        {partner && sessionId ? (
                            <LiveSession
                                user={user!}
                                partner={partner}
                                config={sessionConfig}
                                sessionId={sessionId}
                                onEndSession={handleCancel}
                            />
                        ) : (
                            <Navigate to="/dashboard" />
                        )}
                    </ProtectedRoute>
                }
            />

            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
};

export default AppRoutes;
