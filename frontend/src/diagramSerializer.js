const CARDINALITY_MAP = {
  'One to One': 'one_to_one',
  'One to Many': 'one_to_many',
  'Many to One': 'many_to_one',
  'Many to Many': 'many_to_many',
};

export function serializeDiagram(tables, edges) {
  const tableIdMap = {};  
  const fieldIdMap = {}; 
  let nextTableId = 1;
  let nextFieldId = 1;

  const backendTables = tables.map((table) => {
    const tableIntId = nextTableId++;
    tableIdMap[table.id] = tableIntId;

    const fields = (table.columns || []).map((col) => {
      const fieldIntId = nextFieldId++;
      fieldIdMap[`${table.id}:${col.name}`] = fieldIntId;

      return {
        id: fieldIntId,
        name: col.name || '',
        type: (col.type || 'VARCHAR').toUpperCase(),
        primaryKey: !!col.isPrimary,
        notNull: !!col.isNotNull || !!col.isPrimary,
        unique: !!col.isUnique,
        increment: !!col.isAutoIncrement,
        def: '',
      };
    });

    return { id: tableIntId, name: table.name || '', fields };
  });

  const relationships = [];
  let nextRelId = 1;

  for (const edge of edges) {
    const data = edge.data || {};
    const compositeKeys = data.compositeKeys || [];
    const cardinality = CARDINALITY_MAP[data.cardinality] || 'many_to_one';
    const sourceTableId = tableIdMap[edge.source];
    const targetTableId = tableIdMap[edge.target];

    if (!sourceTableId || !targetTableId) continue;

    for (const ck of compositeKeys) {
      if (!ck.foreign || !ck.primary) continue;

      const startFieldId = fieldIdMap[`${edge.source}:${ck.foreign}`];
      const endFieldId = fieldIdMap[`${edge.target}:${ck.primary}`];

      if (!startFieldId || !endFieldId) continue;

      relationships.push({
        id: nextRelId++,
        cardinality,
        startTable: sourceTableId,
        startField: startFieldId,
        endTable: targetTableId,
        endField: endFieldId,
      });
    }
  }

  return { tables: backendTables, relationships };
}

export function deserializeDiagram(diagram) {
  if (!diagram || !diagram.tables) return { tables: [], nodes: [], edges: [] };
  
  const tables = [];
  const nodes = [];
  const edges = [];
  const tableIdMap = {}; 
  const fieldIdMap = {}; 
  
  diagram.tables.forEach((t, idx) => {
    const tableStrId = `table-${t.id || idx + 1}`;
    tableIdMap[t.id] = tableStrId;
    
    const columns = (t.fields || []).map((f) => {
      fieldIdMap[f.id] = f.name;
      return {
        name: f.name,
        type: f.type || 'VARCHAR',
        isPrimary: !!f.primaryKey,
        isNotNull: !!f.notNull,
        isUnique: !!f.unique,
        isAutoIncrement: !!f.increment,
      };
    });
    
    tables.push({ id: tableStrId, name: t.name, columns });
    nodes.push({
      id: tableStrId,
      type: 'tableNode',
      position: { x: 100 + (idx % 3) * 220, y: 80 + Math.floor(idx / 3) * 185 },
      data: { label: t.name, columns },
    });
  });
  
  const CARDINALITY_REVERSE_MAP = {
    'one_to_one': 'One to One',
    'one_to_many': 'One to Many',
    'many_to_one': 'Many to One',
    'many_to_many': 'Many to Many',
  };
  
  const NOTATION_MAP = {
    'One to One': '1 - 1',
    'One to Many': '1 - N',
    'Many to One': 'N - 1',
    'Many to Many': 'M - N',
  };

  (diagram.relationships || []).forEach((rel, idx) => {
    const source = tableIdMap[rel.startTable];
    const target = tableIdMap[rel.endTable];
    if (!source || !target) return;
    
    const sourceCol = fieldIdMap[rel.startField];
    const targetCol = fieldIdMap[rel.endField];
    const cardinality = CARDINALITY_REVERSE_MAP[rel.cardinality] || 'Many to One';
    
    edges.push({
      id: `edge-${rel.id || idx + 1}`,
      source,
      target,
      label: NOTATION_MAP[cardinality] || '1 - 1',
      labelStyle: { fill: '#334155', fontWeight: 600, fontSize: 10, fontFamily: 'sans-serif' },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9, stroke: '#cbd5e1', strokeWidth: 1, rx: 4, ry: 4 },
      data: {
        name: `rel_${rel.id || idx + 1}`,
        cardinality,
        compositeKeys: sourceCol && targetCol ? [{ foreign: sourceCol, primary: targetCol }] : [],
      }
    });
  });
  
  return { tables, nodes, edges };
}
