/**
 * API Route: Generate Diagram from Requirements
 * Endpoint for testing the Architect agent diagram generation
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
    const { requirementIds, diagramType, projectId, diagramName } = body;

    if (!diagramType || !["class", "sequence", "erd", "component", "deployment", "flowchart"].includes(diagramType)) {
      return NextResponse.json(
        {
          error:
            'Invalid "diagramType" field (must be "class", "sequence", "erd", "component", "deployment", or "flowchart")',
        },
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

    // Fetch requirements from database
    let query = supabase
      .from("artifacts")
      .select("id, content")
      .eq("project_id", projectId)
      .eq("type", "requirement");

    // If specific requirement IDs provided, filter by them
    if (requirementIds && Array.isArray(requirementIds) && requirementIds.length > 0) {
      query = query.in("id", requirementIds);
    }

    const { data: artifacts, error: fetchError } = await query;

    if (fetchError) {
      console.error("Failed to fetch requirements", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch requirements", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!artifacts || artifacts.length === 0) {
      return NextResponse.json(
        { error: "No requirements found for this project" },
        { status: 404 },
      );
    }

    // Extract requirement content and create ID mapping
    const requirements = artifacts.map((artifact) => artifact.content);
    const contentIdToArtifactId = new Map<string, string>();
    
    artifacts.forEach((artifact) => {
      if (artifact.content?.id) {
        contentIdToArtifactId.set(artifact.content.id, artifact.id);
      }
    });

    // Create Architect agent and generate diagram
    const architect = new ArchitectAgent();
    const startTime = Date.now();

    const result = await architect.requirementsToDiagram(
      requirements,
      diagramType,
      projectId,
      user.id,
    );

    const generationTime = Date.now() - startTime;

    // Validate diagram
    const validation = architect.validateDiagram(result.diagram);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Generated diagram failed validation",
          validationErrors: validation.errors,
        },
        { status: 500 },
      );
    }

    // Store diagram in database
    const { data: diagramArtifact, error: insertError } = await supabase
      .from("artifacts")
      .insert({
        project_id: projectId,
        type: "diagram",
        content: {
          diagram_metadata: {
            id: result.diagram.id || crypto.randomUUID(),
            type: diagramType,
            name: diagramName || `${diagramType} Diagram`,
          },
          nodes: convertNodesToObjectFormat(result.diagram.nodes),
          edges: convertEdgesToObjectFormat(result.diagram.edges),
        },
        metadata: {
          diagramType,
          generationTime,
          sourceRequirements: requirementIds || artifacts.map(a => a.id),
        },
        version: 1,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert diagram", insertError);
      return NextResponse.json(
        { error: "Failed to save diagram", details: insertError.message },
        { status: 500 },
      );
    }

    // Store traceability links — prefer AI-populated linkedRequirements, fall back to semantic analysis
    let linksToSave = result.traceabilityLinks;

    if (linksToSave.length === 0) {
      // AI didn't populate linkedRequirements on nodes — run semantic analysis as fallback
      try {
        linksToSave = await architect.createTraceabilityLinks(
          requirements,
          result.diagram,
          user.id,
        );
      } catch (err) {
        console.warn("Fallback link creation failed", err);
      }
    }

    if (linksToSave.length > 0) {
      const links = linksToSave
        .map((link) => {
          const reqArtifactId = contentIdToArtifactId.get(link.sourceId);
          if (!reqArtifactId) {
            console.warn(`Could not find artifact ID for requirement ${link.sourceId}`);
            return null;
          }
          return {
            source_id: reqArtifactId,
            target_id: diagramArtifact.id,
            target_node_id: link.targetId,
            link_type: link.linkType,
            confidence: link.confidence,
            created_by: user.id,
          };
        })
        .filter((link): link is NonNullable<typeof link> => link !== null);

      // Deduplicate by source + node
      const uniqueLinks = Array.from(
        new Map(links.map((l) => [`${l.source_id}-${l.target_node_id}`, l])).values()
      );

      console.log(`Saving ${uniqueLinks.length} traceability links (${linksToSave.length} raw, ${links.length} mapped)`);

      if (uniqueLinks.length > 0) {
        const { error: linksError } = await supabase
          .from("traceability_links")
          .upsert(uniqueLinks, { onConflict: "source_id,target_id,link_type", ignoreDuplicates: true });
        if (linksError) console.error("Failed to insert traceability links", linksError);
      }
    }

    return NextResponse.json({
      success: true,
      diagram: result.diagram,
      diagramArtifact,
      traceabilityLinks: result.traceabilityLinks,
      generationTime,
      validation,
    });
  } catch (error) {
    console.error("Diagram generation failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Convert nodes array to object format for database storage
 */
function convertNodesToObjectFormat(nodes: any[]): Record<string, any> {
  return nodes.reduce((acc, node) => {
    acc[node.id] = {
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    };
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Convert edges array to object format for database storage
 */
function convertEdgesToObjectFormat(edges: any[]): Record<string, any> {
  return edges.reduce((acc, edge) => {
    acc[edge.id] = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      multiplicity: edge.multiplicity,
    };
    return acc;
  }, {} as Record<string, any>);
}
