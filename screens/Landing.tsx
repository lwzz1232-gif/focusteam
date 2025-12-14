import React, { useEffect, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { ArrowRight, CheckCircle2, Clock, Users, Zap, ShieldCheck, Play, ChevronDown, HelpCircle } from 'lucide-react';

// --- 1. UTILITY: FADE IN COMPONENT (Unchanged - works great) ---
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 } 
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// --- 2. UTILITY: ACCORDION ITEM (For the new FAQ) ---
const AccordionItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-800">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left hover:bg-slate-900/30 transition-colors px-2 rounded-lg"
      >
        <span className="font-medium text-lg text-slate-200">{question}</span>
        <ChevronDown 
          className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-48 opacity-100 pb-6' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-slate-400 leading-relaxed px-2 pr-8">
          {answer}
        </p>
      </div>
    </div>
  );
};

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onSignIn }) => {
  
  // Handle Smooth Scroll to "How it works"
  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30 overflow-x-hidden font-sans">
      
      {/* --- ANIMATED BACKGROUND AMBIANCE --- */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-white/5 blur-[100px] rounded-full animate-pulse" />
        
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full mix-blend-screen animate-[float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] left-1/4 w-[800px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-[float_15s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-purple-600/8 blur-[100px] rounded-full mix-blend-screen animate-[float_18s_ease-in-out_infinite]" />
        
        {/* Animated grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
        
        {/* Grain overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${10 + Math.random() * 20}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-40px) translateX(-10px); }
          75% { transform: translateY(-20px) translateX(5px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[95vh] flex flex-col items-center justify-center px-6 pt-20 pb-32">
        
        {/* Top Nav */}
        <nav className="absolute top-0 w-full max-w-7xl mx-auto p-6 flex justify-between items-center z-50">
           <div className="w-20"></div> {/* Spacer for centering */}
           <button 
             onClick={onSignIn}
             className="text-sm font-medium text-slate-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5"
           >
             Login
           </button>
        </nav>

        <div className="text-center max-w-4xl mx-auto space-y-8 z-10">
          
          {/* Logo */}
          <FadeIn>
            <div className="flex justify-center mb-8">
              <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-700/50 shadow-2xl shadow-blue-500/10 backdrop-blur-md">
                <Logo className="w-16 h-16 md:w-20 md:h-20" />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4 drop-shadow-xl">
              <span className="inline-block text-white hover:scale-105 transition-transform duration-300 cursor-default">
                FocusTwin
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-light tracking-wide max-w-2xl mx-auto">
              Don't work alone. Work together.<br/>
              <span className="text-slate-500 text-lg inline-flex items-center gap-2 mt-2">
                The quietest productivity community on earth.
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </span>
            </p>
          </FadeIn>

          <FadeIn delay={400}>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mt-8">
              <button 
                onClick={onGetStarted}
                className="group relative px-8 py-4 bg-white text-black font-bold rounded-full text-lg hover:bg-slate-200 transition-all flex items-center gap-2 overflow-hidden shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)] hover:shadow-[0_0_80px_-5px_rgba(255,255,255,0.7)] hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_ease-in-out]" />
                <span>Start Session</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button 
                onClick={scrollToHowItWorks} 
                className="px-8 py-4 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 font-medium border border-transparent hover:border-slate-700 hover:scale-105 active:scale-95"
              >
                <Play size={18} /> How it works
              </button>
            </div>
          </FadeIn>
          
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 animate-bounce text-slate-500">
           <div className="w-px h-12 bg-gradient-to-b from-slate-500 to-transparent mx-auto"></div>
        </div>
      </section>


      {/* --- THE PROBLEM & SOLUTION (Images Added) --- */}
      <section className="relative z-10 py-32 px-6 border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="grid md:grid-cols-2 gap-20 items-center">
              
              {/* Text Side */}
              <div className="order-2 md:order-1">
                <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-white">
                  The silence of <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    shared accountability.
                  </span>
                </h2>
                <p className="text-lg text-slate-300 leading-relaxed mb-8">
                  Procrastination feeds on isolation. When you're alone, it's easy to pick up your phone. 
                  But when someone is on the other side of the screen working with you, the dynamic changes.
                </p>
                
                <div className="space-y-4">
                  {[
                    "No small talk. Just deep work.",
                    "50-minute matched sessions.",
                    "Strict community guidelines."
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-300">
                      <div className="p-1 rounded-full bg-blue-500/20 text-blue-400">
                        <CheckCircle2 size={16} />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Side - ENHANCED INTERFACE */}
              <div className="order-1 md:order-2 relative">
                  {/* Animated glow effect behind images */}
                  <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full opacity-50 animate-pulse"></div>
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-2xl opacity-30 animate-[spin_10s_linear_infinite]"></div>
                  
                  {/* The "Interface" Container */}
                  <div className="relative z-10 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-2 shadow-2xl rotate-3 hover:rotate-0 transition-all duration-500 hover:scale-105">
                    
                    {/* Fake Window Header */}
                    <div className="flex items-center gap-2 mb-2 px-2">
                       <div className="w-3 h-3 rounded-full bg-red-500/50 hover:bg-red-500 transition-colors cursor-pointer"></div>
                       <div className="w-3 h-3 rounded-full bg-yellow-500/50 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
                       <div className="w-3 h-3 rounded-full bg-green-500/50 hover:bg-green-500 transition-colors cursor-pointer"></div>
                       <div className="ml-auto flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-[10px] text-red-400 font-bold animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div> LIVE
                       </div>
                    </div>

                    {/* The Grid of 2 Users */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* User 1 */}
                        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-800 group">
                           <img 
                             src="https://images.unsplash.com/photo-1664575602276-acd073f104c1?q=80&w=600&auto=format&fit=crop" 
                             alt="Person focusing"
                             className="object-cover w-full h-full opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                           <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                             You
                           </div>
                        </div>

                        {/* User 2 */}
                        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-800 group">
                           <img 
                             src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop" 
                             alt="Partner focusing"
                             className="object-cover w-full h-full opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                           <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] text-white flex items-center gap-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                             Sarah (Partner)
                           </div>
                        </div>
                    </div>

                    {/* Enhanced Fake Controls */}
                    <div className="mt-2 flex justify-center gap-4 py-1">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-400 hover:border-blue-500 hover:scale-110 transition-all cursor-pointer"><Zap size={14}/></div>
                        <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 hover:bg-red-500/30 hover:scale-110 transition-all cursor-pointer"><Play size={14} fill="currentColor"/></div>
                    </div>

                  </div>
              </div>

            </div>
          </FadeIn>
        </div>
      </section>


      {/* --- ANIMATED STATS SECTION --- */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { number: "47K+", label: "Active Users", gradient: "from-blue-400 to-cyan-400" },
                { number: "2.3M", label: "Sessions Completed", gradient: "from-purple-400 to-pink-400" },
                { number: "94%", label: "Completion Rate", gradient: "from-green-400 to-emerald-400" },
                { number: "156", label: "Countries", gradient: "from-orange-400 to-red-400" }
              ].map((stat, idx) => (
                <div key={idx} className="text-center group hover:scale-110 transition-transform duration-300">
                  <div className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-2 group-hover:animate-pulse`}>
                    {stat.number}
                  </div>
                  <div className="text-slate-400 text-sm uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>


      {/* --- HOW IT WORKS (Glass Cards + ID for scroll) --- */}
      <section id="how-it-works" className="relative z-10 py-32 px-6 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-sm font-bold tracking-widest text-blue-400 uppercase mb-12 text-center">
              The Workflow
            </h2>
          </FadeIn>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: Clock, 
                title: "Set Intentions", 
                desc: "Choose a time. Define your task. Commit to showing up.",
                color: "from-blue-500 to-cyan-500"
              },
              { 
                icon: Users, 
                title: "Pair Up", 
                desc: "Our algorithm matches you with a partner globally.",
                color: "from-purple-500 to-pink-500"
              },
              { 
                icon: ShieldCheck, 
                title: "Deep Work", 
                desc: "Cameras on. Microphones off. 50 minutes of pure focus.",
                color: "from-green-500 to-emerald-500"
              }
            ].map((step, idx) => (
              <FadeIn key={idx} delay={idx * 150}>
                <div className="relative group h-full p-8 rounded-2xl bg-slate-900/40 border border-slate-700/50 hover:bg-slate-800/60 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center text-white mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-black/20 ring-1 ring-white/10`}>
                    <step.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 transition-all">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{step.desc}</p>
                  
                  {/* Animated border on hover */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 blur transition-opacity -z-10"></div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>


      {/* --- SOCIAL PROOF / TESTIMONIALS --- */}
      <section className="relative z-10 py-24 px-6 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-sm font-bold tracking-widest text-purple-400 uppercase mb-12 text-center">
              What People Are Saying
            </h2>
          </FadeIn>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I've tried every productivity app. This is the only one that actually works. The accountability is real.",
                author: "Marcus Chen",
                role: "Software Engineer",
                avatar: "MC"
              },
              {
                quote: "As someone with ADHD, having a partner on screen transforms my ability to focus. It's life-changing.",
                author: "Sarah Williams",
                role: "PhD Student",
                avatar: "SW"
              },
              {
                quote: "No fluff, no distractions. Just two people working. Exactly what I needed.",
                author: "James Rodriguez",
                role: "Entrepreneur",
                avatar: "JR"
              }
            ].map((testimonial, idx) => (
              <FadeIn key={idx} delay={idx * 100}>
                <div className="group p-6 rounded-2xl bg-gradient-to-br from-slate-900/60 to-slate-800/40 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{testimonial.author}</div>
                      <div className="text-xs text-slate-500">{testimonial.role}</div>
                    </div>
                  </div>
                  <p className="text-slate-300 italic leading-relaxed">"{testimonial.quote}"</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>


      {/* --- QUESTIONS (New Section) --- */}
      <section className="relative z-10 py-24 px-6 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Common Questions</h2>
              <p className="text-slate-400">Everything you need to know before your first session.</p>
            </div>
            
            <div className="space-y-2">
              <AccordionItem 
                question="Do I have to talk to my partner?" 
                answer="No. You greet each other briefly at the start ('Hi, I'm working on coding today'), then you mute your microphone. The goal is silence." 
              />
              <AccordionItem 
                question="Is this free?" 
                answer="Yes. FocusTwin is currently completely free to use. In the future, we may introduce premium features, but the core matching will remain accessible." 
              />
              <AccordionItem 
                question="Do I need a webcam?" 
                answer="Yes. The psychology of the platform relies on 'body doubling'—being seen working helps you work. However, we do not record or store any video." 
              />
              <AccordionItem 
                question="What if my partner is inappropriate?" 
                answer="We have a zero-tolerance policy. You can end the session instantly and report the user. They will be banned from the platform." 
              />
            </div>
          </FadeIn>
        </div>
      </section>


      {/* --- FINAL CTA WITH DRAMATIC EFFECTS --- */}
      <section className="relative py-32 flex items-center justify-center overflow-hidden">
        {/* Multiple animated glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 blur-[120px] rounded-full animate-[spin_20s_linear_infinite]" />
        
        <div className="relative z-10 text-center px-6">
          <FadeIn>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              <span className="text-white hover:scale-105 inline-block transition-transform">Ready to </span>
              <span className="italic font-serif text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-[gradient_3s_ease_infinite] hover:scale-110 inline-block transition-transform cursor-default">
                focus?
              </span>
            </h2>
            <button 
              onClick={onGetStarted}
              className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-full text-xl shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 hover:-translate-y-1 transition-all duration-300 overflow-hidden hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out]" />
              <span className="relative">Get Matched Now</span>
            </button>
            <p className="mt-6 text-sm text-slate-400 flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              1,247 people working right now
            </p>
          </FadeIn>
        </div>
      </section>

      {/* --- FOOTER (Polished) --- */}
      <footer className="border-t border-slate-900 py-12 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          
          <div className="flex items-center gap-2">
            <Logo className="w-6 h-6 grayscale opacity-50 hover:opacity-100 transition-opacity" />
            <span className="font-bold text-slate-500 hover:text-slate-300 transition-colors cursor-default">FocusTwin</span>
          </div>

          <div className="flex gap-8 text-sm">
             {/* Note: In a real app, these would be <Link to="/privacy"> or trigger a modal */}
            <button className="text-slate-500 hover:text-white transition-colors" onClick={() => alert("Privacy Policy would open here.")}>Privacy</button>
            <button className="text-slate-500 hover:text-white transition-colors" onClick={() => alert("Terms of Service would open here.")}>Terms</button>
            <button className="text-slate-500 hover:text-white transition-colors" onClick={() => window.location.href = "mailto:support@focustwin.com"}>Contact</button>
          </div>

          <div className="text-xs text-slate-600">
            © 2025 FocusTwin Inc.
          </div>
        </div>
      </footer>

    </div>
  );
};
