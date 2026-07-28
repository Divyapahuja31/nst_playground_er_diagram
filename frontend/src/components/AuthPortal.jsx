import { useState } from 'react';

export default function AuthPortal({ onLogin, onRegister, authError }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('STUDENT'); // STUDENT, TEACHER

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password || (!isLogin && !fullName)) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    let success = false;
    
    if (isLogin) {
      success = await onLogin(email, password);
    } else {
      success = await onRegister(fullName, email, password, role);
    }
    
    setLoading(false);
  };

  const activeError = error || authError;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-neutral-50 via-brand-50/20 to-violet-50/20 p-6 font-sans relative overflow-hidden">
      
      {/* Soft Ambient Background Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-200/40 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-200/40 blur-[120px] pointer-events-none" />

      {/* Premium Light Auth Card Container */}
      <div className="relative w-full max-w-md bg-white/75 backdrop-blur-xl border border-white/80 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-300">
        
        {/* Logo/Identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/10 mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h2 className="text-[22px] font-bold text-neutral-900 tracking-tight">
            ER Diagram Evaluator
          </h2>
          <p className="text-[12px] text-neutral-500 mt-1">
            Build, validate, and master entity relationships.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-neutral-100 p-1 rounded-xl mb-6 border border-neutral-200/50">
          <button
            type="button"
            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
              isLogin 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
              !isLogin 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Auth Error Banner */}
        {activeError && (
          <div className="mb-5 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[12px] font-medium leading-relaxed flex items-start gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{activeError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Full Name (Sign Up only) */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-white/80 text-[13px] text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all placeholder-neutral-400"
              />
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-white/80 text-[13px] text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all placeholder-neutral-400"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-white/80 text-[13px] text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all placeholder-neutral-400"
            />
          </div>

          {/* Role selector (Sign Up only) */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Join As</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('STUDENT')}
                  className={`h-11 rounded-xl border font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    role === 'STUDENT'
                      ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-sm'
                      : 'border-neutral-200 bg-white/50 text-neutral-600 hover:bg-white hover:text-neutral-800'
                  }`}
                >
                  🎓 Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('TEACHER')}
                  className={`h-11 rounded-xl border font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    role === 'TEACHER'
                      ? 'border-brand-500 bg-brand-50 text-brand-600 shadow-sm'
                      : 'border-neutral-200 bg-white/50 text-neutral-600 hover:bg-white hover:text-neutral-800'
                  }`}
                >
                  🏫 Teacher
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white font-bold text-[13px] shadow-lg shadow-brand-500/15 hover:from-brand-500 hover:to-violet-500 hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>

        </form>

      </div>
    </div>
  );
}
