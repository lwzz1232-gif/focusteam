import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { User } from '../types';
import { auth, db, googleProvider } from '../utils/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, sendEmailVerification, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2, Chrome, FileText, X, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AuthMascot } from '../components/AuthMascot';
import { Logo } from '../components/Logo';
import { ToastNotification } from '../components/ToastNotification';
// PASTE THIS RIGHT AFTER YOUR IMPORTS
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateMousePosition = (ev: any) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);
  return mousePosition;
};

interface LoginProps {
  onLogin: (user: User) => void;
  onBack: () => void; 
}


export const Login: React.FC<LoginProps> = ({ onLogin, onBack }) => {
  const mouse = useMousePosition();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false); // New state for modal
  const [isPasswordFocus, setIsPasswordFocus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  // --- NEW STATE FOR PASSWORD VISIBILITY ---
  const [showPassword, setShowPassword] = useState(false);

  // --- NEW FUNCTION FOR FORGOT PASSWORD ---
  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address above to reset your password.");
      return;
    }
    try {
      setIsLoading(true);
      setError(""); // Clear previous errors
      await sendPasswordResetEmail(auth, email);
  setToast({
        message: "Almost there! We've sent a secure reset link to your email. If you don't see it in a minute, please check your spam or junk folder—our messages sometimes end up there!",
        type: 'success'
      });
    } catch (err: any) {
      console.error(err);
      setToast({
        message: "Oops! There was an issue processing your request. Please check your email address and try again, or contact support.",
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  // Helper to map Firebase errors to friendly text
  const getFriendlyError = (code: string) => {
      switch (code) {
          case 'auth/invalid-email': return "Please enter a valid email address.";
          case 'auth/user-disabled': return "This account has been disabled.";
          case 'auth/user-not-found': return "No account found with this email.";
          case 'auth/wrong-password': return "Incorrect password.";
          case 'auth/email-already-in-use': return "Email is already registered. Try logging in.";
          case 'auth/weak-password': return "Password should be at least 6 characters.";
          case 'auth/invalid-credential': return "Invalid login credentials.";
          case 'auth/popup-closed-by-user': return "Sign in was canceled.";
          default: return "An authentication error occurred. Please try again.";
      }
  };

 const handleAuth = async (isGoogle: boolean = false, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        let user;
        let isNewUser = false;

        if (isGoogle) {
            const result = await signInWithPopup(auth, googleProvider);
            user = result.user;
            
            // Check if user exists in DB
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) isNewUser = true;
        } else {
            if (isSignup) {
                if (password.length < 6) throw new Error("Password must be 6+ chars.");
                if (password !== confirmPassword) throw new Error("Passwords do not match.");
                if (!agreedToTerms) throw new Error("Please read and agree to the Terms of Service.");

                const cred = await createUserWithEmailAndPassword(auth, email, password);
                user = cred.user;
                await updateProfile(user, { displayName: name });
                await sendEmailVerification(user);
                isNewUser = true;
            } else {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                user = cred.user;
            }
        }

        if (user) {
            // Check Ban Status
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.bannedUntil && data.bannedUntil > Date.now()) {
                    await auth.signOut();
                    throw new Error(`This account is banned until ${new Date(data.bannedUntil).toLocaleString()}`);
                }
            }

            if (isNewUser) {
                 await setDoc(doc(db, "users", user.uid), {
                    name: user.displayName || name || 'User',
                    email: user.email,
                    role: 'user',
                    createdAt: new Date().toISOString()
                });
            }

           // FIX: Don't sign out. Just let the App redirect them to Dashboard automatically.
            if (isSignup && !isGoogle) {
                
               await signOut(auth);
                setSignupSuccess(true);
            }
        }

    } catch (err: any) {
        console.error(err);
        if (err.message && !err.code) {
            setError(err.message);
        } else {
            setError(getFriendlyError(err.code));
        }
    }
    setIsLoading(false);
  };

  // --- TERMS MODAL COMPONENT ---
  const TermsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="text-blue-500" size={20}/> Terms of Service
                </h3>
                <button onClick={() => setShowTermsModal(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6 overflow-y-auto text-sm text-slate-300 space-y-6 leading-relaxed custom-scrollbar">
                <section>
                    <h4 className="text-white font-bold mb-2">1. Eligibility</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>You must be at least 16 years old to use this platform.</li>
                        <li>If you are under 18, you must have permission from a parent or legal guardian.</li>
                        <li>You must provide accurate information when creating an account.</li>
                    </ul>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">2. Purpose of the Platform</h4>
                    <p className="mb-2">The Platform is created solely for:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>Finding study partners.</li>
                        <li>Connecting through peer-to-peer video/audio chat.</li>
                        <li>Studying together.</li>
                    </ul>
                    <p className="mt-2 text-amber-400/80 italic">It is NOT a dating service, social network, or platform for personal interactions outside studying.</p>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">3. User Responsibilities</h4>
                    <p>By using the Platform, you agree to:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400 mt-2">
                        <li>Use the service respectfully and professionally.</li>
                        <li>Keep your account secure and not share your login credentials.</li>
                        <li>Immediately report any unsafe or inappropriate behavior.</li>
                        <li>Follow all applicable laws (your local laws + online safety regulations).</li>
                    </ul>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">4. Prohibited Behavior</h4>
                    <p className="text-red-400 font-medium mb-2">You are strictly forbidden from:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>Harassment, bullying, threats, or abusive language.</li>
                        <li>Sexual or inappropriate behavior of any kind (this includes sexual jokes, flirting, or requests).</li>
                        <li>Sharing or requesting personal data (phone number, address, school, social media, etc.).</li>
                        <li>Recording or taking screenshots of video/audio sessions.</li>
                        <li>Impersonating anyone or providing false identity info.</li>
                        <li>Any illegal activity.</li>
                    </ul>
                    <p className="mt-2 font-bold text-red-500">If you violate these rules, your account may be suspended or permanently banned.</p>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">5. Safety</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>All video sessions are peer-to-peer; the Platform does not store video or audio.</li>
                        <li>We recommend not sharing personal information during sessions.</li>
                        <li>Users should end a session and report the partner if they feel uncomfortable.</li>
                    </ul>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">6. Platform Limitations</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>The Platform does not guarantee successful matches or study results.</li>
                        <li>Sessions may disconnect due to network issues.</li>
                        <li>The Platform is provided “as is” without warranties.</li>
                    </ul>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">7. Privacy</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>We store only minimal data needed for login and matching.</li>
                        <li>We do not store or record video/audio from P2P sessions.</li>
                        <li>By using the Platform, you consent to the collection and processing of basic account data.</li>
                    </ul>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">8. Termination</h4>
                    <p>We reserve the right to suspend, limit, or permanently remove any account that violates these Terms or threatens user safety.</p>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">9. Changes to Terms</h4>
                    <p>We may update these Terms from time to time. Continued use of the Platform means you accept the updated Terms.</p>
                </section>

                <section>
                    <h4 className="text-white font-bold mb-2">10. Disclaimer</h4>
                    <p className="mb-2">The Platform provides a tool for users to connect for studying. We are not responsible for:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-400">
                        <li>The actions of individual users.</li>
                        <li>What users say or do during sessions.</li>
                        <li>Network failures or technical issues.</li>
                    </ul>
                    <p className="mt-2 font-bold">Use the Platform at your own risk.</p>
                </section>
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-950/50 rounded-b-2xl flex justify-end">
                <Button onClick={() => { setAgreedToTerms(true); setShowTermsModal(false); }}>
                    I Agree & Close
                </Button>
            </div>
        </div>
    </div>
  );

  // --- SIGNUP SUCCESS SCREEN ---
  if (signupSuccess) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-4">
             <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                 
                 <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/30">
                     <CheckCircle2 size={40} className="text-emerald-500" />
                 </div>
                 
                 <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
                 <p className="text-slate-400 mb-8 text-sm">
                     Welcome to the community. To ensure platform safety, we require one final step.
                 </p>

                 <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-3 mb-8">
                    <div className="flex items-start gap-3">
                        <div className="bg-emerald-500/20 p-1.5 rounded text-emerald-400 mt-0.5"><Mail size={14} /></div>
                        <div>
                            <span className="text-slate-200 font-medium text-sm block">Step 1: Verify Email</span>
                            <span className="text-slate-500 text-xs">We sent a link to <span className="text-slate-300">{email}</span></span>
                        </div>
                    </div>
                    <div className="w-px h-4 bg-slate-800 ml-4"></div>
                    <div className="flex items-start gap-3">
                        <div className="bg-blue-500/20 p-1.5 rounded text-blue-400 mt-0.5"><Lock size={14} /></div>
                        <div>
                            <span className="text-slate-200 font-medium text-sm block">Step 2: Login</span>
                            <span className="text-slate-500 text-xs">Sign in with your new credentials.</span>
                        </div>
                    </div>
                 </div>

                 <Button 
                    onClick={() => { setSignupSuccess(false); setIsSignup(false); }} 
                    className="w-full py-3 shadow-lg shadow-emerald-900/20"
                 >
                     Proceed to Login
                 </Button>
             </div>
        </div>
      );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
       {toast && (
        <ToastNotification
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
        />
      )}
      {/* --- START COOL BACKGROUND --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[#05050A]"></div>
        <div className="absolute inset-0 opacity-20" 
             style={{
                backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
                maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 100%)'
             }}>
        </div>
        <div 
          className="absolute w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          style={{ left: mouse.x, top: mouse.y }}
        />
      </div>
      {/* --- END COOL BACKGROUND --- */}
      {/* RENDER TERMS MODAL IF OPEN */}
      {showTermsModal && <TermsModal />}

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300">
        {/* --- BACK BUTTON START --- */}
        <button 
            onClick={onBack} 
            type="button"
            className="absolute top-4 left-4 text-slate-500 hover:text-white transition-colors z-20"
            title="Back to Home"
        >
            <ArrowLeft size={24} />
        </button>
        {/* --- BACK BUTTON END --- */}
        <div className="relative z-10 mb-2">
            <AuthMascot isHidden={isPasswordFocus} />
        </div>
        <div className="text-center mb-6 relative z-10">
          <div className="flex justify-center mb-4"><Logo className="w-10 h-10" /></div>
          <h2 className="text-2xl font-bold text-white mb-1">{isSignup ? "Create Account" : "Welcome Back"}</h2>
        </div>

        <form onSubmit={(e) => handleAuth(false, e)} className="space-y-4 relative z-10">
            {isSignup && (
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400 uppercase ml-1">Name</label>
                    <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm" placeholder="Name" required />
                    </div>
                </div>
            )}
            <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase ml-1">Email</label>
                <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm" placeholder="you@example.com" required />
                </div>
            </div>
          <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-400 uppercase ml-1">Password</label>
                    {/* Forgot Password Link (Only shows in Login mode) */}
                    {!isSignup && (
                        <button 
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Forgot password?
                        </button>
                    )}
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    
                    {/* Input type is now dynamic based on showPassword */}
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        onFocus={() => setIsPasswordFocus(true)} 
                        onBlur={() => setIsPasswordFocus(false)} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-10 text-white text-sm" // changed pr-4 to pr-10
                        placeholder="••••••••" 
                        required 
                    />

                    {/* Eye Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>
            {isSignup && (
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400 uppercase ml-1">Confirm</label>
                    <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setIsPasswordFocus(true)} onBlur={() => setIsPasswordFocus(false)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm" placeholder="••••••••" required />
                    </div>
                    {/* MODIFIED CHECKBOX AREA */}
                    <div className="flex items-center gap-2 pt-3">
                        <input 
                            type="checkbox" 
                            checked={agreedToTerms} 
                            onChange={(e) => setAgreedToTerms(e.target.checked)} 
                            className="w-4 h-4 rounded bg-slate-800 border-slate-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs text-slate-400">
                            I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-all">Terms of Service</button>
                        </span>
                    </div>
                </div>
            )}

            {error && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}

            <Button type="submit" className="w-full py-3" isLoading={isLoading}>
                {isSignup ? "Sign Up" : "Login"}
            </Button>
        </form>

        <div className="relative my-6">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
             <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or continue with</span></div>
        </div>

        <button 
            type="button" 
            onClick={() => handleAuth(true)}
            className="w-full bg-white text-black font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
        >
            <Chrome size={18} /> Google
        </button>

        <div className="mt-6 text-center">
            <button onClick={() => setIsSignup(!isSignup)} className="text-sm text-slate-400 hover:text-white">
                {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
            </button>
        </div>
      </div>
    </div>
  );
};
