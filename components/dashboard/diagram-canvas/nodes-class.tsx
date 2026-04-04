"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useState, useCallback } from "react";

// ─── Color palette by stereotype ────────────────────────────────────────────────
const HEADER_COLORS: Record<string, string> = {
  controller: "#6366f1",
  service: "#3b82f6",
  entity: "#8b5cf6",
  repository: "#06b6d4",
  valueObject: "#a78bfa",
  enum: "#f59e0b",
  interface: "#10b981",
  abstract: "#64748b",
  utility: "#0ea5e9",
};

function getHeaderColor(stereotype?: string): string {
  if (!stereotype) return "#6b8cce";
  return HEADER_COLORS[stereotype] ?? "#6b8cce";
}

const handleStyle: React.CSSProperties = {
  background: "#94a3b8",
  width: 8,
  height: 8,
  borderRadius: 4,
  border: "2px solid #fff",
};

// ─── Visibility cycling ──────────────────────────────────────────────────────────
const VISIBILITY_CYCLE = ["+", "-", "#", "~"] as const;
const VISIBILITY_LABELS: Record<string, string> = {
  "+": "public",
  "-": "private",
  "#": "protected",
  "~": "package",
};

function getVisibility(member: string): string {
  const first = member[0];
  return VISIBILITY_CYCLE.includes(first as any) ? first : "+";
}

function setVisibility(member: string, vis: string): string {
  const first = member[0];
  if (VISIBILITY_CYCLE.includes(first as any)) return vis + member.slice(1);
  return vis + member;
}

function cycleVisibility(member: string): string {
  const current = getVisibility(member);
  const idx = VISIBILITY_CYCLE.indexOf(current as any);
  const next = VISIBILITY_CYCLE[(idx + 1) % VISIBILITY_CYCLE.length];
  return setVisibility(member, next);
}

// ─── Type highlighting ───────────────────────────────────────────────────────────
function MemberRow({ text, onVisibilityClick, isAbstract }: {
  text: string;
  onVisibilityClick?: () => void;
  isAbstract?: boolean;
}) {
  const vis = getVisibility(text);
  const rest = VISIBILITY_CYCLE.includes(text[0] as any) ? text.slice(1) : text;
  const colonIdx = rest.indexOf(":");
  const name = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
  const typePart = colonIdx >= 0 ? rest.slice(colonIdx) : "";

  return (
    <div
      title={text}
      style={{
        display: "flex",
        alignItems: "baseline",
        fontSize: 11,
        lineHeight: 1.7,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        letterSpacing: "-0.01em",
        fontStyle: isAbstract ? "italic" : "normal",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <span
        title={`${VISIBILITY_LABELS[vis]} — click to cycle`}
        onClick={(e) => { e.stopPropagation(); onVisibilityClick?.(); }}
        style={{
          color: vis === "+" ? "#16a34a" : vis === "-" ? "#dc2626" : vis === "#" ? "#d97706" : "#6366f1",
          cursor: onVisibilityClick ? "pointer" : "default",
          fontWeight: 700,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {vis}
      </span>
      <span style={{
        color: "#334155",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flexShrink: 1,
        minWidth: 0,
      }}>
        {name}
      </span>
      {typePart && (
        <span style={{
          color: "#0ea5e9",
          flexShrink: 0,
          whiteSpace: "nowrap",
          marginLeft: 1,
        }}>
          :{typePart.slice(1)}
        </span>
      )}
    </div>
  );
}

// ─── ClassNode ───────────────────────────────────────────────────────────────────
export function ClassNode({ data }: NodeProps) {
  const [hoverSection, setHoverSection] = useState<"attrs" | "methods" | null>(null);

  const attrs: string[] = (data.attributes as string[]) ?? [];
  const methods: string[] = (data.methods as string[]) ?? [];
  const stereotype = data.stereotype as string | undefined;
  const isAbstract = !!(data.abstract as boolean | undefined) ||
    stereotype === "abstract" || stereotype === "interface";
  const headerColor = getHeaderColor(stereotype);

  // onUpdate: used for inline visibility cycling (mutates data directly)
  const onUpdate = data.onUpdate as ((patch: Record<string, unknown>) => void) | undefined;
  // onEditMembers: opens the ColumnEditorDialog for adding/editing members
  const onEditMembers = data.onEditMembers as ((field: "attributes" | "methods") => void) | undefined;

  const handleVisibilityClick = useCallback((field: "attributes" | "methods", idx: number) => {
    if (!onUpdate) return;
    const arr = field === "attributes" ? [...attrs] : [...methods];
    arr[idx] = cycleVisibility(arr[idx]);
    onUpdate({ [field]: arr });
  }, [attrs, methods, onUpdate]);

  return (
    <div style={{
      borderRadius: 6,
      background: "#fff",
      width: 280,
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
        borderRadius: "5px 5px 0 0",
      }}>
        <div style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.75)",
          fontWeight: 500,
          letterSpacing: "0.03em",
          marginBottom: 1,
          minHeight: 12,
        }}>
          {stereotype ? `\u00AB${stereotype}\u00BB` : "\u00A0"}
        </div>
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          color: "#fff",
          lineHeight: 1.3,
          fontStyle: isAbstract ? "italic" : "normal",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}>
          {String(data.label)}
        </div>
      </div>

      {/* ─── Attributes section ─── */}
      <div
        style={{ borderTop: "1px solid #e2e8f0", padding: "6px 12px 4px", position: "relative", minHeight: 28 }}
        onMouseEnter={() => setHoverSection("attrs")}
        onMouseLeave={() => setHoverSection(null)}
      >
        {attrs.length === 0 && hoverSection !== "attrs" && (
          <div style={{ color: "#cbd5e1", fontSize: 10, fontStyle: "italic", lineHeight: 1.7 }}>
            No attributes
          </div>
        )}
        {attrs.map((a, i) => (
          <MemberRow
            key={i}
            text={a}
            isAbstract={false}
            onVisibilityClick={onUpdate ? () => handleVisibilityClick("attributes", i) : undefined}
          />
        ))}
        {hoverSection === "attrs" && onEditMembers && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditMembers("attributes"); }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              marginTop: 2,
              padding: "1px 0",
              fontSize: 10,
              color: "#6366f1",
              background: "#f0f4ff",
              border: "1px dashed #a5b4fc",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            + Add Attribute
          </button>
        )}
      </div>

      {/* ─── Methods section ─── */}
      <div
        style={{ borderTop: "1px solid #e2e8f0", padding: "6px 12px 4px", position: "relative", minHeight: 28 }}
        onMouseEnter={() => setHoverSection("methods")}
        onMouseLeave={() => setHoverSection(null)}
      >
        {methods.length === 0 && hoverSection !== "methods" && (
          <div style={{ color: "#cbd5e1", fontSize: 10, fontStyle: "italic", lineHeight: 1.7 }}>
            No methods
          </div>
        )}
        {methods.map((m, i) => (
          <MemberRow
            key={i}
            text={m}
            isAbstract={isAbstract}
            onVisibilityClick={onUpdate ? () => handleVisibilityClick("methods", i) : undefined}
          />
        ))}
        {hoverSection === "methods" && onEditMembers && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditMembers("methods"); }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              marginTop: 2,
              padding: "1px 0",
              fontSize: 10,
              color: "#6366f1",
              background: "#f0f4ff",
              border: "1px dashed #a5b4fc",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            + Add Method
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Top}    style={handleStyle} />
    </div>
  );
}
