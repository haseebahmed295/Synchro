import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DiagramEdge, DiagramNode } from "@/lib/types/diagram";
import { computeActivations, SEQ_COL_SPACING, SEQ_LIFELINE_HEIGHT, SEQ_MSG_SPACING, SEQ_MSG_START_Y } from "./nodes-sequence";

export function toFlowNodes(diagramNodes: DiagramNode[], isSeq: boolean, isDeploy: boolean, isComponent?: boolean, diagramEdges?: DiagramEdge[]): Node[] {
  if (isSeq) {
    const actors = diagramNodes.filter((n) => n.type === "actor");
    const lifelines = diagramNodes.filter((n) => n.type !== "actor" && n.type !== "fragment");
    const fragments = diagramNodes.filter((n) => n.type === "fragment");

    // Pre-compute activation boxes from edges
    const edgesForActivation = (diagramEdges ?? []).map((e, i) => ({
      source: e.source,
      target: e.target,
      data: {
        msgY: e.msgY ?? (SEQ_MSG_START_Y + i * SEQ_MSG_SPACING),
        msgType: e.msgType ?? "sync",
      },
    }));
    const NODE_Y = 40; // lifeline nodes are always placed at y=40
    const activationMap = computeActivations(edgesForActivation, NODE_Y);

    // Compute required lifeline height from the max msgY across all edges
    const maxMsgY = edgesForActivation.reduce((max, e) => Math.max(max, (e.data.msgY as number) ?? SEQ_MSG_START_Y), SEQ_MSG_START_Y);
    // Add padding below the last message, subtract NODE_Y since height is relative to node top
    const lifelineHeight = Math.max(SEQ_LIFELINE_HEIGHT, maxMsgY - NODE_Y + 120);

    return [
      ...([...actors, ...lifelines].map((n, i) => ({
        id: n.id,
        type: "lifeline",
        position: { x: 60 + i * SEQ_COL_SPACING, y: NODE_Y },
        data: {
          label: n.data.label,
          isActor: actors.some((a) => a.id === n.id),
          activations: activationMap.get(n.id) ?? [],
          lifelineHeight,
        },
        draggable: true,
        dragHandle: ".lifeline-drag-x-only",
      }))),
      ...fragments.map((n) => ({
        id: n.id,
        type: "fragment",
        position: n.position ?? { x: 100, y: 150 },
        data: {
          label: n.data.label,
          kind: n.data.stereotype ?? "alt",
          condition: n.data.attributes?.[0] ?? "",
        },
        draggable: true,
        style: {
          width: (n.data as any).width ?? 400,
          height: (n.data as any).height ?? 120,
        },
        zIndex: -1,
      })),
    ];
  }


  if (isDeploy) {
    // Use ReactFlow parentId nesting — children positions are relative to parent.
    // Container types that can hold children.
    const CONTAINER_TYPES = new Set(["node", "executionEnvironment"]);
    const CHILD_PAD = 16;
    const HEADER_H = 56; // header height for containers
    const CHILD_H: Record<string, number> = {
      artifact: 68,
      component: 80,
      interface: 68,
      executionEnvironment: 120,
      node: 140,
    };
    const CHILD_W = 260;
    const CHILD_GAP = 16;
    const TOP_LEVEL_GAP = 60; // gap between top-level nodes

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
        const ch = CONTAINER_TYPES.has(childType) ? containerH(cid) : (CHILD_H[childType] ?? 56);
        h += ch + CHILD_GAP;
      }
      return h + CHILD_PAD;
    }

    // Compute container width — based on nesting depth
    function containerW(nodeId: string): number {
      const n = diagramNodes.find((x) => x.id === nodeId);
      if (!n) return CHILD_W;
      const children = n.data.children ?? [];
      if (children.length === 0) return Math.max(CHILD_W + CHILD_PAD * 2, 300);
      // Width is widest child + padding
      let maxChildW = CHILD_W;
      for (const cid of children) {
        const childType = diagramNodes.find((x) => x.id === cid)?.type ?? "artifact";
        const cw = CONTAINER_TYPES.has(childType) ? containerW(cid) : CHILD_W;
        maxChildW = Math.max(maxChildW, cw);
      }
      return maxChildW + CHILD_PAD * 2;
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
        const ch = CONTAINER_TYPES.has(childType) ? containerH(cid) : (CHILD_H[childType] ?? 56);
        y += ch + CHILD_GAP;
        // recurse
        for (const [id, pos] of childrenPositions(cid)) result.set(id, pos);
      }
      return result;
    }

    // Auto-layout top-level nodes in rows to prevent overlap
    const topLevelNodes = diagramNodes.filter((n) => !childOf.has(n.id));
    const topLevelSizes = new Map<string, { w: number; h: number }>();
    for (const n of topLevelNodes) {
      topLevelSizes.set(n.id, {
        w: containerW(n.id),
        h: containerH(n.id),
      });
    }

    // Arrange top-level nodes in rows of max 3 columns
    const MAX_COLS = 3;
    const relPos = new Map<string, { x: number; y: number }>();
    let currentX = 60;
    let currentY = 60;
    let rowMaxH = 0;
    let colIndex = 0;

    for (const n of topLevelNodes) {
      const size = topLevelSizes.get(n.id)!;
      if (colIndex >= MAX_COLS) {
        // Move to next row
        currentX = 60;
        currentY += rowMaxH + TOP_LEVEL_GAP;
        rowMaxH = 0;
        colIndex = 0;
      }
      relPos.set(n.id, { x: currentX, y: currentY });
      currentX += size.w + TOP_LEVEL_GAP;
      rowMaxH = Math.max(rowMaxH, size.h);
      colIndex++;
    }

    // Assign child positions relative to parents
    for (const n of diagramNodes) {
      if (CONTAINER_TYPES.has(n.type)) {
        for (const [id, pos] of childrenPositions(n.id)) {
          relPos.set(id, pos);
        }
      }
    }

    // ReactFlow requires parent nodes to appear BEFORE their children in the array.
    // Topologically sort: depth-0 (top-level) first, then depth-1 children, etc.
    const depthOf = new Map<string, number>();
    function getDepth(id: string): number {
      if (depthOf.has(id)) return depthOf.get(id)!;
      const pid = childOf.get(id);
      const d = pid ? getDepth(pid) + 1 : 0;
      depthOf.set(id, d);
      return d;
    }
    for (const n of diagramNodes) getDepth(n.id);

    const sorted = [...diagramNodes].sort((a, b) => getDepth(a.id) - getDepth(b.id));

    return sorted.map((n) => {
      const isContainer = CONTAINER_TYPES.has(n.type);
      const parentId = childOf.get(n.id);
      const childType = n.type as string;
      const h = isContainer ? containerH(n.id) : (CHILD_H[childType] ?? 56);
      const w = isContainer ? containerW(n.id) : CHILD_W;

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

  // ─── Component diagram ───────────────────────────────────────────────────────
  if (isComponent) {
    return diagramNodes.map((n) => {
      // Map diagram types to the dedicated component-diagram ReactFlow types
      const rfType = n.type === "component" ? "componentDiagram"
        : n.type === "interface" ? "providedInterface"
        : "componentDiagram"; // fallback
      return {
        id: n.id,
        type: rfType,
        position: n.position,
        data: {
          label: n.data.label,
          attributes: n.data.attributes ?? [],
          methods: n.data.methods ?? [],
          stereotype: n.data.stereotype,
        },
        draggable: true,
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

export function toFlowEdges(diagramEdges: DiagramEdge[], isSeq: boolean, isErd: boolean, isFlow: boolean, isComponent?: boolean): Edge[] {
  if (isSeq) {
    // Sort by msgY (vertical position) to derive execution order
    const sorted = [...diagramEdges].sort((a, b) => {
      const aY = a.msgY ?? SEQ_MSG_START_Y;
      const bY = b.msgY ?? SEQ_MSG_START_Y;
      return aY - bY;
    });
    return sorted.map((e, i) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "sequence",
      label: e.label ?? "",
      data: {
        msgY: e.msgY ?? (SEQ_MSG_START_Y + i * SEQ_MSG_SPACING),
        msgType: e.msgType ?? "sync",
        order: i + 1,
      },
      animated: false,
    }));
  }

  // ─── Component diagram edges — dashed dependency with open arrow ────────────
  if (isComponent) {
    return diagramEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      label: e.label ?? undefined,
      style: { stroke: "#6366f1", strokeWidth: 1.5, strokeDasharray: "6 3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1", width: 14, height: 14 },
      labelStyle: { fill: "#6366f1", fontWeight: 600, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
      labelBgStyle: { fill: "white", fillOpacity: 0.9 },
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    }));
  }

  if (isErd) {
    return diagramEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "erdEdge",
      data: {
        sourceMult: e.multiplicity?.source ?? "1",
        targetMult: e.multiplicity?.target ?? "0..*",
      },
    }));
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
        type: "smoothstep",
        animated: false,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        labelStyle: { fill: color, fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: "white", fillOpacity: 1 },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      };
    });
  }

  // Class diagram edges — use custom UmlClassEdge type
  // Deployment communication paths fall through here too; they have no type set
  // so we detect them by checking if the edge type is a known UML relationship.
  const UML_TYPES = new Set(["association", "inheritance", "composition", "aggregation", "dependency"]);
  return diagramEdges.map((e) => {
    const isUml = UML_TYPES.has(e.type ?? "");
    // Deployment communication path: solid line, no arrowhead
    if (!isUml) {
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
      type: "umlClass",
      data: {
        relType: e.type ?? "association",
        sourceMultiplicity: e.multiplicity?.source ?? "",
        targetMultiplicity: e.multiplicity?.target ?? "",
      },
    };
  });
}
