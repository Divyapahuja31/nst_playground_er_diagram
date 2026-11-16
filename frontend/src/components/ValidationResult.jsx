import { useState } from 'react';

export default function ValidationResult({ result, onClose }) {
  if (!result) return null;

  const isQueryValidator = result.validation_engine === 'query_validator' || Boolean(result.criteria);

  if (isQueryValidator) {
    return <QueryValidationView result={result} onClose={onClose} />;
  }

  return <LegacyValidationView result={result} onClose={onClose} />;
}

// ══════════════════════════════════════════════════════════════════════════════
//  1. Query-Based Validation View (V1 Engine)
// ══════════════════════════════════════════════════════════════════════════════

function QueryValidationView({ result, onClose }) {
  const {
    is_valid,
    status = 'partial',
    total_marks_earned = 0,
    total_marks_possible = 100,
    percentage = 0,
    criteria = {},
    suggestions = [],
    behavioral_test_results = null,
    diagram_errors = [],
  } = result;

  const [expandedCriterion, setExpandedCriterion] = useState(null);
  const [showSqlDetails, setShowSqlDetails] = useState(false);

  const isAccepted = status === 'accepted' || is_valid;
  const isPartial = status === 'partial' && !isAccepted;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-300 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isAccepted ? 'bg-green-50/80 border-green-200' : isPartial ? 'bg-amber-50/80 border-amber-200' : 'bg-red-50/80 border-red-200'
        }`}>
          <div className="flex items-center gap-3.5">
            {isAccepted ? (
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : isPartial ? (
              <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold text-neutral-900 m-0">
                  {isAccepted ? 'Solution Accepted!' : isPartial ? 'Partial Credit Awarded' : 'Solution Needs Revision'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  isAccepted ? 'bg-green-100 text-green-800' : isPartial ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                }`}>
                  {status}
                </span>
              </div>
              <p className="text-[12px] text-neutral-600 m-0 mt-0.5">
                Query Validation Engine V1 • Score: <span className="font-bold text-neutral-900">{total_marks_earned}</span> / {total_marks_possible} pts ({percentage}%)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-200/80 hover:text-neutral-800 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Overall Progress Bar */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-neutral-800">Overall Score Breakdown</span>
              <span className={`text-[15px] font-extrabold ${
                percentage >= 90 ? 'text-green-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {total_marks_earned} / {total_marks_possible} Marks
              </span>
            </div>
            <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  percentage >= 90 ? 'bg-green-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              />
            </div>
          </div>

          {/* Actionable Suggestions (Callout) */}
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="text-amber-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v1" />
                  <path d="M12 21v1" />
                  <path d="M4.93 4.93l.7.7" />
                  <path d="M18.36 18.36l.7.7" />
                  <path d="M2 12h1" />
                  <path d="M21 12h1" />
                  <path d="M4.93 19.07l.7-.7" />
                  <path d="M18.36 5.64l.7-.7" />
                  <circle cx="12" cy="12" r="5" />
                </svg>
                <span className="text-[13px] font-bold text-amber-900">Actionable Suggestions for Improvement</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[12px] text-amber-800 pl-1">
                {suggestions.map((hint, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diagram Errors (if any) */}
          {diagram_errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <span className="text-[13px] font-bold text-red-900 mb-2 block">Structural Diagram Errors</span>
              <ul className="list-disc list-inside space-y-1 text-[12px] text-red-700 pl-1">
                {diagram_errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 4 Rubric Criteria Cards */}
          <div className="flex flex-col gap-3">
            <span className="text-[13px] font-bold text-neutral-800 uppercase tracking-wide">Evaluation Rubric</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(criteria).map(([key, crit]) => {
                const isFull = crit.marks_earned >= crit.marks_possible && crit.marks_possible > 0;
                const isZero = crit.marks_earned === 0 && crit.marks_possible > 0;
                const isExpanded = expandedCriterion === key;

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 transition-all ${
                      isFull ? 'border-green-200 bg-green-50/30' : isZero ? 'border-red-200 bg-red-50/20' : 'border-amber-200 bg-amber-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-bold text-neutral-900">{crit.label}</span>
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${
                        isFull ? 'bg-green-100 text-green-800' : isZero ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {crit.marks_earned} / {crit.marks_possible} pts
                      </span>
                    </div>

                    {/* Compact preview of checks */}
                    <div className="text-[11px] text-neutral-600 space-y-1 mt-2">
                      {crit.passed_checks.slice(0, 2).map((check, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-green-700">
                          <span className="text-green-600 font-bold shrink-0">✓</span>
                          <span className="truncate">{check}</span>
                        </div>
                      ))}
                      {crit.failed_checks.slice(0, 2).map((check, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-red-700">
                          <span className="text-red-600 font-bold shrink-0">✗</span>
                          <span className="truncate">{check}</span>
                        </div>
                      ))}
                    </div>

                    {/* Expand/Collapse toggle for details */}
                    {(crit.passed_checks.length > 2 || crit.failed_checks.length > 2) && (
                      <button
                        onClick={() => setExpandedCriterion(isExpanded ? null : key)}
                        className="mt-3 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide details' : `View all (${crit.passed_checks.length + crit.failed_checks.length})`}
                        <svg className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 text-[11px] space-y-1.5">
                        {crit.passed_checks.map((p, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-green-800">
                            <span className="text-green-600 font-bold shrink-0">✓</span>
                            <span>{p}</span>
                          </div>
                        ))}
                        {crit.failed_checks.map((f, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-red-800">
                            <span className="text-red-600 font-bold shrink-0">✗</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SQL Behavioral Tests Explorer */}
          {behavioral_test_results && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-neutral-900">SQL Behavioral Tests</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-800">
                    {behavioral_test_results.passed_tests?.length || 0} passed / {behavioral_test_results.all_tests?.length || 0} tests
                  </span>
                </div>
                <button
                  onClick={() => setShowSqlDetails(!showSqlDetails)}
                  className="text-[12px] font-bold text-neutral-700 hover:text-neutral-950 flex items-center gap-1"
                >
                  {showSqlDetails ? 'Collapse Details' : 'View All Test Cases'}
                  <svg className={`transition-transform ${showSqlDetails ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {showSqlDetails ? (
                <div className="space-y-2 mt-2">
                  {behavioral_test_results.all_tests?.map((t, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-[12px] flex flex-col gap-1 ${
                        t.passed ? 'bg-green-50/50 border-green-200 text-green-900' : 'bg-red-50/50 border-red-200 text-red-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold">
                          <span>{t.passed ? '✓' : '✗'}</span>
                          <span>{t.description || t.test_name}</span>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          t.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {t.marks_earned} / {t.marks_possible} pts
                        </span>
                      </div>
                      <p className="text-[11px] opacity-80 pl-4 m-0">{t.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {behavioral_test_results.all_tests?.map((t, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 ${
                        t.passed ? 'bg-green-100/80 text-green-800' : 'bg-red-100/80 text-red-800'
                      }`}
                      title={t.message}
                    >
                      <span>{t.passed ? '✓' : '✗'}</span>
                      <span className="truncate max-w-[200px]">{t.description || t.test_name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-[12px] text-neutral-500">
            {isAccepted ? 'Congratulations! Solution satisfies database specifications.' : 'Review suggestions above and re-submit your diagram.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-bold shadow-sm transition-all"
          >
            Close & Keep Editing
          </button>
        </div>

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  2. Legacy Bliss Graph Comparison View (Fallback)
// ══════════════════════════════════════════════════════════════════════════════

function LegacyValidationView({ result, onClose }) {
  const { is_valid, mismatches = [], names = {}, status = {} } = result;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-300 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className={`px-6 py-4 flex items-center justify-between border-b border-neutral-200 ${
          is_valid ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            {is_valid ? (
              <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            )}
            <div>
              <h3 className="text-[16px] font-bold text-neutral-900 m-0">
                {is_valid ? 'Solution Accepted!' : 'Incorrect Solution'}
              </h3>
              <p className="text-[12px] text-neutral-600 m-0 mt-0.5">
                Engine: {result.algorithm_used || 'Bliss'} • {status.engine_ms != null ? `${status.engine_ms}ms` : 'skipped'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Tables" expected={status.expected_nodes} student={status.student_nodes} />
            <StatCard label="Relationships" expected={status.expected_edges} student={status.student_edges} />
          </div>

          {names.score != null && (
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-neutral-800">Name Matching</span>
                <span className={`text-[14px] font-bold ${names.score >= 80 ? 'text-green-600' : names.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {names.score}/100
                </span>
              </div>

              <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    names.score >= 80 ? 'bg-green-500' : names.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${names.score}%` }}
                />
              </div>

              {names.matched?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Matched</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {names.matched.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-green-50 border border-green-200 text-[11px] text-green-800 font-medium" title={m.details}>
                        {m.expected} ↔ {m.current}
                        <span className="ml-1 text-green-500 text-[10px]">({m.type})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {names.missing?.length > 0 && (
                <div className="mb-2">
                  <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wide">Missing</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {names.missing.map((name, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700 font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {names.extra?.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-yellow-600 uppercase tracking-wide">Extra</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {names.extra.map((name, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-yellow-50 border border-yellow-200 text-[11px] text-yellow-800 font-medium">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mismatches.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <span className="text-[13px] font-bold text-red-800 mb-2 block">
                Issues ({mismatches.length})
              </span>
              <div className="flex flex-col gap-2">
                {mismatches.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-red-700">
                    <span className="mt-0.5 w-4 h-4 rounded bg-red-200 text-red-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-red-800">[{m.code}]</span>{' '}
                      <span>{m.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {is_valid && mismatches.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[14px] text-green-700 font-semibold">
                Your diagram structure and relationships match the expected solution.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, expected, student }) {
  const match = expected != null && student != null && expected === student;
  return (
    <div className={`rounded-lg border p-3 ${match ? 'border-green-200 bg-green-50/50' : 'border-neutral-200 bg-neutral-50'}`}>
      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-[18px] font-bold text-neutral-900">{student ?? '—'}</span>
        <span className="text-[12px] text-neutral-500">/ {expected ?? '—'} expected</span>
      </div>
    </div>
  );
}
