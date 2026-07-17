import { useCallback } from 'react';
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
import RightSidebar from './components/RightSidebar';
import '@xyflow/react/dist/style.css';

const initialNodes = [];

const initialEdges = [];

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-neutral-0">
      <Navbar />

      <main className="flex flex-row flex-grow w-full h-[calc(100vh-56px)] relative overflow-hidden">
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
        
        <RightSidebar />
      </main>
    </div>
  );
}

