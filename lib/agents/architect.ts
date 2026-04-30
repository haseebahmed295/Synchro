/**
 * Module B: The Architect Agent
 * Handles diagram generation from requirements and bidirectional sync
 * Requirements: 7.1-7.6
 */

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { generateAIObject } from "../ai/client";
import { computeLayout } from "../utils/diagram-layout";
import type { Diagram, DiagramEdge, DiagramNode, NodeType } from "../types/diagram";
import type { Requirement } from "./analyst";
import type { TraceabilityLink } from "./types";

/**
 * Diagram generation result schema
 */
const DiagramGenerationSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string().transform((t) => {
          // "device" is a common AI hallucination — map it to the correct "node" type
          if (t === "device") return "node";
          const valid = ["class", "entity", "actor", "lifeline", "fragment", "node", "executionEnvironment", "component", "artifact", "interface", "process", "decision", "terminal", "io"];
          return valid.includes(t) ? t : "class";
        }) as z.ZodType<NodeType>,
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      data: z.object({
        label: z.string(),
        attributes: z.array(z.string()).optional(),
        methods: z.array(z.string()).optional(),
        stereotype: z.string().optional(),
        children: z.array(z.string()).optional(),
        abstract: z.boolean().optional(),
        condition: z.string().optional(),
        kind: z.string().optional(),
        color: z.string().optional(),
        height: z.number().optional(),
        width: z.number().optional(),
      }),
      linkedRequirements: z.array(z.string()).optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string().optional(), // Make optional to handle AI errors
      target: z.string().optional(), // Make optional to handle AI errors
      type: z.enum([
        "association",
        "inheritance",
        "dependency",
        "composition",
        "aggregation",
      ]),
      label: z.string().optional(),
      multiplicity: z
        .object({
          source: z.string().optional(),
          target: z.string().optional(),
        })
        .optional(),
      // Sequence diagram message type
      msgType: z.enum(["sync", "return", "async"]).optional(),
      // Sequence diagram vertical ordering (index in array = execution order)
      msgY: z.number().optional(),
      // Component diagram: per-interface handle IDs
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
    }),
  ),
  reasoning: z.union([z.string(), z.array(z.string())]), // Accept string or array
});

type DiagramGenerationResult = z.infer<typeof DiagramGenerationSchema>;

/**
 * The Architect Agent
 * Responsible for generating diagrams from requirements and maintaining bidirectional sync
 */
export class ArchitectAgent {
  /**
   * Generate diagram from requirements
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
   */
  async requirementsToDiagram(
    requirements: Requirement[],
    diagramType: "class" | "sequence" | "erd" | "deployment" | "flowchart",
    projectId: string,
    userId: string,
  ): Promise<{ diagram: Diagram; traceabilityLinks: TraceabilityLink[] }> {
    const systemPrompt = this.getSystemPromptForDiagramType(diagramType);

    const prompt = `Generate a ${diagramType} diagram from the following requirements:

${requirements
  .map(
    (req) => `
**${req.id}: ${req.title}**
${req.description}
Type: ${req.type}
Priority: ${req.priority}
`,
  )
  .join("\n")}

Instructions:
1. Generate unique IDs for all nodes and edges (use descriptive names like "USER_CLASS", "AUTH_ENTITY", etc.)
2. For EVERY node, populate the linkedRequirements array with the IDs of requirements that node implements or relates to — this is MANDATORY, not optional. Every node must have at least one linked requirement.
3. Generate positions following the STRICT layout rules in the system prompt for this diagram type
4. Create appropriate relationships between nodes based on requirement descriptions
5. Include reasoning explaining your design decisions

IMPORTANT: Return a JSON object with this exact structure:
{
  "nodes": [
    {
      "id": "string (unique identifier)",
      "type": "<depends on diagram type — see system prompt for valid types>",
      "position": { "x": number, "y": number },
      "data": {
        "label": "string (display name)",
        "attributes": ["optional", "array", "of", "strings"],
        "methods": ["optional", "array", "of", "strings"],
        "stereotype": "optional string",
        "children": ["optional array of child node IDs — deployment diagrams only"],
        "abstract": "optional boolean — class diagrams: true for abstract classes and interfaces",
        "color": "optional hex string — boundary nodes only (e.g. '#6366f1')"
      },
      "linkedRequirements": ["REQUIRED — list the requirement IDs (e.g. REQ_001) this node implements or relates to. Must not be empty."]
    }
  ],
  "edges": [
    {
      "id": "string (unique identifier like 'edge_1')",
      "source": "string (must match a node id)",
      "target": "string (must match a node id)",
      "type": "association" | "inheritance" | "dependency" | "composition" | "aggregation",
      "label": "optional string",
      "multiplicity": {
        "source": "optional string like '1' or '0..*'",
        "target": "optional string like '1' or '0..*'"
      },
      "msgType": "optional — sequence diagrams only: 'sync' | 'return' | 'async'",
      "sourceHandle": "optional — component diagrams only: 'provided-<InterfaceName>'",
      "targetHandle": "optional — component diagrams only: 'required-<InterfaceName>'"
    }
  ],
  "reasoning": "string explaining your design decisions"
}

CRITICAL: 
- Every edge MUST have both "source" and "target" fields that reference existing node IDs
- "reasoning" MUST be a single string, not an array
- All node IDs must be unique
- All edge source/target must reference existing node IDs
- CLASS DIAGRAMS: You MUST use the correct edge "type" — inheritance/composition/aggregation/dependency/association. Do NOT use "association" for everything. See the system prompt decision table.
- linkedRequirements MUST be populated for every node — use the exact requirement IDs from the input (e.g. "REQ_001"). Never leave it empty or omit it.`;

    try {
      const result = await generateAIObject(
        "architecture",
        prompt,
        DiagramGenerationSchema,
        systemPrompt,
      );

      // Filter out invalid edges (those without source or target)
      const validEdges = result.edges.filter((edge): edge is typeof edge & { source: string; target: string } => {
        if (!edge.source || !edge.target) {
          console.warn(`Skipping invalid edge: ${edge.id} - missing source or target`);
          return false;
        }
        // Check if source and target nodes exist
        const sourceExists = result.nodes.some(n => n.id === edge.source);
        const targetExists = result.nodes.some(n => n.id === edge.target);
        if (!sourceExists || !targetExists) {
          console.warn(`Skipping invalid edge: ${edge.id} - source or target node not found`);
          return false;
        }
        return true;
      });

      // Post-process class diagram edges: infer better relationship types when AI defaults everything to "association"
      if (diagramType === "class") {
        const allAssociation = validEdges.every(e => e.type === "association");
        if (allAssociation) {
          const nodeMap = new Map(result.nodes.map(n => [n.id, n]));
          for (const edge of validEdges) {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) continue;
            const srcSt = src.data.stereotype ?? "";
            const tgtSt = tgt.data.stereotype ?? "";
            // Controller/Service → Service/Repository = dependency
            if (["controller", "service"].includes(srcSt) && ["service", "repository"].includes(tgtSt)) {
              (edge as any).type = "dependency";
            }
            // Service/Repository → entity = association with multiplicity
            else if (["service", "repository"].includes(srcSt) && tgtSt === "entity") {
              (edge as any).type = "association";
            }
            // interface/abstract → concrete = inheritance
            else if (tgt.data.abstract || ["interface", "abstract"].includes(tgtSt)) {
              (edge as any).type = "inheritance";
            }
          }
        }
      }

      // Compute proper layout — only for diagram types that benefit from the LR grid.
      // Flowcharts use a top-to-bottom flow (AI positions are good as-is).
      // Deployment diagrams handle layout in the converter's auto-spacing.
      const useGridLayout = diagramType !== "flowchart" && diagramType !== "deployment";
      let layoutPositions: Map<string, { x: number; y: number }>;

      if (useGridLayout) {
        const aiPositions = new Map(result.nodes.map((n) => [n.id, n.position]));
        layoutPositions = computeLayout(
          result.nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
          validEdges,
          aiPositions,
        );
      } else {
        // Use AI positions directly
        layoutPositions = new Map(result.nodes.map((n) => [n.id, n.position]));
      }

      // Create diagram with unique ID
      const diagramId = uuidv4();
      const diagram: Diagram = {
        id: diagramId,
        type: diagramType,
        nodes: result.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: layoutPositions.get(node.id) ?? node.position,
          data: node.data,
        })),
        edges: validEdges,
        metadata: {
          name: `${diagramType.toUpperCase()} Diagram`,
          description: Array.isArray(result.reasoning) ? result.reasoning.join(' ') : result.reasoning,
        },
      };

      // Create traceability links from requirements to diagram nodes
      const traceabilityLinks: TraceabilityLink[] = [];

      // Create a map of requirement content IDs to artifact UUIDs
      const reqIdToArtifactId = new Map<string, string>();
      for (const req of requirements) {
        // req is the content object, we need to find the artifact ID
        // The requirement content has an id field like "REQ_XXX"
        // We need to match this back to the artifact
        if (req.id) {
          reqIdToArtifactId.set(req.id, req.id); // This will be fixed below
        }
      }

      for (const node of result.nodes) {
        if (node.linkedRequirements && node.linkedRequirements.length > 0) {
          for (const reqId of node.linkedRequirements) {
            // Verify requirement exists
            const requirement = requirements.find((r) => r.id === reqId);
            if (requirement) {
              // Note: We're using the requirement content ID here
              // The API route should pass artifact IDs, not content IDs
              traceabilityLinks.push({
                sourceId: reqId,
                targetId: node.id,
                linkType: "derives_from",
                confidence: 0.9, // High confidence for direct generation
                createdBy: userId,
              });
            }
          }
        }
      }

      return { diagram, traceabilityLinks };
    } catch (error) {
      console.error("Failed to generate diagram from requirements", error);
      throw new Error(
        `Diagram generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Analyze requirement text to identify relevant diagram elements
   * Requirements: 7.5
   */
  async createTraceabilityLinks(
    requirements: Requirement[],
    diagram: Diagram,
    userId: string,
  ): Promise<TraceabilityLink[]> {
    const systemPrompt = `You are an expert at analyzing requirements and identifying which diagram elements they relate to.

Your task is to create traceability links between requirements and diagram nodes based on semantic similarity and logical relationships.

For each requirement, identify:
1. Which diagram nodes implement or represent concepts from the requirement
2. The confidence level (0.0 to 1.0) based on how strongly they relate
3. Only create links with confidence >= 0.6

Consider:
- Keywords and terminology matches
- Functional relationships (e.g., "User authentication" relates to "User" and "AuthService" classes)
- Data flow and dependencies
- Domain concepts`;

    const prompt = `Analyze these requirements and diagram nodes to create traceability links:

**Requirements:**
${requirements
  .map(
    (req) => `
${req.id}: ${req.title}
${req.description}
`,
  )
  .join("\n")}

**Diagram Nodes:**
${diagram.nodes
  .map(
    (node) => `
${node.id}: ${node.data.label}
Type: ${node.type}
${node.data.attributes ? `Attributes: ${node.data.attributes.join(", ")}` : ""}
${node.data.methods ? `Methods: ${node.data.methods.join(", ")}` : ""}
`,
  )
  .join("\n")}

Return a JSON array of links with: requirementId, nodeId, confidence, reasoning`;

    try {
      const LinksSchema = z.object({
        links: z.array(
          z.object({
            requirementId: z.string(),
            nodeId: z.string(),
            confidence: z.number().min(0).max(1),
            reasoning: z.string(),
          }),
        ),
      });

      const result = await generateAIObject(
        "architecture",
        prompt,
        LinksSchema,
        systemPrompt,
      );

      // Convert to TraceabilityLink format
      const traceabilityLinks: TraceabilityLink[] = result.links
        .filter((link) => link.confidence >= 0.6)
        .map((link) => ({
          sourceId: link.requirementId,
          targetId: link.nodeId,
          linkType: "derives_from" as const,
          confidence: link.confidence,
          createdBy: userId,
        }));

      return traceabilityLinks;
    } catch (error) {
      console.error("Failed to create traceability links", error);
      throw new Error(
        `Traceability link creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get system prompt based on diagram type
   */
  private getSystemPromptForDiagramType(
    diagramType: "class" | "sequence" | "erd" | "deployment" | "flowchart" | "component",
  ): string {
    switch (diagramType) {
      case "class":
        return `You are an expert software architect specializing in UML Class diagrams.

Your task is to generate well-structured class diagrams from requirements.

NODE DIMENSIONS (fixed — do not exceed these):
- Every node is exactly 280px wide and at most 280px tall
- Keep attributes to max 5 items, methods to max 4 items — truncate if needed
- Keep member text concise — long strings will be truncated with ellipsis in the UI

STRICT POSITION RULES — LEFT TO RIGHT LAYOUT:
Arrange nodes in columns from left to right based on dependency flow.
- Column 0 (x=60):   Entry points — controllers, API handlers (things that initiate)
- Column 1 (x=360):  Services — business logic classes
- Column 2 (x=660):  Domain entities — core data models
- Column 3 (x=960):  Repositories / persistence layer
- Column 4 (x=1260): Value objects, enums, helper types

Within each column, stack nodes vertically with 300px between them: y=60, 360, 660, 960...
No two nodes may share the same (x, y) position.

IMPORTANT: Generate at most 8-10 nodes total. Focus on the most important classes.

CLASS NODE RULES:
1. Use UML visibility prefixes on every attribute and method:
   - "+fieldName: Type"  → public
   - "-fieldName: Type"  → private
   - "#fieldName: Type"  → protected
   - "~fieldName: Type"  → package-private
2. Methods format: "+methodName(param: Type): ReturnType"
3. Stereotypes: controller, service, entity, valueObject, repository, enum, interface, abstract, utility
4. Abstract classes: set data.abstract = true AND stereotype = "abstract". Abstract method names are italicised in the UI.
5. Interfaces: set stereotype = "interface" and data.abstract = true.

EDGE RULES — CRITICAL: you MUST use the correct "type" for every edge. Never default everything to "association".

MANDATORY DECISION TABLE — pick the first matching rule:
| Relationship                                      | type          | Example                          |
|---------------------------------------------------|---------------|----------------------------------|
| Class A extends/implements Class B                | "inheritance" | UserService extends BaseService  |
| Class A owns Class B (B dies when A dies)         | "composition" | Order → OrderItem                |
| Class A has a collection of Class B (weak own.)   | "aggregation" | Team → Player                    |
| Class A uses/calls Class B but doesn't own it     | "dependency"  | Controller uses AuthService      |
| Class A holds a reference to Class B              | "association" | User has an Address              |

SELF-CHECK before outputting: scan every edge — if more than 60% are "association", you have made an error. Reclassify.

MULTIPLICITY — required on every association, aggregation, and composition edge:
- "1"    → exactly one
- "0..1" → zero or one
- "0..*" → zero or many  (most common for collections)
- "1..*" → one or many
Set both source and target: { "source": "1", "target": "0..*" }

Ensure all node and edge IDs are unique and descriptive.`;

      case "sequence":
        return `You are an expert software architect specializing in UML Sequence diagrams.

Your task is to generate sequence diagrams showing interactions between components.

POSITION RULES: Set ALL lifeline/actor node positions to { "x": 0, "y": 0 } — the renderer handles column layout automatically.

HARD LIMIT: Maximum 6 lifelines/actors total. If the requirements involve more components, merge related ones (e.g. "Auth + Session Service") rather than creating separate lifelines. A crowded diagram is worse than a simplified one.

NODE TYPES:
- "actor"    : External entities (users, external systems). Use for the initiating user/client only.
- "lifeline" : Internal system components (services, controllers, databases). Max 5 lifelines.
- "fragment" : Logic containers for conditional/loop blocks.
  Fragment kinds (set as data.stereotype):
  - "alt"  → If/Else block
  - "opt"  → Optional execution (single If)
  - "loop" → For/While loop
  Set data.attributes[0] to the condition string, e.g. "user.isAuthenticated".

  FRAGMENT POSITIONING — CRITICAL:
  Fragments must visually cover the messages they contain. To position correctly:
  1. Find the msgY of the FIRST message inside the fragment (e.g. msgY=220).
  2. Find the msgY of the LAST message inside the fragment (e.g. msgY=440).
  3. Set fragment position.y = firstMsgY - 20 (e.g. 200).
  4. Set fragment height in data as data.height = (lastMsgY - firstMsgY) + 60 (e.g. 280).
  5. Set fragment position.x = 60 (left edge of the first involved lifeline column).
  6. Set fragment width wide enough to cover all involved lifelines (e.g. 560 for 2 lifelines).
  Store height and width in data: { stereotype: "alt", attributes: ["condition"], height: 280, width: 560 }

MESSAGE TYPES (edge.msgType — CRITICAL for code generation):
- "sync"   → Synchronous call. Caller WAITS. Use for standard function/API calls.
- "return" → Response to a sync call. Always pair with a preceding "sync" edge.
- "async"  → Fire-and-forget. Caller does NOT wait (queue, event, background job).

EDGE ORDERING — THE MOST IMPORTANT RULE:
The array index of each edge IS its execution order. Edge[0] runs first.
Always emit edges in strict chronological order.

Typical request-response pattern (edges array):
  0. Actor → Controller  (sync,   "POST /login")
  1. Controller → Service (sync,   "authenticate(credentials)")
  2. Service → Database   (sync,   "findUser(email)")
  3. Database → Service   (return, "User | null")
  4. Service → Controller (return, "AuthToken")
  5. Controller → Actor   (return, "200 { token }")

Guidelines:
1. HARD LIMIT: 1 actor + max 5 lifelines = 6 participants total. Merge if needed.
2. Emit edges in CHRONOLOGICAL ORDER.
3. Label every edge with the method call or message.
4. Use msgType "return" for all response messages.
5. Use msgType "async" for queue publishes, event emissions, background jobs.
6. Add fragment nodes for conditional or looping logic, positioned to cover their messages.
7. All node and edge IDs must be unique and descriptive.`;

      case "erd":
      case "erd":
        return `You are an expert database architect specializing in Entity-Relationship Diagrams.

Your task is to generate ERD diagrams in the style of SQLhabit's schema visualizer.

NODE FORMAT:
- type: "entity" for all tables
- label: "table_name" (use "schema.table_name" format if there's a schema prefix)
- attributes: array of columns in format "column_name: type"
  - Mark primary keys with "🔑 id: integer" 
  - Keep to max 8 columns per table
  - Common types: integer, text, boolean, datetime, float, JSON, date, uuid

EDGE FORMAT:
- source/target: table node IDs
- type: "association" for all FK relationships
- multiplicity: REQUIRED on every edge — use crow's foot notation values:
  - { source: "1", target: "0..*" } → one-to-many (most FK relationships)
  - { source: "1", target: "1" }   → one-to-one
  - { source: "1", target: "1..*" } → one-to-many mandatory
  - { source: "0..1", target: "0..*" } → optional one-to-many
  The UI renders these as crow's foot symbols — do NOT use text labels, use multiplicity only.
- Do NOT set label on ERD edges (the crow's foot markers replace text labels)

POSITION RULES — same LR grid as class diagrams:
- Central tables (most FK references) at x=580, y=320
- Tables referencing the central table spread around it
- Use x=60,320,580,840,1100 and y=60,320,580,840
- No two tables at the same position

Guidelines:
1. Identify all entities (tables) from requirements
2. Every table must have an "id" primary key
3. Foreign keys should be "referenced_table_id: integer"
4. Include created_at/updated_at where relevant
5. Ensure all node and edge IDs are unique`;

      case "flowchart":
        return `You are an expert software architect specializing in flowcharts.

Your task is to generate clear, readable flowcharts from requirements.

NODE TYPES — use exactly these string values:
- "terminal"  : Start/End oval — use for "Start" and "End" nodes only
- "process"   : Rectangle — use for actions/steps
- "decision"  : Diamond — use for yes/no branches
- "io"        : Parallelogram — use for input/output operations

POSITION RULES — strict top-to-bottom, center-aligned:
- ALL nodes on the main flow share the SAME x coordinate: x=320
- Start at y=60, increment y by 140 for each step on the main flow
- "No" branch nodes go to x=560 (right side), keeping the same y as the diamond
- "Yes" branch continues downward at x=320
- Merge nodes return to x=320
- CRITICAL: Every node on the main vertical flow MUST have x=320 exactly. No slight offsets.

EDGE RULES:
- type: "association" for all edges
- Edges use smoothstep (right-angled) routing — no curves
- For decision diamonds, use sourceHandle to bind exits:
  - "Yes" path: sourceHandle = "yes"  (exits from the BOTTOM of the diamond)
  - "No" path:  sourceHandle = "no"   (exits from the RIGHT of the diamond)
- Label "Yes" edges with label: "Yes" and "No" edges with label: "No"
- Keep labels short (1-3 words max)

Guidelines:
1. Always start with a "terminal" node labeled "Start" at x=320, y=60
2. Always end with a "terminal" node labeled "End"
3. Use "decision" nodes for any conditional logic
4. Keep the flow readable — max 12 nodes
5. All node IDs must be unique`;

      case "deployment":
        return `You are an expert software architect specializing in UML Deployment Diagrams.

Your task is to generate deployment diagrams showing physical infrastructure and software deployment.

NODE TYPES — use exactly these string values:
- "node"                 : physical/virtual machine, server, cloud node (the top-level container)
- "executionEnvironment" : runtime environment inside a node (JVM, Docker, OS, etc.)
- "component"            : a deployed software component (API, service module, etc.)
- "artifact"             : a deployed software artifact (jar, war, exe, config file, etc.)
- "interface"            : a provided/required interface (lollipop notation)

CRITICAL — NESTING via "children" array:
Every top-level "node" MUST contain child nodes. The whole point of a deployment diagram is showing WHAT runs WHERE.
- A "node"'s data.children lists the IDs of executionEnvironments, components, and artifacts directly inside it
- An "executionEnvironment"'s data.children lists the IDs of components and artifacts inside it
- ALL child nodes MUST also appear as their own entries in the top-level "nodes" array
- Child positions are RELATIVE to their parent's top-left corner

CONCRETE EXAMPLE — a web server with a runtime and an artifact:
{
  "nodes": [
    {
      "id": "web_server",
      "type": "node",
      "position": { "x": 60, "y": 60 },
      "data": {
        "label": "Web Server",
        "stereotype": "node",
        "children": ["tomcat_runtime", "api_component"]
      }
    },
    {
      "id": "tomcat_runtime",
      "type": "executionEnvironment",
      "position": { "x": 16, "y": 50 },
      "data": {
        "label": "Tomcat 10",
        "children": ["app_war"]
      }
    },
    {
      "id": "app_war",
      "type": "artifact",
      "position": { "x": 12, "y": 44 },
      "data": { "label": "app.war" }
    },
    {
      "id": "api_component",
      "type": "component",
      "position": { "x": 16, "y": 200 },
      "data": { "label": "REST API" }
    }
  ]
}
Notice: "tomcat_runtime" and "api_component" are children of "web_server", "app_war" is a child of "tomcat_runtime". ALL four nodes appear in the flat nodes array.

POSITION RULES:
Top-level "node" containers — place on a loose grid, no overlap:
  x = 60, 420, 780  (columns, 360px apart)
  y = 60, 380       (rows, 320px apart)

Inside a "node" container, children stack vertically starting at y=50 (below the header):
  First child:  x=16, y=50
  Second child: x=16, y=150
  Third child:  x=16, y=250

Inside an executionEnvironment, nested items stack at:
  First item:  x=12, y=44
  Second item: x=12, y=104

Container ("node") size must accommodate children — use minWidth=280, and height = 60 + (number_of_children * 110)

LABEL LENGTH: Keep all labels SHORT (max 4 words). Long labels cause overlap. Use abbreviations:
- "React Frontend" not "Frontend Web Application (React + TypeScript)"
- "Auth Service" not "Authentication and Authorization Service"
- "app.jar" not "application-deployment-artifact.jar"

EDGES:
- Only between top-level "node" containers
- type: "association"
- label: protocol (HTTPS, TCP, JDBC, gRPC, etc.)

OUTPUT exactly 4-6 top-level "node" containers, each with at least 1-2 children inside.
Do NOT use "device" — the correct type name is "node".
Do NOT create empty containers — every "node" must have children showing what is deployed inside it.
Ensure all IDs are unique snake_case strings.`;
      case "component":
        return `You are an expert software architect specializing in UML Component diagrams.

Your task is to generate well-structured component diagrams that show how the system is wired together.

NODE DIMENSIONS: Every component node is 240px wide.

STRICT POSITION RULES — LEFT TO RIGHT LAYOUT:
Arrange nodes in columns from left to right based on dependencies (requirer → provider).
- Column 0 (x=60):   Client applications, entry points
- Column 1 (x=360):  API Gateways, edge components
- Column 2 (x=660):  Core services, business logic
- Column 3 (x=960):  Data access, integration adapters
- Column 4 (x=1260): External systems, databases

Within each column, stack nodes vertically with 300px between them: y=60, 360, 660, 960...
No two nodes may share the same (x, y) position. Generate at most 8-10 component nodes.

NODE TYPES:
- "component" : Main logical module. Rendered as a UML component box with provided/required interface sections.
  - data.attributes → PROVIDED interfaces (lollipop ○). Services this component OFFERS.
  - data.methods    → REQUIRED interfaces (socket ◑). Services this component NEEDS.
- "boundary"  : System boundary / group box. A resizable dashed-border container that visually groups related components.
  - Use to group components by domain (e.g. "Frontend", "Backend", "AI Workers", "Supabase").
  - Set data.label to the boundary name.
  - Set data.color to a hex color (e.g. "#6366f1" for indigo, "#10b981" for green, "#f59e0b" for amber).
  - Position: place at the top-left of the group it contains, large enough to cover all members.
  - Boundary nodes do NOT need edges; they are visual overlays only (zIndex: -1).

EDGE RULES:
- type: "dependency" for all component-to-component connections.
- Edges use smoothstep (right-angled) routing — no curved bezier lines.
- When connecting to a specific interface, set sourceHandle and targetHandle:
  - sourceHandle: "provided-<InterfaceName>" (e.g. "provided-IProcessPayment")
  - targetHandle: "required-<InterfaceName>" (e.g. "required-IBankGateway")
  This wires the edge to the exact interface row on the node, not just the node border.
- label: the interface name being connected (e.g. "IProcessPayment").

EXAMPLE:
{
  "id": "edge_payment",
  "source": "checkout_service",
  "target": "payment_service",
  "type": "dependency",
  "label": "IProcessPayment",
  "sourceHandle": "required-IProcessPayment",
  "targetHandle": "provided-IProcessPayment"
}

Guidelines:
1. Focus on high-level modular architecture, not class-level details.
2. Every component should have at least one provided OR required interface.
3. Wire required interfaces to the matching provided interfaces of other components.
4. Add boundary nodes to group components by architectural layer or domain.
5. All node and edge IDs must be unique and descriptive.`;

      default:
        return "You are an expert software architect.";
    }
  }

  /**
   * Validate diagram structure
   */
  validateDiagram(diagram: Diagram): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unique node IDs
    const nodeIds = new Set<string>();
    for (const node of diagram.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // Check for unique edge IDs
    const edgeIds = new Set<string>();
    for (const edge of diagram.edges) {
      if (edgeIds.has(edge.id)) {
        errors.push(`Duplicate edge ID: ${edge.id}`);
      }
      edgeIds.add(edge.id);
    }

    // Check that edge sources and targets reference existing nodes
    for (const edge of diagram.edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(
          `Edge ${edge.id} references non-existent source node: ${edge.source}`,
        );
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(
          `Edge ${edge.id} references non-existent target node: ${edge.target}`,
        );
      }
    }

    // Check for valid positions (just ensure they are finite numbers)
    for (const node of diagram.nodes) {
      if (!isFinite(node.position.x) || !isFinite(node.position.y)) {
        errors.push(
          `Node ${node.id} has invalid position: (${node.position.x}, ${node.position.y})`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Suggest diagram updates based on requirement changes
   * Requirements: 10.1, 10.3
   */
  async suggestDiagramUpdates(
    reqDelta: import("./json-patch").JSONPatch,
    currentDiagram: Diagram,
    requirements: Requirement[],
  ): Promise<DiagramSuggestion[]> {
    const systemPrompt = `You are an expert software architect analyzing requirement changes to suggest diagram updates.

Your task is to analyze a requirement change (JSON Patch) and suggest corresponding diagram modifications.

Guidelines:
1. Analyze the requirement change to understand what was added, removed, or modified
2. Suggest diagram updates that maintain consistency with the requirements
3. Provide clear reasoning for each suggestion
4. Assign confidence scores (0.0 to 1.0) based on how certain you are about the suggestion
5. Only suggest changes that are directly related to the requirement modification

Suggestion Types:
- add_node: Add a new class, entity, or component
- remove_node: Remove an existing node
- add_edge: Add a new relationship between nodes
- remove_edge: Remove an existing relationship
- update_node: Modify node properties (attributes, methods, label)

Return suggestions with high confidence (>0.7) for direct mappings, medium confidence (0.5-0.7) for inferred changes, and low confidence (<0.5) for speculative changes.`;

    const prompt = `Analyze this requirement change and suggest diagram updates:

**Requirement Change (JSON Patch):**
Operation: ${reqDelta.op}
Path: ${reqDelta.path}
${reqDelta.value ? `New Value: ${JSON.stringify(reqDelta.value, null, 2)}` : ""}

**Current Requirements:**
${requirements
  .map(
    (req) => `
${req.id}: ${req.title}
${req.description}
Type: ${req.type}, Priority: ${req.priority}
`,
  )
  .join("\n")}

**Current Diagram:**
Type: ${currentDiagram.type}
Nodes: ${currentDiagram.nodes.map((n) => `${n.id} (${n.data.label})`).join(", ")}
Edges: ${currentDiagram.edges.map((e) => `${e.source} -> ${e.target} (${e.type})`).join(", ")}

Suggest diagram updates that maintain consistency with the requirement change. Return a JSON array of suggestions.`;

    try {
      // Accept all field naming conventions the AI may return
      const SuggestionItemSchema = z.object({
        action: z.enum(["add_node", "remove_node", "add_edge", "remove_edge", "update_node"]).optional(),
        type: z.enum(["add_node", "remove_node", "add_edge", "remove_edge", "update_node"]).optional(),
        target_id: z.string().optional(),
        target: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
        node_id: z.string().optional(),   // AI sometimes uses node_id directly
        data: z.record(z.string(), z.any()).optional(),
        properties: z.record(z.string(), z.any()).optional(),
        details: z.record(z.string(), z.any()).optional(),
        changes: z.record(z.string(), z.any()).optional(), // AI sometimes uses changes
        suggested_value: z.any().optional(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(1),
      });

      const SuggestionsSchema = z.object({
        suggestions: z.array(SuggestionItemSchema),
      });

      const result = await generateAIObject(
        "architecture",
        prompt,
        SuggestionsSchema,
        systemPrompt,
      );

      return result.suggestions
        .filter((s) => s.confidence >= 0.3)
        .map((s) => {
          const action = s.action ?? s.type;

          // Normalize target — may be string or object with node_id/edge/node/id
          const rawTarget = s.target_id ?? s.target ?? s.node_id;
          const target_id: string | undefined =
            typeof rawTarget === "string"
              ? rawTarget
              : typeof rawTarget === "object" && rawTarget !== null
                ? String((rawTarget as any).node_id ?? (rawTarget as any).edge ?? (rawTarget as any).node ?? (rawTarget as any).id ?? "")
                : (s.details as any)?.node ?? (s.details as any)?.edge;

          // Merge all data fields
          const data = {
            ...(s.data ?? {}),
            ...(s.properties ?? {}),
            ...(s.changes ?? {}),
            ...(s.details ?? {}),
            ...(s.suggested_value !== undefined ? { value: s.suggested_value } : {}),
          };

          if (!action || !target_id) return null;
          return { action, target_id, data, reasoning: s.reasoning, confidence: s.confidence };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
    } catch (error) {
      console.error("Failed to suggest diagram updates", error);
      throw new Error(
        `Diagram update suggestion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Reverse engineer requirements from diagram changes
   * Requirements: 10.2, 10.3
   */
  async diagramToRequirements(
    diagram: Diagram,
    previousDiagram?: Diagram,
  ): Promise<RequirementSuggestion[]> {
    const systemPrompt = `You are an expert software architect analyzing diagram changes to suggest requirement updates.

Your task is to reverse engineer requirement changes from diagram modifications.

Guidelines:
1. Analyze what changed in the diagram (new nodes, removed nodes, modified relationships)
2. Infer what requirements should be added, modified, or removed
3. Provide clear reasoning for each suggestion
4. Assign confidence scores (0.0 to 1.0) based on how certain you are about the inference
5. Focus on functional requirements that the diagram elements represent

Suggestion Types:
- add_requirement: Suggest a new requirement based on new diagram elements
- update_requirement: Suggest modifications to existing requirements
- remove_requirement: Suggest removing requirements that are no longer represented

Return suggestions with high confidence (>0.7) for clear mappings, medium confidence (0.5-0.7) for inferred changes, and low confidence (<0.5) for speculative changes.

IMPORTANT: You must return a JSON object with a "suggestions" array. Each suggestion must have all required fields.`;

    let prompt = `Analyze this diagram and suggest requirement changes:

**Current Diagram:**
Type: ${diagram.type}
Nodes:
${diagram.nodes
  .map(
    (n) => `
  ${n.id}: ${n.data.label} (${n.type})
  ${n.data.attributes ? `Attributes: ${n.data.attributes.join(", ")}` : ""}
  ${n.data.methods ? `Methods: ${n.data.methods.join(", ")}` : ""}
`,
  )
  .join("\n")}

Edges:
${diagram.edges
  .map(
    (e) => `
  ${e.id}: ${e.source} -> ${e.target} (${e.type})
  ${e.label ? `Label: ${e.label}` : ""}
`,
  )
  .join("\n")}`;

    if (previousDiagram) {
      prompt += `\n\n**Previous Diagram:**
Type: ${previousDiagram.type}
Nodes: ${previousDiagram.nodes.map((n) => `${n.id} (${n.data.label})`).join(", ")}
Edges: ${previousDiagram.edges.map((e) => `${e.source} -> ${e.target} (${e.type})`).join(", ")}

Analyze the differences between the current and previous diagram to suggest requirement changes.`;
    } else {
      prompt += `\n\nThis is a new diagram. Suggest requirements that should exist based on the diagram structure.`;
    }

    prompt += `\n\nReturn a JSON object with this exact structure:
{
  "suggestions": [
    {
      "action": "add_requirement" | "update_requirement" | "remove_requirement",
      "requirement_id": "optional string for update/remove actions",
      "title": "string",
      "description": "string",
      "type": "functional" | "non-functional",
      "priority": "low" | "medium" | "high",
      "reasoning": "string explaining why this suggestion is made",
      "confidence": 0.0 to 1.0,
      "affected_nodes": ["array", "of", "node", "ids"]
    }
  ]
}

If there are no suggestions, return: {"suggestions": []}`;

    try {
      const RequirementSuggestionsSchema = z.object({
        suggestions: z.array(
          z.object({
            action: z.enum([
              "add_requirement",
              "update_requirement",
              "remove_requirement",
            ]),
            requirement_id: z.string().optional(),
            title: z.string(),
            description: z.string(),
            type: z.enum(["functional", "non-functional"]),
            priority: z.enum(["low", "medium", "high"]),
            reasoning: z.string(),
            confidence: z.number().min(0).max(1),
            affected_nodes: z.array(z.string()),
          }),
        ),
      });

      const result = await generateAIObject(
        "architecture",
        prompt,
        RequirementSuggestionsSchema,
        systemPrompt,
      );

      return result.suggestions.map((s) => ({
        action: s.action,
        requirement_id: s.requirement_id,
        title: s.title,
        description: s.description,
        type: s.type,
        priority: s.priority,
        reasoning: s.reasoning,
        confidence: s.confidence,
        affected_nodes: s.affected_nodes,
      }));
    } catch (error) {
      console.error(
        "Failed to reverse engineer requirements from diagram",
        error,
      );
      
      // If validation failed, return empty suggestions instead of throwing
      if (error instanceof Error && error.message.includes("Invalid input")) {
        console.warn("AI returned invalid format, returning empty suggestions");
        return [];
      }
      
      throw new Error(
        `Diagram to requirements conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Diagram suggestion interface
 */
export interface DiagramSuggestion {
  action:
    | "add_node"
    | "remove_node"
    | "add_edge"
    | "remove_edge"
    | "update_node";
  target_id: string;
  data: Record<string, any>;
  reasoning: string;
  confidence: number;
}

/**
 * Requirement suggestion interface
 */
export interface RequirementSuggestion {
  action: "add_requirement" | "update_requirement" | "remove_requirement";
  requirement_id?: string;
  title: string;
  description: string;
  type: "functional" | "non-functional";
  priority: "low" | "medium" | "high";
  reasoning: string;
  confidence: number;
  affected_nodes: string[];
}
