/**
 * Module A: The Analyst Agent
 * Handles text ingestion and surgical requirement updates
 * Requirements: 3.1-3.6, 6.1-6.4
 */

import { z } from "zod";
import { generateAIObject, generateAIObjectStreaming, generateAIText } from "../ai/client";
import type { JSONPatch } from "./json-patch";

/**
 * Requirement schema matching the stable key JSON schema from design
 */
export const RequirementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  type: z.string().transform((val) => {
    const v = val.toLowerCase().replace(/[^a-z-]/g, "");
    return (v.includes("non") ? "non-functional" : "functional") as "functional" | "non-functional";
  }),
  priority: z.string().transform((val) => {
    const v = val.toLowerCase().trim();
    if (v === "high") return "high" as const;
    if (v === "low") return "low" as const;
    return "medium" as const;
  }),
  status: z.string().transform((val) => {
    const v = val.toLowerCase().trim();
    if (v === "validated") return "validated" as const;
    if (v === "implemented") return "implemented" as const;
    return "draft" as const;
  }),
  tags: z.array(z.string()).default([]),
  links: z.array(z.string()).default([]),
  metadata: z
    .object({
      created_at: z.string(),
      created_by: z.string(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Requirement = z.infer<typeof RequirementSchema>;

/**
 * Dependency suggestion from AI — uses temp IDs that get resolved after insert
 */
export const DependencySuggestionSchema = z.object({
  source_temp_id: z.string(),
  target_temp_id: z.string(),
  dependency_type: z.string().transform((val) => {
    const v = val.toLowerCase().trim();
    if (v.includes("parent") || v.includes("child") || v.includes("epic")) return "parent_of" as const;
    if (v.includes("dup")) return "duplicates" as const;
    return "blocks" as const;
  }),
  reasoning: z.string().optional().default(""),
});

export type DependencySuggestion = z.infer<typeof DependencySuggestionSchema>;

/**
 * Schema for multiple requirements extraction with dependencies
 */
const RequirementsExtractionSchema = z.object({
  requirements: z.array(RequirementSchema),
  dependencies: z.array(DependencySuggestionSchema).default([]),
});

/**
 * The Analyst Agent
 * Responsible for ingesting requirements from text and generating surgical updates
 */
export class AnalystAgent {
  /**
   * Ingest raw text and extract structured requirements
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async ingestText(
    rawText: string,
    projectId: string,
    userId: string,
  ): Promise<{ requirements: Requirement[]; dependencies: DependencySuggestion[] }> {
    const systemPrompt = `You are an expert requirements analyst. Extract structured software requirements from text, assign relevant tags, and identify dependencies between them.

Return ONLY valid JSON in this exact format:
{
  "requirements": [
    {
      "id": "temp_1",
      "title": "Short requirement title",
      "description": "Detailed description of what is needed",
      "type": "functional",
      "priority": "medium",
      "status": "draft",
      "tags": ["authentication", "security"],
      "links": []
    }
  ],
  "dependencies": [
    {
      "source_temp_id": "temp_1",
      "target_temp_id": "temp_2",
      "dependency_type": "blocks",
      "reasoning": "User auth must exist before profile management"
    }
  ]
}

Rules for requirements:
- "id" must be unique strings like "temp_1", "temp_2" etc — used to wire up dependencies
- "type": "functional" or "non-functional"
- "priority": "low", "medium", or "high"
- "status": always "draft"
- "tags": 1-4 lowercase keywords describing the domain (e.g. ["auth", "security"], ["database", "performance"])
- "links": always empty array

Rules for dependencies (IMPORTANT — reference the temp IDs you just generated above):
- Only create dependencies clearly implied by the text
- "blocks": source must be done before target can start
- "parent_of": source is an epic containing the target as a child
- "duplicates": source and target describe the same thing
- Avoid cycles (A blocks B blocks A)
- Only use temp IDs that exist in the requirements array above`;

    const prompt = `Extract requirements and their dependencies from this text. Return ONLY JSON:\n\n${rawText}`;

    try {
      const result = await generateAIObject(
        "reasoning",
        prompt,
        RequirementsExtractionSchema,
        systemPrompt,
      );

      const timestamp = new Date().toISOString();
      let counter = 1;

      const requirementsWithMetadata = result.requirements.map((req) => {
        counter++;
        return {
          ...req,
          type: req.type.toLowerCase() as "functional" | "non-functional",
          priority: req.priority.toLowerCase() as "low" | "medium" | "high",
          status: "draft" as const,
          links: req.links || [],
          metadata: {
            created_at: timestamp,
            created_by: userId,
            tags: req.tags ?? [],
          },
        };
      });

      return {
        requirements: requirementsWithMetadata,
        dependencies: result.dependencies ?? [],
      };
    } catch (error) {
      console.error("Failed to ingest text requirements", error);
      if (error instanceof Error) console.error("Error details:", error.message);
      throw new Error(
        `Requirement ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Ingest raw text and extract structured requirements with streaming
   * Calls the callback for each requirement as it's validated
   */
  async ingestTextStreaming(
    rawText: string,
    projectId: string,
    userId: string,
    onRequirement: (requirement: Requirement) => Promise<void>,
  ): Promise<DependencySuggestion[]> {
    const systemPrompt = `You are an expert requirements analyst. Extract structured software requirements from text, assign relevant tags, and identify dependencies between them.

Return ONLY valid JSON in this exact format:
{
  "requirements": [
    {
      "id": "temp_1",
      "title": "Short requirement title",
      "description": "Detailed description of what is needed",
      "type": "functional",
      "priority": "medium",
      "status": "draft",
      "tags": ["authentication", "security"],
      "links": []
    }
  ],
  "dependencies": [
    {
      "source_temp_id": "temp_1",
      "target_temp_id": "temp_2",
      "dependency_type": "blocks",
      "reasoning": "User auth must exist before profile management"
    }
  ]
}

Rules for requirements:
- "id" must be unique strings like "temp_1", "temp_2" etc — used to wire up dependencies
- "type": "functional" or "non-functional"
- "priority": "low", "medium", or "high"
- "status": always "draft"
- "tags": 1-4 lowercase keywords describing the domain (e.g. ["auth", "security"], ["database", "performance"])
- "links": always empty array

Rules for dependencies (IMPORTANT — reference the temp IDs you just generated above):
- Only create dependencies clearly implied by the text
- "blocks": source must be done before target can start
- "parent_of": source is an epic containing the target as a child
- "duplicates": source and target describe the same thing
- Avoid cycles (A blocks B blocks A)
- Only use temp IDs that exist in the requirements array above`;

    const prompt = `Extract requirements and their dependencies from this text. Return ONLY JSON:\n\n${rawText}`;

    try {
      let counter = 1;
      const timestamp = new Date().toISOString();
      let capturedDependencies: DependencySuggestion[] = [];

      await generateAIObjectStreaming(
        "reasoning",
        prompt,
        RequirementsExtractionSchema,
        systemPrompt,
        async (req) => {
          const requirementWithMetadata: Requirement = {
            ...req,
            type: req.type.toLowerCase() as "functional" | "non-functional",
            priority: req.priority.toLowerCase() as "low" | "medium" | "high",
            status: "draft",
            links: req.links || [],
            metadata: {
              created_at: timestamp,
              created_by: userId,
              tags: req.tags ?? [],
            },
          };

          console.log(`[Analyst] Validated requirement ${counter}:`, requirementWithMetadata.title);
          await onRequirement(requirementWithMetadata);
          counter++;
        },
        (result) => { capturedDependencies = result?.dependencies ?? []; },
      );

      return capturedDependencies;
    } catch (error) {
      console.error("Failed to ingest text requirements", error);
      if (error instanceof Error) console.error("Error details:", error.message);
      throw new Error(
        `Requirement ingestion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate surgical update (RFC 6902 JSON Patch) for requirement modification
   * Requirements: 6.1, 6.2, 6.4
   */
  async surgicalUpdate(
    existingReq: Requirement,
    delta: string,
    userId: string,
  ): Promise<JSONPatch[]> {
    const systemPrompt = `You are an expert at generating precise JSON Patches (RFC 6902) for requirement updates.

CRITICAL RULES:
1. NEVER modify the "id" field - it is a stable key
2. Only generate patches for fields that actually changed
3. Use "replace" operation for updating existing fields
4. Use "add" operation for adding new fields or array elements
5. Use "remove" operation for deleting fields or array elements
6. Preserve the JSON schema structure
7. Use JSON Pointer notation for paths (e.g., "/title", "/metadata/tags/0")

Example patches:
- Update title: {"op": "replace", "path": "/title", "value": "New Title"}
- Change priority: {"op": "replace", "path": "/priority", "value": "high"}
- Add tag: {"op": "add", "path": "/metadata/tags/-", "value": "security"}
- Update description: {"op": "replace", "path": "/description", "value": "New description"}`;

    const prompt = `Generate RFC 6902 JSON Patches to apply this change to the requirement:

Current requirement:
${JSON.stringify(existingReq, null, 2)}

Requested change:
${delta}

Return an array of JSON Patch operations. Only include operations for fields that need to change.`;

    try {
      const PatchArraySchema = z.object({
        patches: z.array(
          z.object({
            op: z.enum(["add", "remove", "replace", "move", "copy", "test"]),
            path: z.string(),
            value: z.any().optional(),
            from: z.string().optional(),
          }),
        ),
      });

      const result = await generateAIObject(
        "reasoning",
        prompt,
        PatchArraySchema,
        systemPrompt,
      );

      // Validate that patches don't modify stable keys
      for (const patch of result.patches) {
        if (patch.path === "/id" && patch.op !== "test") {
          throw new Error('Cannot modify stable key "id"');
        }
      }

      return result.patches;
    } catch (error) {
      console.error("Failed to generate surgical update", error);
      throw new Error(
        `Surgical update failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Validate a requirement against the schema
   */
  validateRequirement(requirement: unknown): Requirement {
    return RequirementSchema.parse(requirement);
  }

  /**
   * Generate unique requirement ID
   * Ensures uniqueness by checking against existing IDs
   */
  generateRequirementId(
    existingIds: Set<string>,
    prefix: string = "REQ",
  ): string {
    let id: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      // Generate random alphanumeric suffix
      const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      id = `${prefix}_${suffix}`;
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error(
          "Failed to generate unique requirement ID after maximum attempts",
        );
      }
    } while (existingIds.has(id));

    return id;
  }
}
