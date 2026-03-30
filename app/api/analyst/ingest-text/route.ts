/**
 * API Route: Ingest Text Requirements
 * Endpoint for testing the Analyst agent text ingestion
 */

import { type NextRequest, NextResponse } from "next/server";
import { AnalystAgent } from "@/lib/agents/analyst";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

// Initialize AI on module load
initializeAI();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { text, projectId } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "text" field' },
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

    // Create Analyst agent and ingest text
    const analyst = new AnalystAgent();
    const requirements = await analyst.ingestText(text, projectId, user.id);

    // Store requirements in database
    const artifacts = requirements.map((req) => ({
      project_id: projectId,
      type: "requirement" as const,
      content: req,
      metadata: {},
      version: 1,
      created_by: user.id,
    }));

    const { data: insertedArtifacts, error: insertError } = await supabase
      .from("artifacts")
      .insert(artifacts)
      .select();

    if (insertError) {
      console.error("Failed to insert requirements", insertError);
      return NextResponse.json(
        { error: "Failed to save requirements", details: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      requirements,
      artifacts: insertedArtifacts,
      count: requirements.length,
    });
  } catch (error) {
    console.error("Text ingestion failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
