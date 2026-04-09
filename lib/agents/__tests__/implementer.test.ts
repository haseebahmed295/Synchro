/**
 * Unit Tests for Implementer Agent
 * Tests code generation from class diagrams, template rendering, and syntax validity
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "../../types/diagram";
import { ImplementerAgent } from "../implementer";
import type { CodeTemplate } from "../implementer";

// Mock the AI client
vi.mock("../../ai/client", () => ({
  generateAIObject: vi.fn(),
}));

import { generateAIObject } from "../../ai/client";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUserId = "user-123";

const simpleClassDiagram: Diagram = {
  id: "diagram-001",
  type: "class",
  nodes: [
    {
      id: "USER_CLASS",
      type: "class",
      position: { x: 100, y: 100 },
      data: {
        label: "User",
        attributes: ["+id: string", "+email: string", "-password: string"],
        methods: ["+authenticate(password: string): boolean", "+updateProfile(data: any): void"],
        stereotype: "entity",
      },
    },
    {
      id: "AUTH_SERVICE",
      type: "class",
      position: { x: 400, y: 100 },
      data: {
        label: "AuthService",
        attributes: [],
        methods: ["+login(email: string, password: string): string", "+logout(token: string): void"],
        stereotype: "service",
      },
    },
  ],
  edges: [
    {
      id: "EDGE_1",
      source: "AUTH_SERVICE",
      target: "USER_CLASS",
      type: "dependency",
    },
  ],
};

const mockAIResponse = {
  classes: [
    {
      nodeId: "USER_CLASS",
      className: "User",
      isAbstract: false,
      isInterface: false,
      extendsClass: undefined,
      implementsInterfaces: [],
      attributes: [
        { visibility: "+", name: "id", type: "string", params: "", returnType: "string" },
        { visibility: "+", name: "email", type: "string", params: "", returnType: "string" },
        { visibility: "-", name: "password", type: "string", params: "", returnType: "string" },
      ],
      methods: [
        { visibility: "+", name: "authenticate", type: "boolean", params: "password: string", returnType: "boolean" },
        { visibility: "+", name: "updateProfile", type: "void", params: "data: any", returnType: "void" },
      ],
      filePath: "src/User.ts",
    },
    {
      nodeId: "AUTH_SERVICE",
      className: "AuthService",
      isAbstract: false,
      isInterface: false,
      extendsClass: undefined,
      implementsInterfaces: [],
      attributes: [],
      methods: [
        { visibility: "+", name: "login", type: "string", params: "email: string, password: string", returnType: "string" },
        { visibility: "+", name: "logout", type: "void", params: "token: string", returnType: "void" },
      ],
      filePath: "src/AuthService.ts",
    },
  ],
  dependencies: ["typescript"],
  setupInstructions: "Run npm install",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ImplementerAgent", () => {
  let agent: ImplementerAgent;

  beforeEach(() => {
    agent = new ImplementerAgent();
    vi.clearAllMocks();
  });

  // ── 18.1: Code generation from class diagrams ──────────────────────────────

  describe("diagramToCode - TypeScript", () => {
    it("generates TypeScript files for each class node (Req 11.1, 11.3)", async () => {
      vi.mocked(generateAIObject).mockResolvedValueOnce(mockAIResponse);

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(generatedCode.files).toHaveLength(2);
      expect(generatedCode.files[0].language).toBe("typescript");
      expect(generatedCode.files[0].path).toBe("src/User.ts");
      expect(generatedCode.files[1].path).toBe("src/AuthService.ts");
    });

    it("generates valid TypeScript class syntax with correct visibility modifiers", async () => {
      vi.mocked(generateAIObject).mockResolvedValueOnce(mockAIResponse);

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      const userFile = generatedCode.files.find((f) => f.path === "src/User.ts");
      expect(userFile).toBeDefined();
      expect(userFile!.content).toContain("export class User");
      expect(userFile!.content).toContain("public id: string");
      expect(userFile!.content).toContain("private password: string");
      expect(userFile!.content).toContain("public authenticate(password: string): boolean");
    });

    it("generates TypeScript with framework-specific imports for nextjs (Req 11.4)", async () => {
      vi.mocked(generateAIObject).mockResolvedValueOnce(mockAIResponse);

      const template: CodeTemplate = { language: "typescript", framework: "nextjs", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      const userFile = generatedCode.files.find((f) => f.path === "src/User.ts");
      expect(userFile!.content).toContain("from 'next/server'");
    });

    it("includes dependencies in generated code output", async () => {
      vi.mocked(generateAIObject).mockResolvedValueOnce(mockAIResponse);

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(generatedCode.dependencies).toBeInstanceOf(Array);
      expect(generatedCode.setupInstructions).toBeTruthy();
    });

    it("creates traceability links for each generated file (Req 11.6)", async () => {
      vi.mocked(generateAIObject).mockResolvedValueOnce(mockAIResponse);

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const { traceabilityLinks } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(traceabilityLinks).toHaveLength(2);
      expect(traceabilityLinks[0].linkType).toBe("implements");
      expect(traceabilityLinks[0].sourceId).toBe("diagram-001");
      expect(traceabilityLinks[0].confidence).toBeGreaterThan(0.9);
    });
  });

  describe("diagramToCode - Python", () => {
    it("generates Python files with .py extension (Req 11.3)", async () => {
      const pythonAIResponse = {
        ...mockAIResponse,
        classes: mockAIResponse.classes.map((c) => ({
          ...c,
          filePath: c.filePath.replace(".ts", ".py"),
        })),
      };
      vi.mocked(generateAIObject).mockResolvedValueOnce(pythonAIResponse);

      const template: CodeTemplate = { language: "python", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(generatedCode.files[0].language).toBe("python");
      expect(generatedCode.files[0].path).toMatch(/\.py$/);
    });

    it("generates valid Python class syntax with __init__ and self", async () => {
      const pythonAIResponse = {
        ...mockAIResponse,
        classes: [
          {
            ...mockAIResponse.classes[0],
            filePath: "src/user.py",
          },
        ],
      };
      vi.mocked(generateAIObject).mockResolvedValueOnce(pythonAIResponse);

      const template: CodeTemplate = { language: "python", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      const userFile = generatedCode.files[0];
      expect(userFile.content).toContain("class User");
      expect(userFile.content).toContain("def __init__");
      expect(userFile.content).toContain("self.");
    });

    it("generates Python with fastapi imports when framework is fastapi (Req 11.4)", async () => {
      const pythonAIResponse = {
        ...mockAIResponse,
        classes: [{ ...mockAIResponse.classes[0], filePath: "src/user.py" }],
      };
      vi.mocked(generateAIObject).mockResolvedValueOnce(pythonAIResponse);

      const template: CodeTemplate = { language: "python", framework: "fastapi", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(generatedCode.files[0].content).toContain("from pydantic import BaseModel");
    });
  });

  describe("diagramToCode - Java", () => {
    it("generates Java files with .java extension (Req 11.3)", async () => {
      const javaAIResponse = {
        ...mockAIResponse,
        classes: mockAIResponse.classes.map((c) => ({
          ...c,
          filePath: c.filePath.replace(".ts", ".java"),
        })),
      };
      vi.mocked(generateAIObject).mockResolvedValueOnce(javaAIResponse);

      const template: CodeTemplate = { language: "java", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(generatedCode.files[0].language).toBe("java");
      expect(generatedCode.files[0].path).toMatch(/\.java$/);
    });

    it("generates valid Java class syntax with public class declaration", async () => {
      const javaAIResponse = {
        ...mockAIResponse,
        classes: [{ ...mockAIResponse.classes[0], filePath: "src/User.java" }],
      };
      vi.mocked(generateAIObject).mockResolvedValueOnce(javaAIResponse);

      const template: CodeTemplate = { language: "java", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      const userFile = generatedCode.files[0];
      expect(userFile.content).toContain("public class User");
      expect(userFile.content).toContain("public User(");
    });

    it("generates Java with package declaration when packageName is provided (Req 11.4)", async () => {
      const javaAIResponse = {
        ...mockAIResponse,
        classes: [{ ...mockAIResponse.classes[0], filePath: "src/User.java" }],
      };
      vi.mocked(generateAIObject).mockResolvedValueOnce(javaAIResponse);

      const template: CodeTemplate = {
        language: "java",
        framework: "spring",
        variables: { packageName: "com.example.app" },
      };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      expect(generatedCode.files[0].content).toContain("package com.example.app;");
    });
  });

  describe("diagramToCode - error handling and edge cases", () => {
    it("throws for non-class diagram types (Req 11.1)", async () => {
      const sequenceDiagram: Diagram = { ...simpleClassDiagram, type: "sequence" };
      const template: CodeTemplate = { language: "typescript", variables: {} };

      await expect(agent.diagramToCode(sequenceDiagram, template, mockUserId)).rejects.toThrow(
        "Code generation is only supported for class diagrams",
      );
    });

    it("returns empty files for diagram with no class nodes", async () => {
      const emptyDiagram: Diagram = { ...simpleClassDiagram, nodes: [] };
      const template: CodeTemplate = { language: "typescript", variables: {} };

      const { generatedCode } = await agent.diagramToCode(emptyDiagram, template, mockUserId);

      expect(generatedCode.files).toHaveLength(0);
      expect(generatedCode.dependencies).toHaveLength(0);
    });

    it("falls back to direct parsing when AI fails", async () => {
      vi.mocked(generateAIObject).mockRejectedValueOnce(new Error("AI unavailable"));

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const { generatedCode } = await agent.diagramToCode(simpleClassDiagram, template, mockUserId);

      // Fallback should still produce files
      expect(generatedCode.files).toHaveLength(2);
      expect(generatedCode.files[0].content).toContain("class User");
    });

    it("handles inheritance edges correctly in fallback parsing", async () => {
      vi.mocked(generateAIObject).mockRejectedValueOnce(new Error("AI unavailable"));

      const diagramWithInheritance: Diagram = {
        ...simpleClassDiagram,
        edges: [
          {
            id: "INHERIT_1",
            source: "AUTH_SERVICE",
            target: "USER_CLASS",
            type: "inheritance",
          },
        ],
      };

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const { generatedCode } = await agent.diagramToCode(diagramWithInheritance, template, mockUserId);

      const authFile = generatedCode.files.find((f) => f.content.includes("AuthService"));
      expect(authFile).toBeDefined();
      // AuthService should extend User (inheritance target)
      expect(authFile!.content).toContain("extends User");
    });
  });

  describe("diagramToCode - 15 second time limit (Req 11.5)", () => {
    it("completes code generation within 15 seconds", async () => {
      vi.mocked(generateAIObject).mockResolvedValueOnce(mockAIResponse);

      const template: CodeTemplate = { language: "typescript", variables: {} };
      const start = Date.now();
      await agent.diagramToCode(simpleClassDiagram, template, mockUserId);
      const elapsed = Date.now() - start;

      // With mocked AI, should complete well under 15s
      expect(elapsed).toBeLessThan(15000);
    });
  });

  describe("applyCodePatch", () => {
    it("applies a code patch replacing specific lines", async () => {
      const existingCode = "line1\nline2\nline3\nline4\nline5";
      const patch = {
        filePath: "src/test.ts",
        hunks: [{ startLine: 2, endLine: 3, oldContent: "line2\nline3", newContent: "replaced" }],
      };

      const result = await agent.applyCodePatch(existingCode, patch);
      expect(result).toBe("line1\nreplaced\nline4\nline5");
    });

    it("applies multiple hunks in reverse order to preserve line numbers", async () => {
      const existingCode = "a\nb\nc\nd\ne";
      const patch = {
        filePath: "src/test.ts",
        hunks: [
          { startLine: 1, endLine: 1, oldContent: "a", newContent: "A" },
          { startLine: 4, endLine: 4, oldContent: "d", newContent: "D" },
        ],
      };

      const result = await agent.applyCodePatch(existingCode, patch);
      expect(result).toBe("A\nb\nc\nD\ne");
    });
  });

  describe("generateBoilerplate", () => {
    it("generates Next.js TypeScript boilerplate", async () => {
      const files = await agent.generateBoilerplate("nextjs-typescript", {});
      expect(files).toHaveLength(1);
      expect(files[0].language).toBe("typescript");
      expect(files[0].path).toContain(".ts");
    });

    it("generates Python FastAPI boilerplate", async () => {
      const files = await agent.generateBoilerplate("python-fastapi", {});
      expect(files).toHaveLength(1);
      expect(files[0].language).toBe("python");
      expect(files[0].content).toContain("FastAPI");
    });

    it("generates Java Spring boilerplate", async () => {
      const files = await agent.generateBoilerplate("java-spring", {});
      expect(files).toHaveLength(1);
      expect(files[0].language).toBe("java");
      expect(files[0].content).toContain("SpringApplication");
    });
  });
});
