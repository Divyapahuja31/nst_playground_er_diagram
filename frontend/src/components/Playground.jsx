import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
} from '@xyflow/react';
import TableNode from './TableNode';

const nodeTypes = { tableNode: TableNode };

export default function Playground({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodesDelete
}) {
  return (
    <div className="canvas-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
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
  );
}
