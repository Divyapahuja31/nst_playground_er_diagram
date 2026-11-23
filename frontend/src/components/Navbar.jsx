import { useState, useRef, useEffect } from 'react';

export default function Navbar({
  question = null,
  user = null,
  onSave,
  saving = false,
  saveSuccess = false,
  onPublishToggle = null,
  onDeleteQuestion = null,
  isPublishing = false,
  onRevealSolution = null,
  loadingSolution = false,
  onOpenSqlSpec = null,
  onSubmit,
  submitting = false,
  submitError = null,
  onReset,
  onLogout,
  onBack,
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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

  const handleConfirmDelete = async () => {
    if (!onDeleteQuestion) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteQuestion();
      setShowDeleteModal(false);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete question');
    } finally {
      setIsDeleting(false);
    }
  };

  const isStudent = user?.role === 'STUDENT';
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isOwner =
    question &&
    (isTeacher ||
      String(user?.id).toLowerCase() === String(question.created_by || '').toLowerCase() ||
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
        {question?.title ? (
          <span className="font-sans text-[15px] font-bold text-neutral-900 truncate max-w-[280px]">
            {question.title}
          </span>
        ) : (
          <div className="h-5 w-36 bg-neutral-200/60 rounded-md animate-pulse my-auto" />
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Reset Canvas Button */}
        <button
          className="w-9 h-9 rounded-lg border border-neutral-300 bg-neutral-0 text-neutral-700 flex items-center justify-center cursor-pointer shadow-xs transition-all duration-200 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-none"
          title="Reset"

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
            
            {onOpenSqlSpec && (
              <button
                type="button"
                onClick={onOpenSqlSpec}
                className="px-3.5 h-9 rounded-lg font-bold text-[13px] border border-neutral-300 bg-neutral-0 hover:bg-neutral-100 text-neutral-800 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Configure and manage SQL test queries for this question"
              >
                <span>⚙️ SQL Test Queries</span>
                {question?.has_spec && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Query validation active" />
                )}
              </button>
            )}

            {onPublishToggle && (
              <button
                onClick={onPublishToggle}
                disabled={isPublishing}
                className={`px-3.5 h-9 rounded-lg font-bold text-[13px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                  question?.is_published
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-600'
                    : 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-500'
                }`}
                title={question?.is_published ? 'Click to unpublish question (hide from students)' : 'Click to publish question (make visible to students)'}
              >
                {isPublishing ? (
                  <>
                    <span className="animate-spin mr-1">🌀</span>
                    Updating…
                  </>
                ) : question?.is_published ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Published (Click to Unpublish)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Publish Question</span>
                  </>
                )}
              </button>
            )}

            {onDeleteQuestion && (
              <button
                onClick={() => {
                  setDeleteError('');
                  setShowDeleteModal(true);
                }}
                className="px-3 h-9 rounded-lg font-bold text-[13px] border border-red-200 text-red-600 bg-red-50/40 hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer flex items-center gap-1.5"
                title="Delete this question permanently"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <span>Delete</span>
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
                '🚀 Submit Solution'
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

      {/* IN-APP DELETE CONFIRMATION MODAL (NO BROWSER POPUP) */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl border border-neutral-200/90 shadow-2xl overflow-hidden p-6 flex flex-col gap-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className="grow">
                <h3 className="text-[17px] font-extrabold text-neutral-900 m-0">Delete Question</h3>
                <p className="text-[13px] text-neutral-500 m-0 mt-1.5 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-neutral-800 font-bold">"{question?.title || 'this question'}"</strong>? All student submissions and workspace diagrams will also be removed.
                </p>
                {deleteError && (
                  <div className="mt-2.5 p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[12px] font-medium">
                    {deleteError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-neutral-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-bold text-[13px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] shadow-sm transition-all cursor-pointer flex items-center gap-2 border-none"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin text-white">🌀</span>
                    Deleting…
                  </>
                ) : (
                  'Yes, Delete Question'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
