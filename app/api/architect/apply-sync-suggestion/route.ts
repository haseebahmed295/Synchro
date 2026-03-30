/**
 * API Route: Apply Sync Suggestion
 * Endpoint for applying accepted sync suggestions and creating traceability links
 * Requirements: 10.4, 10.5
 */

import { type NextRequest, NextResponse } from "next/server";
import type {
  DiagramSuggestion,
  RequirementSuggestion,
} from "@/lib/agents/architect";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

// Initialize AI on module load
initializeAI();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { suggestion, suggestionType, artifactId, projectId } = body;

    if (!suggestion || typeof suggestion !== "object") {
      return NextResponse.json(
        { error: 'Missing or invalid "suggestion" field' },
        { status: 400 },
      );
    }

    if (
      !suggestionType ||
      !["diagram", "requirement"].includes(suggestionType)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid "suggestionType" field (must be "diagram" or "requirement")',
        },
        { status: 400 },
      );
    }

    if (!artifactId || typeof artifactId !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "artifactId" field' },
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

    if (suggestionType === "diagram") {
      // Apply diagram suggestion
      const diagramSuggestion = suggestion as DiagramSuggestion;

      // Fetch current diagram
      const { data: diagramArtifact, error: fetchError } = await supabase
        .from("artifacts")
        .select("id, content, version")
        .eq("id", artifactId)
        .eq("type", "diagram")
        .single();

      if (fetchError || !diagramArtifact) {
        return NextResponse.json(
          { error: "Diagram not found" },
          { status: 404 },
        );
      }

      const diagram = diagramArtifact.content;
      let updated = false;

      // Apply the suggestion based on action type
      switch (diagramSuggestion.action) {
        case "add_node":
          diagram.nodes.push({
            id: diagramSuggestion.target_id,
            type: diagramSuggestion.data.type || "class",
            position: diagramSuggestion.data.position || { x: 100, y: 100 },
            data: {
              label: diagramSuggestion.data.label || "New Node",
              attributes: diagramSuggestion.data.attributes || [],
              methods: diagramSuggestion.data.methods || [],
            },
          });
          updated = true;
          break;

        case "remove_node":
          diagram.nodes = diagram.nodes.filter(
            (n: any) => n.id !== diagramSuggestion.target_id,
          );
          diagram.edges = diagram.edges.filter(
            (e: any) =>
              e.source !== diagramSuggestion.target_id &&
              e.target !== diagramSuggestion.target_id,
          );
          updated = true;
          break;

        case "update_node": {
          const nodeIndex = diagram.nodes.findIndex(
            (n: any) => n.id === diagramSuggestion.target_id,
          );
          if (nodeIndex !== -1) {
            diagram.nodes[nodeIndex] = {
              ...diagram.nodes[nodeIndex],
              data: {
                ...diagram.nodes[nodeIndex].data,
                ...diagramSuggestion.data,
              },
            };
            updated = true;
          }
          break;
        }

        case "add_edge":
          diagram.edges.push({
            id: diagramSuggestion.target_id,
            source: diagramSuggestion.data.source,
            target: diagramSuggestion.data.target,
            type: diagramSuggestion.data.type || "association",
            label: diagramSuggestion.data.label,
          });
          updated = true;
          break;

        case "remove_edge":
          diagram.edges = diagram.edges.filter(
            (e: any) => e.id !== diagramSuggestion.target_id,
          );
          updated = true;
          break;
      }

      if (updated) {
        // Update diagram in database with OCC
        const { data: updatedArtifact, error: updateError } = await supabase
          .from("artifacts")
          .update({
            content: diagram,
            version: diagramArtifact.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", artifactId)
          .eq("version", diagramArtifact.version)
          .select()
          .single();

        if (updateError) {
          console.error("Failed to update diagram", updateError);
          return NextResponse.json(
            {
              error: "Failed to apply suggestion",
              details: updateError.message,
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          success: true,
          updatedArtifact,
          message: "Diagram suggestion applied successfully",
        });
      }

      return NextResponse.json({
        success: false,
        message: "No changes were made",
      });
    } else {
      // Apply requirement suggestion
      const reqSuggestion = suggestion as RequirementSuggestion;

      if (reqSuggestion.action === "add_requirement") {
        // Create new requirement
        const { data: newRequirement, error: insertError } = await supabase
          .from("artifacts")
          .insert({
            project_id: projectId,
            type: "requirement",
            content: {
              req_id: `REQ_${Date.now()}`,
              title: reqSuggestion.title,
              description: reqSuggestion.description,
              type: reqSuggestion.type,
              priority: reqSuggestion.priority,
              status: "draft",
            },
            metadata: {
              source: "diagram_sync",
              reasoning: reqSuggestion.reasoning,
              confidence: reqSuggestion.confidence,
            },
            version: 1,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Failed to create requirement", insertError);
          return NextResponse.json(
            {
              error: "Failed to create requirement",
              details: insertError.message,
            },
            { status: 500 },
          );
        }

        // Create traceability links to affected nodes
        if (reqSuggestion.affected_nodes.length > 0) {
          const links = reqSuggestion.affected_nodes.map((nodeId) => ({
            source_id: newRequirement.id,
            target_id: nodeId,
            link_type: "derives_from",
            confidence: reqSuggestion.confidence,
            created_by: user.id,
          }));

          const { error: linksError } = await supabase
            .from("traceability_links")
            .insert(links);

          if (linksError) {
            console.error("Failed to create traceability links", linksError);
            // Don't fail the request, just log the error
          }
        }

        return NextResponse.json({
          success: true,
          newRequirement,
          message: "Requirement created successfully",
        });
      } else if (
        reqSuggestion.action === "update_requirement" &&
        reqSuggestion.requirement_id
      ) {
        // Update existing requirement
        const { data: existingReq, error: fetchError } = await supabase
          .from("artifacts")
          .select("id, content, version")
          .eq("id", reqSuggestion.requirement_id)
          .eq("type", "requirement")
          .single();

        if (fetchError || !existingReq) {
          return NextResponse.json(
            { error: "Requirement not found" },
            { status: 404 },
          );
        }

        const updatedContent = {
          ...existingReq.content,
          title: reqSuggestion.title,
          description: reqSuggestion.description,
          type: reqSuggestion.type,
          priority: reqSuggestion.priority,
        };

        const { data: updatedReq, error: updateError } = await supabase
          .from("artifacts")
          .update({
            content: updatedContent,
            version: existingReq.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reqSuggestion.requirement_id)
          .eq("version", existingReq.version)
          .select()
          .single();

        if (updateError) {
          console.error("Failed to update requirement", updateError);
          return NextResponse.json(
            {
              error: "Failed to update requirement",
              details: updateError.message,
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          success: true,
          updatedRequirement: updatedReq,
          message: "Requirement updated successfully",
        });
      }

      return NextResponse.json({
        success: false,
        message: "Unsupported requirement action",
      });
    }
  } catch (error) {
    console.error("Apply sync suggestion failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
