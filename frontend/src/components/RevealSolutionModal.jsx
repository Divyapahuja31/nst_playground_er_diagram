import React from 'react';

export default function RevealSolutionModal({ solutionDiagram, onClose }) {
  if (!solutionDiagram) return null;

  const tables = solutionDiagram.tables || [];
  const relationships = solutionDiagram.relationships || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <h3 className="text-[17px] font-bold text-neutral-900 m-0 font-sans tracking-tight">
              Official Reference Solution (Read-Only)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-neutral-300 bg-white text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 flex items-center justify-center cursor-pointer border-none font-bold text-lg"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grow space-y-6">
          {tables.length === 0 ? (
            <p className="text-neutral-500 text-[14px] italic">No tables defined in this official solution yet.</p>
          ) : (
            <div>
              <h4 className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
                Tables & Columns ({tables.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tables.map((tbl, idx) => (
                  <div key={tbl.id || idx} className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/40">
                    <h5 className="text-[15px] font-bold text-brand-600 m-0 mb-2.5 font-mono">
                      📋 {tbl.name}
                    </h5>
                    <ul className="space-y-1.5 pl-0 my-0 list-none text-[13px]">
                      {(tbl.columns || tbl.fields || []).map((col, cIdx) => (
                        <li key={col.id || cIdx} className="flex items-center justify-between text-neutral-700 bg-white px-2.5 py-1 rounded border border-neutral-200/60 font-mono">
                          <span>{col.name}</span>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-neutral-400 uppercase">{col.type || 'INT'}</span>
                            {col.is_pk && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">PK</span>
                            )}
                            {col.is_fk && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">FK</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relationships.length > 0 && (
            <div>
              <h4 className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
                Relationships ({relationships.length})
              </h4>
              <div className="space-y-2">
                {relationships.map((rel, idx) => (
                  <div key={rel.id || idx} className="text-[13px] font-mono text-neutral-800 bg-neutral-100/70 border border-neutral-200 px-3.5 py-2 rounded-lg flex items-center justify-between">
                    <span>
                      <strong>{rel.sourceTable || rel.source}</strong> ── [{rel.name || 'rel'}] ── <strong>{rel.targetTable || rel.target}</strong>
                    </span>
                    <span className="text-[11px] font-sans text-neutral-500 bg-white px-2 py-0.5 rounded border border-neutral-200">
                      {rel.cardinality || 'One to Many'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 h-9 rounded-lg bg-neutral-900 text-white font-sans text-[13px] font-bold hover:bg-neutral-800 cursor-pointer border-none transition-colors"
          >
            Close Solution View
          </button>
        </div>
      </div>
    </div>
  );
}
