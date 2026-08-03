import { useState, useRef, useEffect } from 'react';

const COLUMN_TYPES = [
  'INTEGER', 'BIGINT', 'VARCHAR', 'TEXT',
  'BOOLEAN', 'FLOAT', 'DATE', 'TIMESTAMP',
];

const DEFAULT_COL_PROPS = {
  isPrimary: false,
  isNotNull: false,
  isUnique: false,
  isAutoIncrement: false,
};

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-brand-500' : 'bg-neutral-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function FieldOptionsPopover({ col, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const rows = [
    { label: 'Primary Key', icon: '🔑', key: 'isPrimary' },
    { label: 'Not Null',    icon: '◇',  key: 'isNotNull' },
    { label: 'Unique',      icon: '✦',  key: 'isUnique' },
    { label: 'Auto Increment', icon: '↕', key: 'isAutoIncrement' },
  ];

  return (
    <div
      ref={ref}
      className="absolute right-full top-0 mr-2 z-50 bg-neutral-0 border border-neutral-200 rounded-xl shadow-xl p-3 w-52 flex flex-col gap-2"
    >
      {rows.map(({ label, icon, key }) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px] w-5 text-center text-neutral-500">{icon}</span>
            <span className="text-[12px] font-medium text-neutral-800">{label}</span>
          </div>
          <Toggle
            checked={!!col[key]}
            onChange={(val) => onChange({ ...col, [key]: val })}
          />
        </div>
      ))}
    </div>
  );
}

function FieldRow({ col, onUpdate, onDelete }) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="flex items-center gap-1 relative">
      {/* Six-dot grip (smaller) */}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-neutral-400 cursor-grab">
        <circle cx="2.5" cy="2" r="1" fill="currentColor"/>
        <circle cx="7.5" cy="2" r="1" fill="currentColor"/>
        <circle cx="2.5" cy="5" r="1" fill="currentColor"/>
        <circle cx="7.5" cy="5" r="1" fill="currentColor"/>
        <circle cx="2.5" cy="8" r="1" fill="currentColor"/>
        <circle cx="7.5" cy="8" r="1" fill="currentColor"/>
      </svg>

      {/* Field name input */}
      <input
        className="w-[72px] shrink-0 h-6 px-1.5 rounded border border-neutral-300 bg-neutral-50 text-[11px] font-medium text-neutral-900 outline-none focus:border-brand-500 transition-all"
        value={col.name}
        placeholder="field"
        onChange={(e) => onUpdate({ ...col, name: e.target.value })}
      />

      {/* Type dropdown */}
      <select
        className="flex-1 h-6 px-1 rounded border border-neutral-300 bg-neutral-50 text-[11px] font-medium text-neutral-700 outline-none cursor-pointer focus:border-brand-500 transition-all min-w-0"
        value={col.type}
        onChange={(e) => onUpdate({ ...col, type: e.target.value })}
      >
        {COLUMN_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Primary key toggle */}
      <button
        title="Primary Key"
        className={`h-6 w-6 flex items-center justify-center rounded border text-[11px] shrink-0 transition-all ${
          col.isPrimary
            ? 'border-brand-400 bg-brand-50 text-brand-600'
            : 'border-neutral-300 bg-neutral-50 text-neutral-400 hover:border-neutral-400'
        }`}
        onClick={() => onUpdate({ ...col, isPrimary: !col.isPrimary })}
      >
        🔑
      </button>

      {/* More options "..." */}
      <div className="relative shrink-0">
        <button
          title="Field options"
          className="h-6 w-6 flex items-center justify-center rounded border border-neutral-300 bg-neutral-50 text-neutral-500 hover:border-neutral-400 hover:bg-neutral-100 transition-all text-[10px] font-bold tracking-tight"
          onClick={() => setShowOptions((v) => !v)}
        >
          •••
        </button>
        {showOptions && (
          <FieldOptionsPopover
            col={col}
            onChange={(updated) => { onUpdate(updated); }}
            onClose={() => setShowOptions(false)}
          />
        )}
      </div>

      {/* Delete field */}
      <button
        title="Delete field"
        className="h-6 w-6 flex items-center justify-center rounded border border-neutral-300 bg-neutral-50 text-neutral-400 hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-all shrink-0"
        onClick={onDelete}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export default function TableListItem({ table, expanded: propExpanded, onToggleExpand, onUpdate, onDelete }) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isControlled = propExpanded !== undefined;
  const expanded = isControlled ? propExpanded : localExpanded;

  const handleToggle = () => {
    if (isControlled) {
      onToggleExpand();
    } else {
      setLocalExpanded(!localExpanded);
    }
  };

  const updateColumn = (idx, updatedCol) => {
    const newCols = table.columns.map((col, i) => (i === idx ? updatedCol : col));
    onUpdate({ ...table, columns: newCols });
  };

  const addColumn = () => {
    onUpdate({
      ...table,
      columns: [
        ...table.columns,
        { name: '', type: 'VARCHAR', ...DEFAULT_COL_PROPS },
      ],
    });
  };

  return (
    <div className="border-b border-neutral-200">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none hover:bg-neutral-50 transition-colors"
        onClick={handleToggle}
      >
        {/* Six-dot grip */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-neutral-400">
          <circle cx="3.5" cy="2.5" r="1.2" fill="currentColor"/>
          <circle cx="8.5" cy="2.5" r="1.2" fill="currentColor"/>
          <circle cx="3.5" cy="6" r="1.2" fill="currentColor"/>
          <circle cx="8.5" cy="6" r="1.2" fill="currentColor"/>
          <circle cx="3.5" cy="9.5" r="1.2" fill="currentColor"/>
          <circle cx="8.5" cy="9.5" r="1.2" fill="currentColor"/>
        </svg>

        <span className="flex-1 text-[13px] font-semibold text-neutral-900 truncate">
          {table.name || 'Untitled'}
        </span>

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-neutral-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 bg-neutral-50 border-t border-neutral-100">
          {/* Editable table name */}
          <div className="flex items-center gap-2 pt-2 pb-1">
            <span className="text-[11px] font-bold text-neutral-500 w-10 shrink-0">Name</span>
            <input
              className="flex-1 h-7 px-2 rounded-lg border border-neutral-300 bg-neutral-0 text-[12px] font-semibold text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
              value={table.name}
              onChange={(e) => onUpdate({ ...table, name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Field rows */}
          {table.columns.map((col, i) => (
            <FieldRow
              key={i}
              col={col}
              onUpdate={(updated) => updateColumn(i, updated)}
              onDelete={() => {
                onUpdate({ ...table, columns: table.columns.filter((_, j) => j !== i) });
              }}
            />
          ))}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1.5">
            <button
              className="flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-700 transition-colors"
              onClick={addColumn}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add field
            </button>

            <button
              title="Delete table"
              className="h-6 w-6 flex items-center justify-center rounded bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
              onClick={onDelete}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
