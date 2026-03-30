/**
 * Agent Types and State Definitions
 * Defines the core types for the LangGraph agent orchestration system
 */

import type { JSONPatch } from "./json-patch";

export type AgentType = "analyst" | "architect" | "implementer" | "judge";

export type ArtifactType = "requirement" | "diagram" | "code" | "adr";

export type LinkType =
  | "implements"
  | "derives_from"
  | "validates"
  | "references";

/**
 * LangGraph State Schema
 * Tracks the current state of agent processing including iteration count
 */
export interface AgentState {
  // Core identifiers
  projectId: string;
  artifactId?: string;
  userId: string;

  // Event context
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, any>;
  oldRecord?: Record<string, any>;

  // Agent orchestration
  currentAgent: AgentType;
  iterationCount: number;
  maxIterations: number;

  // Processing results
  patches: JSONPatch[];
  traceabilityLinks: TraceabilityLink[];
  validationIssues: ValidationIssue[];

  // Metadata
  confidence: number;
  reasoning: string;
  timestamp: Date;

  // Error handling
  errors: AgentError[];
  requiresUserEscalation: boolean;
}

export interface TraceabilityLink {
  id?: string;
  sourceId: string;
  targetId: string;
  linkType: LinkType;
  confidence: number;
  createdBy: string;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  affectedArtifacts: string[];
  suggestedFix?: string;
}

export interface AgentError {
  agent: AgentType;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * Agent Response Interface
 * Standard response format from all agents
 */
export interface AgentResponse {
  agentType: AgentType;
  patches: JSONPatch[];
  traceabilityLinks: TraceabilityLink[];
  confidence: number;
  reasoning: string;
  expectedVersion: number;
  validationIssues?: ValidationIssue[];
  requiresRefinement?: boolean;
}

/**
 * Webhook Payload from Supabase
 */
export interface WebhookPayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, any>;
  oldRecord?: Record<string, any>;
  timestamp: Date;
}
