"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";

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

// ─── UML Component icon (inline SVG) ────────────────────────────────────────────
function ComponentIcon({ color = "#6366f1", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 22" fill="none" style={{ flexShrink: 0 }}>
      <rect x="5" y="1" width="14" height="20" rx="2" fill="white" stroke={color} strokeWidth="1.4" />
      <rect x="1" y="5" width="8" height="4" rx="1" fill="white" stroke={color} strokeWidth="1.2" />
      <rect x="1" y="13" width="8" height="4" rx="1" fill="white" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

// ─── Lollipop icon (provided interface) ─────────────────────────────────────────
function LollipopIcon({ color = "#10b981" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" fill="white" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Socket icon (required interface) ────────────────────────────────────────────
function SocketIcon({ color = "#f59e0b" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M 10 2 A 6 6 0 0 0 10 12" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component Diagram Node ─────────────────────────────────────────────────────
// Full-sized UML component with provided/required interfaces listed as sections.
// data.attributes → provided interfaces
// data.methods → required interfaces
export function ComponentDiagramNode({ data }: NodeProps) {
  const provided: string[] = (data.attributes as string[]) ?? [];
  const required: string[] = (data.methods as string[]) ?? [];
  const stereotype = (data.stereotype as string | undefined) ?? "component";
  const headerColor = "#6366f1"; // indigo

  return (
    <div style={{
      borderRadius: T.radius,
      background: "#fff",
      width: 240,
      overflow: "hidden",
      fontFamily: T.font,
      boxShadow: T.shadow,
      border: "1px solid #e2e8f0",
    }}>
      {/* ─── Header with UML component icon ─── */}
      <div style={{
        background: headerColor,
        padding: "8px 12px 7px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <ComponentIcon color="rgba(255,255,255,0.7)" size={18} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.7)",
            fontWeight: 500,
            letterSpacing: "0.03em",
          }}>
            &laquo;{stereotype}&raquo;
          </div>
          <div style={{
            fontWeight: 700,
            fontSize: 13,
            color: "#fff",
            lineHeight: 1.3,
          }}>
            {String(data.label)}
          </div>
        </div>
      </div>

      {/* ─── Provided interfaces (lollipop) ─── */}
      {provided.length > 0 && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "5px 10px" }}>
          <div style={{
            fontSize: 8,
            color: "#10b981",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 3,
          }}>
            Provided
          </div>
          {provided.map((p, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              color: "#334155",
              lineHeight: 1.7,
              fontFamily: T.mono,
            }}>
              <LollipopIcon />
              {p}
            </div>
          ))}
        </div>
      )}

      {/* ─── Required interfaces (socket) ─── */}
      {required.length > 0 && (
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "5px 10px" }}>
          <div style={{
            fontSize: 8,
            color: "#f59e0b",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 3,
          }}>
            Required
          </div>
          {required.map((r, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              color: "#334155",
              lineHeight: 1.7,
              fontFamily: T.mono,
            }}>
              <SocketIcon />
              {r}
            </div>
          ))}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {provided.length === 0 && required.length === 0 && (
        <div style={{ height: 16 }} />
      )}

      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Top}    style={handleStyle} />
    </div>
  );
}

// ─── Provided Interface Node (standalone lollipop) ──────────────────────────────
export function ProvidedInterfaceNode({ data }: NodeProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      fontFamily: T.font,
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: "2px solid #10b981",
        background: "linear-gradient(145deg, #ecfdf5, #d1fae5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: T.shadow,
      }} />
      <div style={{
        fontSize: 10,
        color: "#065f46",
        fontWeight: 600,
        whiteSpace: "nowrap",
        textAlign: "center",
        lineHeight: 1.2,
      }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...handleStyle, background: "#10b981", top: 14 }} />
      <Handle type="target" position={Position.Left}   style={{ ...handleStyle, background: "#10b981", top: 14 }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#10b981" }} />
      <Handle type="target" position={Position.Top}    style={{ ...handleStyle, background: "#10b981" }} />
    </div>
  );
}

// ─── Required Interface Node (standalone socket) ────────────────────────────────
export function RequiredInterfaceNode({ data }: NodeProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      fontFamily: T.font,
    }}>
      <div style={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M 20 3 A 12 12 0 0 0 20 25" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{
        fontSize: 10,
        color: "#92400e",
        fontWeight: 600,
        whiteSpace: "nowrap",
        textAlign: "center",
        lineHeight: 1.2,
      }}>
        {String(data.label)}
      </div>
      <Handle type="source" position={Position.Right}  style={{ ...handleStyle, background: "#f59e0b", top: 14 }} />
      <Handle type="target" position={Position.Left}   style={{ ...handleStyle, background: "#f59e0b", top: 14 }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, background: "#f59e0b" }} />
      <Handle type="target" position={Position.Top}    style={{ ...handleStyle, background: "#f59e0b" }} />
    </div>
  );
}
