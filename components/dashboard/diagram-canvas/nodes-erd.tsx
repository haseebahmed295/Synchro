"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";

const SCHEMA_COLORS: Record<string, string> = {
  default:   "#91C4F2",
  public:    "#BEB8EB",
  auth:      "#AFA2FF",
  storage:   "#75C9C8",
  audit:     "#F6BDD1",
  analytics: "#FFD791",
};

export function getSchemaColor(label: string): string {
  const schema = label.includes(".") ? label.split(".")[0] : "default";
  return SCHEMA_COLORS[schema] ?? SCHEMA_COLORS.default;
}

// Detect FK columns: ends with _id, or contains [FK], or has 🔗
function isFk(colName: string, colType: string): boolean {
  const name = colName.toLowerCase();
  return name.endsWith("_id") && name !== "id"
    || colType.toLowerCase().includes("[fk]")
    || colName.includes("🔗");
}

function isPk(attr: string): boolean {
  return attr.startsWith("🔑") || attr.split(":")[0].trim().toLowerCase() === "id";
}

// ─── FK icon (silver link) ────────────────────────────────────────────────────
function FkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
      <path d="M4 7.5L7 4.5" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 6L1.5 7a2.12 2.12 0 0 0 3 3l1-1" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 5L9.5 4a2.12 2.12 0 0 0-3-3L5.5 2" stroke="#64748b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ErdTableNode({ data }: NodeProps) {
  const attrs: string[] = (data.attributes as string[]) ?? [];
  const headerColor = getSchemaColor(String(data.label));

  return (
    <div style={{
      border: "1px solid #d1d5db",
      borderRadius: 6,
      background: "#fff",
      minWidth: 240,
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      fontFamily: "system-ui, sans-serif",
      fontSize: 12,
    }}>
      {/* Header */}
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

      {attrs.map((attr, i) => {
        const pk = isPk(attr);
        const raw = attr.replace("🔑", "").replace("🔗", "");
        const parts = raw.split(":");
        const colName = parts[0]?.trim() ?? attr;
        const colType = parts[1]?.trim() ?? "";
        const fk = !pk && isFk(colName, colType);
        const handleId = `col-${colName}`;
        // Strip [FK] badge from display type
        const displayType = colType.replace(/\[FK\]/gi, "").trim();

        return (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 12px",
            borderTop: i === 0 ? "1px solid #e5e7eb" : "none",
            borderBottom: "1px solid #f3f4f6",
            background: pk ? "#f8faff" : fk ? "#fafaf8" : "#fff",
            position: "relative",
            minHeight: 28,
            gap: 6,
          }}>
            <Handle
              type="target"
              position={Position.Left}
              id={`${handleId}-left`}
              style={{ top: "50%", left: -6, width: 8, height: 8, background: "#94a3b8", border: "1.5px solid #fff" }}
            />

            {/* Left: icon + name */}
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#1e293b", minWidth: 0, flex: 1 }}>
              {pk && <span style={{ fontSize: 10, flexShrink: 0 }}>🔑</span>}
              {fk && <FkIcon />}
              <span style={{
                fontWeight: pk ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: fk ? "#475569" : "#1e293b",
              }}>
                {colName}
              </span>
            </span>

            {/* Right: type */}
            <span style={{
              color: "#94a3b8",
              fontSize: 10,
              flexShrink: 0,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {displayType}
            </span>

            <Handle
              type="source"
              position={Position.Right}
              id={`${handleId}-right`}
              style={{ top: "50%", right: -6, width: 8, height: 8, background: "#94a3b8", border: "1.5px solid #fff" }}
            />
          </div>
        );
      })}

      <Handle type="source" position={Position.Right} id="node-right" style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left}  id="node-left"  style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="node-bottom" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    id="node-top"   style={{ opacity: 0 }} />
    </div>
  );
}
