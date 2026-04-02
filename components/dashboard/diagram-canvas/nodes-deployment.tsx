"use client";

import { Handle, NodeResizer, type NodeProps, Position } from "@xyflow/react";

// ─── Shared colours ────────────────────────────────────────────────────────────
const C = {
  node:    { border: "#1e3a5f", bg: "#dbeafe", header: "#1e40af", text: "#1e3a5f", tab: "#1e40af" },
  execEnv: { border: "#065f46", bg: "#d1fae5", header: "#065f46", text: "#064e3b" },
  comp:    { border: "#4c1d95", bg: "#ede9fe", text: "#3b0764" },
  art:     { border: "#374151", bg: "#f9fafb", text: "#111827" },
  iface:   { border: "#0369a1", bg: "#e0f2fe", text: "#0c4a6e" },
};

// ─── UML Node (physical hardware / server / workstation) ──────────────────────
// Rendered as a rectangle with a 3-D "tab" in the top-right corner per UML spec.
export function DeploymentNode({ data, selected }: NodeProps) {
  const stereotype = (data.stereotype as string | undefined) ?? "node";
  return (
    <>
      <NodeResizer
        color={C.node.border}
        isVisible={!!selected}
        minWidth={200}
        minHeight={150}
      />
      <div style={{
        border: `2px solid ${C.node.border}`,
        borderRadius: 4,
        background: C.node.bg,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        fontFamily: "system-ui, sans-serif",
        overflow: "visible",
      }}>
        {/* 3-D tab */}
        <div style={{
          position: "absolute", top: -6, right: -6,
          width: "100%", height: "100%",
          border: `2px solid ${C.node.border}`,
          borderRadius: 4,
          background: C.node.bg,
          zIndex: -1,
        }} />
        {/* Header */}
        <div style={{
          background: C.node.header,
          borderRadius: "2px 2px 0 0",
          padding: "6px 12px 5px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontStyle: "italic" }}>
            &laquo;{stereotype}&raquo;
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {String(data.label)}
          </div>
        </div>
        <Handle type="source" position={Position.Right} style={{ background: C.node.border }} />
        <Handle type="target" position={Position.Left}  style={{ background: C.node.border }} />
        <Handle type="source" position={Position.Bottom} style={{ background: C.node.border }} />
        <Handle type="target" position={Position.Top}   style={{ background: C.node.border }} />
      </div>
    </>
  );
}

// ─── Execution Environment ─────────────────────────────────────────────────────
// Dashed border, lighter fill — represents a runtime container (JVM, Docker, etc.)
export function ExecEnvNode({ data, selected }: NodeProps) {
  return (
    <>
      <NodeResizer
        color={C.execEnv.border}
        isVisible={!!selected}
        minWidth={180}
        minHeight={120}
      />
      <div style={{
        border: `2px dashed ${C.execEnv.border}`,
        borderRadius: 4,
        background: C.execEnv.bg,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        fontFamily: "system-ui, sans-serif",
        overflow: "visible",
      }}>
        <div style={{
          borderBottom: `1.5px dashed ${C.execEnv.border}`,
          padding: "5px 10px 4px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <div style={{ fontSize: 9, color: C.execEnv.header, fontStyle: "italic" }}>
            &laquo;executionEnvironment&raquo;
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.execEnv.text }}>
            {String(data.label)}
          </div>
        </div>
        <Handle type="source" position={Position.Right}  style={{ background: C.execEnv.border, width: 7, height: 7 }} />
        <Handle type="target" position={Position.Left}   style={{ background: C.execEnv.border, width: 7, height: 7 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: C.execEnv.border, width: 7, height: 7 }} />
        <Handle type="target" position={Position.Top}    style={{ background: C.execEnv.border, width: 7, height: 7 }} />
      </div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
// Rectangle with the UML component icon (two small rectangles on the left side).
export function ComponentNode({ data }: NodeProps) {
  return (
    <div style={{
      border: `1.5px solid ${C.comp.border}`,
      borderRadius: 4,
      background: C.comp.bg,
      minWidth: 160,
      minHeight: 50,
      padding: "8px 12px 8px 28px",
      position: "relative",
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}>
      {/* UML component icon */}
      <svg width="18" height="22" viewBox="0 0 18 22" style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)" }}>
        <rect x="4" y="1" width="13" height="20" rx="1" fill="white" stroke={C.comp.border} strokeWidth="1.5" />
        <rect x="0" y="5"  width="8" height="4" rx="1" fill="white" stroke={C.comp.border} strokeWidth="1.2" />
        <rect x="0" y="13" width="8" height="4" rx="1" fill="white" stroke={C.comp.border} strokeWidth="1.2" />
      </svg>
      <div style={{ fontSize: 9, color: C.comp.border, fontStyle: "italic", lineHeight: 1.2 }}>
        &laquo;component&raquo;
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.comp.text, lineHeight: 1.4 }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ background: C.comp.border }} />
      <Handle type="target" position={Position.Left}   style={{ background: C.comp.border }} />
      <Handle type="source" position={Position.Bottom} style={{ background: C.comp.border }} />
      <Handle type="target" position={Position.Top}    style={{ background: C.comp.border }} />
    </div>
  );
}

// ─── Artifact ─────────────────────────────────────────────────────────────────
// Rectangle with a folded corner (dog-ear) per UML spec.
export function ArtifactNode({ data }: NodeProps) {
  const FOLD = 14;
  return (
    <div style={{
      position: "relative",
      minWidth: 150,
      minHeight: 44,
      fontFamily: "system-ui, sans-serif",
    }}>
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
        preserveAspectRatio="none"
      >
        {/* Body with folded corner cut out */}
        <path
          d={`M0,0 L calc(100% - ${FOLD}px),0 L 100%,${FOLD}px L 100%,100% L 0,100% Z`}
          fill={C.art.bg} stroke={C.art.border} strokeWidth="1.5"
        />
        {/* Fold crease */}
        <path
          d={`M calc(100% - ${FOLD}px),0 L calc(100% - ${FOLD}px),${FOLD}px L 100%,${FOLD}px`}
          fill="#e5e7eb" stroke={C.art.border} strokeWidth="1.5"
        />
      </svg>
      <div style={{
        position: "relative",
        padding: "6px 20px 6px 10px",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ fontSize: 9, color: "#6b7280", fontStyle: "italic" }}>&laquo;artifact&raquo;</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.art.text, whiteSpace: "nowrap" }}>
          {String(data.label)}
        </div>
      </div>
      <Handle type="source" position={Position.Right}  style={{ background: C.art.border, width: 6, height: 6 }} />
      <Handle type="target" position={Position.Left}   style={{ background: C.art.border, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: C.art.border, width: 6, height: 6 }} />
      <Handle type="target" position={Position.Top}    style={{ background: C.art.border, width: 6, height: 6 }} />
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
      gap: 2,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: `2px solid ${C.iface.border}`,
        background: C.iface.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: C.iface.text,
        fontWeight: 700,
      }}>
        «I»
      </div>
      <div style={{ fontSize: 11, color: C.iface.text, fontWeight: 500, whiteSpace: "nowrap" }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ background: C.iface.border, top: 18 }} />
      <Handle type="target" position={Position.Left}   style={{ background: C.iface.border, top: 18 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: C.iface.border }} />
      <Handle type="target" position={Position.Top}    style={{ background: C.iface.border }} />
    </div>
  );
}
