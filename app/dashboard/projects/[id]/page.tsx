/**
 * Project Detail Page
 * Displays project overview and navigation to artifacts
 * Requirements: 2.1, 2.3
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  // Fetch project details
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (error || !project) {
    notFound();
  }

  // Fetch artifact counts
  const { count: requirementCount } = await supabase
    .from("artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("type", "requirement");

  const { count: diagramCount } = await supabase
    .from("artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("type", "diagram");

  const { count: codeCount } = await supabase
    .from("artifacts")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("type", "code");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to Projects
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {project.description}
              </p>
            )}
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
              Version {project.version}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/dashboard/projects/${id}/requirements`}
          className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
            Requirements
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage project requirements and specifications
          </p>
          <p className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {requirementCount || 0}
          </p>
        </Link>

        <Link
          href={`/dashboard/projects/${id}/diagrams`}
          className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
            Diagrams
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            View and edit UML and ERD diagrams
          </p>
          <p className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {diagramCount || 0}
          </p>
        </Link>

        <Link
          href={`/dashboard/projects/${id}/code`}
          className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
            Code
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Generated and reverse-engineered code
          </p>
          <p className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {codeCount || 0}
          </p>
        </Link>
      </div>
    </div>
  );
}
