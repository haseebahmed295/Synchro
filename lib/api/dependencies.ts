/**
 * Requirement Dependencies API
 * Typed DAG edges between requirements: blocks, parent_of, duplicates
 * Includes client-side cycle detection before insert.
 */

import { createClient } from "@/lib/supabase/client";

export type DepType = "blocks" | "parent_of" | "duplicates";

export interface RequirementDependency {
  id: string;
  source_requirement_id: string;
  target_requirement_id: string;
  dependency_type: DepType;
  created_at: string;
  created_by: string;
}

export const DEP_LABELS: Record<DepType, { label: string; inverse: string; description: string }> = {
  blocks:    { label: "Blocks",     inverse: "Blocked by",  description: "This requirement must be completed before the target." },
  parent_of: { label: "Parent of",  inverse: "Child of",    description: "This requirement is a parent/epic of the target." },
  duplicates:{ label: "Duplicates", inverse: "Duplicated by", description: "This requirement is a duplicate of the target." },
};

/** Fetch all dependencies for a project (both directions). */
export async function getDepsForProject(projectId: string): Promise<RequirementDependency[]> {
  const supabase = createClient();

  // Get all requirement artifact IDs for this project first
  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "requirement");

  if (!artifacts?.length) return [];
  const ids = artifacts.map((a) => a.id);

  const { data, error } = await supabase
    .from("requirement_dependencies")
    .select("*")
    .in("source_requirement_id", ids);

  if (error) throw new Error(`Failed to fetch dependencies: ${error.message}`);
  return (data || []) as RequirementDependency[];
}

/**
 * Check if adding source→target would create a cycle.
 * Traverses existing deps client-side (fast for typical project sizes).
 */
export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  allDeps: RequirementDependency[],
): boolean {
  // BFS from targetId following source→target edges — if we reach sourceId, it's a cycle
  const visited = new Set<string>();
  const queue = [targetId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const dep of allDeps) {
      if (dep.source_requirement_id === current) {
        queue.push(dep.target_requirement_id);
      }
    }
  }
  return false;
}

/** Create a dependency after cycle-checking. Throws if cycle detected. */
export async function createDependency(
  sourceId: string,
  targetId: string,
  depType: DepType,
  allDeps: RequirementDependency[],
): Promise<RequirementDependency> {
  if (wouldCreateCycle(sourceId, targetId, allDeps)) {
    throw new Error("Cannot create this dependency — it would create a circular dependency chain.");
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("requirement_dependencies")
    .insert({
      source_requirement_id: sourceId,
      target_requirement_id: targetId,
      dependency_type: depType,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create dependency: ${error.message}`);
  return data as RequirementDependency;
}

/** Delete a dependency by ID. */
export async function deleteDependency(depId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("requirement_dependencies")
    .delete()
    .eq("id", depId);
  if (error) throw new Error(`Failed to delete dependency: ${error.message}`);
}
