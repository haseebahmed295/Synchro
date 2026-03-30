/**
 * API Route: Surgical Requirement Update
 * Endpoint for testing the Analyst agent surgical update functionality
 */

import { type NextRequest, NextResponse } from "next/server";
import { AnalystAgent } from "@/lib/agents/analyst";
import { applyPatch } from "@/lib/agents/json-patch";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

// Initialize AI on module load
initializeAI();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { artifactId, delta, expectedVersion } = body;

    if (!artifactId || typeof artifactId !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "artifactId" field' },
        { status: 400 },
      );
    }

    if (!delta || typeof delta !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "delta" field' },
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

    // Fetch existing artifact
    const { data: artifact, error: fetchError } = await supabase
      .from("artifacts")
      .select("*")
      .eq("id", artifactId)
      .eq("type", "requirement")
      .single();

    if (fetchError || !artifact) {
      return NextResponse.json(
        { error: "Artifact not found or access denied" },
        { status: 404 },
      );
    }

    // Check version if provided (Optimistic Concurrency Control)
    if (expectedVersion !== undefined && artifact.version !== expectedVersion) {
      return NextResponse.json(
        {
          error: "Version conflict",
          expectedVersion,
          currentVersion: artifact.version,
          latestContent: artifact.content,
        },
        { status: 409 },
      );
    }

    // Create Analyst agent and generate surgical update
    const analyst = new AnalystAgent();
    const patches = await analyst.surgicalUpdate(
      artifact.content,
      delta,
      user.id,
    );

    // Apply patches to content
    let updatedContent = artifact.content;
    for (const patch of patches) {
      updatedContent = applyPatch(updatedContent, patch);
    }

    // Validate updated content
    analyst.validateRequirement(updatedContent);

    // Update artifact in database with version increment
    const { data: updatedArtifact, error: updateError } = await supabase
      .from("artifacts")
      .update({
        content: updatedContent,
        version: artifact.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", artifactId)
      .eq("version", artifact.version) // OCC check
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update artifact", updateError);

      // Check if it's a version conflict
      if (updateError.code === "23505" || !updatedArtifact) {
        // Re-fetch latest version
        const { data: latestArtifact } = await supabase
          .from("artifacts")
          .select("*")
          .eq("id", artifactId)
          .single();

        return NextResponse.json(
          {
            error: "Version conflict during update",
            currentVersion: latestArtifact?.version,
            latestContent: latestArtifact?.content,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Failed to update artifact", details: String(updateError) },
        { status: 500 },
      );
    }

    // Record patches in change log
    const changeLogEntries = patches.map((patch) => ({
      artifact_id: artifactId,
      patch,
      applied_by: user.id,
      agent_type: "analyst",
    }));

    await supabase.from("change_log").insert(changeLogEntries);

    return NextResponse.json({
      success: true,
      patches,
      updatedContent,
      newVersion: updatedArtifact.version,
      artifact: updatedArtifact,
    });
  } catch (error) {
    console.error("Surgical update failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
