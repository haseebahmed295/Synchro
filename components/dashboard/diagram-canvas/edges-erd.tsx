"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useState } from "react";

// ─── Crow's Foot SVG marker defs ─────────────────────────────────────────────
export function ErdMarkerDefs() {
  const stroke = "#64748b";
  const sw = 1.8;
  return (
    <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {/* ONE — double bar (target end: arrow points right into node) */}
        <marker id="erd-one" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto">
          <line x1="10" y1="1" x2="10" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="7"  y1="1" x2="7"  y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
        {/* MANY — crow's foot (target end) */}
        <marker id="erd-many" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto">
          <line x1="3" y1="7" x2="12" y2="1"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3" y1="7" x2="12" y2="7"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3" y1="7" x2="12" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
        {/* ZERO-OR-ONE — circle + bar (target end) */}
        <marker id="erd-zero-one" markerWidth="18" markerHeight="14" refX="16" refY="7" orient="auto">
          <circle cx="4"  cy="7" r="3.5" fill="white" stroke={stroke} strokeWidth={sw} />
          <line x1="11" y1="1" x2="11" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="14" y1="1" x2="14" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
        {/* ZERO-OR-MANY — circle + crow's foot (target end) */}
        <marker id="erd-zero-many" markerWidth="20" markerHeight="14" refX="18" refY="7" orient="auto">
          <line x1="3"  y1="7" x2="11" y2="1"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="7"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="16" cy="7" r="3.5" fill="white" stroke={stroke} strokeWidth={sw} />
        </marker>
        {/* ONE-OR-MANY — bar + crow's foot (target end) */}
        <marker id="erd-one-many" markerWidth="18" markerHeight="14" refX="16" refY="7" orient="auto">
          <line x1="3"  y1="7" x2="11" y2="1"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="7"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="14" y1="1" x2="14" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
        {/* EXACTLY-ONE — double bar (source end: arrow points left away from node) */}
        <marker id="erd-exactly-one" markerWidth="14" markerHeight="14" refX="2" refY="7" orient="auto">
          <line x1="4" y1="1" x2="4" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="7" y1="1" x2="7" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>

        {/* ── Source-side variants (orient="auto-start-reverse" mirrors the marker) ── */}
        <marker id="erd-one-start"       markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto-start-reverse">
          <line x1="10" y1="1" x2="10" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="7"  y1="1" x2="7"  y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
        <marker id="erd-zero-one-start"  markerWidth="18" markerHeight="14" refX="16" refY="7" orient="auto-start-reverse">
          <circle cx="4"  cy="7" r="3.5" fill="white" stroke={stroke} strokeWidth={sw} />
          <line x1="11" y1="1" x2="11" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="14" y1="1" x2="14" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
        <marker id="erd-zero-many-start" markerWidth="20" markerHeight="14" refX="18" refY="7" orient="auto-start-reverse">
          <line x1="3"  y1="7" x2="11" y2="1"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="7"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="16" cy="7" r="3.5" fill="white" stroke={stroke} strokeWidth={sw} />
        </marker>
        <marker id="erd-one-many-start"  markerWidth="18" markerHeight="14" refX="16" refY="7" orient="auto-start-reverse">
          <line x1="3"  y1="7" x2="11" y2="1"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="7"  stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="3"  y1="7" x2="11" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="14" y1="1" x2="14" y2="13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </marker>
      </defs>
    </svg>
  );
}

// ─── Multiplicity options shown in the toolbar ────────────────────────────────
export type ErdMult = "1" | "0..1" | "0..*" | "1..*";

const MULT_OPTIONS: { value: ErdMult; label: string; desc: string }[] = [
  { value: "1",    label: "|",   desc: "Exactly one" },
  { value: "0..1", label: "o|",  desc: "Zero or one" },
  { value: "0..*", label: "o<",  desc: "Zero or many" },
  { value: "1..*", label: "|<",  desc: "One or many" },
];

export function multiplicityToMarker(mult: string | undefined, side: "start" | "end"): string {
  const m = (mult ?? "1").trim();
  if (side === "end") {
    if (m === "0..*" || m === "*") return "url(#erd-zero-many)";
    if (m === "1..*")              return "url(#erd-one-many)";
    if (m === "0..1")              return "url(#erd-zero-one)";
    return "url(#erd-one)";
  }
  // source side — use auto-start-reverse variants so they face away from the node
  if (m === "0..*" || m === "*") return "url(#erd-zero-many-start)";
  if (m === "1..*")              return "url(#erd-one-many-start)";
  if (m === "0..1")              return "url(#erd-zero-one-start)";
  return "url(#erd-one-start)";
}

// ─── Cardinality toolbar ──────────────────────────────────────────────────────
function CardinalityToolbar({ x, y, sourceMult, targetMult, onChange, onClose }: {
  x: number; y: number;
  sourceMult: ErdMult;
  targetMult: ErdMult;
  onChange: (src: ErdMult, tgt: ErdMult) => void;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<ErdMult>(sourceMult);
  const [tgt, setTgt] = useState<ErdMult>(targetMult);

  const apply = (newSrc: ErdMult, newTgt: ErdMult) => {
    setSrc(newSrc);
    setTgt(newTgt);
    onChange(newSrc, newTgt);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose} />
      <div
        style={{
          position: "absolute",
          transform: `translate(-50%, -110%) translate(${x}px, ${y}px)`,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
          padding: "10px 12px",
          zIndex: 1000,
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          minWidth: 260,
          pointerEvents: "all",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600, fontSize: 11, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Cardinality
        </div>

        {/* Source side */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Source (from)</div>
          <div style={{ display: "flex", gap: 4 }}>
            {MULT_OPTIONS.map((o) => (
              <button
                key={o.value}
                title={o.desc}
                onClick={() => apply(o.value, tgt)}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 5,
                  border: `1.5px solid ${src === o.value ? "#6366f1" : "#e2e8f0"}`,
                  background: src === o.value ? "#eef2ff" : "#fff",
                  color: src === o.value ? "#4338ca" : "#374151",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: src === o.value ? 700 : 400,
                  fontFamily: "monospace",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target side */}
        <div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Target (to)</div>
          <div style={{ display: "flex", gap: 4 }}>
            {MULT_OPTIONS.map((o) => (
              <button
                key={o.value}
                title={o.desc}
                onClick={() => apply(src, o.value)}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 5,
                  border: `1.5px solid ${tgt === o.value ? "#6366f1" : "#e2e8f0"}`,
                  background: tgt === o.value ? "#eef2ff" : "#fff",
                  color: tgt === o.value ? "#4338ca" : "#374151",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: tgt === o.value ? 700 : 400,
                  fontFamily: "monospace",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MULT_OPTIONS.map((o) => (
            <span key={o.value} style={{ fontSize: 9, color: "#94a3b8" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{o.label}</span> = {o.desc}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── ErdEdge ──────────────────────────────────────────────────────────────────
export function ErdEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}: EdgeProps) {
  const [showToolbar, setShowToolbar] = useState(false);

  const sourceMult: ErdMult = (data?.sourceMult as ErdMult) ?? "1";
  const targetMult: ErdMult = (data?.targetMult as ErdMult) ?? "0..*";
  const onDataChange = data?.onDataChange as ((patch: Record<string, unknown>) => void) | undefined;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const markerStart = multiplicityToMarker(sourceMult, "start");
  const markerEnd   = multiplicityToMarker(targetMult, "end");

  return (
    <>
      {/* Wide invisible hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: "pointer" }}
        onClick={() => setShowToolbar((v) => !v)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: "#64748b", strokeWidth: 1.5 }}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        {(showToolbar || selected) && onDataChange && (
          <CardinalityToolbar
            x={labelX}
            y={labelY}
            sourceMult={sourceMult}
            targetMult={targetMult}
            onChange={(src, tgt) => onDataChange({ sourceMult: src, targetMult: tgt })}
            onClose={() => setShowToolbar(false)}
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
}
