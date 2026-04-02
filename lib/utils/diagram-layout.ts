/**
 * Post-processor for AI-generated positions.
 * Uses a left-to-right column grid: x=60,320,580,840,1100 (260px apart)
 * Resolves collisions by finding the nearest free cell.
 */

export interface LayoutNode {
  id: string;
  type?: string;
  data?: { attributes?: string[]; methods?: string[] };
}

export interface LayoutEdge {
  source: string;
  target: string;
  type?: string;
}

interface Position { x: number; y: number }

// LR grid: columns at x=60,320,580,840,1100 — rows at y=60,320,580,840...
const COL_STEP = 300;
const ROW_STEP = 300;
const H_PAD = 60;
const V_PAD = 60;

function snapToGrid(pos: Position): { col: number; row: number } {
  return {
    col: Math.max(0, Math.round((pos.x - H_PAD) / COL_STEP)),
    row: Math.max(0, Math.round((pos.y - V_PAD) / ROW_STEP)),
  };
}

function gridToPos(col: number, row: number): Position {
  return { x: H_PAD + col * COL_STEP, y: V_PAD + row * ROW_STEP };
}

function cellKey(col: number, row: number): string { return `${col},${row}`; }

/** BFS spiral to find nearest free cell */
function nearestFree(col: number, row: number, occupied: Set<string>): { col: number; row: number } {
  if (!occupied.has(cellKey(col, row))) return { col, row };
  for (let r = 1; r <= 20; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
        const c = col + dc, rr = row + dr;
        if (c < 0 || rr < 0) continue;
        if (!occupied.has(cellKey(c, rr))) return { col: c, row: rr };
      }
    }
  }
  return { col, row };
}

export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  aiPositions?: Map<string, Position>,
): Map<string, Position> {
  if (nodes.length === 0) return new Map();

  const hasVaried = aiPositions && aiPositions.size > 0 &&
    new Set([...aiPositions.values()].map((p) => `${p.x},${p.y}`)).size > 1;

  if (!hasVaried) return fallbackLR(nodes, edges);

  // Sort by AI x position (left-to-right) so leftmost nodes get priority
  const sorted = [...nodes].sort((a, b) => {
    const pa = aiPositions!.get(a.id) ?? { x: 9999, y: 9999 };
    const pb = aiPositions!.get(b.id) ?? { x: 9999, y: 9999 };
    return pa.x !== pb.x ? pa.x - pb.x : pa.y - pb.y;
  });

  const occupied = new Set<string>();
  const result = new Map<string, Position>();

  for (const node of sorted) {
    const aiPos = aiPositions!.get(node.id) ?? { x: H_PAD, y: V_PAD };
    const cell = snapToGrid(aiPos);
    const free = nearestFree(cell.col, cell.row, occupied);
    occupied.add(cellKey(free.col, free.row));
    result.set(node.id, gridToPos(free.col, free.row));
  }

  return result;
}

/**
 * Fallback: rank nodes by graph depth (LR direction) and place in columns.
 */
function fallbackLR(nodes: LayoutNode[], edges: LayoutEdge[]): Map<string, Position> {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) { inDegree.set(n.id, 0); adj.set(n.id, []); }
  for (const e of edges) {
    if (!e.source || !e.target || e.source === e.target) continue;
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }
  const ranks = new Map<string, number>();
  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const rank = ranks.get(id) ?? 0;
    for (const nb of adj.get(id) ?? []) {
      const nr = rank + 1;
      if ((ranks.get(nb) ?? 0) < nr) ranks.set(nb, nr);
      const d = (inDegree.get(nb) ?? 1) - 1;
      inDegree.set(nb, d);
      if (d === 0) queue.push(nb);
    }
  }
  for (const n of nodes) { if (!ranks.has(n.id)) ranks.set(n.id, 0); }

  const byCol = new Map<number, string[]>();
  for (const n of nodes) {
    const col = ranks.get(n.id) ?? 0;
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col)!.push(n.id);
  }

  const result = new Map<string, Position>();
  for (const [col, colNodes] of byCol) {
    colNodes.forEach((id, row) => result.set(id, gridToPos(col, row)));
  }
  return result;
}
