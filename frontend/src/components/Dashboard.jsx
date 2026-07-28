import { useState, useEffect } from 'react';
import { fetchQuestions, createQuestion, updateQuestion, deleteQuestion } from '../api';

export default function Dashboard({ user, onSelectQuestion, onLogout }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  
  // Modal states for Teacher question creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState('');

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await fetchQuestions();
      setQuestions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!title || !desc) {
      setError('Title and Description are required.');
      return;
    }

    setIsCreating(true);
    try {
      const emptySolution = { tables: [], edges: [] };
      await createQuestion({
        title,
        question: desc,
        solution: emptySolution,
        reviewer_email: reviewerEmail || null,
        owner_email: ownerEmail || null
      });
      setShowCreateModal(false);
      resetForm();
      loadQuestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Prevent card selection click
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteQuestion(id);
      loadQuestions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTogglePublish = async (id, currentStatus, e) => {
    e.stopPropagation(); // Prevent card selection click
    try {
      await updateQuestion(id, {
        is_published: !currentStatus
      });
      loadQuestions();
    } catch (err) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDesc('');
    setReviewerEmail('');
    setOwnerEmail('');
    setError('');
  };

  const getInitials = () => {
    if (!user || !user.full_name) return '??';
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Filters logic
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (q.question && q.question.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDifficulty = difficultyFilter === 'All' || q.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="w-full h-screen overflow-y-auto bg-[#f8fafc] px-8 py-10 font-sans text-neutral-800 flex flex-col items-center scrollbar-thin box-border">
      <div className="w-full max-w-6xl">
        
        {/* Top Header Bar */}
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-neutral-200/70">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-extrabold uppercase tracking-wider">
                {user?.role} Dashboard
              </span>
            </div>
            <h1 className="text-[28px] font-extrabold text-neutral-900 tracking-tight m-0">
              Welcome back, {user?.full_name || 'User'}
            </h1>
            <p className="text-[14px] text-neutral-500 m-0 mt-1">
              Select an ER diagram assignment below to start modeling.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isTeacher && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-[13px] shadow-sm hover:shadow transition-all duration-200 border-none cursor-pointer flex items-center gap-1.5"
              >
                + Create Question
              </button>
            )}

            {/* Profile & Sign Out Widget */}
            <div className="flex items-center gap-3 pl-3 border-l border-neutral-200">
              <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[13px] shadow-sm">
                {getInitials()}
              </div>
              <button
                onClick={onLogout}
                className="px-3 py-2 rounded-xl text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors border border-red-200 bg-white cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs mb-6">
          <div className="flex items-center gap-2 grow max-w-md bg-[#f1f5f9] rounded-xl px-3.5 py-2 border border-neutral-200/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-neutral-400">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search assignment questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] text-neutral-900 w-full placeholder-neutral-400 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Difficulty:</span>
            {['All', 'EASY', 'MEDIUM', 'HARD'].map((level) => (
              <button
                key={level}
                onClick={() => setDifficultyFilter(level)}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border-none cursor-pointer transition-all ${
                  difficultyFilter === level
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Questions Catalog */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="w-9 h-9 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mb-3"></div>
            <span className="text-[14px] text-neutral-500 font-medium">Loading questions catalog...</span>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center shadow-xs">
            <p className="text-[14px] text-neutral-500 m-0">No questions match your current search criteria.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 pb-16">
            {filteredQuestions.map((q) => {
              const userIdStr = String(user?.id || '').toLowerCase();
              const canManage = userIdStr === String(q.created_by || '').toLowerCase() ||
                                userIdStr === String(q.owner_id || '').toLowerCase() ||
                                user?.role === 'ADMIN';
              const isReviewer = userIdStr === String(q.reviewer_id || '').toLowerCase();

              // Difficulty Badge Styles
              let diffBadgeClass = 'bg-green-50 text-green-700 border-green-200';
              if (q.difficulty === 'HARD') diffBadgeClass = 'bg-red-50 text-red-700 border-red-200';
              else if (q.difficulty === 'MEDIUM') diffBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

              return (
                <div
                  key={q.id}
                  onClick={() => onSelectQuestion(q.id)}
                  className="flex items-center justify-between bg-white border border-neutral-200/80 hover:border-brand-500/50 p-5 rounded-2xl shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-4 grow">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-[14px] shrink-0">
                      ER
                    </div>
                    <div className="grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-bold text-neutral-900 group-hover:text-brand-600 transition-colors m-0">
                          {q.title}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${diffBadgeClass}`}>
                          {q.difficulty || 'MEDIUM'}
                        </span>
                        {q.is_published ? (
                          <span className="px-2 py-0.5 rounded-md bg-green-50 border border-green-200 text-green-700 text-[9px] font-bold uppercase tracking-wider">Published</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-600 text-[9px] font-bold uppercase tracking-wider">Draft</span>
                        )}
                        {isReviewer && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-600 text-[9px] font-bold uppercase tracking-wider">Reviewer</span>
                        )}
                      </div>
                      <p className="text-[12px] text-neutral-500 m-0 mt-1 max-w-xl truncate">
                        {q.question || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Actions / CTA Area */}
                  <div className="flex items-center gap-3.5 ml-4 shrink-0">
                    {/* Teacher Manage Tools */}
                    {canManage && (
                      <div className="flex items-center gap-2 border-r border-neutral-200 pr-3.5 mr-1">
                        <button
                          onClick={(e) => handleTogglePublish(q.id, q.is_published, e)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border-none cursor-pointer transition-colors ${
                            q.is_published
                              ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                          title={q.is_published ? 'Unpublish question' : 'Publish question'}
                        >
                          {q.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={(e) => handleDelete(q.id, e)}
                          className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors border-none bg-transparent cursor-pointer"
                          title="Delete assignment"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <span className="text-[12px] font-bold text-brand-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Solve Assignment
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* CREATE QUESTION MODAL (TEACHERS ONLY) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200/50 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-6 py-4.5 border-b border-neutral-100 bg-[#f8fafc] flex justify-between items-center shrink-0">
              <h2 className="text-[16px] font-extrabold text-neutral-900 m-0">Create New Assignment</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-[12px] font-bold text-neutral-400 hover:text-neutral-700 bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
            </header>

            <form onSubmit={handleCreate} className="grow overflow-y-auto p-6 flex flex-col gap-4.5">
              {error && (
                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[12px] font-medium">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Assignment Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sales Data Processing"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 px-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Description (Markdown Supported)</label>
                <textarea
                  placeholder="Write assignment instructions, requirements and table column specs here..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={6}
                  className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all font-mono leading-relaxed resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Reviewer Email (Blind)</label>
                  <input
                    type="email"
                    placeholder="reviewer@nst.edu"
                    value={reviewerEmail}
                    onChange={(e) => setReviewerEmail(e.target.value)}
                    className="h-11 px-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Co-Owner Email</label>
                  <input
                    type="email"
                    placeholder="owner@nst.edu"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="h-11 px-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="h-11 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-[13px] shadow-sm transition-all flex items-center justify-center mt-3 cursor-pointer border-none gap-2"
              >
                {isCreating ? (
                  <>
                    <span className="animate-spin text-white">🌀</span>
                    Creating Assignment…
                  </>
                ) : (
                  'Create Question'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
