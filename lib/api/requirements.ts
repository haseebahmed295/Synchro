/**
 * Requirements API Functions
 * CRUD operations for requirements stored in artifacts table
 * Requirements: 3.6, 6.3
 */

import { createClient } from "@/lib/supabase/client";

export interface RequirementContent {
  req_id: string; // REQ_UNIQUE_ID
  title: string;
  description: string;
  type: "functional" | "non-functional";
  priority: "low" | "medium" | "high";
  status: "draft" | "validated" | "implemented";
  links: string[];
  metadata: {
    created_at: string;
    created_by: string;
    tags: string[];
  };
}

export interface Requirement {
  id: string;
  project_id: string;
  content: RequirementContent;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all requirements for a project
 */
export async function getRequirements(
  projectId: string,
): Promise<Requirement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", "requirement")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching requirements:", error);
    throw error;
  }

  return data as Requirement[];
}

/**
 * Create a new requirement
 */
export async function createRequirement(
  projectId: string,
  userId: string,
  content: Partial<RequirementContent>,
): Promise<Requirement> {
  const supabase = createClient();

  // Check auth state
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Session error:", sessionError);
    throw new Error(`Authentication error: ${sessionError.message}`);
  }
  if (!session) {
    console.error("No session found");
    throw new Error("No authenticated session. Please log in again.");
  }

  // Generate project-scoped human-readable display ID via DB atomic counter
  const { data: displayIdData, error: displayIdError } = await supabase
    .rpc("next_req_display_id", { p_project_id: projectId });
  if (displayIdError) {
    console.error("Error generating display ID:", displayIdError);
    throw new Error(`Failed to generate requirement ID: ${displayIdError.message}`);
  }
  const reqId: string = displayIdData;

  const requirementContent: RequirementContent = {
    req_id: reqId,
    title: content.title || "Untitled Requirement",
    description: content.description || "",
    type: content.type || "functional",
    priority: content.priority || "medium",
    status: content.status || "draft",
    links: content.links || [],
    metadata: {
      created_at: new Date().toISOString(),
      created_by: userId,
      tags: [],
    },
  };

  console.log("Inserting requirement:", { project_id: projectId, type: "requirement", content: requirementContent });

  const { data, error } = await supabase
    .from("artifacts")
    .insert({
      project_id: projectId,
      type: "requirement",
      content: requirementContent,
      metadata: {},
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating requirement:", error);
    throw new Error(`Failed to create requirement: ${error.message}`);
  }

  return data as Requirement;
}

/**
 * Update a requirement field
 */
export async function updateRequirement(
  artifactId: string,
  field: keyof RequirementContent,
  value: string,
): Promise<void> {
  const supabase = createClient();

  // Fetch current requirement
  const { data: current, error: fetchError } = await supabase
    .from("artifacts")
    .select("content, version")
    .eq("id", artifactId)
    .single();

  if (fetchError) {
    console.error("Error fetching requirement:", fetchError);
    throw fetchError;
  }

  // Update the specific field in content
  const updatedContent = {
    ...current.content,
    [field]: value,
  };

  // Update with optimistic concurrency control
  const { error: updateError } = await supabase
    .from("artifacts")
    .update({
      content: updatedContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", artifactId)
    .eq("version", current.version);

  if (updateError) {
    console.error("Error updating requirement:", updateError);
    throw updateError;
  }
}

/**
 * Delete a requirement
 */
export async function deleteRequirement(artifactId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("artifacts")
    .delete()
    .eq("id", artifactId);

  if (error) {
    console.error("Error deleting requirement:", error);
    throw error;
  }
}
