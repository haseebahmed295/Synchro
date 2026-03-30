/**
 * API Route: Suggest Diagram Updates from Requirement Changes
 * Endpoint for forward sync (requirements -> diagrams)
 * Requirements: 10.1, 10.3
 */

import { type NextRequest, NextResponse } from "next/server";
import { ArchitectAgent } from "@/lib/agents/architect";
import type { JSONPatch } from "@/lib/agents/json-patch";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

// Initialize AI on module load
initializeAI();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { requirementDelta, diagramId, projectId } = body;

    if (!requirementDelta || typeof requirementDelta !== "object") {
      return NextResponse.json(
        {
          error:
            'Missing or invalid "requirementDelta" field (must be JSON Patch object)',
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

    // Fetch all requirements for context
    const { data: requirementArtifacts, error: reqError } = await supabase
      .from("artifacts")
      .select("id, content")
      .eq("project_id", projectId)
      .eq("type", "requirement");

    if (reqError) {
      console.error("Failed to fetch requirements", reqError);
      return NextResponse.json(
        { error: "Failed to fetch requirements", details: reqError.message },
        { status: 500 },
      );
    }

    const requirements =
      requirementArtifacts?.map((artifact) => artifact.content) || [];
    const diagram = diagramArtifact.content;

    // Create Architect agent and generate suggestions
    const architect = new ArchitectAgent();
    const startTime = Date.now();

    const suggestions = await architect.suggestDiagramUpdates(
      requirementDelta as JSONPatch,
      diagram,
      requirements,
    );

    const analysisTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
      analysisTime,
    });
  } catch (error) {
    console.error("Diagram update suggestion failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
