/**
 * Unit Tests for Architect Agent Bidirectional Sync
 * Tests for diagram-requirement synchronization features
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/lib/types/diagram";
import type { Requirement } from "../analyst";
import { ArchitectAgent } from "../architect";
import type { JSONPatch } from "../json-patch";

// Mock the AI client
vi.mock("@/lib/ai/client", () => ({
  generateAIObject: vi.fn(),
}));

import { generateAIObject } from "@/lib/ai/client";

describe("ArchitectAgent - Bidirectional Sync", () => {
  let architect: ArchitectAgent;

  beforeEach(() => {
    architect = new ArchitectAgent();
    vi.clearAllMocks();
  });

  describe("suggestDiagramUpdates", () => {
    it("should suggest diagram updates based on requirement changes", async () => {
      // Arrange
      const reqDelta: JSONPatch = {
        op: "replace",
        path: "/requirements/REQ_001/title",
        value: "Updated User Authentication",
      };

      const currentDiagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [
          {
            id: "USER_CLASS",
            type: "class",
            position: { x: 100, y: 100 },
            data: {
              label: "User",
              attributes: ["username", "email"],
              methods: ["login()", "logout()"],
            },
          },
        ],
        edges: [],
      };

      const requirements: Requirement[] = [
        {
          id: "REQ_001",
          title: "User Authentication",
          description: "System shall support user authentication",
          type: "functional",
          priority: "high",
          status: "validated",
          links: [],
        },
      ];

      const mockSuggestions = {
        suggestions: [
          {
            action: "update_node",
            target_id: "USER_CLASS",
            data: {
              methods: ["login()", "logout()", "authenticate()"],
            },
            reasoning: "Added authenticate method based on updated requirement",
            confidence: 0.85,
          },
        ],
      };

      vi.mocked(generateAIObject).mockResolvedValue(mockSuggestions);

      // Act
      const suggestions = await architect.suggestDiagramUpdates(
        reqDelta,
        currentDiagram,
        requirements,
      );

      // Assert
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].action).toBe("update_node");
      expect(suggestions[0].target_id).toBe("USER_CLASS");
      expect(suggestions[0].confidence).toBe(0.85);
      expect(suggestions[0].reasoning).toContain("authenticate");
      expect(generateAIObject).toHaveBeenCalledWith(
        "architecture",
        expect.stringContaining("requirement change"),
        expect.any(Object),
        expect.stringContaining("software architect"),
      );
    });

    it("should suggest adding a new node when requirement is added", async () => {
      // Arrange
      const reqDelta: JSONPatch = {
        op: "add",
        path: "/requirements/REQ_002",
        value: {
          title: "Payment Processing",
          description: "System shall process payments",
        },
      };

      const currentDiagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [],
        edges: [],
      };

      const requirements: Requirement[] = [
        {
          id: "REQ_002",
          title: "Payment Processing",
          description: "System shall process payments",
          type: "functional",
          priority: "high",
          status: "draft",
          links: [],
        },
      ];

      const mockSuggestions = {
        suggestions: [
          {
            action: "add_node",
            target_id: "PAYMENT_CLASS",
            data: {
              type: "class",
              label: "Payment",
              position: { x: 200, y: 200 },
              attributes: ["amount", "currency", "status"],
              methods: ["process()", "refund()"],
            },
            reasoning:
              "New Payment class needed for payment processing requirement",
            confidence: 0.9,
          },
        ],
      };

      vi.mocked(generateAIObject).mockResolvedValue(mockSuggestions);

      // Act
      const suggestions = await architect.suggestDiagramUpdates(
        reqDelta,
        currentDiagram,
        requirements,
      );

      // Assert
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].action).toBe("add_node");
      expect(suggestions[0].target_id).toBe("PAYMENT_CLASS");
      expect(suggestions[0].data.label).toBe("Payment");
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const reqDelta: JSONPatch = {
        op: "replace",
        path: "/requirements/REQ_001/title",
        value: "Updated",
      };

      const currentDiagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [],
        edges: [],
      };

      const requirements: Requirement[] = [];

      vi.mocked(generateAIObject).mockRejectedValue(
        new Error("AI service unavailable"),
      );

      // Act & Assert
      await expect(
        architect.suggestDiagramUpdates(reqDelta, currentDiagram, requirements),
      ).rejects.toThrow("Diagram update suggestion failed");
    });
  });

  describe("diagramToRequirements", () => {
    it("should suggest requirements based on diagram structure", async () => {
      // Arrange
      const diagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [
          {
            id: "USER_CLASS",
            type: "class",
            position: { x: 100, y: 100 },
            data: {
              label: "User",
              attributes: ["username", "email", "password"],
              methods: ["login()", "logout()", "register()"],
            },
          },
          {
            id: "AUTH_SERVICE",
            type: "class",
            position: { x: 300, y: 100 },
            data: {
              label: "AuthService",
              methods: ["authenticate()", "validateToken()"],
            },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "USER_CLASS",
            target: "AUTH_SERVICE",
            type: "dependency",
          },
        ],
      };

      const mockSuggestions = {
        suggestions: [
          {
            action: "add_requirement",
            title: "User Authentication",
            description:
              "System shall provide user authentication with login and logout functionality",
            type: "functional",
            priority: "high",
            reasoning:
              "User class has login/logout methods and depends on AuthService",
            confidence: 0.88,
            affected_nodes: ["USER_CLASS", "AUTH_SERVICE"],
          },
          {
            action: "add_requirement",
            title: "User Registration",
            description:
              "System shall allow new users to register with username, email, and password",
            type: "functional",
            priority: "high",
            reasoning: "User class has register method and required attributes",
            confidence: 0.85,
            affected_nodes: ["USER_CLASS"],
          },
        ],
      };

      vi.mocked(generateAIObject).mockResolvedValue(mockSuggestions);

      // Act
      const suggestions = await architect.diagramToRequirements(diagram);

      // Assert
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].action).toBe("add_requirement");
      expect(suggestions[0].title).toBe("User Authentication");
      expect(suggestions[0].confidence).toBe(0.88);
      expect(suggestions[0].affected_nodes).toContain("USER_CLASS");
      expect(suggestions[0].affected_nodes).toContain("AUTH_SERVICE");
      expect(generateAIObject).toHaveBeenCalledWith(
        "architecture",
        expect.stringContaining("diagram"),
        expect.any(Object),
        expect.stringContaining("software architect"),
      );
    });

    it("should detect changes when comparing with previous diagram", async () => {
      // Arrange
      const currentDiagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [
          {
            id: "USER_CLASS",
            type: "class",
            position: { x: 100, y: 100 },
            data: {
              label: "User",
              attributes: ["username", "email", "twoFactorEnabled"],
              methods: ["login()", "logout()", "enableTwoFactor()"],
            },
          },
        ],
        edges: [],
      };

      const previousDiagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [
          {
            id: "USER_CLASS",
            type: "class",
            position: { x: 100, y: 100 },
            data: {
              label: "User",
              attributes: ["username", "email"],
              methods: ["login()", "logout()"],
            },
          },
        ],
        edges: [],
      };

      const mockSuggestions = {
        suggestions: [
          {
            action: "add_requirement",
            title: "Two-Factor Authentication",
            description:
              "System shall support two-factor authentication for enhanced security",
            type: "functional",
            priority: "medium",
            reasoning:
              "New twoFactorEnabled attribute and enableTwoFactor method added to User class",
            confidence: 0.92,
            affected_nodes: ["USER_CLASS"],
          },
        ],
      };

      vi.mocked(generateAIObject).mockResolvedValue(mockSuggestions);

      // Act
      const suggestions = await architect.diagramToRequirements(
        currentDiagram,
        previousDiagram,
      );

      // Assert
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe("Two-Factor Authentication");
      expect(suggestions[0].confidence).toBe(0.92);
      expect(generateAIObject).toHaveBeenCalledWith(
        "architecture",
        expect.stringContaining("Previous Diagram"),
        expect.any(Object),
        expect.any(String),
      );
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const diagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [],
        edges: [],
      };

      vi.mocked(generateAIObject).mockRejectedValue(
        new Error("AI service error"),
      );

      // Act & Assert
      await expect(architect.diagramToRequirements(diagram)).rejects.toThrow(
        "Diagram to requirements conversion failed",
      );
    });
  });

  describe("Confidence Scoring", () => {
    it("should return high confidence suggestions for direct mappings", async () => {
      // Arrange
      const reqDelta: JSONPatch = {
        op: "add",
        path: "/requirements/REQ_003",
        value: {
          title: "Database Connection",
          description: "System shall connect to PostgreSQL database",
        },
      };

      const currentDiagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [],
        edges: [],
      };

      const requirements: Requirement[] = [];

      const mockSuggestions = {
        suggestions: [
          {
            action: "add_node",
            target_id: "DATABASE_CLASS",
            data: { label: "Database" },
            reasoning: "Direct mapping from requirement",
            confidence: 0.95,
          },
        ],
      };

      vi.mocked(generateAIObject).mockResolvedValue(mockSuggestions);

      // Act
      const suggestions = await architect.suggestDiagramUpdates(
        reqDelta,
        currentDiagram,
        requirements,
      );

      // Assert
      expect(suggestions[0].confidence).toBeGreaterThan(0.7);
    });

    it("should return lower confidence for speculative suggestions", async () => {
      // Arrange
      const diagram: Diagram = {
        id: "diagram-1",
        type: "class",
        nodes: [
          {
            id: "UNKNOWN_CLASS",
            type: "class",
            position: { x: 100, y: 100 },
            data: { label: "UnknownComponent" },
          },
        ],
        edges: [],
      };

      const mockSuggestions = {
        suggestions: [
          {
            action: "add_requirement",
            title: "Unknown Component Functionality",
            description: "System may need functionality for unknown component",
            type: "functional",
            priority: "low",
            reasoning: "Speculative requirement based on unclear component",
            confidence: 0.45,
            affected_nodes: ["UNKNOWN_CLASS"],
          },
        ],
      };

      vi.mocked(generateAIObject).mockResolvedValue(mockSuggestions);

      // Act
      const suggestions = await architect.diagramToRequirements(diagram);

      // Assert
      expect(suggestions[0].confidence).toBeLessThan(0.5);
    });
  });
});
