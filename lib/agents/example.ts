/**
 * Example Usage of Agent Orchestration System
 * This file demonstrates how to use the LangGraph agent system
 */

import { routeEvent, type WebhookPayload } from './index'
import { initializeAI } from '../ai'

/**
 * Example: Process a webhook event when a requirement is created
 */
export async function exampleRequirementCreated() {
  // Initialize AI system (should be done once on app startup)
  initializeAI()
  
  // Simulate a webhook payload from Supabase
  const payload: WebhookPayload = {
    eventType: 'INSERT',
    table: 'artifacts',
    record: {
      id: 'artifact-123',
      project_id: 'project-456',
      type: 'requirement',
      content: {
        id: 'REQ_001',
        title: 'User Authentication',
        description: 'Users should be able to log in with email and password',
        type: 'functional',
        priority: 'high',
        status: 'draft',
        links: [],
      },
      version: 1,
      created_at: new Date().toISOString(),
    },
    timestamp: new Date(),
  }
  
  // Route the event to the appropriate agent
  const result = await routeEvent(
    payload,
    'project-456', // projectId
    'user-789'     // userId
  )
  
  console.log('Agent processing result:', {
    iterations: result.iterationCount,
    patches: result.patches.length,
    traceabilityLinks: result.traceabilityLinks.length,
    requiresEscalation: result.requiresUserEscalation,
    reasoning: result.reasoning,
  })
  
  return result
}

/**
 * Example: Process a diagram update event
 */
export async function exampleDiagramUpdated() {
  const payload: WebhookPayload = {
    eventType: 'UPDATE',
    table: 'artifacts',
    record: {
      id: 'artifact-456',
      project_id: 'project-456',
      type: 'diagram',
      content: {
        id: 'diagram-001',
        type: 'class',
        nodes: [
          {
            id: 'node-1',
            type: 'class',
            position: { x: 100, y: 100 },
            data: {
              label: 'User',
              attributes: ['email: string', 'password: string'],
              methods: ['login()', 'logout()'],
            },
          },
        ],
        edges: [],
      },
      version: 2,
      updated_at: new Date().toISOString(),
    },
    oldRecord: {
      // Previous version of the diagram
      version: 1,
    },
    timestamp: new Date(),
  }
  
  const result = await routeEvent(payload, 'project-456', 'user-789')
  
  return result
}

/**
 * Example: Demonstrate iteration limit enforcement
 */
export async function exampleIterationLimit() {
  // This would simulate a scenario where validation keeps failing
  // and the agent keeps trying to refine, eventually hitting the limit
  
  console.log('Maximum iterations allowed: 5')
  console.log('Alert threshold: 3 iterations')
  console.log('When limit is reached, user escalation is triggered')
}
