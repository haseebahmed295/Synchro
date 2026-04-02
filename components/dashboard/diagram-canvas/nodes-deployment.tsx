"use client";

import { Handle, NodeResizer, type NodeProps, Position } from "@xyflow/react";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  font: "'Segoe UI', system-ui, -apple-system, sans-serif",
  radius: 6,
  shadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
  shadowHover: "0 2px 8px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)",
  handle: { width: 8, height: 8, borderRadius: 4, border: "2px solid #fff" },
};

// ─── Color palettes for each node type ──────────────────────────────────────────
const P = {
  node: {
    border: "#334155",
    bg: "#f8fafc",
    headerBg: "#1e293b",
    headerText: "#f1f5f9",
    stereotypeText: "rgba(148,163,184,0.9)",
    bodyBorder: "#e2e8f0",
    handle: "#475569",
  },
  execEnv: {
    border: "#059669",
    bg: "rgba(236,253,245,0.6)",
    headerBg: "transparent",
    headerBorder: "#a7f3d0",
    headerText: "#065f46",
    stereotypeText: "#10b981",
    handle: "#059669",
  },
  comp: {
    border: "#7c3aed",
    bg: "#faf5ff",
    accentBg: "linear-gradient(135deg, #ede9fe, #f5f3ff)",
    text: "#5b21b6",
    stereotypeText: "#8b5cf6",
    iconBg: "#ede9fe",
    handle: "#7c3aed",
  },
  art: {
    border: "#64748b",
    bg: "#ffffff",
    text: "#1e293b",
    stereotypeText: "#94a3b8",
    foldBg: "#f1f5f9",
    handle: "#64748b",
  },
  iface: {
    border: "#0284c7",
    bg: "#f0f9ff",
    text: "#0c4a6e",
    circleGradient: "linear-gradient(145deg, #e0f2fe, #bae6fd)",
    handle: "#0284c7",
  },
};

const handleStyle = (color: string): React.CSSProperties => ({
  background: color,
  ...T.handle,
});

// ─── UML Node (physical hardware / server / workstation) ──────────────────────
// 3-D box with a dark header bar — represents a physical or cloud deployment target.
export function DeploymentNode({ data, selected }: NodeProps) {
  const stereotype = (data.stereotype as string | undefined) ?? "node";
  return (
    <>
      <NodeResizer
        color={P.node.border}
        isVisible={!!selected}
        minWidth={240}
        minHeight={150}
      />
      <div style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        fontFamily: T.font,
        overflow: "visible",
      }}>
        {/* 3-D shadow layer (offset behind) */}
        <div style={{
          position: "absolute",
          top: -4,
          right: -4,
          width: "100%",
          height: "100%",
          border: `1.5px solid ${P.node.border}`,
          borderRadius: T.radius,
          background: P.node.bg,
          zIndex: -1,
          opacity: 0.6,
        }} />
        {/* Main body */}
        <div style={{
          width: "100%",
          height: "100%",
          border: `1.5px solid ${P.node.border}`,
          borderRadius: T.radius,
          background: P.node.bg,
          boxShadow: selected ? T.shadowHover : T.shadow,
          overflow: "hidden",
          boxSizing: "border-box",
        }}>
          {/* Header */}
          <div style={{
            background: P.node.headerBg,
            padding: "7px 14px 6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}>
            <div style={{
              fontSize: 9,
              color: P.node.stereotypeText,
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}>
              &laquo;{stereotype}&raquo;
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: P.node.headerText,
              textAlign: "center",
              lineHeight: 1.3,
            }}>
              {String(data.label)}
            </div>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right}  style={handleStyle(P.node.handle)} />
      <Handle type="target" position={Position.Left}   style={handleStyle(P.node.handle)} />
      <Handle type="source" position={Position.Bottom} style={handleStyle(P.node.handle)} />
      <Handle type="target" position={Position.Top}    style={handleStyle(P.node.handle)} />
    </>
  );
}

// ─── Execution Environment ─────────────────────────────────────────────────────
// Dashed border with a tinted background — represents a runtime container.
export function ExecEnvNode({ data, selected }: NodeProps) {
  return (
    <>
      <NodeResizer
        color={P.execEnv.border}
        isVisible={!!selected}
        minWidth={200}
        minHeight={120}
      />
      <div style={{
        border: `1.5px dashed ${P.execEnv.border}`,
        borderRadius: T.radius,
        background: P.execEnv.bg,
        backdropFilter: "blur(4px)",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        fontFamily: T.font,
        boxShadow: selected ? T.shadowHover : "none",
      }}>
        {/* Header */}
        <div style={{
          borderBottom: `1px dashed ${P.execEnv.headerBorder}`,
          padding: "6px 12px 5px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}>
          <div style={{
            fontSize: 8,
            color: P.execEnv.stereotypeText,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            &laquo;execution environment&raquo;
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: P.execEnv.headerText,
            textAlign: "center",
            lineHeight: 1.3,
          }}>
            {String(data.label)}
          </div>
        </div>
        <Handle type="source" position={Position.Right}  style={handleStyle(P.execEnv.handle)} />
        <Handle type="target" position={Position.Left}   style={handleStyle(P.execEnv.handle)} />
        <Handle type="source" position={Position.Bottom} style={handleStyle(P.execEnv.handle)} />
        <Handle type="target" position={Position.Top}    style={handleStyle(P.execEnv.handle)} />
      </div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
// Compact card with a UML component icon badge.
export function ComponentNode({ data }: NodeProps) {
  return (
    <div style={{
      border: `1.5px solid ${P.comp.border}`,
      borderRadius: T.radius,
      background: P.comp.accentBg,
      minWidth: 160,
      minHeight: 50,
      padding: "8px 12px 8px 32px",
      position: "relative",
      fontFamily: T.font,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      boxShadow: T.shadow,
    }}>
      {/* UML component icon */}
      <div style={{
        position: "absolute",
        left: 7,
        top: "50%",
        transform: "translateY(-50%)",
        width: 18,
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <rect x="4" y="1" width="13" height="20" rx="2" fill="white" stroke={P.comp.border} strokeWidth="1.3" />
          <rect x="0" y="5"  width="8" height="4" rx="1" fill={P.comp.iconBg} stroke={P.comp.border} strokeWidth="1" />
          <rect x="0" y="13" width="8" height="4" rx="1" fill={P.comp.iconBg} stroke={P.comp.border} strokeWidth="1" />
        </svg>
      </div>
      <div style={{
        fontSize: 8,
        color: P.comp.stereotypeText,
        fontWeight: 600,
        letterSpacing: "0.04em",
        lineHeight: 1.2,
      }}>
        &laquo;component&raquo;
      </div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: P.comp.text,
        lineHeight: 1.3,
      }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={handleStyle(P.comp.handle)} />
      <Handle type="target" position={Position.Left}   style={handleStyle(P.comp.handle)} />
      <Handle type="source" position={Position.Bottom} style={handleStyle(P.comp.handle)} />
      <Handle type="target" position={Position.Top}    style={handleStyle(P.comp.handle)} />
    </div>
  );
}

// ─── Artifact ─────────────────────────────────────────────────────────────────
// Clean card with a folded corner (dog-ear).
export function ArtifactNode({ data }: NodeProps) {
  const FOLD = 12;
  return (
    <div style={{
      position: "relative",
      minWidth: 150,
      minHeight: 44,
      fontFamily: T.font,
      filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.06))`,
    }}>
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
        preserveAspectRatio="none"
      >
        {/* Body with folded corner */}
        <path
          d={`M0,0 L calc(100% - ${FOLD}px),0 L 100%,${FOLD}px L 100%,100% L 0,100% Z`}
          fill={P.art.bg} stroke={P.art.border} strokeWidth="1.3"
        />
        {/* Fold crease */}
        <path
          d={`M calc(100% - ${FOLD}px),0 L calc(100% - ${FOLD}px),${FOLD}px L 100%,${FOLD}px`}
          fill={P.art.foldBg} stroke={P.art.border} strokeWidth="1.3"
        />
      </svg>
      <div style={{
        position: "relative",
        padding: "6px 18px 6px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}>
        <div style={{
          fontSize: 8,
          color: P.art.stereotypeText,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}>
          &laquo;artifact&raquo;
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          color: P.art.text,
          lineHeight: 1.3,
        }}>
          {String(data.label)}
        </div>
      </div>
      <Handle type="source" position={Position.Right}  style={handleStyle(P.art.handle)} />
      <Handle type="target" position={Position.Left}   style={handleStyle(P.art.handle)} />
      <Handle type="source" position={Position.Bottom} style={handleStyle(P.art.handle)} />
      <Handle type="target" position={Position.Top}    style={handleStyle(P.art.handle)} />
    </div>
  );
}

// ─── Interface (lollipop) ──────────────────────────────────────────────────────
export function InterfaceNode({ data }: NodeProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      fontFamily: T.font,
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: `2px solid ${P.iface.border}`,
        background: P.iface.circleGradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: P.iface.text,
        fontWeight: 700,
        boxShadow: T.shadow,
      }}>
        «I»
      </div>
      <div style={{
        fontSize: 10,
        color: P.iface.text,
        fontWeight: 600,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...handleStyle(P.iface.handle), top: 16 }} />
      <Handle type="target" position={Position.Left}   style={{ ...handleStyle(P.iface.handle), top: 16 }} />
      <Handle type="source" position={Position.Bottom} style={handleStyle(P.iface.handle)} />
      <Handle type="target" position={Position.Top}    style={handleStyle(P.iface.handle)} />
    </div>
  );
}
