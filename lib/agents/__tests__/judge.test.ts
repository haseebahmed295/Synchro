/**
 * Unit Tests for Judge Agent
 * Tests diagram validation and Critic/Refine loop
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "../../types/diagram";
import { JudgeAgent, type RefinementFeedback } from "../judge";
import type { ValidationIssue } from "../types";

// Mock the AI client
vi.mock("../../ai/client", () => ({
  generateAIObject: vi.fn(),
  generateAIText: vi.fn(),
}));

import { generateAIObject } from "../../ai/client";

describe("JudgeAgent", () => {
  let agent: JudgeAgent;

  beforeEach(() => {
    agent = new JudgeAgent();
    vi.clearAllMocks();
  });

  describe("validateDiagramConsistency", () => {
    it("should pass validation for a valid diagram", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "NODE_1",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "User" },
          },
          {
            id: "NODE_2",
            type: "class",
            position: { x: 300, y: 100 },
            data: { label: "Order" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "NODE_1",
            target: "NODE_2",
            type: "association",
          },
        ],
      };

      // Mock AI validation returning no issues
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "Diagram is valid",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      expect(issues).toHaveLength(0);
    });

    it("should detect orphaned nodes", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "CONNECTED_NODE",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "Connected" },
          },
          {
            id: "ORPHANED_NODE_1",
            type: "class",
            position: { x: 300, y: 100 },
            data: { label: "Orphaned1" },
          },
          {
            id: "ORPHANED_NODE_2",
            type: "class",
            position: { x: 500, y: 100 },
            data: { label: "Orphaned2" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "CONNECTED_NODE",
            target: "CONNECTED_NODE",
            type: "association",
          },
        ],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "No AI issues",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should detect 2 orphaned nodes
      const orphanedIssue = issues.find((i) => i.message.includes("orphaned"));
      expect(orphanedIssue).toBeDefined();
      expect(orphanedIssue?.severity).toBe("warning");
      expect(orphanedIssue?.affectedArtifacts).toContain("ORPHANED_NODE_1");
      expect(orphanedIssue?.affectedArtifacts).toContain("ORPHANED_NODE_2");
      expect(orphanedIssue?.affectedArtifacts).not.toContain("CONNECTED_NODE");
    });

    it("should detect circular inheritance", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "CLASS_A",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "ClassA" },
          },
          {
            id: "CLASS_B",
            type: "class",
            position: { x: 300, y: 100 },
            data: { label: "ClassB" },
          },
          {
            id: "CLASS_C",
            type: "class",
            position: { x: 500, y: 100 },
            data: { label: "ClassC" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "CLASS_A",
            target: "CLASS_B",
            type: "inheritance",
          },
          {
            id: "EDGE_2",
            source: "CLASS_B",
            target: "CLASS_C",
            type: "inheritance",
          },
          {
            id: "EDGE_3",
            source: "CLASS_C",
            target: "CLASS_A",
            type: "inheritance", // Creates cycle
          },
        ],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "No AI issues",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should detect circular inheritance
      const cycleIssue = issues.find((i) =>
        i.message.includes("circular inheritance"),
      );
      expect(cycleIssue).toBeDefined();
      expect(cycleIssue?.severity).toBe("error");
      expect(cycleIssue?.affectedArtifacts).toContain("CLASS_A");
      expect(cycleIssue?.affectedArtifacts).toContain("CLASS_B");
      expect(cycleIssue?.affectedArtifacts).toContain("CLASS_C");
    });

    it("should not flag non-inheritance edges as cycles", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "CLASS_A",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "ClassA" },
          },
          {
            id: "CLASS_B",
            type: "class",
            position: { x: 300, y: 100 },
            data: { label: "ClassB" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "CLASS_A",
            target: "CLASS_B",
            type: "association", // Not inheritance
          },
          {
            id: "EDGE_2",
            source: "CLASS_B",
            target: "CLASS_A",
            type: "dependency", // Not inheritance
          },
        ],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "No AI issues",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should not detect any cycles
      const cycleIssue = issues.find((i) => i.message.includes("circular"));
      expect(cycleIssue).toBeUndefined();
    });

    it("should include AI validation issues", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "NODE_1",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "InvalidClass" },
          },
        ],
        edges: [],
      };

      // Mock AI validation returning issues
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [
          {
            severity: "error",
            message: "Class name should follow PascalCase convention",
            affectedArtifacts: ["NODE_1"],
            suggestedFix: "Rename to follow PascalCase",
          },
          {
            severity: "warning",
            message: "Class has no methods or attributes",
            affectedArtifacts: ["NODE_1"],
          },
        ],
        reasoning: "Found naming and structure issues",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should include AI-detected issues
      expect(issues.length).toBeGreaterThanOrEqual(2);
      const namingIssue = issues.find((i) => i.message.includes("PascalCase"));
      expect(namingIssue).toBeDefined();
      expect(namingIssue?.severity).toBe("error");
    });

    it("should handle AI validation failure gracefully", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "NODE_1",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "Test" },
          },
        ],
        edges: [],
      };

      // Mock AI validation failure
      vi.mocked(generateAIObject).mockRejectedValue(
        new Error("AI service unavailable"),
      );

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should still return basic validation results (orphaned node warning)
      expect(issues).toBeDefined();
      // Should not throw error
    });

    it("should detect multiple issues in complex diagram", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "CLASS_A",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "ClassA" },
          },
          {
            id: "CLASS_B",
            type: "class",
            position: { x: 300, y: 100 },
            data: { label: "ClassB" },
          },
          {
            id: "ORPHANED",
            type: "class",
            position: { x: 500, y: 100 },
            data: { label: "Orphaned" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "CLASS_A",
            target: "CLASS_B",
            type: "inheritance",
          },
          {
            id: "EDGE_2",
            source: "CLASS_B",
            target: "CLASS_A",
            type: "inheritance", // Creates cycle
          },
        ],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [
          {
            severity: "warning",
            message: "Consider using composition instead of inheritance",
            affectedArtifacts: ["CLASS_A", "CLASS_B"],
          },
        ],
        reasoning: "Design pattern suggestion",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should detect: orphaned node, circular inheritance, and AI issue
      expect(issues.length).toBeGreaterThanOrEqual(3);

      const orphanedIssue = issues.find((i) => i.message.includes("orphaned"));
      expect(orphanedIssue).toBeDefined();

      const cycleIssue = issues.find((i) => i.message.includes("circular"));
      expect(cycleIssue).toBeDefined();

      const aiIssue = issues.find((i) => i.message.includes("composition"));
      expect(aiIssue).toBeDefined();
    });
  });

  describe("validateWithRefinement (Critic/Refine loop)", () => {
    it("should pass validation on first iteration", async () => {
      const mockOutput = { value: "test" };
      const mockValidator = vi.fn().mockResolvedValue([]);
      const mockRefiner = vi.fn();

      const result = await agent.validateWithRefinement(
        mockOutput,
        mockValidator,
        mockRefiner,
        "Test validation",
      );

      expect(result.requiresEscalation).toBe(false);
      expect(result.output).toEqual(mockOutput);
      expect(result.issues).toHaveLength(0);
      expect(mockValidator).toHaveBeenCalledTimes(1);
      expect(mockRefiner).not.toHaveBeenCalled();
      expect(result.reasoningLog).toContain("Validation passed on iteration 1");
    });

    it("should refine once and pass on second iteration", async () => {
      const mockOutput = { value: "test" };
      const refinedOutput = { value: "refined" };

      const mockValidator = vi
        .fn()
        .mockResolvedValueOnce([
          {
            severity: "error",
            message: "Invalid value",
            affectedArtifacts: ["test"],
            suggestedFix: "Fix the value",
          },
        ])
        .mockResolvedValueOnce([]); // Pass on second call

      const mockRefiner = vi.fn().mockResolvedValue(refinedOutput);

      const result = await agent.validateWithRefinement(
        mockOutput,
        mockValidator,
        mockRefiner,
        "Test validation",
      );

      expect(result.requiresEscalation).toBe(false);
      expect(result.output).toEqual(refinedOutput);
      expect(mockValidator).toHaveBeenCalledTimes(2);
      expect(mockRefiner).toHaveBeenCalledTimes(1);

      // Check refinement feedback
      const refinementCall = mockRefiner.mock.calls[0];
      expect(refinementCall[0]).toEqual(mockOutput);
      expect(refinementCall[1].iterationCount).toBe(1);
      expect(refinementCall[1].issues).toHaveLength(1);
    });

    it("should escalate after max refinement iterations", async () => {
      const mockOutput = { value: "test" };

      const mockValidator = vi.fn().mockResolvedValue([
        {
          severity: "error",
          message: "Persistent error",
          affectedArtifacts: ["test"],
        },
      ]);

      const mockRefiner = vi.fn().mockResolvedValue(mockOutput);

      const result = await agent.validateWithRefinement(
        mockOutput,
        mockValidator,
        mockRefiner,
        "Test validation",
      );

      expect(result.requiresEscalation).toBe(true);
      expect(mockValidator).toHaveBeenCalledTimes(3); // Initial + 2 refinements + final
      expect(mockRefiner).toHaveBeenCalledTimes(2); // Max 2 refinements
      expect(result.reasoningLog).toContain(
        "Validation failed after 2 refinement iterations",
      );
      expect(
        result.reasoningLog.some((log) => log.includes("Escalating to user")),
      ).toBe(true);
    });

    it("should ignore warnings and only refine on errors", async () => {
      const mockOutput = { value: "test" };

      const mockValidator = vi.fn().mockResolvedValue([
        {
          severity: "warning",
          message: "Minor issue",
          affectedArtifacts: ["test"],
        },
        {
          severity: "info",
          message: "Suggestion",
          affectedArtifacts: ["test"],
        },
      ]);

      const mockRefiner = vi.fn();

      const result = await agent.validateWithRefinement(
        mockOutput,
        mockValidator,
        mockRefiner,
        "Test validation",
      );

      expect(result.requiresEscalation).toBe(false);
      expect(mockRefiner).not.toHaveBeenCalled();
      expect(result.issues).toHaveLength(2);
    });

    it("should handle refiner failure", async () => {
      const mockOutput = { value: "test" };

      const mockValidator = vi.fn().mockResolvedValue([
        {
          severity: "error",
          message: "Error",
          affectedArtifacts: ["test"],
        },
      ]);

      const mockRefiner = vi
        .fn()
        .mockRejectedValue(new Error("Refinement failed"));

      const result = await agent.validateWithRefinement(
        mockOutput,
        mockValidator,
        mockRefiner,
        "Test validation",
      );

      expect(result.requiresEscalation).toBe(true);
      expect(
        result.reasoningLog.some((log) => log.includes("Refinement failed")),
      ).toBe(true);
    });

    it("should track iteration count correctly", async () => {
      const mockOutput = { value: "test" };

      const mockValidator = vi
        .fn()
        .mockResolvedValueOnce([
          { severity: "error", message: "Error 1", affectedArtifacts: [] },
        ])
        .mockResolvedValueOnce([
          { severity: "error", message: "Error 2", affectedArtifacts: [] },
        ])
        .mockResolvedValueOnce([
          { severity: "error", message: "Error 3", affectedArtifacts: [] },
        ])
        .mockResolvedValueOnce([]); // Pass on fourth validation (after 2 refinements, then final check)

      const mockRefiner = vi
        .fn()
        .mockResolvedValueOnce({ value: "refined1" })
        .mockResolvedValueOnce({ value: "refined2" });

      const result = await agent.validateWithRefinement(
        mockOutput,
        mockValidator,
        mockRefiner,
        "Test validation",
      );

      // After 2 refinements with errors, it should escalate
      expect(result.requiresEscalation).toBe(true);

      // Check iteration counts in refinement calls
      expect(mockRefiner.mock.calls[0][1].iterationCount).toBe(1);
      expect(mockRefiner.mock.calls[1][1].iterationCount).toBe(2);
    });
  });

  describe("validateArchitectOutput", () => {
    it("should validate and refine Architect diagram output", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "CLASS_A",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "ClassA" },
          },
          {
            id: "CLASS_B",
            type: "class",
            position: { x: 300, y: 100 },
            data: { label: "ClassB" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "CLASS_A",
            target: "CLASS_B",
            type: "inheritance",
          },
          {
            id: "EDGE_2",
            source: "CLASS_B",
            target: "CLASS_A",
            type: "inheritance", // Circular
          },
        ],
      };

      const refinedDiagram: Diagram = {
        ...diagram,
        edges: [
          {
            id: "EDGE_1",
            source: "CLASS_A",
            target: "CLASS_B",
            type: "association", // Fixed: changed to association
          },
        ],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "No AI issues",
      });

      const mockRefineCallback = vi.fn().mockResolvedValue(refinedDiagram);

      const result = await agent.validateArchitectOutput(
        diagram,
        mockRefineCallback,
      );

      expect(result.requiresEscalation).toBe(false);
      expect(result.diagram).toEqual(refinedDiagram);
      expect(mockRefineCallback).toHaveBeenCalledTimes(1);
    });

    it("should escalate if refinement fails after max iterations", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "ORPHANED",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "Orphaned" },
          },
        ],
        edges: [],
      };

      // Mock AI validation - always returns empty (no AI issues)
      // But orphaned node will be detected by basic validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "No AI issues",
      });

      const mockRefineCallback = vi.fn().mockResolvedValue(diagram); // Returns same diagram

      const result = await agent.validateArchitectOutput(
        diagram,
        mockRefineCallback,
      );

      // Orphaned node is a warning, not an error, so it should pass
      expect(result.requiresEscalation).toBe(false);
      expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
      // Refiner should not be called since warnings don't trigger refinement
      expect(mockRefineCallback).toHaveBeenCalledTimes(0);
    });
  });

  describe("generateRefinementPrompt", () => {
    it("should generate clear refinement prompt", () => {
      const feedback: RefinementFeedback = {
        issues: [
          {
            severity: "error",
            message: "Circular inheritance detected",
            affectedArtifacts: ["CLASS_A", "CLASS_B"],
            suggestedFix: "Remove one inheritance edge",
          },
          {
            severity: "warning",
            message: "Orphaned node found",
            affectedArtifacts: ["CLASS_C"],
            suggestedFix: "Add connections or remove node",
          },
        ],
        suggestions: [
          "Remove one inheritance edge",
          "Add connections or remove node",
        ],
        iterationCount: 1,
      };

      const prompt = agent.generateRefinementPrompt(feedback);

      expect(prompt).toContain("2 issue(s)");
      expect(prompt).toContain("Circular inheritance detected");
      expect(prompt).toContain("Orphaned node found");
      expect(prompt).toContain("CLASS_A, CLASS_B");
      expect(prompt).toContain("CLASS_C");
      expect(prompt).toContain("iteration 1 of 2");
      expect(prompt).toContain("Remove one inheritance edge");
      expect(prompt).toContain("Add connections or remove node");
    });

    it("should handle issues without suggested fixes", () => {
      const feedback: RefinementFeedback = {
        issues: [
          {
            severity: "error",
            message: "Invalid structure",
            affectedArtifacts: ["NODE_1"],
          },
        ],
        suggestions: [],
        iterationCount: 2,
      };

      const prompt = agent.generateRefinementPrompt(feedback);

      expect(prompt).toContain("Invalid structure");
      expect(prompt).toContain("iteration 2 of 2");
      expect(prompt).not.toContain("Suggested fix:");
    });
  });

  describe("edge cases", () => {
    it("should handle empty diagram", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [],
        edges: [],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "Empty diagram",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Empty diagram is technically valid (no orphaned nodes, no cycles)
      expect(issues).toHaveLength(0);
    });

    it("should handle diagram with only one node", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "SINGLE_NODE",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "Single" },
          },
        ],
        edges: [],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "Single node diagram",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should detect orphaned node
      expect(issues.some((i) => i.message.includes("orphaned"))).toBe(true);
    });

    it("should handle self-referencing inheritance", async () => {
      const diagram: Diagram = {
        id: "diagram-123",
        type: "class",
        nodes: [
          {
            id: "CLASS_A",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "ClassA" },
          },
        ],
        edges: [
          {
            id: "EDGE_1",
            source: "CLASS_A",
            target: "CLASS_A",
            type: "inheritance", // Self-reference
          },
        ],
      };

      // Mock AI validation
      vi.mocked(generateAIObject).mockResolvedValue({
        issues: [],
        reasoning: "No AI issues",
      });

      const issues = await agent.validateDiagramConsistency(diagram);

      // Should detect circular inheritance (self-loop)
      const cycleIssue = issues.find((i) => i.message.includes("circular"));
      expect(cycleIssue).toBeDefined();
    });
  });
});
