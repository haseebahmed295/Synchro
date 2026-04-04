"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { useState } from "react";

export type UmlEdgeType = "association" | "inheritance" | "composition" | "aggregation" | "dependency";

// ─── SVG marker defs (rendered once via a hidden SVG in the canvas) ─────────────
export function UmlMarkerDefs() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        {/* Inheritance: hollow triangle */}
        <marker id="uml-inheritance" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">
          <polygon points="0,0 12,5 0,10" fill="white" stroke="#374151" strokeWidth="1.5" />
        </marker>
        {/* Composition: filled diamond */}
        <marker id="uml-composition" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
          <polygon points="0,5 6,0 12,5 6,10" fill="#374151" stroke="#374151" strokeWidth="1" />
        </marker>
        {/* Aggregation: hollow diamond */}
        <marker id="uml-aggregation" markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
          <polygon points="0,5 6,0 12,5 6,10" fill="white" stroke="#374151" strokeWidth="1.5" />
        </marker>
        {/* Association / Dependency: standard open arrow */}
        <marker id="uml-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polyline points="0,0 9,4 0,8" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinejoin="round" />
        </marker>
      </defs>
    </svg>
  );
}

// ─── Edge toolbar (floats near the edge midpoint on click/hover) ─────────────────
const REL_TYPES: { type: UmlEdgeType; label: string; icon: string }[] = [
  { type: "association",  label: "Association",  icon: "→" },
  { type: "inheritance",  label: "Inheritance",  icon: "△" },
  { type: "composition",  label: "Composition",  icon: "◆" },
  { type: "aggregation",  label: "Aggregation",  icon: "◇" },
  { type: "dependency",   label: "Dependency",   icon: "⤳" },
];

interface EdgeToolbarProps {
  x: number;
  y: number;
  currentType: UmlEdgeType;
  sourceMultiplicity: string;
  targetMultiplicity: string;
  onTypeChange: (t: UmlEdgeType) => void;
  onMultiplicityChange: (end: "source" | "target", val: string) => void;
}

function EdgeToolbar({ x, y, currentType, sourceMultiplicity, targetMultiplicity, onTypeChange, onMultiplicityChange }: EdgeToolbarProps) {
  return (
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -110%) translate(${x}px, ${y}px)`,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        zIndex: 1000,
        fontFamily: "system-ui, sans-serif",
        fontSize: 11,
        minWidth: 200,
        pointerEvents: "all",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Relationship type buttons */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {REL_TYPES.map((r) => (
          <button
            key={r.type}
            title={r.label}
            onClick={() => onTypeChange(r.type)}
            style={{
              padding: "3px 7px",
              borderRadius: 4,
              border: `1.5px solid ${currentType === r.type ? "#6366f1" : "#e2e8f0"}`,
              background: currentType === r.type ? "#eef2ff" : "#fff",
              color: currentType === r.type ? "#4338ca" : "#374151",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: currentType === r.type ? 700 : 400,
            }}
          >
            {r.icon} {r.label}
          </button>
        ))}
      </div>
      {/* Multiplicity inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label style={{ color: "#6b7280", whiteSpace: "nowrap" }}>Source</label>
        <input
          value={sourceMultiplicity}
          onChange={(e) => onMultiplicityChange("source", e.target.value)}
          placeholder="1"
          style={{ width: 48, padding: "2px 5px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11 }}
        />
        <label style={{ color: "#6b7280", whiteSpace: "nowrap" }}>Target</label>
        <input
          value={targetMultiplicity}
          onChange={(e) => onMultiplicityChange("target", e.target.value)}
          placeholder="0..*"
          style={{ width: 48, padding: "2px 5px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11 }}
        />
      </div>
    </div>
  );
}

// ─── UML Class Edge ──────────────────────────────────────────────────────────────
export function UmlClassEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}: EdgeProps) {
  const [showToolbar, setShowToolbar] = useState(false);

  const relType: UmlEdgeType = (data?.relType as UmlEdgeType) ?? "association";
  const sourceMult: string = (data?.sourceMultiplicity as string) ?? "";
  const targetMult: string = (data?.targetMultiplicity as string) ?? "";
  const onDataChange = data?.onDataChange as ((patch: Record<string, unknown>) => void) | undefined;

  const isDependency = relType === "dependency";
  const isInheritance = relType === "inheritance";
  const isComposition = relType === "composition";
  const isAggregation = relType === "aggregation";

  // Use straight path for inheritance/dependency, bezier for others
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const markerEnd =
    isInheritance ? "url(#uml-inheritance)"
    : isComposition ? "url(#uml-composition)"
    : isAggregation ? "url(#uml-aggregation)"
    : "url(#uml-arrow)";

  const strokeDasharray = isDependency ? "6 3" : undefined;

  // Source multiplicity label position (near source)
  const srcLabelX = sourceX + (targetX - sourceX) * 0.12;
  const srcLabelY = sourceY + (targetY - sourceY) * 0.12 - 10;
  // Target multiplicity label position (near target)
  const tgtLabelX = sourceX + (targetX - sourceX) * 0.88;
  const tgtLabelY = sourceY + (targetY - sourceY) * 0.88 - 10;

  return (
    <>
      {/* Invisible wider hit area for easier clicking */}
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
        style={{ stroke: "#374151", strokeWidth: 1.5, strokeDasharray }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        {/* Multiplicity labels */}
        {sourceMult && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${srcLabelX}px, ${srcLabelY}px)`,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#374151",
              background: "#fff",
              padding: "1px 4px",
              borderRadius: 3,
              lineHeight: 1.4,
              pointerEvents: "none",
              boxShadow: "0 0 0 2px #fff",
            }}
            className="nodrag nopan"
          >
            {sourceMult}
          </div>
        )}
        {targetMult && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${tgtLabelX}px, ${tgtLabelY}px)`,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#374151",
              background: "#fff",
              padding: "1px 4px",
              borderRadius: 3,
              lineHeight: 1.4,
              pointerEvents: "none",
              boxShadow: "0 0 0 2px #fff",
            }}
            className="nodrag nopan"
          >
            {targetMult}
          </div>
        )}
        {/* Edge toolbar */}
        {(showToolbar || selected) && onDataChange && (
          <EdgeToolbar
            x={labelX}
            y={labelY}
            currentType={relType}
            sourceMultiplicity={sourceMult}
            targetMultiplicity={targetMult}
            onTypeChange={(t) => onDataChange({ relType: t })}
            onMultiplicityChange={(end, val) =>
              onDataChange(end === "source" ? { sourceMultiplicity: val } : { targetMultiplicity: val })
            }
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
}
