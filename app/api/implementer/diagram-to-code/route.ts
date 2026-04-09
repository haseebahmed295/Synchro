/**
 * API Route: Generate Code from Diagram
 * Endpoint for the Implementer agent code generation
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { type NextRequest, NextResponse } from "next/server";
import { ImplementerAgent } from "@/lib/agents/implementer";
import type { CodeTemplate } from "@/lib/agents/implementer";
import { initializeAI } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

initializeAI();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { diagramArtifactId, language, framework, variables } = body;

    if (!diagramArtifactId || typeof diagramArtifactId !== "string") {
      return NextResponse.json({ error: 'Missing "diagramArtifactId"' }, { status: 400 });
    }

    const validLanguages = ["typescript", "python", "java"];
    if (!language || !validLanguages.includes(language)) {
      return NextResponse.json(
        { error: `Invalid "language". Must be one of: ${validLanguages.join(", ")}` },
        { status: 400 },
      );
    }

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the diagram artifact
    const { data: diagramArtifact, error: fetchError } = await supabase
      .from("artifacts")
      .select("id, project_id, content, type")
      .eq("id", diagramArtifactId)
      .single();

    if (fetchError || !diagramArtifact) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    if (diagramArtifact.type !== "diagram") {
      return NextResponse.json({ error: "Artifact is not a diagram" }, { status: 400 });
    }

    // Verify project access
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", diagramArtifact.project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Convert stored diagram content to Diagram shape
    const content = diagramArtifact.content as Record<string, any>;
    const diagramMeta = content.diagram_metadata ?? {};
    const nodesObj = content.nodes ?? {};
    const edgesObj = content.edges ?? {};

    const diagram = {
      id: diagramMeta.id ?? diagramArtifactId,
      type: diagramMeta.type ?? "class",
      nodes: Object.values(nodesObj) as any[],
      edges: Object.values(edgesObj) as any[],
    };

    const template: CodeTemplate = {
      language: language as "typescript" | "python" | "java",
      framework: framework ?? undefined,
      variables: variables ?? {},
    };

    // Run the Implementer agent
    const implementer = new ImplementerAgent();
    const startTime = Date.now();

    const { generatedCode, traceabilityLinks } = await implementer.diagramToCode(
      diagram,
      template,
      user.id,
    );

    const generationTime = Date.now() - startTime;

    // Build a map from file index → diagram node ID using the traceability links.
    // The agent returns one link per generated class (same order as generatedCode.files).
    const fileIndexToNodeId = new Map<number, string>();
    traceabilityLinks.forEach((link, idx) => {
      fileIndexToNodeId.set(idx, link.targetId);
    });

    // Store each generated file as a code artifact
    const codeArtifacts: Array<{ artifact: any; nodeId: string | undefined }> = [];
    for (let i = 0; i < generatedCode.files.length; i++) {
      const file = generatedCode.files[i];
      const nodeId = fileIndexToNodeId.get(i);

      // links field: diagram node ID (per Code Artifact Schema) + diagram artifact ID for broader traceability
      const fileLinks = nodeId ? [nodeId, diagramArtifactId] : [diagramArtifactId];

      const { data: codeArtifact, error: insertError } = await supabase
        .from("artifacts")
        .insert({
          project_id: diagramArtifact.project_id,
          type: "code",
          content: {
            code_metadata: {
              id: crypto.randomUUID(),
              language: file.language,
              framework: framework ?? null,
              version: "1",
            },
            files: {
              [file.path]: {
                path: file.path,
                content: file.content,
                ast_hash: "",
                links: fileLinks,
              },
            },
            dependencies: generatedCode.dependencies,
          },
          metadata: {
            filePath: file.path,
            language: file.language,
            sourceDiagramId: diagramArtifactId,
            sourceDiagramNodeId: nodeId ?? null,
            generationTime,
          },
          version: 1,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[Implementer] Failed to insert code artifact", insertError);
      } else if (codeArtifact) {
        codeArtifacts.push({ artifact: codeArtifact, nodeId });
      }
    }

    // Store traceability links: diagram artifact → code artifact, with node-level granularity
    if (codeArtifacts.length > 0) {
      const linkRows = codeArtifacts.map(({ artifact, nodeId }) => ({
        source_id: diagramArtifactId,
        target_id: artifact.id,
        target_node_id: nodeId ?? null,
        link_type: "implements",
        confidence: 0.95,
        created_by: user.id,
      }));

      const { error: linksError } = await supabase
        .from("traceability_links")
        .upsert(linkRows, { onConflict: "source_id,target_id,link_type", ignoreDuplicates: true });

      if (linksError) {
        console.error("[Implementer] Failed to insert traceability links", linksError);
      }
    }

    return NextResponse.json({
      success: true,
      generatedCode,
      codeArtifacts: codeArtifacts.map(({ artifact }) => artifact),
      traceabilityLinks,
      generationTime,
    });
  } catch (error) {
    console.error("[Implementer] Code generation failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
