/**
 * Agent Router
 * Routes webhook events to appropriate agents and manages execution
 */

import { createAgentGraph, initializeState } from "./state-machine";
import type { AgentState, AgentType, WebhookPayload } from "./types";

/**
 * Main router function that processes webhook events
 */
export async function routeEvent(
  payload: WebhookPayload,
  projectId: string,
  userId: string,
): Promise<AgentState> {
  // Initialize state from webhook payload
  const initialState = initializeState(payload, projectId, userId);

  console.log(`Routing event to ${initialState.currentAgent} agent`, {
    projectId,
    eventType: payload.eventType,
    table: payload.table,
    artifactType: payload.record?.type,
  });

  // Create and execute the agent graph
  const graph = createAgentGraph();

  try {
    // Execute the graph with initial state
    const result = await graph.invoke(initialState);

    // Log completion
    console.log(`Agent processing complete`, {
      projectId,
      iterations: result.iterationCount,
      patches: result.patches.length,
      links: result.traceabilityLinks.length,
      escalated: result.requiresUserEscalation,
    });

    return result;
  } catch (error) {
    console.error("Agent execution failed", error);

    // Return state with error
    return {
      ...initialState,
      requiresUserEscalation: true,
      errors: [
        {
          agent: initialState.currentAgent,
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
          recoverable: false,
        },
      ],
    };
  }
}

/**
 * Dispatch to a specific agent type
 * Used for manual agent invocation or testing
 */
export async function dispatchToAgent(
  agentType: AgentType,
  payload: WebhookPayload,
  projectId: string,
  userId: string,
): Promise<AgentState> {
  const state = initializeState(payload, projectId, userId);
  state.currentAgent = agentType;

  const graph = createAgentGraph();
  return await graph.invoke(state);
}
