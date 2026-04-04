"use client";

import { Handle, NodeResizer, type NodeProps, Position, useUpdateNodeInternals } from "@xyflow/react";
import { useEffect, useState } from "react";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  font: "'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  radius: 6,
  shadow: "0 1px 4px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)",
};

const handleStyle: React.CSSProperties = {
  background: "#94a3b8",
  width: 8,
  height: 8,
  borderRadius: 4,
  border: "2px solid #fff",
};

// ─── Icons ───────────────────────────────────────────────────────────────────────
function ComponentIcon({ color = "#6366f1", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 22" fill="none" style={{ flexShrink: 0 }}>
      <rect x="5" y="1" width="14" height="20" rx="2" fill="white" stroke={color} strokeWidth="1.4" />
      <rect x="1" y="5" width="8" height="4" rx="1" fill="white" stroke={color} strokeWidth="1.2" />
      <rect x="1" y="13" width="8" height="4" rx="1" fill="white" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

function LollipopIcon({ color = "#10b981" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" fill="white" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function SocketIcon({ color = "#f59e0b" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M 10 2 A 6 6 0 0 0 10 12" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
      <polyline points="2,3 5,7 8,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Collapsible section header ───────────────────────────────────────────────
function SectionHeader({ label, color, open, onToggle }: { label: string; color: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 8,
        color,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: open ? 3 : 0,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        width: "100%",
      }}
    >
      <Chevron open={open} />
      {label}
    </button>
  );
}

// ─── ComponentDiagramNode ─────────────────────────────────────────────────────
export function ComponentDiagramNode({ id, data }: NodeProps) {
  const provided: string[] = (data.attributes as string[]) ?? [];
  const required: string[] = (data.methods as string[]) ?? [];
  const stereotype = (data.stereotype as string | undefined) ?? "component";
  const headerColor = "#6366f1";

  const [providedOpen, setProvidedOpen] = useState(true);
  const [requiredOpen, setRequiredOpen] = useState(true);

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [provided.length, required.length, providedOpen, requiredOpen, id, updateNodeInternals]);

  return (
    <div style={{
      borderRadius: T.radius,
      background: "#fff",
      width: 240,
      overflow: "visible",
      fontFamily: T.font,
      boxShadow: T.shadow,
      border: "1px solid #e2e8f0",
    }}>
      {/* Header */}
      <div style={{
        background: headerColor,
        padding: "8px 12px 7px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderRadius: `${T.radius}px ${T.radius}px 0 0`,
      }}>
        <ComponentIcon color="rgba(255,255,255,0.7)" size={18} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 500, letterSpacing: "0.03em" }}>
            &laquo;{stereotype}&raquo;
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", lineHeight: 1.3 }}>
            {String(data.label)}
          </div>
        </div>
      </div>

      {/* Provided interfaces */}
      {provided.length > 0 && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "5px 10px" }}>
          <SectionHeader label="Provided" color="#10b981" open={providedOpen} onToggle={() => setProvidedOpen((v) => !v)} />
          {providedOpen && provided.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#334155", lineHeight: 1.7, fontFamily: T.mono, position: "relative" }}>
              <LollipopIcon />
              {p}
              <Handle
                type="source"
                position={Position.Right}
                id={`provided-${p}`}
                style={{ ...handleStyle, background: "#10b981", right: -4, top: "50%", transform: "translateY(-50%)", position: "absolute" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Required interfaces */}
      {required.length > 0 && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "5px 10px" }}>
          <SectionHeader label="Required" color="#f59e0b" open={requiredOpen} onToggle={() => setRequiredOpen((v) => !v)} />
          {requiredOpen && required.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#334155", lineHeight: 1.7, fontFamily: T.mono, position: "relative" }}>
              <SocketIcon />
              {r}
              <Handle
                type="target"
                position={Position.Left}
                id={`required-${r}`}
                style={{ ...handleStyle, background: "#f59e0b", left: -4, top: "50%", transform: "translateY(-50%)", position: "absolute" }}
              />
            </div>
          ))}
        </div>
      )}

      {provided.length === 0 && required.length === 0 && <div style={{ height: 16 }} />}

      <Handle type="source" position={Position.Bottom} id="fallback-source" style={{ ...handleStyle, opacity: 0.4 }} />
      <Handle type="target" position={Position.Top}    id="fallback-target" style={{ ...handleStyle, opacity: 0.4 }} />
    </div>
  );
}

// ─── BoundaryNode (System Boundary / Group) ───────────────────────────────────
export function BoundaryNode({ data, selected }: NodeProps) {
  const label = String(data.label ?? "System");
  const color = (data.color as string | undefined) ?? "#6366f1";

  return (
    <>
      <NodeResizer
        color={color}
        isVisible={!!selected}
        minWidth={200}
        minHeight={120}
        lineStyle={{ strokeDasharray: "6 3" }}
      />
      <div style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `2px dashed ${color}`,
        borderRadius: 8,
        background: `${color}08`,
        fontFamily: T.font,
        pointerEvents: "none",
        position: "relative",
      }}>
        {/* Label tab */}
        <div style={{
          position: "absolute",
          top: -1,
          left: 12,
          background: color,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 10px",
          borderRadius: "0 0 6px 6px",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}>
          {label}
        </div>
      </div>
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

// ─── Standalone interface nodes ───────────────────────────────────────────────
export function ProvidedInterfaceNode({ data }: NodeProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: T.font }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #10b981", background: "linear-gradient(145deg, #ecfdf5, #d1fae5)", boxShadow: T.shadow }} />
      <div style={{ fontSize: 10, color: "#065f46", fontWeight: 600, whiteSpace: "nowrap", textAlign: "center" }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...handleStyle, background: "#10b981", top: 14 }} />
      <Handle type="target" position={Position.Left}   style={{ ...handleStyle, background: "#10b981", top: 14 }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#10b981" }} />
      <Handle type="target" position={Position.Top}    style={{ ...handleStyle, background: "#10b981" }} />
    </div>
  );
}

export function RequiredInterfaceNode({ data }: NodeProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: T.font }}>
      <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M 20 3 A 12 12 0 0 0 20 25" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: 10, color: "#92400e", fontWeight: 600, whiteSpace: "nowrap", textAlign: "center" }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...handleStyle, background: "#f59e0b", top: 14 }} />
      <Handle type="target" position={Position.Left}   style={{ ...handleStyle, background: "#f59e0b", top: 14 }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#f59e0b" }} />
      <Handle type="target" position={Position.Top}    style={{ ...handleStyle, background: "#f59e0b" }} />
    </div>
  );
}
