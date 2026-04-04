"use client";

import {
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  type EdgeProps,
  type NodeProps,
  Position,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

export const SEQ_MSG_START_Y = 120;
export const SEQ_MSG_SPACING = 55;
export const SEQ_LIFELINE_HEIGHT = 700;
export const SEQ_COL_SPACING = 280;
// Height of the lifeline header box (border + padding + font) — used to offset activation boxes
// Must match the actual rendered header height in LifelineNode
export const LIFELINE_HEADER_H = 44;
export const ACTOR_HEADER_H = 62;

// Activation box dimensions
const ACT_BOX_W = 12;
const ACT_MIN_H = 20;

// Self-message loop dimensions
const SELF_LOOP_W = 55;
const SELF_LOOP_H = 32;

// Maximum handles per side
const MAX_HANDLES = 30;

// ─── Message types ────────────────────────────────────────────────────────────
export type MsgType = "sync" | "return" | "async";

const MSG_LABELS: Record<MsgType, string> = {
  sync: "Sync call",
  return: "Return",
  async: "Async / fire-and-forget",
};

// ─── Fragment types ───────────────────────────────────────────────────────────
export type FragmentKind = "alt" | "opt" | "loop" | "ref";

const FRAGMENT_COLORS: Record<FragmentKind, string> = {
  alt:  "rgba(99,102,241,0.06)",
  opt:  "rgba(16,185,129,0.06)",
  loop: "rgba(245,158,11,0.06)",
  ref:  "rgba(100,116,139,0.06)",
};
const FRAGMENT_BORDER: Record<FragmentKind, string> = {
  alt:  "#6366f1",
  opt:  "#10b981",
  loop: "#f59e0b",
  ref:  "#64748b",
};

// ─── Activation box computation ───────────────────────────────────────────────
/**
 * Given all sequence edges and a list of lifeline IDs, compute the activation
 * rectangles for each lifeline. Returns a Map<lifelineId, Array<{y, h}>>.
 *
 * Rules:
 * - A **sync** message TO a lifeline starts an activation box at that msgY.
 * - The box extends until the next **return** message FROM that lifeline,
 *   or until the next outgoing message from that lifeline, whichever is first.
 *   Fallback height = SEQ_MSG_SPACING.
 * - **Async** messages create a short activation bump on the target only.
 * - Self-messages create a short bump.
 */
export function computeActivations(
  edges: Array<{ source: string; target: string; data?: Record<string, unknown> }>,
  nodeY = 0,
): Map<string, Array<{ y: number; h: number }>> {
  // Sort edges by msgY first
  const sorted = [...edges]
    .map((e) => ({
      source: e.source,
      target: e.target,
      msgY: (e.data?.msgY as number) ?? SEQ_MSG_START_Y,
      msgType: (e.data?.msgType as MsgType) ?? "sync",
    }))
    .sort((a, b) => a.msgY - b.msgY);

  const result = new Map<string, Array<{ y: number; h: number }>>();

  const getOrCreate = (id: string) => {
    if (!result.has(id)) result.set(id, []);
    return result.get(id)!;
  };

  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i];
    const isSelf = msg.source === msg.target;

    if (isSelf) {
      // Self-message → short activation bump on the lifeline
      const acts = getOrCreate(msg.target);
      acts.push({ y: msg.msgY - 4, h: SELF_LOOP_H + 8 });
      continue;
    }

    if (msg.msgType === "return") {
      // Return messages don't start activation boxes
      continue;
    }

    if (msg.msgType === "async") {
      // Async → short activation bump on target
      const acts = getOrCreate(msg.target);
      acts.push({ y: msg.msgY - 4, h: ACT_MIN_H });
      continue;
    }

    // Sync call → activation box on the target
    const targetId = msg.target;
    const acts = getOrCreate(targetId);
    const startY = msg.msgY - 4;

    // Look for the end of this activation: a return FROM targetId, or next
    // outgoing message FROM targetId (whichever comes first, after this msg)
    let endY = msg.msgY + SEQ_MSG_SPACING;
    for (let j = i + 1; j < sorted.length; j++) {
      const later = sorted[j];
      // Return from this target ends the activation
      if (later.source === targetId && later.msgType === "return") {
        endY = later.msgY + 4;
        break;
      }
      // An outgoing sync/async from this target means it's still active
      // (it's calling someone else during its activation)
      if (later.source === targetId && later.msgType !== "return") {
        // Don't end yet — the activation spans through sub-calls
        continue;
      }
      // An incoming message to a different target after this one — use
      // the next message involving our target as the endpoint
      if (later.target === targetId || later.source === targetId) {
        endY = later.msgY + 4;
        break;
      }
    }

    acts.push({ y: startY, h: Math.max(endY - startY, ACT_MIN_H) });
  }

  // Convert from absolute canvas Y to relative-to-node-top Y
  if (nodeY !== 0) {
    for (const acts of result.values()) {
      for (const act of acts) {
        act.y -= nodeY;
      }
    }
  }

  return result;
}

// ─── Actor stick-figure SVG ───────────────────────────────────────────────────
function ActorIcon({ size = 28 }: { size?: number }) {
  const s = size;
  const headR = s * 0.18;
  const neckY = s * 0.36 + headR;
  const bodyEnd = s * 0.62;
  const armY = s * 0.46;
  const legStart = bodyEnd;
  const legEnd = s * 0.92;
  const armSpan = s * 0.32;
  const legSpan = s * 0.22;
  const cx = s / 2;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: "block", margin: "0 auto 4px" }}>
      {/* Head */}
      <circle cx={cx} cy={s * 0.18} r={headR} fill="none" stroke="#374151" strokeWidth="1.6" />
      {/* Body */}
      <line x1={cx} y1={neckY} x2={cx} y2={bodyEnd} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      {/* Arms */}
      <line x1={cx - armSpan} y1={armY} x2={cx + armSpan} y2={armY} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      {/* Left leg */}
      <line x1={cx} y1={legStart} x2={cx - legSpan} y2={legEnd} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
      {/* Right leg */}
      <line x1={cx} y1={legStart} x2={cx + legSpan} y2={legEnd} stroke="#374151" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ─── LifelineNode ─────────────────────────────────────────────────────────────
export function LifelineNode({ data }: NodeProps) {
  const isActor = data.isActor === true;
  const lifelineHeight = (data.lifelineHeight as number | undefined) ?? SEQ_LIFELINE_HEIGHT;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none" }}>
      {/* Actor icon or header box */}
      {isActor ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "6px 16px 4px",
          minWidth: 100,
        }}>
          <ActorIcon size={32} />
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#111827",
            whiteSpace: "nowrap",
            textAlign: "center",
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {String(data.label)}
          </div>
        </div>
      ) : (
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
      )}

      {/* Dashed lifeline — no activation boxes */}
      <div style={{ position: "relative", width: 20 }}>
        <div style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 0,
          height: lifelineHeight,
          borderLeft: "2px dashed #9ca3af",
          transform: "translateX(-50%)",
        }} />
      </div>

      {/* Handles — cover the full lifeline height */}
      {Array.from({ length: MAX_HANDLES }, (_, i) => (
        <Handle key={`s-${i}`} type="source" position={Position.Right} id={`msg-${i}`}
          style={{ top: SEQ_MSG_START_Y - 40 + i * SEQ_MSG_SPACING, right: -5, width: 1, height: 1, background: "transparent", border: "none" }} />
      ))}
      {Array.from({ length: MAX_HANDLES }, (_, i) => (
        <Handle key={`t-${i}`} type="target" position={Position.Left} id={`msg-${i}`}
          style={{ top: SEQ_MSG_START_Y - 40 + i * SEQ_MSG_SPACING, left: -5, width: 1, height: 1, background: "transparent", border: "none" }} />
      ))}
    </div>
  );
}

// ─── Fragment node (Alt / Opt / Loop / Ref bounding box) ─────────────────────
export function FragmentNode({ data, selected }: NodeProps) {
  const kind: FragmentKind = (data.kind as FragmentKind) ?? "alt";
  const condition = (data.condition as string) ?? "";
  const borderColor = FRAGMENT_BORDER[kind];
  const bgColor = FRAGMENT_COLORS[kind];

  return (
    <>
      <NodeResizer
        color={borderColor}
        isVisible={true}
        minWidth={160}
        minHeight={80}
        lineStyle={{ opacity: selected ? 1 : 0.3 }}
        handleStyle={{ opacity: selected ? 1 : 0.4 }}
      />
      <div style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1.5px solid ${borderColor}`,
        borderRadius: 4,
        background: bgColor,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
      }}>
        {/* Label tab in top-left corner */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          background: borderColor,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px 2px 6px",
          borderRadius: "3px 0 6px 0",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          {kind}
        </div>
        {/* Condition text */}
        {condition && (
          <div style={{
            position: "absolute",
            top: 4,
            left: 48,
            fontSize: 11,
            color: borderColor,
            fontStyle: "italic",
            fontWeight: 500,
          }}>
            [{condition}]
          </div>
        )}
        {/* Dashed divider for alt (else branch) */}
        {kind === "alt" && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            borderTop: `1px dashed ${borderColor}`,
          }} />
        )}
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

// ─── Message type toolbar ─────────────────────────────────────────────────────
function MsgTypeToolbar({ x, y, current, onChange }: {
  x: number; y: number;
  current: MsgType;
  onChange: (t: MsgType) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -110%) translate(${x}px, ${y}px)`,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "6px 8px",
        display: "flex",
        gap: 4,
        zIndex: 1000,
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "all",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {(["sync", "async", "return"] as MsgType[]).map((t) => (
        <button
          key={t}
          title={MSG_LABELS[t]}
          onClick={() => onChange(t)}
          style={{
            padding: "3px 8px",
            borderRadius: 4,
            border: `1.5px solid ${current === t ? "#6366f1" : "#e2e8f0"}`,
            background: current === t ? "#eef2ff" : "#fff",
            color: current === t ? "#4338ca" : "#374151",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: current === t ? 700 : 400,
            whiteSpace: "nowrap",
          }}
        >
          {t === "sync" ? "→ Sync" : t === "async" ? "⇢ Async" : "⤶ Return"}
        </button>
      ))}
    </div>
  );
}

// ─── SequenceEdge ─────────────────────────────────────────────────────────────
export function SequenceEdge({ id, source, target, label, data, selected }: EdgeProps) {
  const nodes = useStore((s) => s.nodes);
  const { updateEdgeData } = useReactFlow();
  const [localY, setLocalY] = useState<number | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const dragStartRef = useRef<{ mouseY: number; msgY: number } | null>(null);

  const srcNode = nodes.find((n) => n.id === source);
  const tgtNode = nodes.find((n) => n.id === target);

  const msgY = localY ?? (data?.msgY as number) ?? SEQ_MSG_START_Y;
  const msgType: MsgType = (data?.msgType as MsgType) ?? "sync";
  const order: number | undefined = data?.order as number | undefined;

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragStartRef.current = { mouseY: e.clientY, msgY };
    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      setLocalY(dragStartRef.current.msgY + (ev.clientY - dragStartRef.current.mouseY));
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const newY = dragStartRef.current.msgY + (ev.clientY - dragStartRef.current.mouseY);
      updateEdgeData(id, { msgY: newY, msgType });
      setLocalY(null);
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [id, msgY, msgType, updateEdgeData]);

  if (!srcNode || !tgtNode) return null;

  const srcW = srcNode.measured?.width ?? 160;
  const tgtW = tgtNode.measured?.width ?? 160;
  const x1 = srcNode.position.x + srcW / 2;
  const x2 = tgtNode.position.x + tgtW / 2;
  const goingRight = x2 > x1;

  // Self-message detection
  const isSelf = source === target;

  // Visual style per message type
  const isReturn = msgType === "return";
  const isAsync = msgType === "async";
  const strokeDash = isReturn ? "6 3" : "none";
  const markerId = `seq-arrow-${id}`;

  // Return = open arrowhead, async = open arrowhead, sync = filled
  const arrowFill = isReturn || isAsync ? "none" : "#374151";
  const arrowStroke = "#374151";

  // ─── Self-message loop path ────────────────────────────────────────
  if (isSelf) {
    const loopRight = x1 + SELF_LOOP_W;
    const y1 = msgY;
    const y2 = msgY + SELF_LOOP_H;
    const pathD = `M ${x1} ${y1} L ${loopRight} ${y1} L ${loopRight} ${y2} L ${x1} ${y2}`;
    const midX = x1 + SELF_LOOP_W / 2;
    const selfMarkerId = `seq-self-arrow-${id}`;

    return (
      <>
        <defs>
          <marker id={selfMarkerId} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            {isReturn || isAsync ? (
              <polyline points="0,0 9,4 0,8" fill="none" stroke={arrowStroke} strokeWidth="1.5" strokeLinejoin="round" />
            ) : (
              <polygon points="0 0, 10 3.5, 0 7" fill={arrowFill} stroke={arrowStroke} strokeWidth="1" />
            )}
          </marker>
        </defs>

        {/* Wide invisible hit area */}
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          style={{ cursor: "ns-resize" }}
          onMouseDown={handleDragStart}
          onClick={() => setShowToolbar((v) => !v)}
        />

        {/* Visible loop path */}
        <path
          d={pathD}
          fill="none"
          stroke="#374151"
          strokeWidth={1.5}
          strokeDasharray={strokeDash}
          markerEnd={`url(#${selfMarkerId})`}
          style={{ pointerEvents: "none" }}
        />

        <EdgeLabelRenderer>
          {/* Label at the apex of the loop */}
          {label && (
            <div style={{
              position: "absolute",
              transform: `translate(4px, -100%) translate(${loopRight}px,${y1 - 3}px)`,
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
          )}

          {/* Message type badge — always shown */}
          <div style={{
            position: "absolute",
            transform: `translate(4px, 3px) translate(${loopRight}px,${y1}px)`,
            fontSize: 9,
            color: isReturn ? "#6366f1" : isAsync ? "#f59e0b" : "#6b7280",
            background: "rgba(255,255,255,0.92)",
            padding: "0 4px",
            borderRadius: 2,
            pointerEvents: "none",
            fontStyle: "italic",
          }}>
            {isReturn ? "⤶ return" : isAsync ? "⇢ async" : "→ sync"}
          </div>

          {/* Order badge — removed */}

          {/* Toolbar on click */}
          {(showToolbar || selected) && (
            <MsgTypeToolbar
              x={midX}
              y={y1}
              current={msgType}
              onChange={(t) => {
                updateEdgeData(id, { msgType: t, msgY });
                setShowToolbar(false);
              }}
            />
          )}
        </EdgeLabelRenderer>
      </>
    );
  }

  // ─── Normal (non-self) message ─────────────────────────────────────
  const midX = (x1 + x2) / 2;
  const lineX2 = goingRight ? x2 - 1 : x2 + 1;

  // Leftmost point for the order badge
  const leftX = Math.min(x1, x2);

  return (
    <>
      <defs>
        {isReturn ? (
          // Open arrowhead for return
          <marker id={markerId} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0,0 9,4 0,8" fill="none" stroke={arrowStroke} strokeWidth="1.5" strokeLinejoin="round" />
          </marker>
        ) : isAsync ? (
          // Open arrowhead for async
          <marker id={markerId} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polyline points="0,0 9,4 0,8" fill="none" stroke={arrowStroke} strokeWidth="1.5" strokeLinejoin="round" />
          </marker>
        ) : (
          // Filled arrowhead for sync
          <marker id={markerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={arrowFill} stroke={arrowStroke} strokeWidth="1" />
          </marker>
        )}
      </defs>

      {/* Wide invisible hit area for dragging + clicking */}
      <line
        x1={x1} y1={msgY} x2={lineX2} y2={msgY}
        stroke="transparent" strokeWidth={14}
        style={{ cursor: "ns-resize" }}
        onMouseDown={handleDragStart}
        onClick={() => setShowToolbar((v) => !v)}
      />

      {/* Visible message line */}
      <line
        x1={x1} y1={msgY} x2={lineX2} y2={msgY}
        stroke="#374151"
        strokeWidth={1.5}
        strokeDasharray={strokeDash}
        markerEnd={`url(#${markerId})`}
        style={{ pointerEvents: "none" }}
      />

      <EdgeLabelRenderer>
        {/* Message label */}
        {label && (
          <div style={{
            position: "absolute",
            transform: `translate(-50%, -100%) translate(${midX}px,${msgY - 3}px)`,
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
        )}

        {/* Message type badge — always shown for all types */}
        <div style={{
          position: "absolute",
          transform: `translate(-50%, 3px) translate(${midX}px,${msgY}px)`,
          fontSize: 9,
          color: isReturn ? "#6366f1" : isAsync ? "#f59e0b" : "#6b7280",
          background: "rgba(255,255,255,0.92)",
          padding: "0 4px",
          borderRadius: 2,
          pointerEvents: "none",
          fontStyle: "italic",
          letterSpacing: "0.02em",
        }}>
          {isReturn ? "⤶ return" : isAsync ? "⇢ async" : "→ sync"}
        </div>

        {/* Order number badge */}
        {order != null && (
          <div style={{
            position: "absolute",
            transform: `translate(-100%, -50%) translate(${leftX - 6}px,${msgY}px)`,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#6366f1",
            color: "#fff",
            fontSize: 8,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}>
            {order}
          </div>
        )}

        {/* Toolbar on click */}
        {(showToolbar || selected) && (
          <MsgTypeToolbar
            x={midX}
            y={msgY}
            current={msgType}
            onChange={(t) => {
              updateEdgeData(id, { msgType: t, msgY });
              setShowToolbar(false);
            }}
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
}
