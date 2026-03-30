# Multi-Model AI Strategy

This directory contains the AI model configuration and client for Synchro's multi-model strategy.

## Overview

Synchro uses different AI models optimized for specific tasks to balance cost, performance, and quality.

## Model Selection Strategy

| Task Type | Primary Model | Use Case | Max Tokens |
|-----------|---------------|----------|------------|
| OCR / Multimodal | Gemini 3 Flash | Image extraction, hand-drawn diagrams | 4,000 |
| Reasoning | Claude Sonnet 4.6 | Core reasoning, architecture decisions | 8,000 |
| Architecture | Claude Sonnet 4.6 | Diagram generation, design decisions | 8,000 |
| Validation | Claude Sonnet 4.6 | Primary validation, consistency checks | 8,000 |
| Validation (Fallback) | GPT-4o | Complex abstract reasoning | 8,000 |
| Code Generation | DeepSeek-V3 | Code generation, boilerplate | 16,000 |

## Requirements Mapping

- **Req 31.1**: Gemini 3 Flash for OCR and multimodal extraction
- **Req 31.2**: Claude Sonnet 4.6 for core reasoning and architecture
- **Req 31.3**: Claude Sonnet 4.6 primary, GPT-5.2 for complex validation
- **Req 31.4**: DeepSeek-V3 for code generation
- **Req 31.5**: Fallback handling for model unavailability

## Usage

### Basic Text Generation

```typescript
import { generateAIText } from './lib/ai'

const result = await generateAIText(
  'reasoning',
  'Analyze these requirements and suggest a system architecture',
  'You are an expert software architect'
)
```

### Structured Object Generation

```typescript
import { generateAIObject } from './lib/ai'
import { z } from 'zod'

const schema = z.object({
  requirements: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['functional', 'non-functional']),
  })),
})

const result = await generateAIObject(
  'reasoning',
  'Extract requirements from this text',
  schema
)
```

### With Fallback

```typescript
import { generateWithFallback } from './lib/ai'

const result = await generateWithFallback(
  'validation',
  'Validate this UML diagram',
  'You are a UML expert',
  3 // max retries
)
```

## Token Tracking

The system tracks token usage per task type to enforce limits:

```typescript
import { tokenTracker } from './lib/ai'

// Check if request is within limits
if (!tokenTracker.checkLimit('ocr', 5000)) {
  throw new Error('Token limit exceeded for OCR tasks')
}

// Record usage
tokenTracker.recordUsage('ocr', 3500)

// Get current usage
const usage = tokenTracker.getUsage('ocr')
```

## Configuration

### Required API Keys

```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
OPENAI_API_KEY=sk-...
```

### Optional API Keys

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

## Initialization

Initialize the AI system on application startup:

```typescript
import { initializeAI } from './lib/ai'

// In your app startup (e.g., layout.tsx or middleware)
initializeAI()
```

This will:
- Validate all required API keys are present
- Log available models
- Throw an error if configuration is invalid

## Error Handling

The system includes automatic retry and fallback logic:

1. **Primary model fails** → Retry with exponential backoff (up to 2 times)
2. **All retries fail** → For validation tasks, try GPT fallback
3. **All models fail** → Throw error with details

## Cost Optimization

- **Gemini 3 Flash**: 10x cheaper than GPT-4o for OCR
- **DeepSeek-V3**: Cost-effective for code generation
- **Claude Sonnet 4.6**: Balanced cost/performance for reasoning
- **Prompt caching**: Enabled for Anthropic models to reduce costs

## Performance Targets

- OCR extraction: < 5 seconds per image
- Diagram generation: < 10 seconds per diagram
- Code generation: < 15 seconds per file
- Validation checks: < 2 seconds per artifact

## Next Steps

The AI client will be integrated with agent implementations in:
- Task 8: Analyst agent (OCR, text ingestion)
- Task 13: Architect agent (diagram generation)
- Task 18: Implementer agent (code generation)
- Task 22: Judge agent (validation)
