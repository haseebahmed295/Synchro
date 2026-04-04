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
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramEdge, DiagramNode, NodeType } from "@/lib/types/diagram";

import { ColumnEditorDialog, ContextMenu, EditLabelDialog, type CtxTarget } from "./shared";
import { ClassNode } from "./nodes-class";
import { LifelineNode, SequenceEdge, FragmentNode, SEQ_MSG_START_Y, SEQ_MSG_SPACING, computeActivations } from "./nodes-sequence";
import { ArtifactNode, ComponentNode, DeploymentNode, ExecEnvNode, InterfaceNode } from "./nodes-deployment";
import { ComponentDiagramNode, ProvidedInterfaceNode, RequiredInterfaceNode, BoundaryNode } from "./nodes-component";
import { ErdTableNode } from "./nodes-erd";
import { ErdEdge, ErdMarkerDefs } from "./edges-erd";
import { FlowDecision, FlowIO, FlowProcess, FlowTerminal } from "./nodes-flowchart";
import { UmlClassEdge, UmlMarkerDefs } from "./edges-class";
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
          // Preserve inline-edited attributes/methods from the flow node
          ...(fn.data.attributes !== undefined && fn.data.attributes !== null ? { attributes: fn.data.attributes as string[] } : {}),
          ...(fn.data.methods !== undefined && fn.data.methods !== null ? { methods: fn.data.methods as string[] } : {}),
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
  fragment: FragmentNode,
  class: ClassNode,
  entity: ErdTableNode,
  // deployment
  deploymentNode: DeploymentNode,
  executionEnvironment: ExecEnvNode,
  component: ComponentNode,
  artifact: ArtifactNode,
  interface: InterfaceNode,
  // component diagram
  componentDiagram: ComponentDiagramNode,
  providedInterface: ProvidedInterfaceNode,
  requiredInterface: RequiredInterfaceNode,
  boundary: BoundaryNode,
  // flowchart
  process: FlowProcess,
  decision: FlowDecision,
  terminal: FlowTerminal,
  io: FlowIO,
};
const edgeTypes = { sequence: SequenceEdge, umlClass: UmlClassEdge, erdEdge: ErdEdge };

// ─── Flow edge → DiagramEdge ──────────────────────────────────────────────────
function flowEdgeToDiagram(fe: Edge, orig: DiagramEdge | undefined): DiagramEdge {
  if (orig) {
    const d = fe.data as Record<string, unknown> | undefined;
    return {
      ...orig,
      label: (fe.label as string | undefined) ?? orig.label,
      // sequence
      ...(d?.msgType !== undefined ? { msgType: d.msgType as DiagramEdge["msgType"] } : {}),
      ...(d?.msgY !== undefined ? { msgY: d.msgY as number } : {}),
      // uml class
      ...(d?.relType !== undefined ? { type: d.relType as DiagramEdge["type"] } : {}),
      ...(d?.sourceMultiplicity !== undefined || d?.targetMultiplicity !== undefined
        ? { multiplicity: { source: d?.sourceMultiplicity as string, target: d?.targetMultiplicity as string } }
        : {}),
      // erd crow's foot
      ...(d?.sourceMult !== undefined || d?.targetMult !== undefined
        ? { multiplicity: { source: d?.sourceMult as string, target: d?.targetMult as string } }
        : {}),
      ...(fe.sourceHandle !== undefined && fe.sourceHandle !== null ? { sourceHandle: fe.sourceHandle as string } : {}),
      ...(fe.targetHandle !== undefined && fe.targetHandle !== null ? { targetHandle: fe.targetHandle as string } : {}),
    };
  }
  return { 
    id: fe.id, 
    source: fe.source, 
    target: fe.target, 
    type: "association", 
    ...(fe.sourceHandle ? { sourceHandle: fe.sourceHandle as string } : {}), 
    ...(fe.targetHandle ? { targetHandle: fe.targetHandle as string } : {}) 
  };
}

// ─── Callback injection helpers ──────────────────────────────────────────────────
// Inject onUpdate (visibility cycling) and onEditMembers (open dialog) into class nodes.
function injectClassCallbacks(
  nodes: Node[],
  onUpdate: (id: string, patch: Record<string, unknown>) => void,
  onEditMembers: (id: string, label: string, field: "attributes" | "methods") => void,
  onEdgeDataChange: (id: string, patch: Record<string, unknown>) => void,
): Node[] {
  return nodes.map((n) => {
    if (n.type !== "class") return n;
    return {
      ...n,
      data: {
        ...n.data,
        onUpdate: (patch: Record<string, unknown>) => onUpdate(n.id, patch),
        onEditMembers: (field: "attributes" | "methods") => onEditMembers(n.id, String(n.data.label ?? ""), field),
      },
    };
  });
}

function injectEdgeCallbacks(
  edges: Edge[],
  onDataChange: (id: string, patch: Record<string, unknown>) => void,
): Edge[] {
  return edges.map((e) => {
    if (e.type !== "umlClass" && e.type !== "erdEdge") return e;
    return { ...e, data: { ...e.data, onDataChange: (patch: Record<string, unknown>) => onDataChange(e.id, patch) } };
  });
}

const NODE_PALETTE: Record<string, Array<{ type: string; label: string; defaultLabel: string; color: string }>> = {
  class: [
    { type: "class",  label: "Class",      defaultLabel: "NewClass",      color: "#1e40af" },
    { type: "entity", label: "Entity",     defaultLabel: "NewEntity",     color: "#7c3aed" },
  ],
  erd: [
    { type: "entity", label: "Table",      defaultLabel: "new_table",     color: "#7c3aed" },
  ],
  sequence: [
    { type: "lifeline",  label: "Lifeline",  defaultLabel: "Component", color: "#374151" },
    { type: "actor",     label: "Actor",     defaultLabel: "Actor",     color: "#374151" },
    { type: "fragment",  label: "Fragment",  defaultLabel: "alt",       color: "#6366f1" },
  ],
  deployment: [
    { type: "node", label: "Node", defaultLabel: "Server", color: "#1e40af" },
  ],
  component: [
    { type: "component",  label: "Component", defaultLabel: "Component", color: "#6366f1" },
    { type: "boundary",   label: "Boundary",  defaultLabel: "System",    color: "#64748b" },
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
  onNodeClick?: (nodeId: string) => void;
  highlightNodeId?: string | null;
  readOnly?: boolean;
}

export function DiagramCanvas({
  nodes: diagramNodes,
  edges: diagramEdges,
  diagramType,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  highlightNodeId,
  readOnly = false,
}: DiagramCanvasProps) {
  const isSeq = diagramType === "sequence";
  const isDeploy = diagramType === "deployment";
  const isErd = diagramType === "erd";
  const isFlow = diagramType === "flowchart";
  const isComp = diagramType === "component";

  // Stable callback refs so we can inject them into node/edge data without stale closures
  const classNodeUpdateRef = useRef<(id: string, patch: Record<string, unknown>) => void>(() => {});
  const editClassMembersRef = useRef<(id: string, label: string, field: "attributes" | "methods") => void>(() => {});
  const umlEdgeDataChangeRef = useRef<(id: string, patch: Record<string, unknown>) => void>(() => {});

  const [flowNodes, setFlowNodes] = useState<Node[]>(() => toFlowNodes(diagramNodes, isSeq, isDeploy, isComp, diagramEdges));
  const [flowEdges, setFlowEdges] = useState<Edge[]>(() => toFlowEdges(diagramEdges, isSeq, isErd, isFlow, isComp));
  // Keep a mutable ref to the latest flowNodes so callbacks never read stale state
  const flowNodesRef = useRef(flowNodes);
  useEffect(() => { flowNodesRef.current = flowNodes; }, [flowNodes]);
  const flowEdgesRef = useRef(flowEdges);
  useEffect(() => { flowEdgesRef.current = flowEdges; }, [flowEdges]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: CtxTarget } | null>(null);
  const [editTarget, setEditTarget] = useState<{ kind: "node" | "edge"; id: string; current: string } | null>(null);
  const [columnEdit, setColumnEdit] = useState<{ id: string; label: string; columns: string[] } | null>(null);
  const [interfaceEdit, setInterfaceEdit] = useState<{ id: string; label: string; field: "provided" | "required"; values: string[] } | null>(null);
  const [classMemberEdit, setClassMemberEdit] = useState<{ id: string; label: string; field: "attributes" | "methods"; values: string[] } | null>(null);
  const [pendingConnectSource, setPendingConnectSource] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [erdSearch, setErdSearch] = useState("");
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // ─── Inline class node editing (visibility cycling) ─────────────────────────
  const handleClassNodeUpdate = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    const updated = flowNodesRef.current.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
    );
    const withCbs = injectClassCallbacks(updated, classNodeUpdateRef.current, editClassMembersRef.current, umlEdgeDataChangeRef.current);
    flowNodesRef.current = withCbs;
    setFlowNodes(withCbs);
    if (onNodesChange) onNodesChange(flowNodesToDiagramNodes(withCbs, diagramNodes));
  }, [diagramNodes, onNodesChange]);

  // ─── Inline UML edge data change (type, multiplicity) ────────────────────────
  const handleUmlEdgeDataChange = useCallback((edgeId: string, patch: Record<string, unknown>) => {
    const updated = flowEdgesRef.current.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, ...patch } } : e
    );
    const withCbs = injectEdgeCallbacks(updated, umlEdgeDataChangeRef.current);
    flowEdgesRef.current = withCbs;
    setFlowEdges(withCbs);
    if (onEdgesChange) {
      onEdgesChange(updated.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        const d = fe.data as Record<string, unknown> | undefined;
        return orig
          ? { ...orig, type: (d?.relType as DiagramEdge["type"]) ?? orig.type, multiplicity: { source: d?.sourceMultiplicity as string, target: d?.targetMultiplicity as string } }
          : { id: fe.id, source: fe.source, target: fe.target, type: "association" as const };      }));
    }
  }, [diagramEdges, onEdgesChange]);

  // Keep refs in sync with latest callbacks, and re-inject into nodes/edges when they change
  useEffect(() => {
    classNodeUpdateRef.current = handleClassNodeUpdate;
  }, [handleClassNodeUpdate]);

  useEffect(() => {
    umlEdgeDataChangeRef.current = handleUmlEdgeDataChange;
    setFlowEdges((prev) => injectEdgeCallbacks(prev, handleUmlEdgeDataChange));
  }, [handleUmlEdgeDataChange]);


  // Highlight a node when navigating from requirements table
  useEffect(() => {
    if (!highlightNodeId) return;
    setFlowNodes((prev) => prev.map((n) => ({
      ...n,
      style: n.id === highlightNodeId
        ? { ...n.style, outline: "3px solid #6366f1", outlineOffset: "2px", borderRadius: "6px" }
        : n.style,
    })));
    // Remove highlight after 2s
    const t = setTimeout(() => {
      setFlowNodes((prev) => prev.map((n) => {
        if (n.id !== highlightNodeId) return n;
        const { outline, outlineOffset, borderRadius, ...rest } = n.style as any ?? {};
        return { ...n, style: Object.keys(rest).length ? rest : undefined };
      }));
    }, 2000);
    return () => clearTimeout(t);
  }, [highlightNodeId]);

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
      const comp = diagramTypeRef.current === "component";
      const newNodes = toFlowNodes(diagramNodes, seq, deploy, comp, diagramEdges);
      const newEdges = toFlowEdges(diagramEdges, seq, erd, flow, comp);
      setFlowNodes(injectClassCallbacks(newNodes, classNodeUpdateRef.current, editClassMembersRef.current, umlEdgeDataChangeRef.current));
      setFlowEdges(injectEdgeCallbacks(newEdges, umlEdgeDataChangeRef.current));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramNodes, diagramEdges]);

  // Auto-expand container nodes to always fit their children
  useAutoResizeContainers(flowNodes, setFlowNodes);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Lock lifeline nodes to horizontal movement only (Y-axis fixed at 40)
    const lockedChanges = isSeq ? changes.map((c) => {
      if (c.type === "position" && c.position) {
        const node = flowNodesRef.current.find((n) => n.id === c.id);
        if (node?.type === "lifeline") {
          return { ...c, position: { x: c.position.x, y: 40 } };
        }
      }
      return c;
    }) : changes;
    const updated = applyNodeChanges(lockedChanges, flowNodesRef.current);
    // Re-inject callbacks after every change since applyNodeChanges may strip functions from data
    const withCbs = injectClassCallbacks(updated, classNodeUpdateRef.current, editClassMembersRef.current, umlEdgeDataChangeRef.current);
    flowNodesRef.current = withCbs;
    setFlowNodes(withCbs);
    if (onNodesChange) {
      onNodesChange(flowNodesToDiagramNodes(withCbs, diagramNodes));
    }
  }, [diagramNodes, onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updated = applyEdgeChanges(changes, flowEdgesRef.current);
    const withCbs = injectEdgeCallbacks(updated, umlEdgeDataChangeRef.current);
    flowEdgesRef.current = withCbs;
    setFlowEdges(withCbs);

    // For sequence diagrams, recompute activation boxes on lifeline nodes
    if (isSeq) {
      const seqEdges = withCbs.filter((e) => e.type === "sequence");
      const activationMap = computeActivations(seqEdges);
      setFlowNodes((prev) => {
        const patched = prev.map((n) => {
          if (n.type !== "lifeline") return n;
          return { ...n, data: { ...n.data, activations: activationMap.get(n.id) ?? [] } };
        });
        flowNodesRef.current = patched;
        return patched;
      });
    }

    if (onEdgesChange) {
      // Convert to DiagramEdges and sort by msgY for sequence diagrams
      let diagramResult = withCbs.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return flowEdgeToDiagram(fe, orig);
      });
      if (isSeq) {
        diagramResult = diagramResult
          .sort((a, b) => (a.msgY ?? 0) - (b.msgY ?? 0))
          .map((e, i) => ({ ...e, order: i + 1 }));
      }
      onEdgesChange(diagramResult);
    }
  }, [isSeq, diagramEdges, onEdgesChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const edgeDefaults: Partial<Edge> = isFlow
      ? {
          type: "default",
          style: { stroke: "#6366f1", strokeWidth: 2, strokeDasharray: "6 3" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1", width: 14, height: 14 },
        }
      : isComp
      ? (() => {
          // Smart inference for label
          let edgeLabel = "«interface»";
          if (connection.sourceHandle && connection.sourceHandle.startsWith("provided-")) {
            edgeLabel = `«${connection.sourceHandle.replace("provided-", "")}»`;
          } else if (connection.targetHandle && connection.targetHandle.startsWith("required-")) {
            edgeLabel = `«${connection.targetHandle.replace("required-", "")}»`;
          }

          return {
            type: "smoothstep",
            label: edgeLabel,
            style: { stroke: "#6366f1", strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1", width: 14, height: 14 },
            labelStyle: { fill: "#6366f1", fontWeight: 600, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
            labelBgStyle: { fill: "white", fillOpacity: 0.9 },
          };
        })()
      : !isSeq && !isDeploy && !isErd
      ? {
          type: "umlClass",
          data: { relType: "association", sourceMultiplicity: "", targetMultiplicity: "" },
        }
      : isErd
      ? {
          type: "erdEdge",
          data: { sourceMult: "1", targetMult: "0..*" },
        }
      : {};
    const updated = addEdge({ ...connection, ...edgeDefaults }, flowEdgesRef.current);
    const withCbs = injectEdgeCallbacks(updated, umlEdgeDataChangeRef.current);
    flowEdgesRef.current = withCbs;
    setFlowEdges(withCbs);
    // Recompute activations for sequence diagrams
    if (isSeq) {
      const seqEdges = withCbs.filter((e) => e.type === "sequence");
      const activationMap = computeActivations(seqEdges);
      setFlowNodes((prev) => {
        const patched = prev.map((n) => {
          if (n.type !== "lifeline") return n;
          return { ...n, data: { ...n.data, activations: activationMap.get(n.id) ?? [] } };
        });
        flowNodesRef.current = patched;
        return patched;
      });
    }
    if (onEdgesChange) {
      let diagramResult = withCbs.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return flowEdgeToDiagram(fe, orig);
      });
      if (isSeq) {
        diagramResult = diagramResult
          .sort((a, b) => (a.msgY ?? 0) - (b.msgY ?? 0))
          .map((e, i) => ({ ...e, order: i + 1 }));
      }
      onEdgesChange(diagramResult);
    }
  }, [isFlow, isSeq, diagramEdges, onEdgesChange]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    e.preventDefault();
    setPendingConnectSource(null);
    setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: "node", id: node.id, label: String(node.data.label ?? ""), nodeType: node.type } });
  }, [readOnly]);

  const handleStartConnect = useCallback((sourceId: string) => {
    setPendingConnectSource(sourceId);
  }, []);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (!pendingConnectSource) return;
    if (node.id === pendingConnectSource) { setPendingConnectSource(null); return; }

    // For sequence diagrams use the sequence edge type with a default msgY
    const existingSeqEdges = flowEdgesRef.current.filter((e) => e.type === "sequence");
    const newEdge: Edge = isSeq
      ? {
          id: `edge_${Date.now()}`,
          source: pendingConnectSource,
          target: node.id,
          type: "sequence",
          label: "",
          data: { msgY: SEQ_MSG_START_Y + existingSeqEdges.length * SEQ_MSG_SPACING, msgType: "sync" },
        }
      : {
          id: `edge_${Date.now()}`,
          source: pendingConnectSource,
          target: node.id,
          type: "umlClass",
          data: {
            relType: "association",
            sourceMultiplicity: "",
            targetMultiplicity: "",
            onDataChange: (patch: Record<string, unknown>) => umlEdgeDataChangeRef.current(`edge_${Date.now()}`, patch),
          },
        };
    const updated = [...flowEdgesRef.current, newEdge];
    const withCbs = injectEdgeCallbacks(updated, umlEdgeDataChangeRef.current);
    flowEdgesRef.current = withCbs;
    setFlowEdges(withCbs);
    setPendingConnectSource(null);
    // Recompute activations for sequence diagrams
    if (isSeq) {
      const seqEdges = withCbs.filter((e) => e.type === "sequence");
      const activationMap = computeActivations(seqEdges);
      setFlowNodes((prev) => {
        const patched = prev.map((n) => {
          if (n.type !== "lifeline") return n;
          return { ...n, data: { ...n.data, activations: activationMap.get(n.id) ?? [] } };
        });
        flowNodesRef.current = patched;
        return patched;
      });
    }
    if (onEdgesChange) {
      let diagramResult = updated.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return flowEdgeToDiagram(fe, orig);
      });
      if (isSeq) {
        diagramResult = diagramResult
          .sort((a, b) => (a.msgY ?? 0) - (b.msgY ?? 0))
          .map((e, i) => ({ ...e, order: i + 1 }));
      }
      onEdgesChange(diagramResult);
    }
  }, [pendingConnectSource, isSeq, diagramEdges, onEdgesChange]);
  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    if (readOnly) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, target: { kind: "edge", id: edge.id, label: String(edge.label ?? "") } });
  }, [readOnly]);

  const handleDelete = useCallback((kind: "node" | "edge", id: string) => {
    if (kind === "node") {
      // Collect the node and all its descendants (children, grandchildren, etc.)
      const toDelete = new Set<string>();
      const queue = [id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        toDelete.add(current);
        // Find all nodes whose parentId is current (ReactFlow children)
        for (const n of flowNodesRef.current) {
          if (n.parentId === current) queue.push(n.id);
        }
      }

      const updatedNodes = flowNodesRef.current.filter((n) => !toDelete.has(n.id));
      flowNodesRef.current = updatedNodes;
      setFlowNodes(updatedNodes);
      skipNextSyncRef.current = true;
      nodeIdSetRef.current = new Set(updatedNodes.map((n) => n.id));
      if (onNodesChange) {
        onNodesChange(flowNodesToDiagramNodes(updatedNodes, diagramNodes));
      }
      // Remove edges connected to any deleted node
      const updatedEdges = flowEdgesRef.current.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
      flowEdgesRef.current = updatedEdges;
      setFlowEdges(updatedEdges);
      if (onEdgesChange) {
        onEdgesChange(updatedEdges.map((fe) => {
          const orig = diagramEdges.find((e) => e.id === fe.id);
          return flowEdgeToDiagram(fe, orig);
        }));
      }
    } else {
      const updatedEdges = flowEdgesRef.current.filter((e) => e.id !== id);
      flowEdgesRef.current = updatedEdges;
      setFlowEdges(updatedEdges);
      if (onEdgesChange) {
        onEdgesChange(updatedEdges.map((fe) => {
          const orig = diagramEdges.find((e) => e.id === fe.id);
          return flowEdgeToDiagram(fe, orig);
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

  const handleEditInterfaces = useCallback((id: string, label: string, field: "provided" | "required") => {
    const node = flowNodesRef.current.find((n) => n.id === id);
    const dataKey = field === "provided" ? "attributes" : "methods";
    const values = (node?.data[dataKey] as string[]) ?? [];
    setInterfaceEdit({ id, label, field, values });
  }, []);

  const handleSaveInterfaces = useCallback((newValues: string[]) => {
    if (!interfaceEdit) return;
    const dataKey = interfaceEdit.field === "provided" ? "attributes" : "methods";
    const updated = flowNodesRef.current.map((n) =>
      n.id === interfaceEdit.id ? { ...n, data: { ...n.data, [dataKey]: newValues } } : n
    );
    flowNodesRef.current = updated;
    setFlowNodes(updated);
    if (onNodesChange) onNodesChange(flowNodesToDiagramNodes(updated, diagramNodes));
    setInterfaceEdit(null);
  }, [interfaceEdit, diagramNodes, onNodesChange]);

  const handleEditClassMembers = useCallback((id: string, label: string, field: "attributes" | "methods") => {
    const node = flowNodesRef.current.find((n) => n.id === id);
    const values = (node?.data[field] as string[]) ?? [];
    setClassMemberEdit({ id, label, field, values });
  }, []);

  // Keep ref in sync and re-inject into class nodes so the hover buttons open the dialog
  useEffect(() => {
    editClassMembersRef.current = handleEditClassMembers;
    setFlowNodes((prev) => injectClassCallbacks(prev, classNodeUpdateRef.current, handleEditClassMembers, umlEdgeDataChangeRef.current));
  }, [handleEditClassMembers]);

  const handleSaveClassMembers = useCallback((newValues: string[]) => {
    if (!classMemberEdit) return;
    const updated = flowNodesRef.current.map((n) =>
      n.id === classMemberEdit.id ? { ...n, data: { ...n.data, [classMemberEdit.field]: newValues } } : n
    );
    const withCbs = injectClassCallbacks(updated, classNodeUpdateRef.current, editClassMembersRef.current, umlEdgeDataChangeRef.current);
    flowNodesRef.current = withCbs;
    setFlowNodes(withCbs);
    if (onNodesChange) onNodesChange(flowNodesToDiagramNodes(withCbs, diagramNodes));
    setClassMemberEdit(null);
  }, [classMemberEdit, diagramNodes, onNodesChange]);
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
    const HEADER_H = 56;
    const CHILD_H: Record<string, number> = { artifact: 68, component: 80, interface: 68, executionEnvironment: 120, node: 140 };
    const CHILD_W = 260;
    const CHILD_GAP = 16;
    const CHILD_PAD = 16;

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
    // Exception: "component" is top-level in component diagrams
    const blocked = isDeploy ? CHILD_ONLY_TYPES : new Set([...CHILD_ONLY_TYPES].filter((t) => t !== "component"));
    if (blocked.has(type)) return;

    const rfType = type === "node" ? "deploymentNode" : type === "component" && isComp ? "componentDiagram" : type === "boundary" ? "boundary" : type;
    const isContainer = type === "node" || type === "boundary";
    const prev = flowNodesRef.current;
    const offset = prev.length * 20;

    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: rfType,
      position: { x: 200 + offset, y: 200 + offset },
      data: { label: defaultLabel },
      draggable: true,
      style: isContainer ? { width: type === "boundary" ? 400 : 280, height: type === "boundary" ? 300 : 160 } : undefined,
      zIndex: type === "boundary" ? -1 : undefined,
    };

    const updated = [...prev, newNode];
    const withCbs = injectClassCallbacks(updated, classNodeUpdateRef.current, editClassMembersRef.current, umlEdgeDataChangeRef.current);
    flowNodesRef.current = withCbs;
    setFlowNodes(withCbs);
    skipNextSyncRef.current = true;
    nodeIdSetRef.current = new Set(withCbs.map((n) => n.id));
    if (onNodesChange) {
      onNodesChange(flowNodesToDiagramNodes(withCbs, diagramNodes));
    }
  }, [diagramNodes, onNodesChange]);

  // ─── Edge/node hover highlighting ────────────────────────────────────────────
  const highlightedEdgeIds = new Set<string>();
  if (hoveredEdgeId) highlightedEdgeIds.add(hoveredEdgeId);
  if (hoveredNodeId) {
    for (const e of flowEdges) {
      if (e.source === hoveredNodeId || e.target === hoveredNodeId) highlightedEdgeIds.add(e.id);
    }
  }
  const hasHighlight = highlightedEdgeIds.size > 0;
  const displayEdges = hasHighlight
    ? flowEdges.map((e) => {
        const isHot = highlightedEdgeIds.has(e.id);
        return {
          ...e,
          style: isHot
            ? { ...(e.style ?? {}), stroke: "#2563eb", strokeWidth: 3, opacity: 1 }
            : { ...(e.style ?? {}), opacity: 0.15 },
          zIndex: isHot ? 10 : 0,
        };
      })
    : flowEdges;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <UmlMarkerDefs />
      <ErdMarkerDefs />
      <ReactFlow
        nodes={flowNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeClick={pendingConnectSource ? handleNodeClick : (onNodeClick ? (_e, node) => onNodeClick(node.id) : undefined)}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onEdgeMouseEnter={(_e, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        onNodeMouseEnter={(_e, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        nodesDraggable={!readOnly && !pendingConnectSource}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        connectOnClick={!readOnly}
        style={pendingConnectSource ? { cursor: "crosshair" } : undefined}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        snapToGrid={isFlow}
        snapGrid={[20, 20]}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        {!isSeq && <MiniMap nodeColor="#1e40af" />}

        {/* ERD search bar */}
        {isErd && (
          <Panel position="top-right" style={{ zIndex: 10 }}>
            <div style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "system-ui, sans-serif",
            }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>🔍</span>
              <input
                value={erdSearch}
                onChange={(e) => {
                  const q = e.target.value;
                  setErdSearch(q);
                  if (!q.trim()) return;
                  const match = flowNodesRef.current.find((n) =>
                    String(n.data.label ?? "").toLowerCase().includes(q.toLowerCase())
                  );
                  if (match && rfInstanceRef.current) {
                    const w = (match.measured?.width ?? 240);
                    const h = (match.measured?.height ?? 200);
                    rfInstanceRef.current.fitBounds(
                      { x: match.position.x, y: match.position.y, width: w, height: h },
                      { padding: 0.4, duration: 400 }
                    );
                    // Flash highlight
                    setFlowNodes((prev) => prev.map((n) => ({
                      ...n,
                      style: n.id === match.id
                        ? { ...n.style, outline: "3px solid #6366f1", outlineOffset: "2px", borderRadius: "6px" }
                        : n.style,
                    })));
                    setTimeout(() => {
                      setFlowNodes((prev) => prev.map((n) => {
                        if (n.id !== match.id) return n;
                        const { outline, outlineOffset, ...rest } = (n.style ?? {}) as any;
                        return { ...n, style: Object.keys(rest).length ? rest : undefined };
                      }));
                    }, 2000);
                  }
                }}
                placeholder="Find table…"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 12,
                  width: 140,
                  color: "#1e293b",
                  background: "transparent",
                }}
              />
              {erdSearch && (
                <button
                  onClick={() => setErdSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14, padding: 0, lineHeight: 1 }}
                >×</button>
              )}
            </div>
          </Panel>
        )}
        {pendingConnectSource && (
          <Panel position="top-center" style={{ zIndex: 10 }}>
            <div style={{
              background: "#2563eb", color: "#fff", borderRadius: 8,
              padding: "6px 16px", fontSize: 13, fontWeight: 500,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 10,
            }}>
              🔗 Click a node to connect — or{" "}
              <button
                onClick={() => setPendingConnectSource(null)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </Panel>
        )}
        {!readOnly && (NODE_PALETTE[diagramType ?? ""] ?? []).length > 0 && (
          <Panel position="top-left" style={{ zIndex: 10 }}>
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
          onEditInterfaces={isComp ? handleEditInterfaces : undefined}
          onEditClassMembers={!isErd && !isComp && !isSeq && !isDeploy && !isFlow ? handleEditClassMembers : undefined}
          onAddChild={isDeploy ? handleAddDeployChild : undefined}
          onStartConnect={isSeq ? handleStartConnect : undefined}
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
      {interfaceEdit && (
        <ColumnEditorDialog
          tableName={`${interfaceEdit.label} — ${interfaceEdit.field === "provided" ? "Provided" : "Required"} Interfaces`}
          columns={interfaceEdit.values}
          onSave={handleSaveInterfaces}
          onClose={() => setInterfaceEdit(null)}
          mode="interface"
        />
      )}
      {classMemberEdit && (
        <ColumnEditorDialog
          tableName={classMemberEdit.label}
          columns={classMemberEdit.values}
          onSave={handleSaveClassMembers}
          onClose={() => setClassMemberEdit(null)}
          mode={classMemberEdit.field === "attributes" ? "attribute" : "method"}
        />
      )}
    </div>
  );
}
