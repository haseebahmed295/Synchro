/**
 * AI Client
 * Provides high-level interface for AI model interactions
 */

import { generateObject, generateText, zodSchema } from "ai";
import type { z } from "zod";
import {
  getModelForTask,
  getValidationFallbackModel,
  type TaskType,
} from "./models";

/**
 * Generate text using the appropriate model for the task
 */
export async function generateAIText(
  taskType: TaskType,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const model = getModelForTask(taskType);

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt,
    });

    return result.text;
  } catch (error) {
    console.error(`AI generation failed for task ${taskType}`, error);
    throw error;
  }
}

/**
 * Generate structured object using the appropriate model
 */
export async function generateAIObject<T>(
  taskType: TaskType,
  prompt: string,
  schema: z.ZodSchema<T>,
  systemPrompt?: string,
): Promise<T> {
  const model = getModelForTask(taskType);

  try {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    // TypeScript has issues with the complex union types in AI SDK v6
    // Using type assertion to work around this
    const result = await generateObject({
      model,
      schema: zodSchema(schema),
      messages,
    } as any);

    return result.object as T;
  } catch (error) {
    console.error(`AI object generation failed for task ${taskType}`, error);
    throw error;
  }
}

/**
 * Generate text with retry and fallback logic
 */
export async function generateWithFallback(
  taskType: TaskType,
  prompt: string,
  systemPrompt?: string,
  maxRetries: number = 2,
): Promise<string> {
  let lastError: Error | null = null;

  // Try primary model
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateAIText(taskType, prompt, systemPrompt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      console.warn(`Attempt ${attempt + 1} failed, retrying...`, error);

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
      }
    }
  }

  // Try fallback model for validation tasks
  if (taskType === "validation") {
    try {
      console.log("Trying validation fallback model (GPT)");
      const fallbackModel = getValidationFallbackModel();
      const result = await generateText({
        model: fallbackModel,
        system: systemPrompt,
        prompt,
      });
      return result.text;
    } catch (error) {
      console.error("Fallback model also failed", error);
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

/**
 * Rate limiting and cost control
 * Tracks token usage per task type
 */
export class TokenTracker {
  private usage: Map<TaskType, number> = new Map();

  private limits: Record<TaskType, number> = {
    ocr: 4000,
    multimodal: 4000,
    reasoning: 8000,
    architecture: 8000,
    validation: 8000,
    "code-generation": 16000,
  };

  recordUsage(taskType: TaskType, tokens: number): void {
    const current = this.usage.get(taskType) || 0;
    this.usage.set(taskType, current + tokens);
  }

  checkLimit(taskType: TaskType, requestedTokens: number): boolean {
    const limit = this.limits[taskType];
    return requestedTokens <= limit;
  }

  getUsage(taskType: TaskType): number {
    return this.usage.get(taskType) || 0;
  }

  reset(): void {
    this.usage.clear();
  }
}

export const tokenTracker = new TokenTracker();
