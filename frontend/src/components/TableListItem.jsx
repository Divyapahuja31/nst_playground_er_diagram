import { useState, useRef, useEffect } from 'react';

const COLUMN_TYPES = [
  'INTEGER', 'BIGINT', 'VARCHAR', 'TEXT',
  'BOOLEAN', 'FLOAT', 'DATE', 'TIMESTAMP',
];

const OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN'];

const DEFAULT_COL_PROPS = {
  isPrimary: false,
  isNotNull: false,
  isUnique: false,
  isAutoIncrement: false,
  defaultValue: '',
  checkConstraint: null,
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

function CheckConstraintBuilder({ conditions = [], columns, onChange }) {
  const addCondition = () => {
    const newConditions = [...conditions];
    if (newConditions.length > 0) {
      newConditions.push({ connector: 'AND' });
    }
    newConditions.push({ left: '', operator: '=', right: '' });
    onChange(newConditions);
  };

  const removeCondition = (idx) => {
    let newConditions = [...conditions];
    // Remove connector before this condition if exists
    if (idx > 0 && newConditions[idx - 1]?.connector) {
      newConditions.splice(idx - 1, 2);
    } else {
      // Remove condition and connector after if exists
      if (newConditions[idx + 1]?.connector) {
        newConditions.splice(idx, 2);
      } else {
        newConditions.splice(idx, 1);
      }
    }
    onChange(newConditions);
  };

  const updateCondition = (idx, field, value) => {
    const newConditions = [...conditions];
    newConditions[idx] = { ...newConditions[idx], [field]: value };
    onChange(newConditions);
  };

  return (
    <div className="flex flex-col gap-2 mt-1">
      {conditions.map((item, idx) => {
        if (item.connector) {
          return (
            <div key={idx} className="flex justify-center">
              <select
                className="h-6 px-2 rounded border border-neutral-300 bg-neutral-50 text-[11px] font-bold text-brand-600 outline-none cursor-pointer"
                value={item.connector}
                onChange={(e) => updateCondition(idx, 'connector', e.target.value)}
              >
                <option>AND</option>
                <option>OR</option>
              </select>
            </div>
          );
        }

        // Find condition index (exclude connectors)
        const condIdx = idx;
        return (
          <div key={idx} className="flex flex-col gap-1 p-2 rounded-lg border border-neutral-200 bg-neutral-50 relative">
            {/* Remove button */}
            <button
              title="Remove condition"
              className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-red-500 transition-colors"
              onClick={() => removeCondition(idx)}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Left operand (column dropdown) */}
            <select
              className="w-full h-6 px-1.5 rounded border border-neutral-300 bg-white text-[11px] font-medium text-neutral-800 outline-none cursor-pointer focus:border-brand-500"
              value={item.left || ''}
              onChange={(e) => updateCondition(idx, 'left', e.target.value)}
            >
              <option value="">Column...</option>
              {columns.map(col => (
                <option key={col.name} value={col.name}>{col.name || '(unnamed)'}</option>
              ))}
            </select>

            {/* Operator + right operand row */}
            <div className="flex gap-1">
              <select
                className="w-16 h-6 px-1 rounded border border-neutral-300 bg-white text-[11px] font-medium text-neutral-700 outline-none cursor-pointer focus:border-brand-500 shrink-0"
                value={item.operator || '='}
                onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
              >
                {OPERATORS.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>

              <input
                className="flex-1 h-6 px-1.5 rounded border border-neutral-300 bg-white text-[11px] font-medium text-neutral-800 outline-none focus:border-brand-500 transition-all"
                placeholder="Value or column"
                value={item.right || ''}
                onChange={(e) => updateCondition(idx, 'right', e.target.value)}
              />
            </div>

            {/* Inline validation */}
            {(item.left === '' || item.right === '') && (
              <span className="text-[10px] text-amber-500">Column and value required.</span>
            )}
          </div>
        );
      })}

      <button
        className="flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-700 transition-colors mt-0.5"
        onClick={addCondition}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Condition
      </button>
    </div>
  );
}

function FieldOptionsPopover({ col, onChange, onClose, allColumns }) {
  const ref = useRef(null);
  const [showCheck, setShowCheck] = useState(!!(col.checkConstraint?.conditions?.length));

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggleRows = [
    { label: 'Primary Key',    icon: '🔑', key: 'isPrimary' },
    { label: 'Not Null',       icon: '◇',  key: 'isNotNull' },
    { label: 'Unique',         icon: '✦',  key: 'isUnique' },
    { label: 'Auto Increment', icon: '↕',  key: 'isAutoIncrement' },
  ];

  const checkConditions = col.checkConstraint?.conditions || [];

  const updateCheck = (conditions) => {
    onChange({ ...col, checkConstraint: conditions.length ? { conditions } : null });
  };

  const enableCheck = () => {
    setShowCheck(true);
    if (!checkConditions.length) {
      updateCheck([{ left: '', operator: '=', right: '' }]);
    }
  };

  const disableCheck = () => {
    setShowCheck(false);
    onChange({ ...col, checkConstraint: null });
  };

  return (
    <div
      ref={ref}
      className="absolute right-full top-0 mr-2 z-50 bg-neutral-0 border border-neutral-200 rounded-xl shadow-xl p-3 w-64 flex flex-col gap-2.5"
    >
      {/* Toggle switches */}
      {toggleRows.map(({ label, icon, key }) => (
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

      {/* Divider */}
      <div className="border-t border-neutral-200 my-0.5" />

      {/* Default Value */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">Default Value</span>
        <input
          className="w-full h-7 px-2 rounded-md border border-neutral-300 bg-neutral-50 text-[12px] font-medium text-neutral-800 outline-none focus:border-brand-500 transition-all"
          placeholder="e.g. 18, true, CURRENT_DATE"
          value={col.defaultValue || ''}
          onChange={(e) => onChange({ ...col, defaultValue: e.target.value })}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-200 my-0.5" />

      {/* Check Constraint */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">Check Constraint</span>
          {showCheck ? (
            <button
              className="text-[10px] font-semibold text-red-400 hover:text-red-600 transition-colors"
              onClick={disableCheck}
            >
              Remove
            </button>
          ) : (
            <button
              className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 transition-colors"
              onClick={enableCheck}
            >
              + Add
            </button>
          )}
        </div>

        {showCheck && (
          <CheckConstraintBuilder
            conditions={checkConditions}
            columns={allColumns}
            onChange={updateCheck}
          />
        )}
      </div>
    </div>
  );
}

function FieldRow({ col, onUpdate, onDelete, allColumns }) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="flex items-center gap-1 relative">
      {/* Six-dot grip */}
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

      {/* Check constraint indicator badge */}
      {col.checkConstraint?.conditions?.length > 0 && (
        <span title="Has check constraint" className="h-6 w-6 flex items-center justify-center rounded border border-amber-300 bg-amber-50 text-[10px] shrink-0">
          ✓
        </span>
      )}

      {/* Default value indicator badge */}
      {col.defaultValue && (
        <span title={`Default: ${col.defaultValue}`} className="h-6 w-6 flex items-center justify-center rounded border border-green-300 bg-green-50 text-[10px] shrink-0">
          D
        </span>
      )}

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
            allColumns={allColumns}
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

export default function TableListItem({ table, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

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
        onClick={() => setExpanded((v) => !v)}
      >
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
              allColumns={table.columns}
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
