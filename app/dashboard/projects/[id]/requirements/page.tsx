/**
 * Requirements Page
 * Displays and manages project requirements
 * Requirements: 3.1, 3.2, 25.1, 17.2, 17.3
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import RequirementsClient from "./requirements-client";

interface RequirementsPageProps {
  params: Promise<{ id: string }>;
}

export default async function RequirementsPage({
  params,
}: RequirementsPageProps) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  // Verify project access
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!project) {
    notFound();
  }

  // Fetch initial requirements
  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", id)
    .eq("type", "requirement")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/dashboard/projects/${id}`}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to {project.name}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Requirements
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Manage project requirements and specifications
        </p>
      </div>

      <RequirementsClient
        projectId={id}
        userId={user.id}
        initialRequirements={artifacts || []}
      />
    </div>
  );
}
