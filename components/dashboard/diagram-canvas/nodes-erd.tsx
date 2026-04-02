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

export function ErdTableNode({ id, data }: NodeProps) {
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
      <Handle type="target" position={Position.Left} id="node-left" style={{ background: "#94a3b8", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="node-bottom" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} id="node-top" style={{ opacity: 0 }} />
    </div>
  );
}
