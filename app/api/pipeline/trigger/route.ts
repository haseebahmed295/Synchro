/**
 * API Route: Trigger AI Pipeline from User Changes
 * Reads recent user-initiated changes from change_log and dispatches
 * to the appropriate downstream agent (architect for requirements,
 * analyst for diagrams).
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ArchitectAgent } from "@/lib/agents/architect";
import { initializeAI } from "@/lib/ai";

initializeAI();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artifactId, projectId } = body;

    if (!artifactId || !projectId) {
      return NextResponse.json({ error: "artifactId and projectId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify project access
    const { data: project } = await supabase
      .from("projects").select("id").eq("id", projectId).single();
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Fetch the artifact to determine type
    const { data: artifact, error: artifactError } = await supabase
      .from("artifacts").select("id, type, content").eq("id", artifactId).single();
    if (artifactError || !artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    // Fetch recent user changes for this artifact (last 50)
    const { data: changes, error: changesError } = await supabase
      .from("change_log")
      .select("*")
      .eq("artifact_id", artifactId)
      .eq("agent_type", "user")
      .order("applied_at", { ascending: false })
      .limit(50);

    if (changesError) {
      return NextResponse.json({ error: "Failed to fetch changes" }, { status: 500 });
    }

    if (!changes || changes.length === 0) {
      return NextResponse.json({ message: "No user changes to process", suggestions: [] });
    }

    const patches = changes.map((c) => c.patch);

    // Route to appropriate agent based on artifact type
    if (artifact.type === "requirement") {
      // Requirement changed → ask Architect to suggest diagram updates
      const { data: diagrams } = await supabase
        .from("artifacts")
        .select("id, content")
        .eq("project_id", projectId)
        .eq("type", "diagram");

      const { data: requirements } = await supabase
        .from("artifacts")
        .select("id, content")
        .eq("project_id", projectId)
        .eq("type", "requirement");

      const architect = new ArchitectAgent();
      const allSuggestions = [];

      for (const diagram of diagrams ?? []) {
        const suggestions = await architect.suggestDiagramUpdates(
          patches[0], // most recent patch as the delta
          diagram.content,
          (requirements ?? []).map((r) => r.content),
        );
        if (suggestions.length > 0) {
          allSuggestions.push({ diagramId: diagram.id, suggestions });
        }
      }

      return NextResponse.json({
        success: true,
        artifactType: "requirement",
        changesProcessed: changes.length,
        results: allSuggestions,
      });
    }

    if (artifact.type === "diagram") {
      // Diagram changed → ask Architect to suggest requirement updates
      const architect = new ArchitectAgent();
      const suggestions = await architect.diagramToRequirements(artifact.content);

      return NextResponse.json({
        success: true,
        artifactType: "diagram",
        changesProcessed: changes.length,
        results: suggestions,
      });
    }

    return NextResponse.json({
      success: true,
      message: `No pipeline handler for artifact type: ${artifact.type}`,
      results: [],
    });
  } catch (error) {
    console.error("[pipeline/trigger] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
