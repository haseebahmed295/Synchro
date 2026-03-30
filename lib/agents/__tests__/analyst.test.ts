/**
 * Unit Tests for Analyst Agent
 * Tests text ingestion and surgical update functionality
 * Task 8.3 (Optional)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalystAgent, type Requirement, RequirementSchema } from "../analyst";
import type { JSONPatch } from "../json-patch";

// Mock AI client
vi.mock("../../ai/client", () => ({
  generateAIObject: vi.fn(),
  generateAIText: vi.fn(),
}));

describe("AnalystAgent", () => {
  let analyst: AnalystAgent;
  const mockProjectId = "test-project-123";
  const mockUserId = "test-user-456";

  beforeEach(() => {
    analyst = new AnalystAgent();
    vi.clearAllMocks();
  });

  describe("Requirement Schema Validation", () => {
    it("should validate a correct requirement", () => {
      const validRequirement = {
        id: "REQ_AUTH001",
        title: "User Authentication",
        description: "The system shall authenticate users using JWT tokens",
        type: "functional" as const,
        priority: "high" as const,
        status: "draft" as const,
        links: [],
        metadata: {
          created_at: new Date().toISOString(),
          created_by: mockUserId,
          tags: [],
        },
      };

      expect(() => RequirementSchema.parse(validRequirement)).not.toThrow();
    });

    it("should reject requirement with invalid ID pattern", () => {
      const invalidRequirement = {
        id: "INVALID_ID",
        title: "Test",
        description: "Test description",
        type: "functional",
        priority: "high",
        status: "draft",
        links: [],
      };

      expect(() => RequirementSchema.parse(invalidRequirement)).toThrow();
    });

    it("should reject requirement with empty title", () => {
      const invalidRequirement = {
        id: "REQ_TEST001",
        title: "",
        description: "Test description",
        type: "functional",
        priority: "high",
        status: "draft",
        links: [],
      };

      expect(() => RequirementSchema.parse(invalidRequirement)).toThrow();
    });

    it("should reject requirement with invalid type", () => {
      const invalidRequirement = {
        id: "REQ_TEST001",
        title: "Test",
        description: "Test description",
        type: "invalid-type",
        priority: "high",
        status: "draft",
        links: [],
      };

      expect(() => RequirementSchema.parse(invalidRequirement)).toThrow();
    });
  });

  describe("generateRequirementId", () => {
    it("should generate unique IDs following REQ_[A-Z0-9]+ pattern", () => {
      const existingIds = new Set<string>();
      const id = analyst.generateRequirementId(existingIds);

      expect(id).toMatch(/^REQ_[A-Z0-9]+$/);
      expect(existingIds.has(id)).toBe(false);
    });

    it("should not generate duplicate IDs", () => {
      const existingIds = new Set<string>();
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const id = analyst.generateRequirementId(existingIds);
        expect(ids.has(id)).toBe(false);
        ids.add(id);
        existingIds.add(id);
      }

      expect(ids.size).toBe(100);
    });

    it("should use custom prefix", () => {
      const existingIds = new Set<string>();
      const id = analyst.generateRequirementId(existingIds, "CUSTOM");

      expect(id).toMatch(/^CUSTOM_[A-Z0-9]+$/);
    });

    it("should throw error after max attempts", () => {
      const existingIds = new Set<string>();

      // Mock Math.random to always return same value, causing ID collision
      const originalRandom = Math.random;
      Math.random = () => 0.123456789;

      // Pre-populate the ID that would be generated
      const testId = `REQ_${(0.123456789).toString(36).substring(2, 8).toUpperCase()}`;
      existingIds.add(testId);

      expect(() => {
        analyst.generateRequirementId(existingIds);
      }).toThrow("Failed to generate unique requirement ID");

      Math.random = originalRandom;
    });
  });

  describe("validateRequirement", () => {
    it("should validate and return a valid requirement", () => {
      const requirement = {
        id: "REQ_TEST001",
        title: "Test Requirement",
        description: "This is a test requirement",
        type: "functional" as const,
        priority: "medium" as const,
        status: "draft" as const,
        links: [],
      };

      const validated = analyst.validateRequirement(requirement);
      expect(validated).toEqual(requirement);
    });

    it("should throw error for invalid requirement", () => {
      const invalidRequirement = {
        id: "INVALID",
        title: "",
        description: "Test",
      };

      expect(() => analyst.validateRequirement(invalidRequirement)).toThrow();
    });
  });

  describe("ingestText", () => {
    it("should extract requirements from text", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const mockRequirements = [
        {
          id: "REQ_AUTH001",
          title: "User Authentication",
          description: "The system shall authenticate users using JWT tokens",
          type: "functional" as const,
          priority: "high" as const,
          status: "draft" as const,
          links: [],
        },
      ];

      mockGenerateAIObject.mockResolvedValueOnce({
        requirements: mockRequirements,
      });

      const rawText = "The system shall authenticate users using JWT tokens.";
      const result = await analyst.ingestText(
        rawText,
        mockProjectId,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("REQ_AUTH001");
      expect(result[0].title).toBe("User Authentication");
      expect(result[0].type).toBe("functional");
      expect(result[0].priority).toBe("high");
      expect(result[0].status).toBe("draft");
      expect(result[0].metadata).toBeDefined();
      expect(result[0].metadata?.created_by).toBe(mockUserId);
    });

    it("should extract multiple requirements from complex text", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const mockRequirements = [
        {
          id: "REQ_AUTH001",
          title: "User Authentication",
          description: "The system shall authenticate users using JWT tokens",
          type: "functional" as const,
          priority: "high" as const,
          status: "draft" as const,
          links: [],
        },
        {
          id: "REQ_PERF001",
          title: "Response Time",
          description: "The system shall respond to user requests within 200ms",
          type: "non-functional" as const,
          priority: "medium" as const,
          status: "draft" as const,
          links: [],
        },
        {
          id: "REQ_SEC001",
          title: "Data Encryption",
          description: "All sensitive data shall be encrypted at rest",
          type: "non-functional" as const,
          priority: "high" as const,
          status: "draft" as const,
          links: [],
        },
      ];

      mockGenerateAIObject.mockResolvedValueOnce({
        requirements: mockRequirements,
      });

      const rawText = `
        The system shall authenticate users using JWT tokens.
        The system shall respond to user requests within 200ms.
        All sensitive data shall be encrypted at rest.
      `;
      const result = await analyst.ingestText(
        rawText,
        mockProjectId,
        mockUserId,
      );

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("functional");
      expect(result[1].type).toBe("non-functional");
      expect(result[2].type).toBe("non-functional");

      // Verify all have metadata
      result.forEach((req) => {
        expect(req.metadata).toBeDefined();
        expect(req.metadata?.created_by).toBe(mockUserId);
        expect(req.status).toBe("draft");
      });
    });

    it("should extract requirements from markdown format", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const mockRequirements = [
        {
          id: "REQ_UI001",
          title: "Dashboard Display",
          description: "The dashboard shall display project statistics",
          type: "functional" as const,
          priority: "medium" as const,
          status: "draft" as const,
          links: [],
        },
      ];

      mockGenerateAIObject.mockResolvedValueOnce({
        requirements: mockRequirements,
      });

      const rawText = `
# User Stories

## Dashboard
- As a user, I want to see project statistics on the dashboard
- The dashboard shall display project statistics
      `;
      const result = await analyst.ingestText(
        rawText,
        mockProjectId,
        mockUserId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^REQ_[A-Z0-9]+$/);
      expect(result[0].title).toBe("Dashboard Display");
    });

    it("should extract requirements from bullet point format", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const mockRequirements = [
        {
          id: "REQ_API001",
          title: "REST API",
          description: "System must provide REST API endpoints",
          type: "functional" as const,
          priority: "high" as const,
          status: "draft" as const,
          links: [],
        },
        {
          id: "REQ_API002",
          title: "API Authentication",
          description: "API endpoints must require authentication",
          type: "functional" as const,
          priority: "high" as const,
          status: "draft" as const,
          links: [],
        },
      ];

      mockGenerateAIObject.mockResolvedValueOnce({
        requirements: mockRequirements,
      });

      const rawText = `
Requirements:
• System must provide REST API endpoints
• API endpoints must require authentication
• All responses must be in JSON format
      `;
      const result = await analyst.ingestText(
        rawText,
        mockProjectId,
        mockUserId,
      );

      expect(result).toHaveLength(2);
      expect(result.every((req) => req.id.match(/^REQ_[A-Z0-9]+$/))).toBe(true);
    });

    it("should handle AI generation errors", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      mockGenerateAIObject.mockRejectedValueOnce(new Error("AI API error"));

      const rawText = "Test requirement text";

      await expect(
        analyst.ingestText(rawText, mockProjectId, mockUserId),
      ).rejects.toThrow("Requirement ingestion failed");
    });

    it("should handle non-Error exceptions during ingestion", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      mockGenerateAIObject.mockRejectedValueOnce("String error");

      const rawText = "Test requirement text";

      await expect(
        analyst.ingestText(rawText, mockProjectId, mockUserId),
      ).rejects.toThrow("Requirement ingestion failed: Unknown error");
    });
  });

  describe("surgicalUpdate", () => {
    it("should generate JSON patches for requirement updates", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const existingReq: Requirement = {
        id: "REQ_TEST001",
        title: "Original Title",
        description: "Original description",
        type: "functional",
        priority: "low",
        status: "draft",
        links: [],
        metadata: {
          created_at: new Date().toISOString(),
          created_by: mockUserId,
          tags: [],
        },
      };

      const mockPatches: JSONPatch[] = [
        {
          op: "replace",
          path: "/priority",
          value: "high",
        },
        {
          op: "replace",
          path: "/title",
          value: "Updated Title",
        },
      ];

      mockGenerateAIObject.mockResolvedValueOnce({
        patches: mockPatches,
      });

      const delta =
        'Change priority to high and update title to "Updated Title"';
      const result = await analyst.surgicalUpdate(
        existingReq,
        delta,
        mockUserId,
      );

      expect(result).toHaveLength(2);
      expect(result[0].op).toBe("replace");
      expect(result[0].path).toBe("/priority");
      expect(result[0].value).toBe("high");
    });

    it("should reject patches that modify stable keys", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const existingReq: Requirement = {
        id: "REQ_TEST001",
        title: "Test",
        description: "Test description",
        type: "functional",
        priority: "low",
        status: "draft",
        links: [],
      };

      const invalidPatches: JSONPatch[] = [
        {
          op: "replace",
          path: "/id",
          value: "REQ_NEWID",
        },
      ];

      mockGenerateAIObject.mockResolvedValueOnce({
        patches: invalidPatches,
      });

      const delta = "Change the ID";

      await expect(
        analyst.surgicalUpdate(existingReq, delta, mockUserId),
      ).rejects.toThrow('Cannot modify stable key "id"');
    });

    it("should handle AI generation errors", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      mockGenerateAIObject.mockRejectedValueOnce(new Error("AI API error"));

      const existingReq: Requirement = {
        id: "REQ_TEST001",
        title: "Test",
        description: "Test description",
        type: "functional",
        priority: "low",
        status: "draft",
        links: [],
      };

      const delta = "Update something";

      await expect(
        analyst.surgicalUpdate(existingReq, delta, mockUserId),
      ).rejects.toThrow("Surgical update failed");
    });

    it("should handle non-Error exceptions during surgical update", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      mockGenerateAIObject.mockRejectedValueOnce("String error");

      const existingReq: Requirement = {
        id: "REQ_TEST001",
        title: "Test",
        description: "Test description",
        type: "functional",
        priority: "low",
        status: "draft",
        links: [],
      };

      const delta = "Update something";

      await expect(
        analyst.surgicalUpdate(existingReq, delta, mockUserId),
      ).rejects.toThrow("Surgical update failed: Unknown error");
    });
  });

  describe("Stable Key Preservation Property", () => {
    it("should never modify the id field in patches", async () => {
      const { generateAIObject } = await import("../../ai/client");
      const mockGenerateAIObject = generateAIObject as any;

      const existingReq: Requirement = {
        id: "REQ_TEST001",
        title: "Test",
        description: "Test description",
        type: "functional",
        priority: "low",
        status: "draft",
        links: [],
      };

      // Test multiple update scenarios
      const scenarios = [
        {
          delta: "Change priority to high",
          patches: [
            { op: "replace" as const, path: "/priority", value: "high" },
          ],
        },
        {
          delta: "Update description",
          patches: [
            {
              op: "replace" as const,
              path: "/description",
              value: "New description",
            },
          ],
        },
        {
          delta: "Add a tag",
          patches: [
            { op: "add" as const, path: "/metadata/tags/-", value: "security" },
          ],
        },
      ];

      for (const scenario of scenarios) {
        mockGenerateAIObject.mockResolvedValueOnce({
          patches: scenario.patches,
        });

        const result = await analyst.surgicalUpdate(
          existingReq,
          scenario.delta,
          mockUserId,
        );

        // Verify no patch modifies the id field
        for (const patch of result) {
          expect(patch.path).not.toBe("/id");
          if (patch.op !== "test") {
            expect(patch.path).not.toMatch(/^\/id/);
          }
        }
      }
    });
  });
});
