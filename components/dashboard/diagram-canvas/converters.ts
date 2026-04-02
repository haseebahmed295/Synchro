import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DiagramEdge, DiagramNode } from "@/lib/types/diagram";
import { SEQ_COL_SPACING, SEQ_MSG_SPACING, SEQ_MSG_START_Y } from "./nodes-sequence";

export function toFlowNodes(diagramNodes: DiagramNode[], isSeq: boolean, isDeploy: boolean): Node[] {
  if (isSeq) {
    const actors = diagramNodes.filter((n) => n.type === "actor");
    const lifelines = diagramNodes.filter((n) => n.type !== "actor");
    return [...actors, ...lifelines].map((n, i) => ({
      id: n.id,
      type: "lifeline",
      position: { x: 60 + i * SEQ_COL_SPACING, y: 40 },
      data: { label: n.data.label },
      draggable: true,
    }));
  }

  if (isDeploy) {
    // Use ReactFlow parentId nesting — children positions are relative to parent.
    // Container types that can hold children.
    const CONTAINER_TYPES = new Set(["node", "executionEnvironment"]);
    const CHILD_PAD = 12;
    const HEADER_H = 52; // header height for containers
    const CHILD_H: Record<string, number> = {
      artifact: 52,
      component: 60,
      interface: 64,
      executionEnvironment: 100,
      node: 120,
    };
    const CHILD_W = 180;
    const CHILD_GAP = 10;

    // Build parent→children map from data.children
    const childOf = new Map<string, string>(); // childId → parentId
    for (const n of diagramNodes) {
      for (const cid of (n.data.children ?? [])) childOf.set(cid, n.id);
    }

    // For each container, compute its required height based on children count
    function containerH(nodeId: string): number {
      const n = diagramNodes.find((x) => x.id === nodeId);
      if (!n) return 120;
      const children = n.data.children ?? [];
      if (children.length === 0) return HEADER_H + 40;
      let h = HEADER_H + CHILD_PAD;
      for (const cid of children) {
        const childType = diagramNodes.find((x) => x.id === cid)?.type ?? "artifact";
        const ch = CONTAINER_TYPES.has(childType) ? containerH(cid) : (CHILD_H[childType] ?? 52);
        h += ch + CHILD_GAP;
      }
      return h + CHILD_PAD;
    }

    // Assign child positions relative to parent
    function childrenPositions(parentId: string): Map<string, { x: number; y: number }> {
      const result = new Map<string, { x: number; y: number }>();
      const n = diagramNodes.find((x) => x.id === parentId);
      if (!n) return result;
      let y = HEADER_H + CHILD_PAD;
      for (const cid of (n.data.children ?? [])) {
        result.set(cid, { x: CHILD_PAD, y });
        const childType = diagramNodes.find((x) => x.id === cid)?.type ?? "artifact";
        const ch = CONTAINER_TYPES.has(childType) ? containerH(cid) : (CHILD_H[childType] ?? 52);
        y += ch + CHILD_GAP;
        // recurse
        for (const [id, pos] of childrenPositions(cid)) result.set(id, pos);
      }
      return result;
    }

    // Collect all relative positions
    const relPos = new Map<string, { x: number; y: number }>();
    for (const n of diagramNodes) {
      if (!childOf.has(n.id)) {
        // top-level: use stored position
        relPos.set(n.id, n.position);
      }
    }
    for (const n of diagramNodes) {
      if (CONTAINER_TYPES.has(n.type)) {
        for (const [id, pos] of childrenPositions(n.id)) {
          relPos.set(id, pos);
        }
      }
    }

    return diagramNodes.map((n) => {
      const isContainer = CONTAINER_TYPES.has(n.type);
      const parentId = childOf.get(n.id);
      const childType = n.type as string;
      const h = isContainer ? containerH(n.id) : (CHILD_H[childType] ?? 52);
      // Width: containers expand to fit, leaves use fixed width
      const w = isContainer
        ? Math.max(CHILD_W + CHILD_PAD * 2, 260)
        : CHILD_W;

      return {
        id: n.id,
        type: n.type === "node" ? "deploymentNode" : (n.type as string),
        position: relPos.get(n.id) ?? n.position,
        data: { label: n.data.label, stereotype: n.data.stereotype },
        draggable: true,
        ...(parentId ? { parentId, extent: "parent" as const } : {}),
        style: { width: w, height: h },
      };
    });
  }

  const flowchartTypes = new Set(["process", "decision", "terminal", "io"]);
  return diagramNodes.map((n) => ({
    id: n.id,
    type: flowchartTypes.has(n.type) ? n.type
      : n.type === "entity" ? "entity" : "class",
    position: n.position,
    data: {
      label: n.data.label,
      attributes: n.data.attributes ?? [],
      methods: n.data.methods ?? [],
      stereotype: n.data.stereotype,
    },
    draggable: true,
  }));
}

export function toFlowEdges(diagramEdges: DiagramEdge[], isSeq: boolean, isErd: boolean, isFlow: boolean): Edge[] {
  if (isSeq) {
    return diagramEdges.map((e, i) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "sequence",
      label: e.label ?? "",
      data: { msgY: SEQ_MSG_START_Y + i * SEQ_MSG_SPACING },
      animated: false,
    }));
  }

  if (isErd) {
    return diagramEdges.map((e) => {
      const edgeLabel = e.multiplicity
        ? `${e.multiplicity.source ?? "1"}:${e.multiplicity.target ?? "*"}`
        : e.label ?? undefined;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: edgeLabel,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 12, height: 12 },
      };
    });
  }

  if (isFlow) {
    return diagramEdges.map((e) => {
      const isNo = e.label?.toLowerCase() === "no";
      const isYes = e.label?.toLowerCase() === "yes";
      const color = isNo ? "#dc2626" : isYes ? "#16a34a" : "#6366f1";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "default",
        animated: false,
        style: { stroke: color, strokeWidth: 2, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        labelStyle: { fill: color, fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "white", fillOpacity: 0.85 },
      };
    });
  }

  // Class diagram edges / deployment communication paths
  return diagramEdges.map((e) => {
    const isInheritance = e.type === "inheritance";
    const isDependency = e.type === "dependency";
    // Deployment communication path: solid line, no arrowhead
    if (!isInheritance && !isDependency && e.label === undefined) {
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "#374151", strokeWidth: 1.5 },
      };
    }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: isDependency,
      style: { stroke: "#374151", strokeWidth: 1.5, strokeDasharray: isDependency ? "5,3" : undefined },
      markerEnd: isInheritance
        ? { type: MarkerType.ArrowClosed, color: "#374151" }
        : { type: MarkerType.Arrow, color: "#374151" },
    };
  });
}
