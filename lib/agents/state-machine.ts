/**
 * LangGraph State Machine
 * Manages agent orchestration with iteration limits and state tracking
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph'
import type { AgentState, AgentType, WebhookPayload } from './types'

const MAX_ITERATIONS = 5
const ALERT_THRESHOLD = 3

// Define the state annotation for LangGraph
const StateAnnotation = Annotation.Root({
  projectId: Annotation<string>,
  artifactId: Annotation<string | undefined>,
  userId: Annotation<string>,
  eventType: Annotation<'INSERT' | 'UPDATE' | 'DELETE'>,
  table: Annotation<string>,
  record: Annotation<Record<string, any>>,
  oldRecord: Annotation<Record<string, any> | undefined>,
  currentAgent: Annotation<AgentType>,
  iterationCount: Annotation<number>,
  maxIterations: Annotation<number>,
  patches: Annotation<any[]>,
  traceabilityLinks: Annotation<any[]>,
  validationIssues: Annotation<any[]>,
  confidence: Annotation<number>,
  reasoning: Annotation<string>,
  timestamp: Annotation<Date>,
  errors: Annotation<any[]>,
  requiresUserEscalation: Annotation<boolean>,
})

/**
 * Initialize a new agent state from a webhook payload
 */
export function initializeState(
  payload: WebhookPayload,
  projectId: string,
  userId: string
): AgentState {
  return {
    projectId,
    artifactId: payload.record?.id,
    userId,
    eventType: payload.eventType,
    table: payload.table,
    record: payload.record,
    oldRecord: payload.oldRecord,
    currentAgent: determineInitialAgent(payload),
    iterationCount: 0,
    maxIterations: MAX_ITERATIONS,
    patches: [],
    traceabilityLinks: [],
    validationIssues: [],
    confidence: 1.0,
    reasoning: '',
    timestamp: payload.timestamp,
    errors: [],
    requiresUserEscalation: false,
  }
}

/**
 * Determine which agent should handle the initial event
 */
function determineInitialAgent(payload: WebhookPayload): AgentType {
  const { table, eventType, record } = payload
  
  // Route based on table and artifact type
  if (table === 'artifacts') {
    const artifactType = record?.type
    
    switch (artifactType) {
      case 'requirement':
        return 'analyst'
      case 'diagram':
        return 'architect'
      case 'code':
        return 'implementer'
      case 'adr':
        return 'judge'
      default:
        return 'analyst'
    }
  }
  
  // Default to analyst for unknown events
  return 'analyst'
}

/**
 * Check if iteration limit has been reached
 */
export function checkIterationLimit(state: AgentState): AgentState {
  state.iterationCount += 1
  
  // Alert at threshold
  if (state.iterationCount >= ALERT_THRESHOLD) {
    console.warn(`Agent iteration count reached ${state.iterationCount} for project ${state.projectId}`)
    // TODO: Trigger monitoring alert
  }
  
  // Enforce maximum
  if (state.iterationCount >= state.maxIterations) {
    console.error(`Agent iteration limit exceeded for project ${state.projectId}`)
    state.requiresUserEscalation = true
    state.errors.push({
      agent: state.currentAgent,
      message: `Maximum iteration limit (${state.maxIterations}) reached. Manual intervention required.`,
      timestamp: new Date(),
      recoverable: false,
    })
  }
  
  return state
}

/**
 * Determine if processing should continue or end
 */
export function shouldContinue(state: AgentState): 'continue' | 'end' {
  // Stop if user escalation is required
  if (state.requiresUserEscalation) {
    return 'end'
  }
  
  // Stop if iteration limit reached
  if (state.iterationCount >= state.maxIterations) {
    return 'end'
  }
  
  // Stop if there are unrecoverable errors
  if (state.errors.some(e => !e.recoverable)) {
    return 'end'
  }
  
  // Continue if validation issues require refinement
  if (state.validationIssues.some(v => v.severity === 'error')) {
    return 'continue'
  }
  
  // End if processing is complete
  return 'end'
}

/**
 * Create the LangGraph state machine
 * Note: This is a simplified placeholder implementation
 * The full graph with conditional edges will be implemented when agent modules are ready
 */
export function createAgentGraph() {
  // For now, return a simple function that processes the state
  // This will be replaced with a proper LangGraph workflow in later tasks
  return {
    async invoke(state: AgentState): Promise<AgentState> {
      // Check iteration limit
      const updatedState = checkIterationLimit(state)
      
      // Route to appropriate agent based on currentAgent field
      // Actual agent implementations will be added in subsequent tasks
      switch (updatedState.currentAgent) {
        case 'analyst':
          // Module A implementation (Task 8)
          return await processAnalystAgent(updatedState)
        case 'architect':
          // Module B implementation (Task 13)
          console.log('Architect agent placeholder')
          break
        case 'implementer':
          // Module C implementation (Task 18)
          console.log('Implementer agent placeholder')
          break
        case 'judge':
          // Module D implementation (Task 14, 22)
          return await processJudgeAgent(updatedState)
      }
      
      return updatedState
    },
  }
}

/**
 * Process Analyst agent workflow
 */
async function processAnalystAgent(state: AgentState): Promise<AgentState> {
  try {
    // Import AnalystAgent dynamically to avoid circular dependencies
    const { AnalystAgent } = await import('./analyst')
    const analyst = new AnalystAgent()
    
    // For now, just log that the analyst is processing
    // Full implementation will handle text ingestion and surgical updates
    console.log('Analyst agent processing artifact', {
      artifactId: state.artifactId,
      eventType: state.eventType,
    })
    
    state.reasoning = 'Analyst agent processed the requirement'
    state.confidence = 0.9
    
    return state
  } catch (error) {
    console.error('Analyst agent processing failed', error)
    state.errors.push({
      agent: 'analyst',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
      recoverable: false,
    })
    state.requiresUserEscalation = true
    return state
  }
}

/**
 * Process Judge agent workflow
 */
async function processJudgeAgent(state: AgentState): Promise<AgentState> {
  try {
    // Import JudgeAgent dynamically to avoid circular dependencies
    const { JudgeAgent } = await import('./judge')
    const judge = new JudgeAgent()
    
    console.log('Judge agent processing validation', {
      artifactId: state.artifactId,
      eventType: state.eventType,
    })
    
    // For now, just log that the judge is processing
    // Full implementation will handle validation and governance
    state.reasoning = 'Judge agent validated the artifact'
    state.confidence = 0.95
    
    return state
  } catch (error) {
    console.error('Judge agent processing failed', error)
    state.errors.push({
      agent: 'judge',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
      recoverable: false,
    })
    state.requiresUserEscalation = true
    return state
  }
}
