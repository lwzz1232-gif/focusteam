import React from 'react';
import { Logo } from '../components/Logo';

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onSignIn }) => {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
      
      {/* Subtle gradient background - same style as your app */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/10 blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-900/10 blur-3xl"></div>
      </div>

      {/* Simple nav - matches your existing nav style */}
      <nav className="relative z-10 h-16 border-b border-slate-900 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight">FocusTwin</span>
        </div>
        <button 
          onClick={onSignIn}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Sign in
        </button>
      </nav>

      {/* Hero - centered, lots of breathing room */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-2xl text-center space-y-8">
          
          <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            Work quietly<br />with someone else
          </h1>
          
          <p className="text-xl text-slate-400 max-w-xl mx-auto">
            You both turn on your cameras. You work in silence. That's it.
          </p>

          <button 
            onClick={onGetStarted}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/20"
          >
            Find a partner
          </button>

        </div>
      </div>

      {/* How it works - very simple, matches your config UI style */}
      <div className="relative z-10 border-t border-slate-900 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          
          <div className="grid md:grid-cols-3 gap-16">
            
            <div className="space-y-3">
              <div className="text-5xl font-bold text-slate-800">1</div>
              <h3 className="text-lg font-semibold">Pick your time</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Choose what you're working on and how long.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-5xl font-bold text-slate-800">2</div>
              <h3 className="text-lg font-semibold">Get matched</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                We find someone working at the same time.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-5xl font-bold text-slate-800">3</div>
              <h3 className="text-lg font-semibold">Work together</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Say hello. Then work quietly side by side.
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* Why it helps - honest, no selling */}
      <div className="relative z-10 border-t border-slate-900 py-24 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          
          <h2 className="text-3xl font-bold text-center">
            Why it helps
          </h2>

          <div className="space-y-8">
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold mb-2">You show up</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Someone is waiting. So you follow through.
              </p>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold mb-2">You stay focused</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                The camera keeps you honest. No scrolling, no wandering off.
              </p>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold mb-2">You feel less stuck</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Working alone can feel heavy. A quiet partner makes it lighter.
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* Simple questions - matches your modal style */}
      <div className="relative z-10 border-t border-slate-900 py-24 px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          
          <h2 className="text-2xl font-bold text-center mb-12">
            Questions
          </h2>

          <details className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer font-semibold hover:bg-slate-900/50 transition-colors">
              Do I have to talk?
            </summary>
            <p className="px-6 pb-4 text-sm text-slate-400 leading-relaxed">
              No. You say hello at the start. Then you work quietly. That's the whole point.
            </p>
          </details>

          <details className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer font-semibold hover:bg-slate-900/50 transition-colors">
              What if my partner is weird?
            </summary>
            <p className="px-6 pb-4 text-sm text-slate-400 leading-relaxed">
              End the session. Report them. We remove people who don't follow the rules.
            </p>
          </details>

          <details className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer font-semibold hover:bg-slate-900/50 transition-colors">
              Is it free?
            </summary>
            <p className="px-6 pb-4 text-sm text-slate-400 leading-relaxed">
              Yes. Completely free.
            </p>
          </details>

          <details className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer font-semibold hover:bg-slate-900/50 transition-colors">
              Do you record sessions?
            </summary>
            <p className="px-6 pb-4 text-sm text-slate-400 leading-relaxed">
              Never. Sessions are peer-to-peer. Nothing is stored.
            </p>
          </details>

        </div>
      </div>

      {/* Final CTA - calm, confident */}
      <div className="relative z-10 border-t border-slate-900 py-24 px-6">
        <div className="max-w-xl mx-auto text-center space-y-8">
          
          <h2 className="text-4xl font-bold">
            Start working
          </h2>
          
          <p className="text-lg text-slate-400">
            Find someone. Turn on your camera. Get it done.
          </p>

          <button 
            onClick={onGetStarted}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/20"
          >
            Get started
          </button>

        </div>
      </div>

      {/* Footer - matches your existing footer */}
      <footer className="relative z-10 border-t border-slate-900 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            © 2025 FocusTwin
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <a href="#" className="hover:text-slate-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
