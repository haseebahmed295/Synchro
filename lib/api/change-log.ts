/**
 * Change Log API
 * Records user-initiated changes to artifacts for AI pipeline consumption.
 * Stores RFC 6902 JSON Patches so downstream agents can see exactly what changed.
 */

import { createClient } from "@/lib/supabase/client";

export interface ChangeLogEntry {
  artifact_id: string;
  /** RFC 6902 JSON Patch operation */
  patch: object | object[];
  /** AgentType enum value — who made the change */
  applied_by: "user" | "analyst" | "architect" | "implementer" | "judge";
  /** Free-text identifier — store user UUID or agent run ID here */
  agent_type?: string | null;
}

/**
 * Write one or more change log entries for a user-driven edit.
 */
export async function recordChange(entry: ChangeLogEntry): Promise<void> {
  const supabase = createClient();
  const patches = Array.isArray(entry.patch) ? entry.patch : [entry.patch];

  const rows = patches.map((p) => ({
    artifact_id: entry.artifact_id,
    patch: p,
    applied_by: entry.applied_by,
    agent_type: entry.agent_type,
  }));

  const { error } = await supabase.from("change_log").insert(rows);
  if (error) {
    // Non-fatal — log but don't break the user's action
    console.error("[change-log] Failed to record change:", error.message);
  }
}
