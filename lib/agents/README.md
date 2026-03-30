# Agent Orchestration System

This directory contains the LangGraph-based agent orchestration framework for Synchro.

## Overview

The agent system uses LangGraph to manage a state machine that routes events to appropriate AI agents, enforces iteration limits, and handles validation loops.

## Architecture

```
┌─────────────────┐
│ Webhook Event   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Router   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  State Machine  │
│  (LangGraph)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Agent  │ │ Judge  │
│ (A/B/C)│ │ (D)    │
└────────┘ └────────┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Database       │
└─────────────────┘
```

## Components

### State Machine (`state-machine.ts`)
- Manages agent execution flow
- Tracks iteration count
- Enforces maximum iteration limit (5)
- Triggers alerts at threshold (3)

### Router (`router.ts`)
- Routes webhook events to appropriate agents
- Initializes agent state
- Handles execution errors

### Types (`types.ts`)
- Defines core interfaces for agent state
- Webhook payloads
- Agent responses
- Traceability links

### JSON Patch (`json-patch.ts`)
- RFC 6902 JSON Patch implementation
- Used for surgical updates to artifacts

## Agent Types

1. **Analyst** - Ingests and structures requirements
2. **Architect** - Generates and maintains diagrams
3. **Implementer** - Generates and reverse engineers code
4. **Judge** - Validates outputs and enforces governance

## Iteration Limits

The system enforces strict iteration limits to prevent infinite loops:

- **Maximum iterations**: 5
- **Alert threshold**: 3
- **Action on limit**: User escalation with reasoning log

## Usage

```typescript
import { routeEvent } from './lib/agents'

// Process a webhook event
const result = await routeEvent(
  webhookPayload,
  projectId,
  userId
)

// Check if user intervention is needed
if (result.requiresUserEscalation) {
  // Handle escalation
  console.log('Errors:', result.errors)
}

// Apply patches to database
for (const patch of result.patches) {
  await applyPatchToDatabase(patch)
}

// Create traceability links
for (const link of result.traceabilityLinks) {
  await createTraceabilityLink(link)
}
```

## Configuration

The agent system requires AI API keys to be configured in `.env.local`:

```env
ANTHROPIC_API_KEY=your_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here (optional)
```

## Testing

See `example.ts` for usage examples and test scenarios.

## Next Steps

The agent implementations (Analyst, Architect, Implementer, Judge) will be added in subsequent tasks:
- Task 8: Module A - The Analyst
- Task 13: Module B - The Architect
- Task 18: Module C - The Implementer
- Task 22: Module D - The Judge
