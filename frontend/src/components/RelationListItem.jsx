import { useState } from 'react';

const CARDINALITIES = [
  'One to One',
  'One to Many',
  'Many to One',
  'Many to Many'
];

export default function RelationListItem({ edge, tables, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const data = edge.data || { name: '', cardinality: 'One to One', compositeKeys: [] };
  const compositeKeys = data.compositeKeys || [];

  const sourceTable = tables.find(t => t.id === edge.source);
  const targetTable = tables.find(t => t.id === edge.target);

  const sourceColumns = sourceTable ? sourceTable.columns : [];
  const targetColumns = targetTable ? targetTable.columns : [];

  const updateRelation = (updates) => {
    const newEdgeData = { ...data };
    let newSource = edge.source;
    let newTarget = edge.target;

    if ('source' in updates) {
      newSource = updates.source;
      newEdgeData.compositeKeys = [];
    }
    if ('target' in updates) {
      newTarget = updates.target;
      newEdgeData.compositeKeys = [];
    }
    if ('name' in updates) newEdgeData.name = updates.name;
    if ('cardinality' in updates) newEdgeData.cardinality = updates.cardinality;
    if ('compositeKeys' in updates) newEdgeData.compositeKeys = updates.compositeKeys;

    onUpdate(edge.id, newEdgeData, newSource, newTarget);
  };

  const addCompositeKey = () => {
    updateRelation({
      compositeKeys: [...compositeKeys, { foreign: '', primary: '' }]
    });
  };

  const updateCompositeKey = (idx, field, value) => {
    const newKeys = [...compositeKeys];
    newKeys[idx][field] = value;
    updateRelation({ compositeKeys: newKeys });
  };

  const deleteCompositeKey = (idx) => {
    const newKeys = compositeKeys.filter((_, i) => i !== idx);
    updateRelation({ compositeKeys: newKeys });
  };

  return (
    <div className="border-b border-neutral-200">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none hover:bg-neutral-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
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
          {data.name || 'Untitled Relation'}
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
        <div className="px-3 pb-4 pt-1 flex flex-col gap-3.5 bg-neutral-100/50 border-t border-neutral-100">
          
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-neutral-700 w-12 shrink-0">Name:</span>
            <input
              className="flex-1 h-7 px-2 rounded-md border border-neutral-300 bg-neutral-0 text-[12px] font-medium text-neutral-900 outline-none focus:border-brand-500 transition-all"
              value={data.name || ''}
              onChange={(e) => updateRelation({ name: e.target.value })}
            />
          </div>
 
          {/* FROM table & column */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-neutral-700">FROM (Source):</span>
            <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-brand-500">
              <select
                className="w-full h-8 px-2 rounded-md border border-neutral-300 bg-neutral-0 text-[12px] font-medium text-neutral-900 outline-none cursor-pointer focus:border-brand-500 transition-all"
                value={edge.source}
                onChange={(e) => updateRelation({ source: e.target.value })}
              >
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">↳ Column:</span>
                <select
                  className="flex-1 h-7 px-2 rounded-md border border-neutral-300 bg-neutral-0 text-[12px] font-medium text-neutral-900 outline-none cursor-pointer focus:border-brand-500 transition-all"
                  value={compositeKeys[0]?.foreign || ''}
                  onChange={(e) => {
                    const newKeys = [...compositeKeys];
                    if (newKeys.length === 0) newKeys.push({ foreign: '', primary: '' });
                    newKeys[0].foreign = e.target.value;
                    updateRelation({ compositeKeys: newKeys });
                  }}
                >
                  <option value="">Select column...</option>
                  {sourceColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
 
          {/* TO table & column */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-neutral-700">TO (Target):</span>
            <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-green-500">
              <select
                className="w-full h-8 px-2 rounded-md border border-neutral-300 bg-neutral-0 text-[12px] font-medium text-neutral-900 outline-none cursor-pointer focus:border-brand-500 transition-all"
                value={edge.target}
                onChange={(e) => updateRelation({ target: e.target.value })}
              >
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">↳ Column:</span>
                <select
                  className="flex-1 h-7 px-2 rounded-md border border-neutral-300 bg-neutral-0 text-[12px] font-medium text-neutral-900 outline-none cursor-pointer focus:border-brand-500 transition-all"
                  value={compositeKeys[0]?.primary || ''}
                  onChange={(e) => {
                    const newKeys = [...compositeKeys];
                    if (newKeys.length === 0) newKeys.push({ foreign: '', primary: '' });
                    newKeys[0].primary = e.target.value;
                    updateRelation({ compositeKeys: newKeys });
                  }}
                >
                  <option value="">Select column...</option>
                  {targetColumns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
 
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-neutral-700">Cardinality:</span>
            <select
              className="w-full h-8 px-2 rounded-md border border-neutral-300 bg-neutral-0 text-[12px] font-medium text-neutral-900 outline-none cursor-pointer focus:border-brand-500 transition-all"
              value={data.cardinality}
              onChange={(e) => updateRelation({ cardinality: e.target.value })}
            >
              {CARDINALITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
 
          {/* Composite key mappings list (for key pairs > 1) */}
          {compositeKeys.length > 1 && (
            <div className="mt-1 rounded-md border border-neutral-300 bg-neutral-100 overflow-hidden">
              <div className="px-3 py-1.5 bg-neutral-200 border-b border-neutral-300 flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">Additional Mappings</span>
              </div>
              
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[10px] font-semibold text-neutral-600 text-center">FROM Column</span>
                  <span className="flex-1 text-[10px] font-semibold text-neutral-600 text-center">TO Column</span>
                  <div className="w-4 shrink-0"></div>
                </div>
 
                {compositeKeys.slice(1).map((key, index) => {
                  const i = index + 1;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        className="flex-1 h-6 px-1 rounded border border-neutral-300 bg-neutral-0 text-[11px] font-medium text-neutral-800 outline-none focus:border-brand-500 cursor-pointer"
                        value={key.foreign}
                        onChange={(e) => updateCompositeKey(i, 'foreign', e.target.value)}
                      >
                        <option value="">Select column...</option>
                        {sourceColumns.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                      
                      <select
                        className="flex-1 h-6 px-1 rounded border border-neutral-300 bg-neutral-0 text-[11px] font-medium text-neutral-800 outline-none focus:border-brand-500 cursor-pointer"
                        value={key.primary}
                        onChange={(e) => updateCompositeKey(i, 'primary', e.target.value)}
                      >
                        <option value="">Select column...</option>
                        {targetColumns.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
 
                      <button
                        title="Remove field"
                        className="w-4 h-4 flex items-center justify-center shrink-0 text-red-400 hover:text-red-600 transition-colors"
                        onClick={() => deleteCompositeKey(i)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
 
          {/* Delete Relationship Button */}
          {onDelete && (
            <div className="flex justify-end pt-1">
              <button
                title="Delete relationship"
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
          )}
        </div>
      )}
    </div>
  );
}
