/**
 * Dashboard Home Page
 * Displays project list and creation form
 * Requirements: 2.1, 2.3
 */

import CreateProjectButton from "@/components/dashboard/create-project-button";
import ProjectList from "@/components/dashboard/project-list";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  // Fetch user's projects
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Projects
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your software development projects
          </p>
        </div>
        <CreateProjectButton />
      </div>

      <ProjectList projects={projects || []} />
    </div>
  );
}
