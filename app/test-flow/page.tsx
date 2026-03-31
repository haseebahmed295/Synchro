'use client';

import { useState, useCallback } from 'react';
import { ReactFlow, applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
];
const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];

export default function TestFlowPage() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [jsonInput, setJsonInput] = useState(JSON.stringify({ nodes: initialNodes, edges: initialEdges }, null, 2));

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: any) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.nodes) setNodes(parsed.nodes);
      if (parsed.edges) setEdges(parsed.edges);
    } catch (error) {
      alert('Invalid JSON: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      {/* Left panel - JSON editor */}
      <div style={{ width: '400px', padding: '20px', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>Edit Diagram JSON</h2>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          style={{
            flex: 1,
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <button
          onClick={handleApplyJson}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Apply Changes
        </button>
        <button
          onClick={() => setJsonInput(JSON.stringify({ nodes, edges }, null, 2))}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Sync from Canvas
        </button>
      </div>

      {/* Right panel - React Flow canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        />
      </div>
    </div>
  );
}
