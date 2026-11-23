/** Translates a raw mismatch object into a plain-English sentence. */
function humanMessage(m) {
  const msg = m.message || '';
  const code = m.code || '';

  // Helper: strip the field descriptor down to a friendly name
  // e.g. "INTEGER [PRIMARY KEY, NOT NULL]" → "Integer (Primary Key)"
  function friendlyType(raw) {
    if (!raw) return raw;
    const typeMatch = raw.match(/^([A-Z]+)/);
    const type = typeMatch ? typeMatch[1] : raw;
    const traits = [];
    if (raw.includes('PRIMARY KEY')) traits.push('Primary Key');
    if (raw.includes('NOT NULL') && !raw.includes('PRIMARY KEY')) traits.push('Not Null');
    if (raw.includes('UNIQUE')) traits.push('Unique');
    if (raw.includes('AUTO_INCREMENT')) traits.push('Auto Increment');
    return traits.length ? `${type} (${traits.join(', ')})` : type;
  }

  // relationship_endpoints: "solution has 1 relationship(s) INTEGER [PRIMARY KEY, NOT NULL] -> FLOAT (many_to_one); student has 0"
  if (code === 'relationship_endpoints') {
    const relMatch = msg.match(/solution has (\d+) .+? ([\w [\],]+?) -> ([\w [\],]+?) \((\w+)\); student has (\d+)/);
    if (relMatch) {
      const [, solCount, srcRaw, dstRaw, card, stuCount] = relMatch;
      const src = friendlyType(srcRaw.trim());
      const dst = friendlyType(dstRaw.trim());
      const cardLabel = card.replace(/_/g, '-');
      if (Number(solCount) > Number(stuCount)) {
        return `Missing a ${cardLabel} relationship: ${src} → ${dst}`;
      } else {
        return `Extra (wrong) relationship found: ${src} → ${dst} (${cardLabel}) — not in the expected solution`;
      }
    }
  }

  // field_types: "solution has 2 field(s) of INTEGER [PRIMARY KEY, NOT NULL]; student has 1"
  if (code === 'field_types') {
    const ftMatch = msg.match(/solution has (\d+) .+? ([\w [\],]+); student has (\d+)/);
    if (ftMatch) {
      const [, solCount, typeRaw, stuCount] = ftMatch;
      const typeFriendly = friendlyType(typeRaw.trim());
      if (Number(solCount) > Number(stuCount)) {
        return `Expected ${solCount} field(s) of type "${typeFriendly}", but only found ${stuCount}`;
      } else {
        return `Found ${stuCount} field(s) of type "${typeFriendly}", but expected only ${solCount}`;
      }
    }
  }

  // table_composition: "solution has 2 table(s) with fields {INTEGER [PRIMARY KEY, NOT NULL], VARCHAR}; student has 1"
  if (code === 'table_composition') {
    const tcMatch = msg.match(/solution has (\d+) .+? \{(.+?)\}; student has (\d+)/);
    if (tcMatch) {
      const [, solCount, fieldsRaw, stuCount] = tcMatch;
      const fieldsFriendly = fieldsRaw
        .split(',')
        .map(f => friendlyType(f.trim()))
        .join(', ');
      if (Number(solCount) > Number(stuCount)) {
        return `Missing a table whose columns are: ${fieldsFriendly}`;
      } else {
        return `Extra table found with columns: ${fieldsFriendly} — not in the expected solution`;
      }
    }
  }

  // table_count / field_count / relationship_count
  if (code === 'table_count') {
    const nums = msg.match(/solution has (\d+) .+?, student has (\d+)/);
    if (nums) return `Wrong number of tables — expected ${nums[1]}, you have ${nums[2]}`;
  }
  if (code === 'field_count') {
    const nums = msg.match(/solution has (\d+) .+?, student has (\d+)/);
    if (nums) return `Wrong total number of fields — expected ${nums[1]}, you have ${nums[2]}`;
  }
  if (code === 'relationship_count') {
    const nums = msg.match(/solution has (\d+) .+?, student has (\d+)/);
    if (nums) return `Wrong number of relationships — expected ${nums[1]}, you have ${nums[2]}`;
  }

  // cardinality
  if (code === 'cardinality') {
    const cardMatch = msg.match(/solution has (\d+) .+? (\w+); student has (\d+)/);
    if (cardMatch) {
      const [, solCount, card, stuCount] = cardMatch;
      const cardLabel = card.replace(/_/g, '-');
      if (Number(solCount) > Number(stuCount)) {
        return `Missing a ${cardLabel} relationship`;
      } else {
        return `Extra ${cardLabel} relationship found — not expected`;
      }
    }
  }

  // structural (passed pre-checks but graph wiring is wrong)
  if (code === 'structural') {
    return 'Tables and fields look correct, but the foreign key connections are wired differently from the expected solution. Check which columns your relationships are linking.';
  }

  // fallback: return the raw message
  return msg;
}

/** Groups issues into categories for a cleaner display */
function categorise(mismatches) {
  const order = ['table_count', 'relationship_count', 'field_count', 'field_types', 'table_composition', 'relationship_endpoints', 'cardinality', 'structural', 'check_constraint_invalid'];
  const groups = {};
  for (const m of mismatches) {
    const key = m.code || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  const result = [];
  for (const code of order) {
    if (groups[code]) result.push(...groups[code]);
  }
  for (const [code, items] of Object.entries(groups)) {
    if (!order.includes(code)) result.push(...items);
  }
  return result;
}

const CODE_LABELS = {
  table_count: 'Table Count',
  field_count: 'Field Count',
  relationship_count: 'Relationship Count',
  field_types: 'Field Type',
  table_composition: 'Table Structure',
  relationship_endpoints: 'Relationship Wiring',
  cardinality: 'Cardinality',
  structural: 'Structural Mismatch',
  check_constraint_invalid: 'Invalid Constraint',
};

const CODE_COLORS = {
  table_count: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-900' },
  field_count: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-900' },
  relationship_count: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-900' },
  field_types: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', text: 'text-red-900' },
  table_composition: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', text: 'text-red-900' },
  relationship_endpoints: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', text: 'text-purple-900' },
  cardinality: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-900' },
  structural: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', text: 'text-red-900' },
};
const DEFAULT_COLORS = { bg: 'bg-neutral-50', border: 'border-neutral-200', badge: 'bg-neutral-100 text-neutral-700', text: 'text-neutral-900' };
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
  const sortedIssues = categorise(mismatches);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>

        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between border-b ${is_valid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-300 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className={`px-6 py-4 flex items-center justify-between border-b border-neutral-200 ${
          is_valid ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${is_valid ? 'bg-green-500' : 'bg-red-500'}`}>
              {is_valid ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-neutral-900 m-0">
                {is_valid ? '✅ Solution Accepted!' : '❌ Incorrect Solution'}
              </h3>
              <p className="text-[12px] text-neutral-500 m-0 mt-0.5">
                Checked with <strong>{result.algorithm_used || 'Bliss'}</strong>
                {status.engine_ms != null ? ` in ${status.engine_ms}ms` : ' (skipped — pre-check failed)'}
              <p className="text-[12px] text-neutral-600 m-0 mt-0.5">
                Engine: {result.algorithm_used || 'Bliss'} • {status.engine_ms != null ? `${status.engine_ms}ms` : 'skipped'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 transition-colors border-none bg-transparent cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Tables"
              icon="🗂️"
              student={status.student_tables}
              expected={status.expected_tables}
            />
            <StatCard
              label="Relationships"
              icon="🔗"
              student={status.student_relationships}
              expected={status.expected_relationships}
            />
          </div>

          {/* Name matching */}
          {names.score != null && (
            <div className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold text-neutral-800">Table Name Matching</span>
                <span className={`text-[14px] font-bold ${names.score >= 80 ? 'text-green-600' : names.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {names.score}/100
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${names.score >= 80 ? 'bg-green-500' : names.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${names.score}%` }}
                />
              </div>
              {names.matched?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {names.matched.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 border border-green-200 text-[11px] text-green-800 font-medium" title={m.details}>
                      <span>{m.expected}</span>
                      <span className="text-green-400">↔</span>
                      <span>{m.current}</span>
                      <span className="text-green-500 opacity-70">({m.type})</span>
                    </span>
                  ))}
                  {names.missing?.map((name, i) => (
                    <span key={`miss-${i}`} className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700 font-medium">
                      ✗ {name} (missing)
                    </span>
                  ))}
                  {names.extra?.map((name, i) => (
                    <span key={`extra-${i}`} className="px-2 py-0.5 rounded-md bg-yellow-50 border border-yellow-200 text-[11px] text-yellow-800 font-medium">
                      + {name} (extra)
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Issues */}
          {sortedIssues.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-bold text-neutral-800">
                Issues Found ({sortedIssues.length})
              </span>
              {sortedIssues.map((m, i) => {
                const c = CODE_COLORS[m.code] || DEFAULT_COLORS;
                const label = CODE_LABELS[m.code] || m.code;
                return (
                  <div key={i} className={`rounded-xl border ${c.border} ${c.bg} p-3.5 flex gap-3 items-start`}>
                    <span className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${c.badge}`}>
                      {label}
                    </span>
                    <p className={`text-[13px] ${c.text} m-0 leading-snug`}>
                      {humanMessage(m)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Success message */}
          {is_valid && mismatches.length === 0 && (
            <div className="text-center py-3">
              <p className="text-[14px] text-green-700 font-semibold m-0">
                Your diagram structure and relationships match the expected solution perfectly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, icon, student, expected }) {
  const match = expected != null && student != null && expected === student;
  const mismatch = expected != null && student != null && expected !== student;
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${match ? 'border-green-200 bg-green-50' : mismatch ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-neutral-50'}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[14px]">{icon}</span>
        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className={`text-[22px] font-bold ${match ? 'text-green-700' : mismatch ? 'text-red-600' : 'text-neutral-900'}`}>
          {student ?? '—'}
        </span>
        {expected != null && (
          <span className="text-[12px] text-neutral-400 font-medium">
            {match ? `✓ matches` : `/ ${expected} expected`}
          </span>
        )}
      </div>
    </div>
  );
}
