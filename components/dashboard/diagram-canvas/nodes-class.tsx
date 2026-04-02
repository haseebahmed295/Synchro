"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";

export function ClassNode({ data }: NodeProps) {
  const attrs: string[] = (data.attributes as string[]) ?? [];
  const methods: string[] = (data.methods as string[]) ?? [];
  const stereotype = data.stereotype as string | undefined;

  return (
    <div style={{
      border: "1.5px solid #374151",
      borderRadius: 4,
      background: "#fff",
      width: 200,
      maxHeight: 220,
      overflow: "hidden",
      fontSize: 11,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      fontFamily: "monospace",
    }}>
      <div style={{
        background: "#1e40af",
        color: "#fff",
        padding: "6px 12px",
        textAlign: "center",
        borderRadius: "2px 2px 0 0",
      }}>
        {stereotype && (
          <div style={{ fontSize: 10, opacity: 0.85 }}>&laquo;{stereotype}&raquo;</div>
        )}
        <div style={{ fontWeight: 700, fontSize: 13 }}>{String(data.label)}</div>
      </div>
      {attrs.length > 0 && (
        <div style={{ borderTop: "1px solid #d1d5db", padding: "4px 10px" }}>
          {attrs.map((a, i) => (
            <div key={i} style={{ color: "#374151", lineHeight: 1.6 }}>{a}</div>
          ))}
        </div>
      )}
      {methods.length > 0 && (
        <div style={{ borderTop: "1px solid #d1d5db", padding: "4px 10px" }}>
          {methods.map((m, i) => (
            <div key={i} style={{ color: "#374151", lineHeight: 1.6 }}>{m}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#6b7280" }} />
      <Handle type="target" position={Position.Left} style={{ background: "#6b7280" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#6b7280" }} />
      <Handle type="target" position={Position.Top} style={{ background: "#6b7280" }} />
    </div>
  );
}
