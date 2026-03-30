/**
 * Diagrams Page
 * Displays and manages project diagrams with React Flow canvas
 * Requirements: 7.1, 9.1, 9.2, 26.1, 26.2, 26.3
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DiagramsClient } from "./diagrams-client";
import type { Diagram } from "@/lib/types/diagram";

interface DiagramsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DiagramsPage({ params }: DiagramsPageProps) {
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

  // Fetch diagram artifacts
  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", id)
    .eq("type", "diagram")
    .order("created_at", { ascending: false });

  // Parse artifacts into Diagram format
  const diagrams: Diagram[] = (artifacts || []).map((artifact) => {
    const content = artifact.content || {};
    const metadata = content.diagram_metadata || {};
    const nodes = content.nodes || {};
    const edges = content.edges || {};

    return {
      id: artifact.id,
      type: metadata.type || 'class',
      nodes: Object.entries(nodes).map(([nodeId, node]: [string, any]) => ({
        id: nodeId,
        type: node.type || 'class',
        position: node.position || { x: 0, y: 0 },
        data: node.data || { label: nodeId },
      })),
      edges: Object.entries(edges).map(([edgeId, edge]: [string, any]) => ({
        id: edgeId,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'association',
        label: edge.label,
        multiplicity: edge.multiplicity,
      })),
      metadata: {
        name: metadata.name,
        description: metadata.description,
      },
    };
  });

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
          Diagrams
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          View and edit UML and ERD diagrams with interactive canvas
        </p>
      </div>

      <DiagramsClient projectId={id} initialDiagrams={diagrams} />
    </div>
  );
}
