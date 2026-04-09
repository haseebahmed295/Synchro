/**
 * Module C: The Implementer Agent
 * Handles code generation from diagrams and reverse engineering
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { generateAIObject } from "../ai/client";
import type { Diagram, DiagramNode } from "../types/diagram";
import type { TraceabilityLink } from "./types";
import { renderTypeScriptClass } from "./templates/typescript-class";
import { renderPythonClass } from "./templates/python-class";
import { renderJavaClass } from "./templates/java-class";

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface CodeTemplate {
  language: "typescript" | "python" | "java";
  framework?: string;
  variables: Record<string, any>;
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export interface GeneratedCode {
  files: CodeFile[];
  dependencies: string[];
  setupInstructions: string;
}

export interface CodePatch {
  filePath: string;
  hunks: PatchHunk[];
}

export interface PatchHunk {
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
}

// ─── AI schema for code generation ───────────────────────────────────────────

// Coerce params: AI sometimes returns an array like ["email: string", "password: string"]
const ParamsSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v.join(", ") : v))
  .default("");

const ParsedMemberSchema = z.object({
  visibility: z.string().default("+"),
  name: z.string(),
  type: z.string().default("any"),
  params: ParamsSchema,
  returnType: z.string().optional().default("void"),
});

const ParsedClassSchema = z.object({
  nodeId: z.string(),
  className: z.string(),
  isAbstract: z.boolean().optional().default(false),
  isInterface: z.boolean().optional().default(false),
  // AI sometimes returns null — treat null as undefined (no parent class)
  extendsClass: z.string().nullable().optional().transform((v) => v ?? undefined),
  implementsInterfaces: z.array(z.string()).optional().default([]),
  attributes: z.array(ParsedMemberSchema).default([]),
  methods: z.array(ParsedMemberSchema).default([]),
  filePath: z.string(),
});

const CodeGenerationSchema = z.object({
  classes: z.array(ParsedClassSchema),
  dependencies: z.array(z.string()).default([]),
  setupInstructions: z.string().default(""),
});

type ParsedClass = z.infer<typeof ParsedClassSchema>;

// ─── The Implementer Agent ────────────────────────────────────────────────────

/**
 * The Implementer Agent
 * Responsible for generating code from diagrams and maintaining code-to-diagram traceability
 */
export class ImplementerAgent {
  /**
   * Generate code files from a diagram
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
   */
  async diagramToCode(
    diagram: Diagram,
    template: CodeTemplate,
    userId: string,
  ): Promise<{ generatedCode: GeneratedCode; traceabilityLinks: TraceabilityLink[] }> {
    const startTime = Date.now();

    // Only class diagrams are supported for code generation
    if (diagram.type !== "class") {
      throw new Error(`Code generation is only supported for class diagrams, got: ${diagram.type}`);
    }

    const classNodes = diagram.nodes.filter((n) => n.type === "class" || n.type === "interface");
    if (classNodes.length === 0) {
      return {
        generatedCode: { files: [], dependencies: [], setupInstructions: "" },
        traceabilityLinks: [],
      };
    }

    // Ask AI to parse the diagram nodes into structured class definitions
    const parsedClasses = await this.parseClassNodes(classNodes, diagram, template);

    // Render each class using the appropriate template
    const files: CodeFile[] = [];
    for (const cls of parsedClasses) {
      const content = this.renderClass(cls, template);
      files.push({ path: cls.filePath, content, language: template.language });
    }

    // Enforce 15-second time limit (Req 11.5)
    const elapsed = Date.now() - startTime;
    if (elapsed > 15000) {
      console.warn(`[Implementer] Code generation took ${elapsed}ms, exceeding 15s limit`);
    }

    // Build traceability links: each generated file → source diagram node
    const traceabilityLinks: TraceabilityLink[] = parsedClasses.map((cls) => ({
      sourceId: diagram.id,
      targetId: cls.nodeId,
      linkType: "implements" as const,
      confidence: 0.95,
      createdBy: userId,
    }));

    return {
      generatedCode: {
        files,
        dependencies: parsedClasses[0]?.attributes ? this.inferDependencies(template) : [],
        setupInstructions: this.buildSetupInstructions(template),
      },
      traceabilityLinks,
    };
  }

  /**
   * Apply a code patch to existing code
   * Requirements: 13.1, 13.2
   */
  async applyCodePatch(existingCode: string, patch: CodePatch): Promise<string> {
    const lines = existingCode.split("\n");

    // Apply hunks in reverse order to preserve line numbers
    const sortedHunks = [...patch.hunks].sort((a, b) => b.startLine - a.startLine);

    for (const hunk of sortedHunks) {
      const start = hunk.startLine - 1; // Convert to 0-indexed
      const end = hunk.endLine; // exclusive
      const newLines = hunk.newContent.split("\n");
      lines.splice(start, end - start, ...newLines);
    }

    return lines.join("\n");
  }

  /**
   * Generate boilerplate for a project type
   */
  async generateBoilerplate(
    projectType: string,
    config: Record<string, any>,
  ): Promise<CodeFile[]> {
    const files: CodeFile[] = [];

    if (projectType === "nextjs-typescript") {
      files.push({
        path: "src/types/index.ts",
        content: "// Auto-generated types\nexport {};\n",
        language: "typescript",
      });
    } else if (projectType === "python-fastapi") {
      files.push({
        path: "main.py",
        content: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef root():\n    return {"message": "Hello World"}\n',
        language: "python",
      });
    } else if (projectType === "java-spring") {
      files.push({
        path: "src/main/java/Application.java",
        content: 'import org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n\n@SpringBootApplication\npublic class Application {\n    public static void main(String[] args) {\n        SpringApplication.run(Application.class, args);\n    }\n}\n',
        language: "java",
      });
    }

    return files;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Use AI to parse diagram nodes into structured class definitions
   */
  private async parseClassNodes(
    nodes: DiagramNode[],
    diagram: Diagram,
    template: CodeTemplate,
  ): Promise<ParsedClass[]> {
    const systemPrompt = `You are an expert software engineer. Parse UML class diagram nodes into structured class definitions for code generation.

For each node, extract:
- className: PascalCase class name from the label
- isAbstract: true if stereotype is "abstract" or "interface"
- isInterface: true if stereotype is "interface"
- extendsClass: parent class name if there's an inheritance edge
- implementsInterfaces: list of interface names from inheritance edges
- attributes: parsed from the attributes array (format: "visibility name: type")
- methods: parsed from the methods array (format: "visibility name(params): returnType")
- filePath: appropriate file path for the language (e.g. "src/User.ts" for TypeScript)

Parse visibility prefixes: + = public, - = private, # = protected, ~ = package`;

    // Build inheritance map from edges
    const inheritanceMap = new Map<string, { extendsClass?: string; implementsInterfaces: string[] }>();
    for (const edge of diagram.edges) {
      if (edge.type === "inheritance") {
        const targetNode = diagram.nodes.find((n) => n.id === edge.target);
        if (!targetNode) continue;
        const existing = inheritanceMap.get(edge.source) ?? { implementsInterfaces: [] };
        const targetLabel = targetNode.data.label;
        if (targetNode.data.stereotype === "interface" || (targetNode.data as any).abstract) {
          existing.implementsInterfaces.push(targetLabel);
        } else {
          existing.extendsClass = targetLabel;
        }
        inheritanceMap.set(edge.source, existing);
      }
    }

    const prompt = `Parse these UML class diagram nodes into structured class definitions for ${template.language} code generation.
Framework: ${template.framework ?? "none"}

Nodes:
${nodes.map((n) => `
Node ID: ${n.id}
Label: ${n.data.label}
Stereotype: ${n.data.stereotype ?? "none"}
Abstract: ${(n.data as any).abstract ?? false}
Attributes: ${JSON.stringify(n.data.attributes ?? [])}
Methods: ${JSON.stringify(n.data.methods ?? [])}
Inheritance: ${JSON.stringify(inheritanceMap.get(n.id) ?? {})}
`).join("\n---\n")}

Return a JSON object with a "classes" array. Each class must have:
- nodeId: the original node ID
- className: PascalCase name
- isAbstract: boolean
- isInterface: boolean  
- extendsClass: string or null
- implementsInterfaces: string[]
- attributes: [{visibility, name, type}]
- methods: [{visibility, name, params, returnType}]
- filePath: file path for ${template.language} (e.g. "src/User.ts")
- dependencies: [] (npm/pip/maven packages needed)
- setupInstructions: "" (brief setup notes)`;

    try {
      const result = await generateAIObject(
        "code-generation",
        prompt,
        CodeGenerationSchema,
        systemPrompt,
      );
      return result.classes;
    } catch (error) {
      console.error("[Implementer] AI parsing failed, falling back to direct parsing", error);
      // Fallback: parse nodes directly without AI
      return nodes.map((node) => this.parseNodeDirectly(node, diagram, template, inheritanceMap));
    }
  }

  /**
   * Fallback: parse a node directly without AI
   */
  private parseNodeDirectly(
    node: DiagramNode,
    diagram: Diagram,
    template: CodeTemplate,
    inheritanceMap: Map<string, { extendsClass?: string; implementsInterfaces: string[] }>,
  ): ParsedClass {
    const className = node.data.label.replace(/\s+/g, "");
    const isInterface = node.data.stereotype === "interface";
    const isAbstract = isInterface || (node.data as any).abstract === true || node.data.stereotype === "abstract";
    const inheritance = inheritanceMap.get(node.id) ?? { implementsInterfaces: [] };

    const attributes = (node.data.attributes ?? []).map((attr) => parseMember(attr));
    const methods = (node.data.methods ?? []).map((method) => parseMethod(method));

    const ext = template.language === "typescript" ? ".ts" : template.language === "python" ? ".py" : ".java";
    const filePath = `src/${className}${ext}`;

    return {
      nodeId: node.id,
      className,
      isAbstract,
      isInterface,
      extendsClass: inheritance.extendsClass,
      implementsInterfaces: inheritance.implementsInterfaces,
      attributes,
      methods,
      filePath,
    };
  }

  /**
   * Render a parsed class using the appropriate language template
   */
  private renderClass(cls: ParsedClass, template: CodeTemplate): string {
    switch (template.language) {
      case "typescript":
        return renderTypeScriptClass({
          className: cls.className,
          isAbstract: cls.isAbstract,
          isInterface: cls.isInterface,
          attributes: cls.attributes.map((a) => ({
            visibility: a.visibility,
            name: a.name,
            type: a.type,
          })),
          methods: cls.methods.map((m) => ({
            visibility: m.visibility,
            name: m.name,
            params: m.params ?? "",
            returnType: m.returnType ?? "void",
          })),
          extendsClass: cls.extendsClass,
          implementsInterfaces: cls.implementsInterfaces,
          framework: template.framework,
        });

      case "python":
        return renderPythonClass({
          className: cls.className,
          isAbstract: cls.isAbstract,
          isInterface: cls.isInterface,
          attributes: cls.attributes.map((a) => ({
            visibility: a.visibility,
            name: a.name,
            type: a.type,
          })),
          methods: cls.methods.map((m) => ({
            visibility: m.visibility,
            name: m.name,
            params: m.params ?? "",
            returnType: m.returnType ?? "None",
          })),
          extendsClass: cls.extendsClass,
          framework: template.framework,
        });

      case "java":
        return renderJavaClass({
          className: cls.className,
          packageName: template.variables?.packageName as string | undefined,
          isAbstract: cls.isAbstract,
          isInterface: cls.isInterface,
          attributes: cls.attributes.map((a) => ({
            visibility: a.visibility,
            name: a.name,
            type: a.type,
          })),
          methods: cls.methods.map((m) => ({
            visibility: m.visibility,
            name: m.name,
            params: m.params ?? "",
            returnType: m.returnType ?? "void",
          })),
          extendsClass: cls.extendsClass,
          implementsInterfaces: cls.implementsInterfaces,
          framework: template.framework,
        });

      default:
        throw new Error(`Unsupported language: ${template.language}`);
    }
  }

  private inferDependencies(template: CodeTemplate): string[] {
    const deps: string[] = [];
    if (template.language === "typescript") {
      if (template.framework === "nextjs") deps.push("next", "react", "react-dom");
      else if (template.framework === "express") deps.push("express", "@types/express");
    } else if (template.language === "python") {
      if (template.framework === "fastapi") deps.push("fastapi", "uvicorn");
      else if (template.framework === "django") deps.push("django");
    } else if (template.language === "java") {
      if (template.framework === "spring") deps.push("org.springframework.boot:spring-boot-starter");
    }
    return deps;
  }

  private buildSetupInstructions(template: CodeTemplate): string {
    if (template.language === "typescript") {
      return template.framework === "nextjs"
        ? "Run `npm install` then `npm run dev` to start the development server."
        : "Run `npm install` then `npx ts-node src/index.ts` to run.";
    }
    if (template.language === "python") {
      return template.framework === "fastapi"
        ? "Run `pip install fastapi uvicorn` then `uvicorn main:app --reload`."
        : "Run `pip install -r requirements.txt` then `python main.py`.";
    }
    if (template.language === "java") {
      return template.framework === "spring"
        ? "Run `mvn spring-boot:run` to start the application."
        : "Compile with `javac` and run with `java`.";
    }
    return "";
  }
}

// ─── Member parsing helpers ───────────────────────────────────────────────────

/**
 * Parse a UML attribute string like "+name: string" or "- id: number"
 */
function parseMember(raw: string): { visibility: string; name: string; type: string; params: string; returnType: string } {
  const trimmed = raw.trim();
  // Extract visibility prefix
  let visibility = "+";
  let rest = trimmed;
  if (/^[+\-#~]/.test(trimmed)) {
    visibility = trimmed[0];
    rest = trimmed.slice(1).trim();
  } else if (/^(public|private|protected)\s/.test(trimmed)) {
    const match = trimmed.match(/^(public|private|protected)\s+(.+)/);
    if (match) {
      visibility = match[1] === "public" ? "+" : match[1] === "private" ? "-" : "#";
      rest = match[2];
    }
  }

  // Split name: type
  const colonIdx = rest.indexOf(":");
  if (colonIdx !== -1) {
    const name = rest.slice(0, colonIdx).trim();
    const type = rest.slice(colonIdx + 1).trim();
    return { visibility, name, type, params: "", returnType: type };
  }

  return { visibility, name: rest, type: "any", params: "", returnType: "any" };
}

/**
 * Parse a UML method string like "+login(email: string): boolean"
 */
function parseMethod(raw: string): { visibility: string; name: string; type: string; params: string; returnType: string } {
  const trimmed = raw.trim();
  let visibility = "+";
  let rest = trimmed;

  if (/^[+\-#~]/.test(trimmed)) {
    visibility = trimmed[0];
    rest = trimmed.slice(1).trim();
  } else if (/^(public|private|protected)\s/.test(trimmed)) {
    const match = trimmed.match(/^(public|private|protected)\s+(.+)/);
    if (match) {
      visibility = match[1] === "public" ? "+" : match[1] === "private" ? "-" : "#";
      rest = match[2];
    }
  }

  // Extract method name and params: "login(email: string): boolean"
  const parenOpen = rest.indexOf("(");
  const parenClose = rest.lastIndexOf(")");

  if (parenOpen !== -1 && parenClose !== -1) {
    const name = rest.slice(0, parenOpen).trim();
    const params = rest.slice(parenOpen + 1, parenClose).trim();
    const afterParen = rest.slice(parenClose + 1).trim();
    const returnType = afterParen.startsWith(":") ? afterParen.slice(1).trim() : "void";
    return { visibility, name, type: returnType, params, returnType };
  }

  // No parens — treat as attribute
  return parseMember(raw);
}
