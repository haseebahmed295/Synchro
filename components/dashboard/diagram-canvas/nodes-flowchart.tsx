"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";

// ─── Process (rectangle) ─────────────────────────────────────────────────────
export function FlowProcess({ data }: NodeProps) {
  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #6366f1",
      borderRadius: 8,
      padding: "10px 18px",
      minWidth: 160,
      textAlign: "center",
      fontSize: 13,
      fontWeight: 500,
      color: "#1e1b4b",
      boxShadow: "0 2px 8px rgba(99,102,241,0.10)",
    }}>
      {String(data.label)}
      <Handle type="target" position={Position.Top}    style={{ background: "#6366f1" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#6366f1" }} />
      {/* Side handles for branch merges */}
      <Handle type="target" position={Position.Left}   style={{ background: "#6366f1", opacity: 0.5 }} />
      <Handle type="target" position={Position.Right}  style={{ background: "#6366f1", opacity: 0.5 }} />
    </div>
  );
}

// ─── Decision (diamond) ───────────────────────────────────────────────────────
// Strict handle anchoring:
//   Top    = incoming flow
//   Bottom = "Yes" / true branch (exits downward)
//   Right  = "No"  / false branch (exits right)
//   Left   = secondary target (for loop-back merges)
export function FlowDecision({ data }: NodeProps) {
  const label = String(data.label);
  const W = 180;
  const H = 90;
  const cx = W / 2;
  const cy = H / 2;

  return (
    <div style={{ position: "relative", width: W, height: H }}>
      <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
        <polygon
          points={`${cx},4 ${W - 4},${cy} ${cx},${H - 4} 4,${cy}`}
          fill="#fef9c3"
          stroke="#ca8a04"
          strokeWidth="1.5"
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 600, color: "#713f12", textAlign: "center",
        padding: "0 28px",
      }}>
        {label}
      </div>

      {/* Top — incoming */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#ca8a04", left: cx, top: 4, transform: "translateX(-50%)" }}
      />
      {/* Bottom — Yes */}
      <Handle
        type="source"
        id="yes"
        position={Position.Bottom}
        style={{ background: "#16a34a", left: cx, bottom: 4, transform: "translateX(-50%)" }}
      />
      {/* Right — No */}
      <Handle
        type="source"
        id="no"
        position={Position.Right}
        style={{ background: "#dc2626", top: cy, right: 4, transform: "translateY(-50%)" }}
      />
      {/* Left — loop-back / merge target */}
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        style={{ background: "#ca8a04", top: cy, left: 4, transform: "translateY(-50%)" }}
      />
    </div>
  );
}

// ─── Terminal (rounded pill) ──────────────────────────────────────────────────
export function FlowTerminal({ data }: NodeProps) {
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
      boxShadow: "0 2px 8px rgba(22,163,74,0.10)",
    }}>
      {String(data.label)}
      <Handle type="target" position={Position.Top}    style={{ background: "#16a34a" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#16a34a" }} />
    </div>
  );
}

// ─── I/O (parallelogram) ──────────────────────────────────────────────────────
export function FlowIO({ data }: NodeProps) {
  return (
    <div style={{ position: "relative", minWidth: 160, height: 50 }}>
      <svg width="100%" height="50" style={{ position: "absolute", top: 0, left: 0 }}>
        <polygon points="20,2 158,2 140,48 2,48" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
      </svg>
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 50, fontSize: 12, fontWeight: 500, color: "#1e3a8a",
        padding: "0 24px",
      }}>
        {String(data.label)}
      </div>
      <Handle type="target" position={Position.Top}    style={{ background: "#3b82f6" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#3b82f6" }} />
      <Handle type="target" position={Position.Left}   style={{ background: "#3b82f6", opacity: 0.5 }} />
      <Handle type="source" position={Position.Right}  style={{ background: "#3b82f6", opacity: 0.5 }} />
    </div>
  );
}
