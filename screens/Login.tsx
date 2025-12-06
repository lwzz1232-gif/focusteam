import React, { useState } from 'react';
import { Button } from '../components/Button';
import { User } from '../types';
import { auth, db, googleProvider } from '../utils/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Lock, Mail, User as UserIcon, AlertCircle, CheckSquare, CheckCircle2, Chrome } from 'lucide-react';
import { AuthMascot } from '../components/AuthMascot';
import { Logo } from '../components/Logo';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isPasswordFocus, setIsPasswordFocus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

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
                if (!agreedToTerms) throw new Error("Please agree to terms.");

                const cred = await createUserWithEmailAndPassword(auth, email, password);
                user = cred.user;
                await updateProfile(user, { displayName: name });
                await sendEmailVerification(user);
                isNewUser = true;
            } else {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                user = cred.user;
                
                // Note: Auth Hook also handles this, but good for immediate feedback
                // We let the auth hook handle strict enforcement to avoid double logic, 
                // but we can warn here if needed.
            }
        }

        if (user) {
            // Check Ban Status immediately (Redundant check for better UX speed)
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

            // If it's a new signup with password, show verification screen instead of logging in
            if (isSignup && !isGoogle) {
                setSignupSuccess(true);
            } else {
                 // Login success handled by global auth listener
            }
        }

    } catch (err: any) {
        console.error(err);
        // Use custom message if thrown, otherwise map firebase code
        if (err.message && !err.code) {
            setError(err.message);
        } else {
            setError(getFriendlyError(err.code));
        }
    }
    setIsLoading(false);
  };

  if (signupSuccess) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
             <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center">
                 <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Mail size={32} className="text-emerald-500" />
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
                 <p className="text-slate-400 mb-6">We sent a verification link to <b>{email}</b>.<br/>Please check your inbox to continue.</p>
                 <Button onClick={() => { setSignupSuccess(false); setIsSignup(false); }} variant="secondary">
                     Back to Login
                 </Button>
             </div>
        </div>
      );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300">
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
                <label className="text-xs font-medium text-slate-400 uppercase ml-1">Password</label>
                <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setIsPasswordFocus(true)} onBlur={() => setIsPasswordFocus(false)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm" placeholder="••••••••" required />
                </div>
            </div>
            {isSignup && (
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400 uppercase ml-1">Confirm</label>
                    <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setIsPasswordFocus(true)} onBlur={() => setIsPasswordFocus(false)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm" placeholder="••••••••" required />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="rounded bg-slate-800 border-slate-600"/>
                        <span className="text-xs text-slate-400">Agree to terms</span>
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
