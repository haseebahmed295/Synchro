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
  id: z.string().min(1), // Relaxed - we'll generate proper IDs ourselves
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  type: z.enum(["functional", "non-functional", "Functional", "Non-functional", "Non-Functional"]).transform(val => val.toLowerCase() as "functional" | "non-functional"),
  priority: z.enum(["low", "medium", "high", "Low", "Medium", "High"]).transform(val => val.toLowerCase() as "low" | "medium" | "high"),
  status: z.enum(["draft", "validated", "implemented", "Draft", "Validated", "Implemented"]).transform(val => val.toLowerCase() as "draft" | "validated" | "implemented"),
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
 * Schema for multiple requirements extraction
 */
const RequirementsExtractionSchema = z.object({
  requirements: z.array(RequirementSchema),
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
  ): Promise<Requirement[]> {
    const systemPrompt = `You are an expert requirements analyst. Extract structured software requirements from text.

Return ONLY valid JSON in this format:
{
  "requirements": [
    {
      "id": "temp_1",
      "title": "Short requirement title",
      "description": "Detailed description of what is needed",
      "type": "functional",
      "priority": "medium",
      "status": "draft",
      "links": []
    }
  ]
}

Rules:
- "id" can be any string (we'll generate proper IDs)
- "type" must be "functional" or "non-functional"
- "priority" must be "low", "medium", or "high"
- "status" should be "draft"
- "links" should be an empty array
- Each requirement should be atomic and testable
- Functional requirements describe what the system does
- Non-functional requirements describe quality attributes`;

    const prompt = `Extract requirements from this text. Return ONLY JSON:

${rawText}`;

    try {
      const result = await generateAIObject(
        "reasoning",
        prompt,
        RequirementsExtractionSchema,
        systemPrompt,
      );

      // Add metadata and proper IDs to each requirement
      const timestamp = new Date().toISOString();
      let counter = 1;
      
      const requirementsWithMetadata = result.requirements.map((req) => {
        const properReqId = `REQ_${Date.now().toString(36).toUpperCase()}_${counter.toString().padStart(3, '0')}`;
        counter++;
        
        return {
          ...req,
          id: properReqId,
          type: req.type.toLowerCase() as "functional" | "non-functional",
          priority: req.priority.toLowerCase() as "low" | "medium" | "high",
          status: "draft" as const,
          links: req.links || [],
          metadata: {
            created_at: timestamp,
            created_by: userId,
            tags: [],
          },
        };
      });

      return requirementsWithMetadata;
    } catch (error) {
      console.error("Failed to ingest text requirements", error);
      
      // Log the actual error details for debugging
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      
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
  ): Promise<void> {
    const systemPrompt = `You are an expert requirements analyst. Extract structured software requirements from text.

Return ONLY valid JSON in this format:
{
  "requirements": [
    {
      "id": "temp_1",
      "title": "Short requirement title",
      "description": "Detailed description of what is needed",
      "type": "functional",
      "priority": "medium",
      "status": "draft",
      "links": []
    }
  ]
}

Rules:
- "id" can be any string (we'll generate proper IDs)
- "type" must be "functional" or "non-functional"
- "priority" must be "low", "medium", or "high"
- "status" should be "draft"
- "links" should be an empty array
- Each requirement should be atomic and testable
- Functional requirements describe what the system does
- Non-functional requirements describe quality attributes`;

    const prompt = `Extract requirements from this text. Return ONLY JSON:

${rawText}`;

    try {
      let counter = 1;
      const timestamp = new Date().toISOString();

      await generateAIObjectStreaming(
        "reasoning",
        prompt,
        RequirementsExtractionSchema,
        systemPrompt,
        async (req) => {
          // Generate a proper REQ_ID
          const properReqId = `REQ_${Date.now().toString(36).toUpperCase()}_${counter.toString().padStart(3, '0')}`;
          
          const requirementWithMetadata: Requirement = {
            ...req,
            id: properReqId,
            type: req.type.toLowerCase() as "functional" | "non-functional",
            priority: req.priority.toLowerCase() as "low" | "medium" | "high",
            status: "draft",
            links: req.links || [],
            metadata: {
              created_at: timestamp,
              created_by: userId,
              tags: [],
            },
          };
          
          console.log(`[Analyst] Validated requirement ${counter}:`, requirementWithMetadata.title);
          await onRequirement(requirementWithMetadata);
          counter++;
        },
      );
    } catch (error) {
      console.error("Failed to ingest text requirements", error);
      
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      
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
