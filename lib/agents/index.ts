/**
 * Agent Module Exports
 */

export { routeEvent, dispatchToAgent } from './router'

export { initializeState, createAgentGraph, checkIterationLimit, shouldContinue } from './state-machine'

export { AnalystAgent, RequirementSchema, type Requirement } from './analyst'

export { ArchitectAgent } from './architect'

export { JudgeAgent, type RefinementFeedback } from './judge'

export type {
  AgentType,
  ArtifactType,
  LinkType,
  AgentState,
  TraceabilityLink,
  ValidationIssue,
  AgentError,
  AgentResponse,
  WebhookPayload,
} from './types'

export type { JSONPatch, JSONPatchOperation } from './json-patch'
export { applyPatch } from './json-patch'
