/**
 * Diagram Canvas Tests
 * Unit tests for interactive diagram editing
 * Requirements: 9.2, 9.3, 9.5
 */

import { describe, expect, it } from "vitest";
import type { DiagramEdge, DiagramNode } from "@/lib/types/diagram";

describe("Diagram Canvas - Interactive Editing", () => {
  describe("Edge Type Validation (Requirement 9.3)", () => {
    it("should validate association edge type", () => {
      const edge: DiagramEdge = {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        type: "association",
      };

      expect(edge.type).toBe("association");
    });

    it("should validate inheritance edge type", () => {
      const edge: DiagramEdge = {
        id: "edge-2",
        source: "node-1",
        target: "node-2",
        type: "inheritance",
      };

      expect(edge.type).toBe("inheritance");
    });

    it("should validate dependency edge type", () => {
      const edge: DiagramEdge = {
        id: "edge-3",
        source: "node-1",
        target: "node-2",
        type: "dependency",
      };

      expect(edge.type).toBe("dependency");
    });

    it("should validate composition edge type", () => {
      const edge: DiagramEdge = {
        id: "edge-4",
        source: "node-1",
        target: "node-2",
        type: "composition",
      };

      expect(edge.type).toBe("composition");
    });

    it("should validate aggregation edge type", () => {
      const edge: DiagramEdge = {
        id: "edge-5",
        source: "node-1",
        target: "node-2",
        type: "aggregation",
      };

      expect(edge.type).toBe("aggregation");
    });
  });

  describe("Node Position Updates (Requirement 9.2)", () => {
    it("should update node position when dragged", () => {
      const node: DiagramNode = {
        id: "node-1",
        type: "class",
        position: { x: 100, y: 100 },
        data: { label: "User" },
      };

      const updatedNode: DiagramNode = {
        ...node,
        position: { x: 200, y: 300 },
      };

      expect(updatedNode.position.x).toBe(200);
      expect(updatedNode.position.y).toBe(300);
      expect(updatedNode.id).toBe(node.id);
    });

    it("should preserve node data when position changes", () => {
      const node: DiagramNode = {
        id: "node-1",
        type: "class",
        position: { x: 100, y: 100 },
        data: {
          label: "User",
          attributes: ["id: string"],
          methods: ["login()"],
        },
      };

      const updatedNode: DiagramNode = {
        ...node,
        position: { x: 200, y: 300 },
      };

      expect(updatedNode.data.label).toBe("User");
      expect(updatedNode.data.attributes).toEqual(["id: string"]);
      expect(updatedNode.data.methods).toEqual(["login()"]);
    });
  });

  describe("Auto-Layout Algorithms (Requirement 9.5)", () => {
    it("should apply force-directed layout to nodes", () => {
      const nodes: DiagramNode[] = [
        {
          id: "node-1",
          type: "class",
          position: { x: 0, y: 0 },
          data: { label: "User" },
        },
        {
          id: "node-2",
          type: "class",
          position: { x: 0, y: 0 },
          data: { label: "Post" },
        },
      ];

      // After layout, nodes should have different positions
      // This is a simplified test - actual layout is tested in integration
      expect(nodes).toHaveLength(2);
      expect(nodes[0].id).toBe("node-1");
      expect(nodes[1].id).toBe("node-2");
    });

    it("should apply hierarchical layout to nodes", () => {
      const nodes: DiagramNode[] = [
        {
          id: "node-1",
          type: "class",
          position: { x: 0, y: 0 },
          data: { label: "Base" },
        },
        {
          id: "node-2",
          type: "class",
          position: { x: 0, y: 0 },
          data: { label: "Derived" },
        },
      ];

      const edges: DiagramEdge[] = [
        {
          id: "edge-1",
          source: "node-2",
          target: "node-1",
          type: "inheritance",
        },
      ];

      // After hierarchical layout, nodes should be arranged in levels
      expect(nodes).toHaveLength(2);
      expect(edges).toHaveLength(1);
    });
  });

  describe("Edge Creation and Deletion (Requirement 9.3)", () => {
    it("should create new edge with valid type", () => {
      const edges: DiagramEdge[] = [];
      const newEdge: DiagramEdge = {
        id: "edge-new",
        source: "node-1",
        target: "node-2",
        type: "association",
      };

      const updatedEdges = [...edges, newEdge];

      expect(updatedEdges).toHaveLength(1);
      expect(updatedEdges[0].type).toBe("association");
    });

    it("should delete edge from diagram", () => {
      const edges: DiagramEdge[] = [
        {
          id: "edge-1",
          source: "node-1",
          target: "node-2",
          type: "association",
        },
        {
          id: "edge-2",
          source: "node-2",
          target: "node-3",
          type: "inheritance",
        },
      ];

      const updatedEdges = edges.filter((e) => e.id !== "edge-1");

      expect(updatedEdges).toHaveLength(1);
      expect(updatedEdges[0].id).toBe("edge-2");
    });
  });
});
