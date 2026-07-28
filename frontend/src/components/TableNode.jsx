import { Handle, Position } from '@xyflow/react';

const TYPE_COLORS = {
  INTEGER: '#b8860b',
  VARCHAR: '#2e7d32',
  TEXT: '#1565c0',
  BOOLEAN: '#6a1b9a',
  FLOAT: '#c62828',
  DATE: '#00695c',
  TIMESTAMP: '#00695c',
};

const DEFAULT_COLUMNS = [
  { name: 'id', type: 'INTEGER', isPrimary: true },
  { name: 'name', type: 'VARCHAR', isPrimary: false },
];

export default function TableNode({ data }) {
  const columns = data.columns ?? DEFAULT_COLUMNS;

  return (
    <div className="rounded-lg shadow-md border border-neutral-300 bg-neutral-100 min-w-[200px]">
      {/* Header */}
      <div className="bg-[#4a90e2] px-4 py-2 rounded-t-lg text-white text-[14px] font-bold text-center tracking-wide">
        {data.label}
      </div>

      {/* Columns */}
      <div className="bg-neutral-100 rounded-b-lg">
        {columns.map((col, i) => (
          <div
            key={i}
            className="relative flex items-center justify-between px-3 py-[7px] border-t border-neutral-200"
          >
            {/* Left target handle */}
            <Handle
              type="target"
              position={Position.Left}
              id={`target-${col.name}`}
              className="!w-2.5 !h-2.5 !bg-[#4a90e2] !border-none !rounded-full !absolute"
              style={{ left: '-5px', top: '50%', transform: 'translateY(-50%)' }}
            />

            <span className="text-[13px] font-medium text-neutral-800 ml-1.5">{col.name}</span>

            {/* Right: type + key icon + source handle */}
            <div className="flex items-center gap-1.5 mr-1.5">
              <span
                className="text-[12px] font-semibold"
                style={{ color: TYPE_COLORS[col.type] ?? '#555' }}
              >
                {col.type}
              </span>
              {col.isPrimary && (
                <span className="text-[14px]" title="Primary Key">🔑</span>
              )}
            </div>

            {/* Right source handle */}
            <Handle
              type="source"
              position={Position.Right}
              id={`source-${col.name}`}
              className="!w-2.5 !h-2.5 !bg-[#4a90e2] !border-none !rounded-full !absolute"
              style={{ right: '-5px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
