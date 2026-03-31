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
  EdgeLabelRenderer,
  type EdgeProps,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagramEdge, DiagramNode } from "@/lib/types/diagram";

// ─── Sequence diagram constants ───────────────────────────────────────────────
const SEQ_MSG_START_Y = 100;
const SEQ_MSG_SPACING = 40;
const SEQ_LIFELINE_HEIGHT = 600;
const SEQ_COL_SPACING = 280;

// ─── UML Class node ────────────────────────────────────────────────────────────
function ClassNode({ data }: NodeProps) {
  const attrs: string[] = (data.attributes as string[]) ?? [];
  const methods: string[] = (data.methods as string[]) ?? [];
  const stereotype = data.stereotype as string | undefined;

  return (
    <div style={{
      border: "1.5px solid #374151",
      borderRadius: 4,
      background: "#fff",
      width: 200,
      maxHeight: 220,
      overflow: "hidden",
      fontSize: 11,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        background: "#1e40af",
        color: "#fff",
        padding: "6px 12px",
        textAlign: "center",
        borderRadius: "2px 2px 0 0",
      }}>
        {stereotype && (
          <div style={{ fontSize: 10, opacity: 0.85 }}>&laquo;{stereotype}&raquo;</div>
        )}
        <div style={{ fontWeight: 700, fontSize: 13 }}>{String(data.label)}</div>
      </div>
      {/* Attributes */}
      {attrs.length > 0 && (
        <div style={{ borderTop: "1px solid #d1d5db", padding: "4px 10px" }}>
          {attrs.map((a, i) => (
            <div key={i} style={{ color: "#374151", lineHeight: 1.6 }}>{a}</div>
          ))}
        </div>
      )}
      {/* Methods */}
      {methods.length > 0 && (
        <div style={{ borderTop: "1px solid #d1d5db", padding: "4px 10px" }}>
          {methods.map((m, i) => (
            <div key={i} style={{ color: "#374151", lineHeight: 1.6 }}>{m}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#6b7280" }} />
      <Handle type="target" position={Position.Left} style={{ background: "#6b7280" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#6b7280" }} />
      <Handle type="target" position={Position.Top} style={{ background: "#6b7280" }} />
    </div>
  );
}

// ─── Lifeline node (sequence diagrams) ────────────────────────────────────────
function LifelineNode({ data }: NodeProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        border: "2px solid #374151",
        borderRadius: 4,
        background: "#f9fafb",
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
        minWidth: 140,
        maxWidth: 240,
        textAlign: "center",
        color: "#111827",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        {String(data.label)}
      </div>
      <div style={{ width: 0, height: SEQ_LIFELINE_HEIGHT, borderLeft: "2px dashed #9ca3af" }} />
      {Array.from({ length: 20 }, (_, i) => (
        <Handle key={`s-${i}`} type="source" position={Position.Right} id={`msg-${i}`}
          style={{ top: 44 + i * SEQ_MSG_SPACING, right: -5, width: 1, height: 1, background: "transparent", border: "none" }} />
      ))}
      {Array.from({ length: 20 }, (_, i) => (
        <Handle key={`t-${i}`} type="target" position={Position.Left} id={`msg-${i}`}
          style={{ top: 44 + i * SEQ_MSG_SPACING, left: -5, width: 1, height: 1, background: "transparent", border: "none" }} />
      ))}
    </div>
  );
}

// ─── Sequence message edge ─────────────────────────────────────────────────────
function SequenceEdge({ id, source, target, label, data }: EdgeProps) {
  const nodes = useStore((s) => s.nodes);
  const srcNode = nodes.find((n) => n.id === source);
  const tgtNode = nodes.find((n) => n.id === target);
  if (!srcNode || !tgtNode) return null;

  const srcW = srcNode.measured?.width ?? 160;
  const tgtW = tgtNode.measured?.width ?? 160;
  const x1 = srcNode.position.x + srcW / 2;
  const x2 = tgtNode.position.x + tgtW / 2;
  const y = (data?.msgY as number) ?? SEQ_MSG_START_Y;
  const midX = (x1 + x2) / 2;
  const goingRight = x2 > x1;
  const markerId = `arrow-${id}`;

  return (
    <>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
        </marker>
      </defs>
      <line
        x1={x1} y1={y}
        x2={goingRight ? x2 - 1 : x2 + 1} y2={y}
        stroke="#374151" strokeWidth={1.5}
        markerEnd={`url(#${markerId})`}
      />
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%, -100%) translate(${midX}px,${y - 3}px)`,
            fontSize: 11,
            color: "#1f2937",
            background: "rgba(255,255,255,0.95)",
            padding: "1px 5px",
            borderRadius: 3,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            border: "1px solid #e5e7eb",
          }}>
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ─── Deployment diagram nodes ──────────────────────────────────────────────────

function DeviceNode({ data }: NodeProps) {
  return (
    <div style={{
      border: "2px solid #92400e",
      borderRadius: 6,
      background: "#fef3c7",
      width: "100%",
      height: "100%",
      boxShadow: "2px 2px 8px rgba(0,0,0,0.15)",
      position: "relative",
      boxSizing: "border-box",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 22, height: 22,
        background: "#d97706",
        clipPath: "polygon(100% 0, 100% 100%, 0 0)",
        borderRadius: "0 6px 0 0",
      }} />
      <div style={{ padding: "10px 16px 8px", borderBottom: "1.5px solid #d97706" }}>
        <div style={{ fontSize: 10, color: "#92400e", fontStyle: "italic" }}>&laquo;device&raquo;</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>:{String(data.label)}</div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "#92400e" }} />
      <Handle type="target" position={Position.Left} style={{ background: "#92400e" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#92400e" }} />
      <Handle type="target" position={Position.Top} style={{ background: "#92400e" }} />
    </div>
  );
}

function ExecEnvNode({ data }: NodeProps) {
  return (
    <div style={{
      border: "1.5px solid #b45309",
      borderRadius: 4,
      background: "#fffbeb",
      width: "100%",
      height: "100%",
      position: "relative",
      boxSizing: "border-box",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 14, height: 14,
        background: "#d97706",
        clipPath: "polygon(100% 0, 100% 100%, 0 0)",
      }} />
      <div style={{ padding: "6px 12px 5px", borderBottom: "1px solid #d97706" }}>
        <div style={{ fontSize: 9, color: "#b45309", fontStyle: "italic" }}>&laquo;executionEnvironment&raquo;</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1c1917" }}>:{String(data.label)}</div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "#b45309", width: 6, height: 6 }} />
      <Handle type="target" position={Position.Left} style={{ background: "#b45309", width: 6, height: 6 }} />
    </div>
  );
}

function ArtifactNode({ data }: NodeProps) {
  return (
    <div style={{
      border: "1px solid #78716c",
      borderRadius: 3,
      background: "#fafaf9",
      minWidth: 160,
      padding: "5px 10px 5px 8px",
      display: "flex",
      alignItems: "center",
      gap: 6,
      position: "relative",
    }}>
      {/* Artifact file icon */}
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 1h8l4 4v10H1V1z" stroke="#78716c" strokeWidth="1.2" fill="white"/>
        <path d="M9 1v4h4" stroke="#78716c" strokeWidth="1.2" fill="none"/>
      </svg>
      <div style={{ fontSize: 11, color: "#1c1917", fontWeight: 500, whiteSpace: "nowrap" }}>
        :{String(data.label)}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "#78716c", width: 5, height: 5 }} />
      <Handle type="target" position={Position.Left} style={{ background: "#78716c", width: 5, height: 5 }} />
    </div>
  );
}

// ─── ERD Table node ────────────────────────────────────────────────────────────
// Schema color palette matching SQLhabit style
const SCHEMA_COLORS: Record<string, string> = {
  default:  "#91C4F2",
  public:   "#BEB8EB",
  auth:     "#AFA2FF",
  storage:  "#75C9C8",
  audit:    "#F6BDD1",
  analytics:"#FFD791",
};

function getSchemaColor(label: string): string {
  const schema = label.includes(".") ? label.split(".")[0] : "default";
  return SCHEMA_COLORS[schema] ?? SCHEMA_COLORS.default;
}

function ErdTableNode({ id, data }: NodeProps) {
  const attrs: string[] = (data.attributes as string[]) ?? [];
  const headerColor = getSchemaColor(String(data.label));

  return (
    <div style={{
      border: "1px solid #d1d5db",
      borderRadius: 6,
      background: "#fff",
      minWidth: 220,
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      fontFamily: "system-ui, sans-serif",
      fontSize: 12,
    }}>
      {/* Table header */}
      <div style={{
        background: headerColor,
        borderRadius: "5px 5px 0 0",
        padding: "7px 12px",
        fontWeight: 700,
        fontSize: 13,
        color: "#1e293b",
        textAlign: "center",
      }}>
        {String(data.label)}
      </div>

      {/* Column rows — each has left + right handles */}
      {attrs.map((attr, i) => {
        const isPk = attr.startsWith("🔑") || attr.toLowerCase().includes("pk") ||
          attr.split(":")[0].trim() === "id";
        const parts = attr.replace("🔑", "").split(":");
        const colName = parts[0]?.trim() ?? attr;
        const colType = parts[1]?.trim() ?? "";
        const handleId = `col-${colName}`;

        return (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 12px",
            borderTop: i === 0 ? "1px solid #e5e7eb" : "none",
            borderBottom: "1px solid #f3f4f6",
            background: isPk ? "#f8faff" : "#fff",
            position: "relative",
            minHeight: 28,
          }}>
            {/* Left handle for incoming edges */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${handleId}-left`}
              style={{ top: "50%", left: -6, width: 8, height: 8, background: "#94a3b8", border: "1.5px solid #fff" }}
            />
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#1e293b" }}>
              {isPk && <span style={{ fontSize: 10 }}>🔑</span>}
              <span style={{ fontWeight: isPk ? 600 : 400 }}>{colName}</span>
            </span>
            <span style={{ color: "#94a3b8", fontSize: 11 }}>{colType}</span>
            {/* Right handle for outgoing edges */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${handleId}-right`}
              style={{ top: "50%", right: -6, width: 8, height: 8, background: "#94a3b8", border: "1.5px solid #fff" }}
            />
          </div>
        );
      })}

      {/* Fallback handles on the node itself for edges without column info */}
      <Handle type="source" position={Position.Right} id="node-right" style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="node-left" style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="node-bottom" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} id="node-top" style={{ opacity: 0 }} />
    </div>
  );
}

// ─── Flowchart nodes ───────────────────────────────────────────────────────────

function FlowProcess({ data }: NodeProps) {
  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #6366f1",
      borderRadius: 10,
      padding: "10px 18px",
      minWidth: 160,
      textAlign: "center",
      fontSize: 13,
      fontWeight: 500,
      color: "#1e1b4b",
      boxShadow: "0 2px 8px rgba(99,102,241,0.12)",
    }}>
      {String(data.label)}
      <Handle type="target" position={Position.Top} style={{ background: "#6366f1" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#6366f1" }} />
      <Handle type="target" position={Position.Left} style={{ background: "#6366f1" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#6366f1" }} />
    </div>
  );
}

function FlowDecision({ data }: NodeProps) {
  const label = String(data.label);
  return (
    <div style={{ position: "relative", width: 160, height: 80 }}>
      <svg width="160" height="80" style={{ position: "absolute", top: 0, left: 0 }}>
        <polygon
          points="80,4 156,40 80,76 4,40"
          fill="#fef9c3"
          stroke="#ca8a04"
          strokeWidth="1.5"
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 600, color: "#713f12", textAlign: "center",
        padding: "0 20px",
      }}>
        {label}
      </div>
      <Handle type="target" position={Position.Top} style={{ background: "#ca8a04", top: 4 }} />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ background: "#16a34a", bottom: 4 }} />
      <Handle type="source" position={Position.Right} id="no" style={{ background: "#dc2626", right: 4 }} />
      <Handle type="target" position={Position.Left} style={{ background: "#ca8a04", left: 4 }} />
    </div>
  );
}

function FlowTerminal({ data }: NodeProps) {
  return (
    <div style={{
      background: "#f0fdf4",
      border: "1.5px solid #16a34a",
      borderRadius: 40,
      padding: "8px 24px",
      minWidth: 120,
      textAlign: "center",
      fontSize: 13,
      fontWeight: 600,
      color: "#14532d",
      boxShadow: "0 2px 8px rgba(22,163,74,0.12)",
    }}>
      {String(data.label)}
      <Handle type="target" position={Position.Top} style={{ background: "#16a34a" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#16a34a" }} />
      <Handle type="target" position={Position.Left} style={{ background: "#16a34a" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#16a34a" }} />
    </div>
  );
}

function FlowIO({ data }: NodeProps) {
  return (
    <div style={{ position: "relative", minWidth: 160, height: 50 }}>
      <svg width="100%" height="50" style={{ position: "absolute", top: 0, left: 0 }}>
        <polygon
          points="20,2 158,2 140,48 2,48"
          fill="#eff6ff"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
      </svg>
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 50, fontSize: 12, fontWeight: 500, color: "#1e3a8a",
        padding: "0 24px",
      }}>
        {String(data.label)}
      </div>
      <Handle type="target" position={Position.Top} style={{ background: "#3b82f6" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#3b82f6" }} />
      <Handle type="target" position={Position.Left} style={{ background: "#3b82f6" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#3b82f6" }} />
    </div>
  );
}

const nodeTypes = {
  lifeline: LifelineNode,
  actor: LifelineNode,
  class: ClassNode,
  entity: ErdTableNode,
  device: DeviceNode,
  executionEnvironment: ExecEnvNode,
  artifact: ArtifactNode,
  process: FlowProcess,
  decision: FlowDecision,
  terminal: FlowTerminal,
  io: FlowIO,
};
const edgeTypes = { sequence: SequenceEdge };

// ─── Conversion helpers ────────────────────────────────────────────────────────

function toFlowNodes(diagramNodes: DiagramNode[], isSeq: boolean, isDeploy: boolean): Node[] {
  if (isSeq) {
    const actors = diagramNodes.filter((n) => n.type === "actor");
    const lifelines = diagramNodes.filter((n) => n.type !== "actor");
    const ordered = [...actors, ...lifelines];
    return ordered.map((n, i) => ({
      id: n.id,
      type: "lifeline",
      position: { x: 60 + i * SEQ_COL_SPACING, y: 40 },
      data: { label: n.data.label },
      draggable: true,
    }));
  }

  if (isDeploy) {
    const nodeMap = new Map(diagramNodes.map((n) => [n.id, n]));

    // Build parent map
    const parentOf = new Map<string, string>();
    for (const n of diagramNodes) {
      for (const childId of (n.data.children ?? [])) {
        parentOf.set(childId, n.id);
      }
    }

    const HEADER_H = { device: 52, executionEnvironment: 42, artifact: 0 };
    const ARTIFACT_H = 40;
    const EXEC_ENV_HEADER_H = 42;
    const CHILD_GAP = 10;
    const CHILD_PAD_X = 12;
    const CHILD_PAD_TOP = 8;

    // Compute tight dimensions bottom-up
    function getDims(id: string): { w: number; h: number } {
      const n = nodeMap.get(id);
      if (!n) return { w: 180, h: ARTIFACT_H };
      const type = n.type as string;
      if (type === "artifact") return { w: 200, h: ARTIFACT_H };

      const children = n.data.children ?? [];
      if (children.length === 0) {
        return type === "executionEnvironment"
          ? { w: 220, h: EXEC_ENV_HEADER_H + 16 }
          : { w: 280, h: HEADER_H.device + 16 };
      }

      let totalChildH = CHILD_PAD_TOP;
      let maxChildW = 0;
      for (const cid of children) {
        const { w, h } = getDims(cid);
        totalChildH += h + CHILD_GAP;
        maxChildW = Math.max(maxChildW, w);
      }
      totalChildH += CHILD_PAD_TOP; // bottom padding

      const headerH = type === "device" ? HEADER_H.device : EXEC_ENV_HEADER_H;
      return {
        w: Math.max(maxChildW + CHILD_PAD_X * 2, type === "device" ? 280 : 220),
        h: headerH + totalChildH,
      };
    }

    // Compute tight child positions top-down (ignore AI child positions)
    const computedPositions = new Map<string, { x: number; y: number }>();

    function layoutChildren(parentId: string) {
      const parent = nodeMap.get(parentId);
      if (!parent) return;
      const children = parent.data.children ?? [];
      const headerH = (parent.type as string) === "device" ? HEADER_H.device : EXEC_ENV_HEADER_H;
      let currentY = headerH + CHILD_PAD_TOP;
      for (const cid of children) {
        const { w } = getDims(cid);
        computedPositions.set(cid, { x: CHILD_PAD_X, y: currentY });
        const { h } = getDims(cid);
        currentY += h + CHILD_GAP;
        layoutChildren(cid); // recurse for exec envs containing artifacts
      }
    }

    // Layout all top-level devices' children
    for (const n of diagramNodes) {
      if (!parentOf.has(n.id)) layoutChildren(n.id);
    }

    return diagramNodes.map((n) => {
      const parent = parentOf.get(n.id);
      const { w, h } = getDims(n.id);
      const pos = parent
        ? (computedPositions.get(n.id) ?? n.position)
        : n.position; // top-level devices keep AI positions

      return {
        id: n.id,
        type: n.type as string,
        position: pos,
        data: { label: n.data.label, stereotype: n.data.stereotype ?? n.type },
        draggable: !parent,
        style: { width: w, height: h },
        ...(parent ? { parentId: parent, extent: "parent" as const } : {}),
      };
    });
  }

  // Flowchart node types map directly
  const flowchartTypes = new Set(["process", "decision", "terminal", "io"]);

  return diagramNodes.map((n) => ({
    id: n.id,
    type: flowchartTypes.has(n.type) ? n.type
      : n.type === "entity" ? "entity" : "class",
    position: n.position,
    data: {
      label: n.data.label,
      attributes: n.data.attributes ?? [],
      methods: n.data.methods ?? [],
      stereotype: n.data.stereotype,
    },
    draggable: true,
  }));
}

function toFlowEdges(diagramEdges: DiagramEdge[], isSeq: boolean, isErd: boolean, isFlow: boolean): Edge[] {
  if (isSeq) {
    return diagramEdges.map((e, i) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "sequence",
      label: e.label ?? "",
      data: { msgY: SEQ_MSG_START_Y + i * SEQ_MSG_SPACING },
      animated: false,
    }));
  }

  if (isErd) {
    return diagramEdges.map((e) => {
      const edgeLabel = e.multiplicity
        ? `${e.multiplicity.source ?? "1"}:${e.multiplicity.target ?? "*"}`
        : e.label ?? undefined;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: edgeLabel,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 12, height: 12 },
      };
    });
  }

  if (isFlow) {
    return diagramEdges.map((e) => {
      const isNo = e.label?.toLowerCase() === "no";
      const isYes = e.label?.toLowerCase() === "yes";
      const color = isNo ? "#dc2626" : isYes ? "#16a34a" : "#6366f1";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "default",
        animated: false,
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: "6 3",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        labelStyle: { fill: color, fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "white", fillOpacity: 0.85 },
      };
    });
  }

  // Class diagram edges
  return diagramEdges.map((e) => {
    const isInheritance = e.type === "inheritance";
    const isDependency = e.type === "dependency";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: isDependency,
      style: { stroke: "#374151", strokeWidth: 1.5, strokeDasharray: isDependency ? "5,3" : undefined },
      markerEnd: isInheritance
        ? { type: MarkerType.ArrowClosed, color: "#374151" }
        : { type: MarkerType.Arrow, color: "#374151" },
    };
  });
}

// ─── Main component ────────────────────────────────────────────────────────────

interface DiagramCanvasProps {
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

  const nodeIdsRef = useRef(diagramNodes.map((n) => n.id).join(","));
  const diagramTypeRef = useRef(diagramType);

  useEffect(() => {
    const nextIds = diagramNodes.map((n) => n.id).join(",");
    const seq = diagramTypeRef.current === "sequence";
    const deploy = diagramTypeRef.current === "deployment";
    const erd = diagramTypeRef.current === "erd";
    const flow = diagramTypeRef.current === "flowchart";
    if (nodeIdsRef.current !== nextIds) {
      nodeIdsRef.current = nextIds;
      setFlowNodes(toFlowNodes(diagramNodes, seq, deploy));
      setFlowEdges(toFlowEdges(diagramEdges, seq, erd, flow));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramNodes, diagramEdges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const updated = applyNodeChanges(changes, flowNodes);
    setFlowNodes(updated);
    if (onNodesChange) {
      onNodesChange(updated.map((fn) => {
        const orig = diagramNodes.find((n) => n.id === fn.id);
        return orig ? { ...orig, position: fn.position }
          : { id: fn.id, type: "class", position: fn.position, data: { label: String(fn.data.label) } };
      }));
    }
  }, [flowNodes, diagramNodes, onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updated = applyEdgeChanges(changes, flowEdges);
    setFlowEdges(updated);
    if (onEdgesChange) {
      onEdgesChange(updated.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return orig ?? { id: fe.id, source: fe.source, target: fe.target, type: "association" };
      }));
    }
  }, [flowEdges, diagramEdges, onEdgesChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const updated = addEdge(connection, flowEdges);
    setFlowEdges(updated);
    if (onEdgesChange) {
      onEdgesChange(updated.map((fe) => {
        const orig = diagramEdges.find((e) => e.id === fe.id);
        return orig ?? { id: fe.id, source: fe.source, target: fe.target, type: "association" };
      }));
    }
  }, [flowEdges, diagramEdges, onEdgesChange]);

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
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.15 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        {!isSeq && <MiniMap nodeColor="#1e40af" />}
      </ReactFlow>
    </div>
  );
}
