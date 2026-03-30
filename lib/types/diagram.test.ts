/**
 * Diagram Types Tests
 * Unit tests for diagram type definitions
 */

import { describe, expect, it } from "vitest";
import type { Diagram, DiagramEdge, DiagramNode } from "./diagram";

describe("Diagram Types", () => {
  it("should create a valid DiagramNode", () => {
    const node: DiagramNode = {
      id: "node-1",
      type: "class",
      position: { x: 100, y: 200 },
      data: {
        label: "User",
        attributes: ["id: string", "name: string"],
        methods: ["login()", "logout()"],
      },
    };

    expect(node.id).toBe("node-1");
    expect(node.type).toBe("class");
    expect(node.position.x).toBe(100);
    expect(node.data.label).toBe("User");
  });

  it("should create a valid DiagramEdge", () => {
    const edge: DiagramEdge = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      type: "inheritance",
      label: "extends",
    };

    expect(edge.id).toBe("edge-1");
    expect(edge.source).toBe("node-1");
    expect(edge.target).toBe("node-2");
    expect(edge.type).toBe("inheritance");
  });

  it("should create a valid Diagram", () => {
    const diagram: Diagram = {
      id: "diagram-1",
      type: "class",
      nodes: [
        {
          id: "node-1",
          type: "class",
          position: { x: 0, y: 0 },
          data: { label: "User" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "node-1",
          target: "node-2",
          type: "association",
        },
      ],
      metadata: {
        name: "User Class Diagram",
        description: "Shows user relationships",
      },
    };

    expect(diagram.id).toBe("diagram-1");
    expect(diagram.type).toBe("class");
    expect(diagram.nodes).toHaveLength(1);
    expect(diagram.edges).toHaveLength(1);
  });
});
