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

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create Analyst agent and ingest text with streaming
          const analyst = new AnalystAgent();
          
          let requirementCount = 0;
          
          // Use streaming callback
          await analyst.ingestTextStreaming(
            text,
            projectId,
            user.id,
            async (requirement) => {
              // Save each requirement as it's generated
              const artifact = {
                project_id: projectId,
                type: "requirement" as const,
                content: requirement,
                metadata: {},
                version: 1,
                created_by: user.id,
              };

              const { data: insertedArtifact, error: insertError } = await supabase
                .from("artifacts")
                .insert(artifact)
                .select()
                .single();

              if (insertError) {
                console.error("Failed to insert requirement", insertError);
                // Send error event
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "error", error: insertError.message })}\n\n`,
                  ),
                );
              } else {
                requirementCount++;
                console.log(`[SSE] Sending requirement ${requirementCount}:`, insertedArtifact.content.title);
                // Send success event with the created requirement
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "requirement", requirement: insertedArtifact, count: requirementCount })}\n\n`,
                  ),
                );
              }
            },
          );

          // Send completion event
          console.log(`[SSE] Sending completion event - ${requirementCount} requirements created`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "complete", count: requirementCount })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          console.error("Streaming error", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Unknown error" })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
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
