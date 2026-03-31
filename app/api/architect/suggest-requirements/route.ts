/**
 * API Route: Suggest Requirements from Diagram Changes
 * Endpoint for reverse sync (diagrams -> requirements)
 * Requirements: 10.2, 10.3
 */

import { type NextRequest, NextResponse } from "next/server";
import { ArchitectAgent } from "@/lib/agents/architect";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

// Initialize AI on module load
initializeAI();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { diagramId, previousDiagramId, projectId } = body;

    if (!diagramId || typeof diagramId !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "diagramId" field' },
        { status: 400 },
      );
    }

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "projectId" field' },
        { status: 400 },
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Fetch current diagram from database
    const { data: diagramArtifact, error: diagramError } = await supabase
      .from("artifacts")
      .select("id, content")
      .eq("id", diagramId)
      .eq("type", "diagram")
      .single();

    if (diagramError || !diagramArtifact) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    // Parse diagram content into Diagram format
    const content = diagramArtifact.content || {};
    const metadata = content.diagram_metadata || {};
    const nodesObj = content.nodes || {};
    const edgesObj = content.edges || {};

    const diagram = {
      id: diagramArtifact.id,
      type: metadata.type || "class",
      nodes: Object.entries(nodesObj).map(([id, node]: [string, any]) => ({
        id,
        type: node.type || "class",
        position: node.position || { x: 0, y: 0 },
        data: node.data || { label: id },
      })),
      edges: Object.entries(edgesObj).map(([id, edge]: [string, any]) => ({
        id,
        source: edge.source,
        target: edge.target,
        type: edge.type || "association",
        label: edge.label,
        multiplicity: edge.multiplicity,
      })),
      metadata: {
        name: metadata.name,
        description: metadata.description,
      },
    };

    // Optionally fetch previous diagram for comparison
    let previousDiagram: any;
    if (previousDiagramId && typeof previousDiagramId === "string") {
      const { data: prevDiagramArtifact, error: prevError } = await supabase
        .from("artifacts")
        .select("id, content")
        .eq("id", previousDiagramId)
        .eq("type", "diagram")
        .single();

      if (!prevError && prevDiagramArtifact) {
        const prevContent = prevDiagramArtifact.content || {};
        const prevMetadata = prevContent.diagram_metadata || {};
        const prevNodesObj = prevContent.nodes || {};
        const prevEdgesObj = prevContent.edges || {};

        previousDiagram = {
          id: prevDiagramArtifact.id,
          type: prevMetadata.type || "class",
          nodes: Object.entries(prevNodesObj).map(([id, node]: [string, any]) => ({
            id,
            type: node.type || "class",
            position: node.position || { x: 0, y: 0 },
            data: node.data || { label: id },
          })),
          edges: Object.entries(prevEdgesObj).map(([id, edge]: [string, any]) => ({
            id,
            source: edge.source,
            target: edge.target,
            type: edge.type || "association",
            label: edge.label,
            multiplicity: edge.multiplicity,
          })),
          metadata: {
            name: prevMetadata.name,
            description: prevMetadata.description,
          },
        };
      }
    }

    // Create Architect agent and generate requirement suggestions
    const architect = new ArchitectAgent();
    const startTime = Date.now();

    const suggestions = await architect.diagramToRequirements(
      diagram,
      previousDiagram,
    );

    const analysisTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
      analysisTime,
    });
  } catch (error) {
    console.error("Requirement suggestion from diagram failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
