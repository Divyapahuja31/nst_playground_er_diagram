import { useState, useRef, useEffect } from 'react';

export default function Navbar({
  question = null,
  user = null,
  onSave,
  saving = false,
  saveSuccess = false,
  onPublishToggle = null,
  isPublishing = false,
  onRevealSolution = null,
  loadingSolution = false,
  onSubmit,
  submitting = false,
  submitError = null,
  onReset,
  onLogout,
  onBack,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getInitials = () => {
    if (!user || !user.full_name) return '??';
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const isStudent = user?.role === 'STUDENT';
  const isOwner =
    question &&
    (String(user?.id).toLowerCase() === String(question.created_by || '').toLowerCase() ||
      String(user?.id).toLowerCase() === String(question.owner_id || '').toLowerCase() ||
      user?.role === 'ADMIN');
  const isReviewingTeacher = !isStudent && !isOwner;

  return (
    <header className="h-14 min-h-[56px] bg-neutral-0 border-b border-neutral-300 flex justify-between items-center px-6 box-border z-10 font-sans">
      <div className="flex items-center gap-4">
        {onBack && (
          <>
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-transparent border-none text-neutral-900 font-sans text-[14px] font-bold cursor-pointer py-2 transition-opacity duration-200 hover:opacity-80"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="13" y1="8" x2="3" y2="8"></line>
                <polyline points="7 12 3 8 7 4"></polyline>
              </svg>
              <span>Back</span>
            </button>
            <div className="w-[1px] h-5 bg-neutral-300"></div>
          </>
        )}
        <span className="font-sans text-[15px] font-bold text-neutral-900 truncate max-w-[280px]">
          {question?.title || 'ER Diagram Question'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Reset Canvas Button */}
        <button
          className="w-9 h-9 rounded-lg border border-neutral-300 bg-neutral-0 text-neutral-700 flex items-center justify-center cursor-pointer shadow-xs transition-all duration-200 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-none"
          title="Reset Canvas"
          onClick={onReset}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>

        {/* ── ROLE 1: QUESTION OWNER / TEACHER CREATOR ── */}
        {isOwner && (
          <>
            <button
              onClick={onSave}
              disabled={saving}
              className={`px-3.5 h-9 rounded-lg font-bold text-[13px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                saveSuccess
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-neutral-300 bg-neutral-0 text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {saving ? (
                <>
                  <span className="animate-spin text-neutral-500 mr-1">🌀</span>
                  Saving…
                </>
              ) : saveSuccess ? (
                '✓ Saved Solution'
              ) : (
                '💾 Save Solution'
              )}
            </button>

            {onPublishToggle && (
              <button
                onClick={onPublishToggle}
                disabled={isPublishing}
                className={`px-3.5 h-9 rounded-lg font-bold text-[13px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                  question?.is_published
                    ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {isPublishing ? (
                  <>
                    <span className="animate-spin mr-1">🌀</span>
                    Updating…
                  </>
                ) : question?.is_published ? (
                  '✓ Published'
                ) : (
                  'Publish Question'
                )}
              </button>
            )}
          </>
        )}

        {/* ── ROLE 2: REVIEWING TEACHER (Other Teacher) ── */}
        {isReviewingTeacher && (
          <>
            <button
              onClick={onSave}
              disabled={saving}
              className={`px-3.5 h-9 rounded-lg font-bold text-[13px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                saveSuccess
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-neutral-300 bg-neutral-0 text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {saving ? (
                <>
                  <span className="animate-spin text-neutral-500 mr-1">🌀</span>
                  Saving…
                </>
              ) : saveSuccess ? (
                '✓ Saved Attempt'
              ) : (
                '💾 Save My Attempt'
              )}
            </button>

            {onRevealSolution && (
              <button
                onClick={onRevealSolution}
                disabled={loadingSolution}
                className="px-3.5 h-9 rounded-lg font-bold text-[13px] border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {loadingSolution ? (
                  <>
                    <span className="animate-spin mr-1">🌀</span>
                    Loading Solution…
                  </>
                ) : (
                  '👁 Reveal Official Solution'
                )}
              </button>
            )}
          </>
        )}

        {/* ── ROLE 3: STUDENT ── */}
        {isStudent && (
          <>
            <button
              onClick={onSave}
              disabled={saving}
              className={`px-3.5 h-9 rounded-lg font-bold text-[13px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                saveSuccess
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-neutral-300 bg-neutral-0 text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {saving ? (
                <>
                  <span className="animate-spin text-neutral-500 mr-1">🌀</span>
                  Saving…
                </>
              ) : saveSuccess ? (
                '✓ Saved'
              ) : (
                '💾 Save'
              )}
            </button>

            <button
              onClick={onSubmit}
              disabled={submitting}
              className="px-4 h-9 rounded-lg border-none bg-brand-500 text-white font-bold text-[13px] hover:bg-brand-400 cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="animate-spin mr-1">🌀</span>
                  Submitting…
                </>
              ) : (
                '🚀 Submit'
              )}
            </button>
          </>
        )}

        {submitError && (
          <span className="text-[11px] text-red-600 font-semibold max-w-[160px] truncate" title={submitError}>
            {submitError}
          </span>
        )}

        {/* User Profile Widget */}
        <div className="relative ml-2" ref={profileRef}>
          <div
            className="w-9 h-9 rounded-full bg-brand-500 text-neutral-0 flex items-center justify-center font-sans text-[12px] font-bold cursor-pointer transition-all duration-200 hover:scale-105 hover:bg-brand-600 shadow-sm"
            title="User Profile"
            onClick={() => setShowProfileMenu((v) => !v)}
          >
            {getInitials()}
          </div>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-neutral-0 border border-neutral-300 rounded-xl shadow-xl py-2 z-50 animate-fadeIn">
              {user && (
                <div className="px-4 py-2.5 border-b border-neutral-200">
                  <p className="text-[13px] font-bold text-neutral-950 truncate m-0">{user.full_name}</p>
                  <p className="text-[11px] text-neutral-500 truncate m-0 mt-0.5">{user.email}</p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-brand-50 text-[10px] text-brand-700 font-bold tracking-wide uppercase">
                    {user.role}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="w-full text-left px-4 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
