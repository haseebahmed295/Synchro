/**
 * API Route: Create Traceability Links
 * Endpoint for creating traceability links between requirements and diagram nodes
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
    const { requirementIds, diagramId, projectId } = body;

    if (
      !requirementIds ||
      !Array.isArray(requirementIds) ||
      requirementIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid "requirementIds" field (must be non-empty array)',
        },
        { status: 400 },
      );
    }

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

    // Fetch requirements from database
    const { data: requirementArtifacts, error: reqError } = await supabase
      .from("artifacts")
      .select("id, content")
      .eq("project_id", projectId)
      .eq("type", "requirement")
      .in("id", requirementIds);

    if (reqError) {
      console.error("Failed to fetch requirements", reqError);
      return NextResponse.json(
        { error: "Failed to fetch requirements", details: reqError.message },
        { status: 500 },
      );
    }

    if (!requirementArtifacts || requirementArtifacts.length === 0) {
      return NextResponse.json(
        { error: "No requirements found with provided IDs" },
        { status: 404 },
      );
    }

    // Fetch diagram from database
    const { data: diagramArtifact, error: diagramError } = await supabase
      .from("artifacts")
      .select("id, content")
      .eq("id", diagramId)
      .eq("type", "diagram")
      .single();

    if (diagramError || !diagramArtifact) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    // Extract data — keep a map from content req_id → artifact UUID for link resolution
    const contentIdToArtifactId = new Map<string, string>();
    for (const artifact of requirementArtifacts) {
      // Map by artifact UUID
      contentIdToArtifactId.set(artifact.id, artifact.id);
      // Map by req_id display value (e.g. "SYCN-3")
      if (artifact.content?.req_id) {
        contentIdToArtifactId.set(artifact.content.req_id, artifact.id);
      }
      // Map by content.id (temp ID used during AI generation e.g. "temp_3")
      if (artifact.content?.id) {
        contentIdToArtifactId.set(artifact.content.id, artifact.id);
      }
      // Map by title as last-resort fuzzy key
      if (artifact.content?.title) {
        contentIdToArtifactId.set(artifact.content.title, artifact.id);
      }
    }

    const requirements = requirementArtifacts.map((artifact) => ({
      ...artifact.content,
      // Ensure id is the artifact UUID so the agent prompt uses resolvable IDs
      id: artifact.id,
    }));

    // DB stores nodes/edges as id-keyed objects — convert to arrays for the agent
    const rawContent = diagramArtifact.content as any;
    const diagram = {
      id: diagramArtifact.id,
      type: rawContent.diagram_metadata?.type ?? "class",
      nodes: Object.values(rawContent.nodes ?? {}),
      edges: Object.values(rawContent.edges ?? {}),
    } as any;

    // Create Architect agent and generate traceability links
    const architect = new ArchitectAgent();
    const startTime = Date.now();

    const traceabilityLinks = await architect.createTraceabilityLinks(
      requirements,
      diagram,
      user.id,
    );

    const analysisTime = Date.now() - startTime;

    // Store traceability links in database
    if (traceabilityLinks.length > 0) {
      const links = traceabilityLinks
        .map((link) => {
          // Resolve requirement content ID → artifact UUID
          const reqArtifactId = contentIdToArtifactId.get(link.sourceId);
          if (!reqArtifactId) {
            console.warn(`Could not resolve requirement ID: ${link.sourceId}`);
            return null;
          }
          return {
            source_id: reqArtifactId,       // requirement artifact UUID
            target_id: diagramArtifact.id,  // diagram artifact UUID
            target_node_id: link.targetId,  // React Flow node string ID
            link_type: link.linkType,
            confidence: link.confidence,
            created_by: user.id,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      // Deduplicate by (source_id, target_id, link_type) — keep highest confidence per group
      // since the unique constraint covers those three columns
      const deduped = new Map<string, typeof links[0]>();
      for (const link of links) {
        const key = `${link.source_id}|${link.target_id}|${link.link_type}`;
        const existing = deduped.get(key);
        if (!existing || link.confidence > existing.confidence) {
          deduped.set(key, link);
        }
      }
      const dedupedLinks = Array.from(deduped.values());

      const { data: insertedLinks, error: linksError } = await supabase
        .from("traceability_links")
        .upsert(dedupedLinks, {
          onConflict: "source_id,target_id,link_type",
          ignoreDuplicates: false,
        })
        .select();

      if (linksError) {
        console.error("Failed to insert traceability links", linksError);
        return NextResponse.json(
          { error: "Failed to save traceability links", details: linksError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        traceabilityLinks,
        insertedLinks,
        count: dedupedLinks.length,
        analysisTime,
      });
    }

    return NextResponse.json({
      success: true,
      traceabilityLinks: [],
      count: 0,
      analysisTime,
      message: "No traceability links created (all below confidence threshold)",
    });
  } catch (error) {
    console.error("Traceability link creation failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
