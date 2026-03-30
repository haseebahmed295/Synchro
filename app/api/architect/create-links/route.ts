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

    // Extract data
    const requirements = requirementArtifacts.map(
      (artifact) => artifact.content,
    );
    const diagram = diagramArtifact.content;

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
      const links = traceabilityLinks.map((link) => ({
        source_id: link.sourceId,
        target_id: link.targetId,
        link_type: link.linkType,
        confidence: link.confidence,
        created_by: user.id,
      }));

      const { data: insertedLinks, error: linksError } = await supabase
        .from("traceability_links")
        .insert(links)
        .select();

      if (linksError) {
        console.error("Failed to insert traceability links", linksError);
        return NextResponse.json(
          {
            error: "Failed to save traceability links",
            details: linksError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        traceabilityLinks,
        insertedLinks,
        count: traceabilityLinks.length,
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
