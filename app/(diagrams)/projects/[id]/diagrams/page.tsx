import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Diagram } from "@/lib/types/diagram";
import { DiagramsClient } from "./diagrams-client";

interface DiagramsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DiagramsPage({ params }: DiagramsPageProps) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!project) notFound();

  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("*")
    .eq("project_id", id)
    .eq("type", "diagram")
    .order("created_at", { ascending: false });

  const diagrams: Diagram[] = (artifacts || []).map((artifact) => {
    const content = artifact.content || {};
    const metadata = content.diagram_metadata || {};
    const nodes = content.nodes || {};
    const edges = content.edges || {};
    return {
      id: artifact.id,
      type: metadata.type || "class",
      nodes: Object.entries(nodes).map(([nodeId, node]: [string, any]) => ({
        id: nodeId,
        type: node.type || "class",
        position: node.position || { x: 0, y: 0 },
        data: node.data || { label: nodeId },
      })),
      edges: Object.entries(edges).map(([edgeId, edge]: [string, any]) => ({
        id: edgeId,
        source: edge.source,
        target: edge.target,
        type: edge.type || "association",
        label: edge.label,
        multiplicity: edge.multiplicity,
      })),
      metadata: { name: metadata.name, description: metadata.description },
    };
  });

  return (
    <DiagramsClient
      projectId={id}
      projectName={project.name}
      userEmail={user.email ?? ""}
      initialDiagrams={diagrams}
    />
  );
}
