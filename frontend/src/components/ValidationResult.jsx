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

export default function ValidationResult({ result, onClose }) {
  if (!result) return null;

  const { is_valid, mismatches = [], names = {}, status = {} } = result;
  const sortedIssues = categorise(mismatches);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden" style={{ animation: 'fadeIn 0.2s ease-out' }}>

        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between border-b ${is_valid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
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
