/**
 * Code Page
 * Displays and manages generated code artifacts
 * Requirements: 11.1, 12.1
 */

import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CodeClient } from "./code-client";

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

  if (!project) notFound();

  // Fetch code artifacts
  const { data: codeArtifacts } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", id)
    .eq("type", "code")
    .order("created_at", { ascending: false });

  // Fetch diagrams for the generate dialog
  const { data: diagramArtifacts } = await supabase
    .from("artifacts")
    .select("id, content")
    .eq("project_id", id)
    .eq("type", "diagram")
    .order("created_at", { ascending: false });

  return (
    <CodeClient
      projectId={id}
      projectName={project.name}
      userEmail={user.email ?? ""}
      initialCodeArtifacts={codeArtifacts ?? []}
      diagrams={diagramArtifacts ?? []}
    />
  );
}
