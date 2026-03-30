# Judge Agent - Validation and Governance

## Overview

The Judge Agent (Module D) is responsible for diagram validation and quality control in the Synchro system. It implements a Critic/Refine loop that validates AI-generated outputs before they are written to the database, preventing compound errors from cascading through the system.

## Key Features

### 1. Diagram Consistency Validation

The Judge agent validates diagrams for:

- **Orphaned Nodes**: Detects nodes with no connections
- **Circular Inheritance**: Validates that inheritance edges don't form cycles using graph traversal
- **Complex UML Validation**: Uses GPT-5.2 for advanced semantic validation

### 2. Critic/Refine Loop

The Judge implements a validation loop with:

- **Maximum 2 refinement iterations** per validation
- **Structured feedback** to generating agents for refinement
- **Automatic escalation** to users after failed refinements
- **Detailed reasoning logs** for debugging and audit trails

## Usage Examples

### Basic Diagram Validation

```typescript
import { JudgeAgent } from './lib/agents'
import type { Diagram } from './lib/types/diagram'

const judge = new JudgeAgent()

const diagram: Diagram = {
  id: 'diagram-123',
  type: 'class',
  nodes: [
    {
      id: 'USER_CLASS',
      type: 'class',
      position: { x: 100, y: 100 },
      data: { label: 'User', methods: ['login()', 'logout()'] },
    },
  ],
  edges: [],
}

// Validate diagram consistency
const issues = await judge.validateDiagramConsistency(diagram)

if (issues.length > 0) {
  console.log('Validation issues found:')
  issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.message}`)
    if (issue.suggestedFix) {
      console.log(`  Fix: ${issue.suggestedFix}`)
    }
  })
}
```

### Architect Output Validation with Refinement

```typescript
import { JudgeAgent, ArchitectAgent } from './lib/agents'

const judge = new JudgeAgent()
const architect = new ArchitectAgent()

// Generate initial diagram
const { diagram } = await architect.requirementsToDiagram(
  requirements,
  'class',
  projectId,
  userId
)

// Validate with automatic refinement
const result = await judge.validateArchitectOutput(
  diagram,
  async (invalidDiagram, feedback) => {
    // Refine the diagram based on feedback
    const refinementPrompt = judge.generateRefinementPrompt(feedback)
    
    // Call Architect to refine
    const { diagram: refinedDiagram } = await architect.requirementsToDiagram(
      requirements,
      'class',
      projectId,
      userId,
      refinementPrompt // Additional context for refinement
    )
    
    return refinedDiagram
  }
)

if (result.requiresEscalation) {
  console.log('Validation failed after 2 refinement attempts')
  console.log('Reasoning log:')
  result.reasoningLog.forEach(log => console.log(`  ${log}`))
  
  // Notify user for manual intervention
  await notifyUser({
    message: 'Diagram validation requires your attention',
    issues: result.issues,
    reasoningLog: result.reasoningLog,
  })
} else {
  console.log('Diagram validated successfully')
  // Save to database
  await saveDiagram(result.output)
}
```

### Custom Validation with Refinement Loop

```typescript
import { JudgeAgent } from './lib/agents'

const judge = new JudgeAgent()

// Custom validator function
async function validateCustomOutput(output: MyCustomType): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  
  // Your custom validation logic
  if (!output.isValid) {
    issues.push({
      severity: 'error',
      message: 'Output is invalid',
      affectedArtifacts: [output.id],
      suggestedFix: 'Ensure all required fields are present',
    })
  }
  
  return issues
}

// Custom refiner function
async function refineCustomOutput(
  output: MyCustomType,
  feedback: RefinementFeedback
): Promise<MyCustomType> {
  // Your refinement logic based on feedback
  return {
    ...output,
    isValid: true,
    // Apply fixes based on feedback.suggestions
  }
}

// Use the Critic/Refine loop
const result = await judge.validateWithRefinement(
  myOutput,
  validateCustomOutput,
  refineCustomOutput,
  'Custom output validation'
)
```

## Validation Issue Structure

```typescript
interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  affectedArtifacts: string[]  // IDs of affected nodes/edges
  suggestedFix?: string
}
```

- **error**: Must be fixed before saving (triggers refinement)
- **warning**: Should be fixed but doesn't block saving
- **info**: Suggestions for improvement

## Refinement Feedback Structure

```typescript
interface RefinementFeedback {
  issues: ValidationIssue[]      // Only critical errors
  suggestions: string[]          // Extracted suggested fixes
  iterationCount: number         // Current iteration (1 or 2)
}
```

## Integration with State Machine

The Judge agent is integrated into the LangGraph state machine and can be invoked automatically:

```typescript
import { initializeState, createAgentGraph } from './lib/agents'

const state = initializeState(webhookPayload, projectId, userId)
state.currentAgent = 'judge'

const graph = createAgentGraph()
const result = await graph.invoke(state)

if (result.requiresUserEscalation) {
  // Handle escalation
}
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **8.1**: Validates UML/ERD relationship correctness
- **8.2**: Provides feedback to Architect for refinement
- **8.3**: Detects orphaned nodes with no connections
- **8.4**: Validates that inheritance edges do not form cycles
- **8.5**: Escalates to user after 2 failed refinement iterations
- **8.6**: Uses GPT-5.2 for complex UML validation
- **21.1**: Validates output before database write
- **21.6**: Provides structured feedback for refinement
- **21.7**: Allows up to 2 refinement iterations
- **21.8**: Escalates with reasoning log after failures

## Testing

Comprehensive unit tests are available in `lib/agents/__tests__/judge.test.ts`:

```bash
npm test -- lib/agents/__tests__/judge.test.ts
```

Tests cover:
- Orphaned node detection
- Circular inheritance detection
- AI-powered validation
- Critic/Refine loop with various scenarios
- Edge cases and error handling

## Performance Considerations

- **Validation latency**: < 2 seconds per diagram (target from requirements)
- **AI validation**: Uses GPT-5.2 for complex reasoning (fallback available)
- **Graceful degradation**: If AI validation fails, basic validation still runs
- **Iteration limits**: Maximum 2 refinements prevents infinite loops

## Future Enhancements

Potential improvements for future iterations:

1. **Caching**: Cache validation results for identical diagrams
2. **Parallel validation**: Run basic and AI validation concurrently
3. **Custom rules**: Allow users to define project-specific validation rules
4. **Metrics**: Track validation success rates and common issues
5. **Learning**: Use validation history to improve refinement suggestions
