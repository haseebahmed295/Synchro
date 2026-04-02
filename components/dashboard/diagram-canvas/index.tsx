"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramEdge, DiagramNode, NodeType } from "@/lib/types/diagram";

import { ColumnEditorDialog, ContextMenu, EditLabelDialog, type CtxTarget } from "./shared";
import { ClassNode } from "./nodes-class";
import { LifelineNode, SequenceEdge } from "./nodes-sequence";
import { ArtifactNode, ComponentNode, DeploymentNode, ExecEnvNode, InterfaceNode } from "./nodes-deployment";
import { ErdTableNode } from "./nodes-erd";
import { FlowDecision, FlowIO, FlowProcess, FlowTerminal } from "./nodes-flowchart";
import { toFlowEdges, toFlowNodes } from "./converters";
import { useAutoResizeContainers } from "./use-auto-resize-containers";

// Reverse-map ReactFlow node type back to DiagramNode type
const RF_TO_DIAGRAM_TYPE: Record<string, NodeType> = { deploymentNode: "node" };
function rfTypeToDiagramType(rfType: string | undefined): NodeType {
  return RF_TO_DIAGRAM_TYPE[rfType ?? ""] ?? (rfType as NodeType) ?? "class";
}

/**
 * Convert current ReactFlow nodes back to DiagramNode[], preserving parent→child
 * relationships by rebuilding data.children from ReactFlow's parentId.
 */
function flowNodesToDiagramNodes(flowNodes: Node[], diagramNodes: DiagramNode[]): DiagramNode[] {
  // Build parentId → childIds map from flow nodes
  const childrenMap = new Map<string, string[]>();
  for (const fn of flowNodes) {
    if (fn.parentId) {
      const list = childrenMap.get(fn.parentId) ?? [];
      list.push(fn.id);
      childrenMap.set(fn.parentId, list);
    }
  }

  return flowNodes.map((fn) => {
    const orig = diagramNodes.find((n) => n.id === fn.id);
    const children = childrenMap.get(fn.id);
    if (orig) {
      return {
        ...orig,
        position: fn.position,
        data: {
          ...orig.data,
          ...(children ? { children } : {}),
        },
      };
    }
    return {
      id: fn.id,
      type: rfTypeToDiagramType(fn.type),
      position: fn.position,
      data: {
        label: String(fn.data.label),
        stereotype: fn.data.stereotype as string | undefined,
        ...(children ? { children } : {}),
      },
    };
  });
}

const nodeTypes = {
  lifeline: LifelineNode,
  actor: LifelineNode,
  class: ClassNode,
  entity: ErdTableNode,
  // deployment
  deploymentNode: DeploymentNode,
  executionEnvironment: ExecEnvNode,
  component: ComponentNode,
  artifact: ArtifactNode,
  interface: InterfaceNode,
  // flowchart
  process: FlowProcess,
  decision: FlowDecision,
  terminal: FlowTerminal,
  io: FlowIO,
};
const edgeTypes = { sequence: SequenceEdge };

const NODE_PALETTE: Record<string, Array<{ type: string; label: string; defaultLabel: string; color: string }>> = {
  class: [
    { type: "class",  label: "Class",      defaultLabel: "NewClass",      color: "#1e40af" },
    { type: "entity", label: "Entity",     defaultLabel: "NewEntity",     color: "#7c3aed" },
  ],
  erd: [
    { type: "entity", label: "Table",      defaultLabel: "new_table",     color: "#7c3aed" },
  ],
  sequence: [
    { type: "lifeline", label: "Lifeline", defaultLabel: "Component",     color: "#374151" },
    { type: "actor",    label: "Actor",    defaultLabel: "Actor",         color: "#374151" },
  ],
  deployment: [
    { type: "node", label: "Node", defaultLabel: "Server", color: "#1e40af" },
  ],
  flowchart: [
    { type: "terminal",  label: "Start/End", defaultLabel: "Start",       color: "#16a34a" },
    { type: "process",   label: "Process",   defaultLabel: "Step",        color: "#6366f1" },
    { type: "decision",  label: "Decision",  defaultLabel: "Condition?",  color: "#ca8a04" },
    { type: "io",        label: "I/O",       defaultLabel: "Input/Output",color: "#3b82f6" },
  ],
};

// Types that must live inside a parent container — not creatable standalone
const CHILD_ONLY_TYPES = new Set(["executionEnvironment", "component", "artifact", "interface"]);

export interface DiagramCanvasProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  diagramType?: string;
  onNodesChange?: (nodes: DiagramNode[]) => void;
  onEdgesChange?: (edges: DiagramEdge[]) => void;
  readOnly?: boolean;
}

export function DiagramCanvas({
  nodes: diagramNodes,
  edges: diagramEdges,
  diagramType,
  onNodesChange,
  onEdgesChange,
  readOnly = false,
}: DiagramCanvasProps) {
  const isSeq = diagramType === "sequence";
  const isDeploy = diagramType === "deployment";
  const isErd = diagramType === "erd";
  const isFlow = diagramType === "flowchart";

  const [flowNodes, setFlowNodes] = useState<Node[]>(() => toFlowNodes(diagramNodes, isSeq, isDeploy));
  const [flowEdges, setFlowEdges] = useState<Edge[]>(() => toFlowEdges(diagramEdges, isSeq, isErd, isFlow));

  // Keep a mutable ref to the latest flowNodes so callbacks never read stale state
  const flowNodesRef = useRef(flowNodes);
  useEffect(() => { flowNodesRef.current = flowNodes; }, [flowNodes]);
  const flowEdgesRef = useRef(flowEdges);
  useEffect(() => { flowEdgesRef.current = flowEdges; }, [flowEdges]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: CtxTarget } | null>(null);
  const [editTarget, setEditTarget] = useState<{ kind: "node" | "edge"; id: string; current: string } | null>(null);
  const [columnEdit, setColumnEdit] = useState<{ id: string; label: string; columns: string[] } | null>(null);

  const diagramTypeRef = useRef(diagramType);

  // Track node IDs as a Set for order-independent comparison
  const nodeIdSetRef = useRef(new Set(diagramNodes.map((n) => n.id)));

  // When interactive handlers (add/delete/etc.) modify nodes, they set this flag
  // to tell the sync effect to skip the next incoming prop change (which is just
  // the parent echoing our own change back).
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    // If an interactive handler just fired, skip this echo from the parent.
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      // Still update the ID set so future comparisons are accurate
      nodeIdSetRef.current = new Set(diagramNodes.map((n) => n.id));
      return;
    }

    const nextIdSet = new Set(diagramNodes.map((n) => n.id));
    const prevIdSet = nodeIdSetRef.current;

    // Check if the ID sets are actually different
    const changed = nextIdSet.size !== prevIdSet.size ||
      [...nextIdSet].some((id) => !prevIdSet.has(id));

    if (changed) {
      nodeIdSetRef.current = nextIdSet;
      const seq = diagramTypeRef.current === "sequence";
      const deploy = diagramTypeRef.current === "deployment";
      const erd = diagramTypeRef.current === "erd";
      const flow = diagramTypeRef.current === "flowchart";
      setFlowNodes(toFlowNodes(diagramNodes, seq, deploy));
      setFlowEdges(toFlowEdges(diagramEdges, seq, erd, flow));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramNodes, diagramEdges]);

  // Auto-expand container nodes to always fit their children
  useAutoResizeContainers(flowNodes, setFlowNodes);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const updated = applyNodeChanges(changes, flowNodesRef.current);
    flowNodesRef.current = updated;
    setFlowNodes(updated);
    if (onNodesChange) {
      onNodesChange(flowNodesToDiagramNodes(updated, diagramNodes));
    }
  }, [diagramNodes, onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updated = applyEdgeChanges(changes, flowEdgesRef.current);
    flowEdgesRef.current = updated;
    setFlowEdges(updated);
    if (onEdgesChange) {
      onEdgesChange(updated.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return orig ?? { id: fe.id, source: fe.source, target: fe.target, type: "association" };
      }));
    }
  }, [diagramEdges, onEdgesChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const updated = addEdge(connection, flowEdgesRef.current);
    flowEdgesRef.current = updated;
    setFlowEdges(updated);
    if (onEdgesChange) {
      onEdgesChange(updated.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return orig ?? { id: fe.id, source: fe.source, target: fe.target, type: "association" };
      }));
    }
  }, [diagramEdges, onEdgesChange]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: "node", id: node.id, label: String(node.data.label ?? ""), nodeType: node.type } });
  }, [readOnly]);

  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    if (readOnly) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: "edge", id: edge.id, label: String(edge.label ?? "") } });
  }, [readOnly]);

  const handleDelete = useCallback((kind: "node" | "edge", id: string) => {
    if (kind === "node") {
      const updatedNodes = flowNodesRef.current.filter((n) => n.id !== id);
      flowNodesRef.current = updatedNodes;
      setFlowNodes(updatedNodes);
      skipNextSyncRef.current = true;
      nodeIdSetRef.current = new Set(updatedNodes.map((n) => n.id));
      if (onNodesChange) {
        onNodesChange(flowNodesToDiagramNodes(updatedNodes, diagramNodes));
      }
      const updatedEdges = flowEdgesRef.current.filter((e) => e.source !== id && e.target !== id);
      flowEdgesRef.current = updatedEdges;
      setFlowEdges(updatedEdges);
      if (onEdgesChange) {
        onEdgesChange(updatedEdges.map((fe) => {
          const orig = diagramEdges.find((e) => e.id === fe.id);
          return orig ?? { id: fe.id, source: fe.source, target: fe.target, type: "association" };
        }));
      }
    } else {
      const updatedEdges = flowEdgesRef.current.filter((e) => e.id !== id);
      flowEdgesRef.current = updatedEdges;
      setFlowEdges(updatedEdges);
      if (onEdgesChange) {
        onEdgesChange(updatedEdges.map((fe) => {
          const orig = diagramEdges.find((e) => e.id === fe.id);
          return orig ?? { id: fe.id, source: fe.source, target: fe.target, type: "association" };
        }));
      }
    }
  }, [diagramNodes, diagramEdges, onNodesChange, onEdgesChange]);

  const handleEditLabel = useCallback((kind: "node" | "edge", id: string, current: string) => {
    setEditTarget({ kind, id, current });
  }, []);

  const handleEditColumns = useCallback((id: string, label: string) => {
    const node = flowNodesRef.current.find((n) => n.id === id);
    const cols = (node?.data.attributes as string[]) ?? [];
    setColumnEdit({ id, label, columns: cols });
  }, []);

  const handleSaveColumns = useCallback((newColumns: string[]) => {
    if (!columnEdit) return;
    const updated = flowNodesRef.current.map((n) =>
      n.id === columnEdit.id ? { ...n, data: { ...n.data, attributes: newColumns } } : n
    );
    flowNodesRef.current = updated;
    setFlowNodes(updated);
    if (onNodesChange) {
      onNodesChange(flowNodesToDiagramNodes(updated, diagramNodes));
    }
    setColumnEdit(null);
  }, [columnEdit, diagramNodes, onNodesChange]);

  const handleSaveLabel = useCallback((newLabel: string) => {
    if (!editTarget) return;
    if (editTarget.kind === "node") {
      const updated = flowNodesRef.current.map((n) =>
        n.id === editTarget.id ? { ...n, data: { ...n.data, label: newLabel } } : n
      );
      flowNodesRef.current = updated;
      setFlowNodes(updated);
      if (onNodesChange) {
        onNodesChange(flowNodesToDiagramNodes(updated, diagramNodes));
      }
    } else {
      const updated = flowEdgesRef.current.map((e) =>
        e.id === editTarget.id ? { ...e, label: newLabel } : e
      );
      flowEdgesRef.current = updated;
      setFlowEdges(updated);
      if (onEdgesChange) {
        onEdgesChange(updated.map((fe) => {
          const orig = diagramEdges.find((e) => e.id === fe.id);
          return orig ? { ...orig, label: fe.label as string }
            : { id: fe.id, source: fe.source, target: fe.target, type: "association", label: newLabel };
        }));
      }
    }
    setEditTarget(null);
  }, [editTarget, diagramNodes, diagramEdges, onNodesChange, onEdgesChange]);

  // Add a child node inside a container via context menu.
  // Position is relative to the parent — stacked below existing siblings.
  // Parent expansion is handled entirely by useAutoResizeContainers.
  const handleAddDeployChild = useCallback((parentId: string, type: string, defaultLabel: string) => {
    const HEADER_H = 52;
    const CHILD_H: Record<string, number> = { artifact: 52, component: 60, interface: 64, executionEnvironment: 100, node: 120 };
    const CHILD_W = 220;
    const CHILD_GAP = 10;
    const CHILD_PAD = 12;

    const childH = CHILD_H[type] ?? 52;
    const rfType = type === "node" ? "deploymentNode" : type;

    // Stack below existing siblings (positions are relative to parent)
    const prev = flowNodesRef.current;
    const siblings = prev.filter((n) => n.parentId === parentId);
    const lastY = siblings.reduce((max, s) => {
      const h = (s.style?.height as number) ?? 52;
      return Math.max(max, s.position.y + h);
    }, HEADER_H + CHILD_PAD);
    const childY = siblings.length === 0 ? HEADER_H + CHILD_PAD : lastY + CHILD_GAP;

    const newChild: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: rfType,
      position: { x: CHILD_PAD, y: childY },
      data: { label: defaultLabel },
      draggable: true,
      parentId,
      extent: "parent",
      style: { width: CHILD_W, height: childH },
    };

    const updated = [...prev, newChild];
    flowNodesRef.current = updated;
    setFlowNodes(updated);
    skipNextSyncRef.current = true;
    nodeIdSetRef.current = new Set(updated.map((n) => n.id));
    if (onNodesChange) {
      onNodesChange(flowNodesToDiagramNodes(updated, diagramNodes));
    }
  }, [diagramNodes, onNodesChange]);

  const handleAddNode = useCallback((type: string, defaultLabel: string) => {
    // Child-only types must be added via right-click on a parent, not the toolbar
    if (CHILD_ONLY_TYPES.has(type)) return;

    const rfType = type === "node" ? "deploymentNode" : type;
    const isContainer = type === "node";
    const prev = flowNodesRef.current;
    const offset = prev.length * 20;

    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: rfType,
      position: { x: 200 + offset, y: 200 + offset },
      data: { label: defaultLabel },
      draggable: true,
      style: isContainer ? { width: 280, height: 160 } : undefined,
    };

    const updated = [...prev, newNode];
    flowNodesRef.current = updated;
    setFlowNodes(updated);
    skipNextSyncRef.current = true;
    nodeIdSetRef.current = new Set(updated.map((n) => n.id));
    if (onNodesChange) {
      onNodesChange(flowNodesToDiagramNodes(updated, diagramNodes));
    }
  }, [diagramNodes, onNodesChange]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.15 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        {!isSeq && <MiniMap nodeColor="#1e40af" />}
        {!readOnly && (NODE_PALETTE[diagramType ?? ""] ?? []).length > 0 && (
          <Panel position="top-left">
            <div style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "8px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontFamily: "system-ui, sans-serif",
            }}>
              <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                Add Node
              </div>
              {(NODE_PALETTE[diagramType ?? ""] ?? []).map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddNode(item.type, item.defaultLabel)}
                  title={`Add ${item.label}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: `1.5px solid ${item.color}`,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    color: item.color,
                    whiteSpace: "nowrap",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${item.color}18`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                >
                  <span style={{ fontSize: 14 }}>＋</span>
                  {item.label}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          target={ctxMenu.target}
          onDelete={handleDelete}
          onEditLabel={handleEditLabel}
          onEditColumns={isErd ? handleEditColumns : undefined}
          onAddChild={isDeploy ? handleAddDeployChild : undefined}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {editTarget && (
        <EditLabelDialog
          current={editTarget.current}
          onSave={handleSaveLabel}
          onClose={() => setEditTarget(null)}
        />
      )}
      {columnEdit && (
        <ColumnEditorDialog
          tableName={columnEdit.label}
          columns={columnEdit.columns}
          onSave={handleSaveColumns}
          onClose={() => setColumnEdit(null)}
        />
      )}
    </div>
  );
}
