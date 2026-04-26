/**
 * Suggestions persistence API
 * Saves AI-generated sync suggestions as 'adr' artifacts so they survive page refresh.
 * One suggestions artifact per source artifact (diagram or requirement set).
 */

import { createClient } from "@/lib/supabase/client";
import type { DiagramSuggestion } from "@/lib/agents/architect";

export interface SavedSuggestions {
  id: string;
  source_artifact_id: string;
  suggestions: DiagramSuggestion[];
  created_at: string;
}

/**
 * Upsert suggestions for a source artifact.
 * Replaces any existing suggestions artifact for the same source.
 */
export async function saveSuggestions(
  projectId: string,
  sourceArtifactId: string,
  suggestions: DiagramSuggestion[],
  userId: string,
): Promise<void> {
  const supabase = createClient();

  // Check for existing suggestions artifact for this source
  const { data: existing } = await supabase
    .from("artifacts")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "adr")
    .eq("metadata->>source_artifact_id", sourceArtifactId)
    .eq("metadata->>suggestion_type", "sync")
    .maybeSingle();

  const content = { suggestions };
  const metadata = {
    source_artifact_id: sourceArtifactId,
    suggestion_type: "sync",
    generated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from("artifacts")
      .update({ content, metadata, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("artifacts").insert({
      project_id: projectId,
      type: "adr",
      content,
      metadata,
      created_by: userId,
    });
  }
}

/**
 * Load saved suggestions for a source artifact.
 */
export async function loadSuggestions(
  sourceArtifactId: string,
): Promise<DiagramSuggestion[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("artifacts")
    .select("content")
    .eq("type", "adr")
    .eq("metadata->>source_artifact_id", sourceArtifactId)
    .eq("metadata->>suggestion_type", "sync")
    .maybeSingle();

  return (data?.content as any)?.suggestions ?? [];
}

/**
 * Clear saved suggestions for a source artifact (after all applied/rejected).
 */
export async function clearSuggestions(
  projectId: string,
  sourceArtifactId: string,
): Promise<void> {
  const supabase = createClient();

  await supabase
    .from("artifacts")
    .delete()
    .eq("project_id", projectId)
    .eq("type", "adr")
    .eq("metadata->>source_artifact_id", sourceArtifactId)
    .eq("metadata->>suggestion_type", "sync");
}
