import { useEffect } from "react";
import type { Node } from "@xyflow/react";

const CONTAINER_TYPES = new Set(["deploymentNode", "executionEnvironment"]);
const PAD = 16; // padding around children inside the container

/**
 * After every node change, finds all container nodes that have children
 * and expands them so every child fits inside with padding.
 * Calls setNodes only when a resize is actually needed.
 */
export function useAutoResizeContainers(
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
) {
  useEffect(() => {
    let dirty = false;

    const next = nodes.map((node) => {
      if (!CONTAINER_TYPES.has(node.type ?? "")) return node;

      const children = nodes.filter((n) => n.parentId === node.id);
      if (children.length === 0) return node;

      // Compute bounding box of all children (positions are relative to parent)
      let maxX = 0;
      let maxY = 0;
      for (const child of children) {
        const cw = (child.style?.width as number) ?? (child.measured?.width ?? 160);
        const ch = (child.style?.height as number) ?? (child.measured?.height ?? 52);
        maxX = Math.max(maxX, child.position.x + cw);
        maxY = Math.max(maxY, child.position.y + ch);
      }

      const neededW = maxX + PAD;
      const neededH = maxY + PAD;

      const currentW = (node.style?.width as number) ?? 280;
      const currentH = (node.style?.height as number) ?? 160;

      // Only grow, never shrink (user may have manually made it bigger)
      const newW = Math.max(currentW, neededW);
      const newH = Math.max(currentH, neededH);

      if (newW === currentW && newH === currentH) return node;

      dirty = true;
      return { ...node, style: { ...node.style, width: newW, height: newH } };
    });

    if (dirty) setNodes(next);
  // We intentionally only re-run when the nodes array reference changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);
}
