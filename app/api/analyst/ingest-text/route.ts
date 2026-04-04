/**
 * API Route: Ingest Text Requirements
 * Streams AI-generated requirements with project-scoped display IDs and dependencies.
 */

import { type NextRequest, NextResponse } from "next/server";
import { AnalystAgent } from "@/lib/agents/analyst";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

initializeAI();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, projectId } = body;

    if (!text || typeof text !== "string")
      return NextResponse.json({ error: 'Missing "text"' }, { status: 400 });
    if (!projectId || typeof projectId !== "string")
      return NextResponse.json({ error: 'Missing "projectId"' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const analyst = new AnalystAgent();
          let requirementCount = 0;

          // tempId → artifact UUID — used to resolve dependency references after insert
          const tempIdToArtifactId = new Map<string, string>();

          const dependencies = await analyst.ingestTextStreaming(
            text,
            projectId,
            user.id,
            async (requirement) => {
              // Get project-scoped display ID from DB atomic counter
              const { data: displayId, error: idError } = await supabase
                .rpc("next_req_display_id", { p_project_id: projectId });

              if (idError) {
                console.error("Failed to generate display ID:", idError);
              }

              const reqId: string = displayId ?? `REQ-${requirementCount + 1}`;
              const tempId = requirement.id; // e.g. "temp_1"

              const { data: inserted, error: insertError } = await supabase
                .from("artifacts")
                .insert({
                  project_id: projectId,
                  type: "requirement",
                  content: {
                    ...requirement,
                    req_id: reqId,
                    // Ensure tags live in both places for compatibility
                    metadata: {
                      ...requirement.metadata,
                      tags: requirement.tags ?? requirement.metadata?.tags ?? [],
                    },
                  },
                  metadata: {},
                  version: 1,
                  created_by: user.id,
                })
                .select()
                .single();

              if (insertError) {
                console.error("Failed to insert requirement", insertError);
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "error", error: insertError.message })}\n\n`
                ));
                return;
              }

              // Record temp → artifact UUID mapping for dependency resolution
              tempIdToArtifactId.set(tempId, inserted.id);
              requirementCount++;

              console.log(`[SSE] Requirement ${requirementCount} (${reqId}):`, inserted.content.title);
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: "requirement", requirement: inserted, count: requirementCount })}\n\n`
              ));
            },
          );

          // Insert dependencies now that all artifact UUIDs are known
          let depsCreated = 0;
          if (dependencies.length > 0) {
            const depRows = dependencies
              .map((dep) => {
                const sourceId = tempIdToArtifactId.get(dep.source_temp_id);
                const targetId = tempIdToArtifactId.get(dep.target_temp_id);
                if (!sourceId || !targetId) {
                  console.warn(`Skipping dep: could not resolve ${dep.source_temp_id} → ${dep.target_temp_id}`);
                  return null;
                }
                return {
                  source_requirement_id: sourceId,
                  target_requirement_id: targetId,
                  dependency_type: dep.dependency_type,
                  created_by: user.id,
                };
              })
              .filter((d): d is NonNullable<typeof d> => d !== null);

            if (depRows.length > 0) {
              const { data: insertedDeps, error: depsError } = await supabase
                .from("requirement_dependencies")
                .insert(depRows)
                .select();

              if (depsError) {
                console.error("Failed to insert dependencies:", depsError);
              } else {
                depsCreated = insertedDeps?.length ?? 0;
                // Send each dependency so the client can update state immediately
                for (const dep of insertedDeps ?? []) {
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: "dependency", dependency: dep })}\n\n`
                  ));
                }
              }
            }
          }

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "complete", count: requirementCount, depsCreated })}\n\n`
          ));
          controller.close();
        } catch (error) {
          console.error("Streaming error", error);
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Unknown error" })}\n\n`
          ));
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
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
