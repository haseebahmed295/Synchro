"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";

// ─── Color palette by stereotype ────────────────────────────────────────────────
// Each stereotype gets a distinct header color for visual grouping
const HEADER_COLORS: Record<string, string> = {
  controller: "#6366f1",   // indigo
  service: "#3b82f6",      // blue
  entity: "#8b5cf6",       // violet
  repository: "#06b6d4",   // cyan
  valueObject: "#a78bfa",  // lavender
  enum: "#f59e0b",         // amber
  interface: "#10b981",    // emerald
};

function getHeaderColor(stereotype?: string): string {
  if (!stereotype) return "#6b8cce";  // soft steel blue default
  return HEADER_COLORS[stereotype] ?? "#6b8cce";
}

const handleStyle: React.CSSProperties = {
  background: "#94a3b8",
  width: 8,
  height: 8,
  borderRadius: 4,
  border: "2px solid #fff",
};

export function ClassNode({ data }: NodeProps) {
  const attrs: string[] = (data.attributes as string[]) ?? [];
  const methods: string[] = (data.methods as string[]) ?? [];
  const stereotype = data.stereotype as string | undefined;
  const headerColor = getHeaderColor(stereotype);

  return (
    <div style={{
      borderRadius: 6,
      background: "#fff",
      width: 220,
      overflow: "hidden",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      boxShadow: "0 1px 4px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)",
      border: "1px solid #e2e8f0",
    }}>
      {/* ─── Header ─── */}
      <div style={{
        background: headerColor,
        padding: "8px 14px 7px",
        textAlign: "center",
      }}>
        {stereotype && (
          <div style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.75)",
            fontWeight: 500,
            letterSpacing: "0.03em",
            marginBottom: 1,
          }}>
            &laquo;{stereotype}&raquo;
          </div>
        )}
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          color: "#fff",
          lineHeight: 1.3,
        }}>
          {String(data.label)}
        </div>
      </div>

      {/* ─── Attributes section ─── */}
      {attrs.length > 0 && (
        <div style={{
          borderTop: "1px solid #e2e8f0",
          padding: "6px 12px",
        }}>
          {attrs.map((a, i) => (
            <div key={i} style={{
              color: "#334155",
              fontSize: 11,
              lineHeight: 1.7,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              letterSpacing: "-0.01em",
            }}>
              {a.startsWith("+") || a.startsWith("-") || a.startsWith("#") ? a : `+${a}`}
            </div>
          ))}
        </div>
      )}

      {/* ─── Methods section ─── */}
      {methods.length > 0 && (
        <div style={{
          borderTop: "1px solid #e2e8f0",
          padding: "6px 12px",
        }}>
          {methods.map((m, i) => (
            <div key={i} style={{
              color: "#334155",
              fontSize: 11,
              lineHeight: 1.7,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              letterSpacing: "-0.01em",
            }}>
              {m.startsWith("+") || m.startsWith("-") || m.startsWith("#") ? m : `+${m}`}
            </div>
          ))}
        </div>
      )}

      {/* Empty state — ensure minimum height */}
      {attrs.length === 0 && methods.length === 0 && (
        <div style={{ height: 16 }} />
      )}

      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Top}    style={handleStyle} />
    </div>
  );
}
