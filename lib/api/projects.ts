/**
 * Projects API Functions
 * CRUD operations for projects
 */

import { createClient } from "@/lib/supabase/client";

/**
 * Delete a project and all its artifacts
 */
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = createClient();

  // Delete the project (artifacts will be cascade deleted via foreign key)
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("Error deleting project:", error);
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}
