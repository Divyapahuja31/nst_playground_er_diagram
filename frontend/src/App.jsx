import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  Controls,
} from '@xyflow/react';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import TableNode from './components/TableNode';
import '@xyflow/react/dist/style.css';

const nodeTypes = { tableNode: TableNode };

const initialNodes = [];
const initialEdges = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [tables, setTables] = useState([]);

  const onConnect = useCallback(
    (params) => {
      const sourceTable = tables.find((t) => t.id === params.source);
      const targetTable = tables.find((t) => t.id === params.target);
      const edgeName = sourceTable && targetTable 
        ? `${sourceTable.name.toLowerCase()}_${targetTable.name.toLowerCase()}_rel` 
        : `rel_${Date.now()}`;
        
      setEdges((eds) => addEdge({
        ...params,
        data: {
          name: edgeName,
          cardinality: 'One to One',
          compositeKeys: [],
        }
      }, eds));
    },
    [setEdges, tables],
  );

  const handleAddTable = (tableName) => {
    const id = `table-${Date.now()}`;
    const defaultColumns = [];
    const newTable = { id, name: tableName, columns: defaultColumns };

    setTables((prev) => [...prev, newTable]);
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'tableNode',
        position: {
          x: 200 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },
        data: { label: tableName, columns: defaultColumns },
      },
    ]);
  };

  const handleUpdateTable = (updatedTable) => {
    setTables((prev) =>
      prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
    );
    setNodes((prev) =>
      prev.map((n) =>
        n.id === updatedTable.id
          ? {
              ...n,
              data: {
                ...n.data,
                label: updatedTable.name,
                columns: updatedTable.columns,
              },
            }
          : n
      )
    );
  };

  const handleDeleteTable = (tableId) => {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
    setNodes((prev) => prev.filter((n) => n.id !== tableId));
  };

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-neutral-0">
      <Navbar />

      <main className="main-workspace">
        <Sidebar />
        <div className="canvas-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={true}
            fitView
          >
            <Background variant="dots" gap={16} size={1.2} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <RightSidebar
          tables={tables}
          edges={edges}
          setEdges={setEdges}
          onAddTable={handleAddTable}
          onUpdateTable={handleUpdateTable}
          onDeleteTable={handleDeleteTable}
        />
      </main>
    </div>
  );
}
