"use client";

import {
  EdgeLabelRenderer,
  Handle,
  type EdgeProps,
  type NodeProps,
  Position,
  useStore,
} from "@xyflow/react";

export const SEQ_MSG_START_Y = 100;
export const SEQ_MSG_SPACING = 40;
export const SEQ_LIFELINE_HEIGHT = 600;
export const SEQ_COL_SPACING = 280;

export function LifelineNode({ data }: NodeProps) {
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

export function SequenceEdge({ id, source, target, label, data }: EdgeProps) {
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
