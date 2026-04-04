/**
 * Traceability Links API
 * CRUD operations for requirement ↔ diagram node links
 */

import { createClient } from "@/lib/supabase/client";
import type { LinkType } from "@/lib/agents/types";

export interface TraceabilityLinkRow {
  id: string;
  source_id: string;       // requirement artifact UUID
  target_id: string;       // diagram artifact UUID
  target_node_id: string | null; // React Flow node string ID
  link_type: LinkType;
  confidence: number;
  created_at: string;
  created_by: string;
}

/**
 * Fetch all node-level traceability links for a project.
 * Joins through artifacts to scope by project_id.
 */
export async function getLinksForProject(projectId: string): Promise<TraceabilityLinkRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("traceability_links")
    .select(`
      id,
      source_id,
      target_id,
      target_node_id,
      link_type,
      confidence,
      created_at,
      created_by,
      source:artifacts!source_id(project_id)
    `)
    .eq("artifacts.project_id", projectId)
    .not("target_node_id", "is", null);

  if (error) throw new Error(`Failed to fetch links: ${error.message}`);
  return (data || []) as TraceabilityLinkRow[];
}

/**
 * Create a manual link between a requirement artifact and a diagram node.
 */
export async function createLink(
  sourceId: string,
  targetId: string,
  targetNodeId: string,
  linkType: LinkType = "implements",
  confidence = 1.0,
): Promise<TraceabilityLinkRow> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("traceability_links")
    .upsert(
      {
        source_id: sourceId,
        target_id: targetId,
        target_node_id: targetNodeId,
        link_type: linkType,
        confidence,
        created_by: user.id,
      },
      { onConflict: "source_id,target_id,link_type", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to create link: ${error.message}`);
  return data as TraceabilityLinkRow;
}

/**
 * Delete a traceability link by ID.
 */
export async function deleteLink(linkId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("traceability_links")
    .delete()
    .eq("id", linkId);
  if (error) throw new Error(`Failed to delete link: ${error.message}`);
}
