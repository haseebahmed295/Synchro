/**
 * Code Page
 * Displays and manages generated code
 * Requirements: 11.1, 12.1
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

interface CodePageProps {
  params: Promise<{ id: string }>;
}

export default async function CodePage({ params }: CodePageProps) {
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
          Code
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Generated and reverse-engineered code
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Code management coming soon
        </p>
      </div>
    </div>
  );
}
