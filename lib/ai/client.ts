/**
 * AI Client
 * Provides high-level interface for AI model interactions
 */

import { generateText } from "ai";
import OpenAI from "openai";
import type { z } from "zod";
import {
  getModelForTask,
  getValidationFallbackModel,
  type TaskType,
} from "./models";

// Create OpenAI client
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Using standard OpenAI endpoint
});

/**
 * Generate text using the appropriate model for the task
 */
export async function generateAIText(
  taskType: TaskType,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  try {
    // Use OpenAI GPT-4o
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-5.4-nano",
      messages,
      temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
    });

    return completion.choices[0]?.message?.content || "";
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
  try {
    // Use OpenAI GPT-4o for structured output
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-5.4-nano",
      messages,
      response_format: { type: "json_object" },
      temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI model");
    }

    // Parse and validate the JSON response
    const parsed = JSON.parse(content);
    console.log("[AI Response]", JSON.stringify(parsed, null, 2));
    return schema.parse(parsed) as T;
  } catch (error) {
    console.error(`AI object generation failed for task ${taskType}`, error);
    throw error;
  }
}

/**
 * Generate structured object using streaming
 * Parses JSON incrementally and calls callback for each complete object
 */
export async function generateAIObjectStreaming<T>(
  taskType: TaskType,
  prompt: string,
  schema: z.ZodSchema<T>,
  systemPrompt: string | undefined,
  onPartialObject: (obj: any) => Promise<void>,
  onComplete?: (fullResult: T) => void,
): Promise<void> {
  try {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    // Collect the full streamed response before parsing — the incremental
    // object-extraction approach was too fragile and caused parse errors.
    const stream = await openaiClient.chat.completions.create({
      model: "gpt-5.4-nano",
      messages,
      response_format: { type: "json_object" },
      temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      fullContent += chunk.choices[0]?.delta?.content ?? "";
    }

    console.log("[AI Stream] Full response received, length:", fullContent.length);

    // Parse and validate the complete JSON once
    const parsed = JSON.parse(fullContent);
    const validated = schema.parse(parsed) as any;

    // Stream each requirement to the callback so the UI updates progressively
    const items: any[] = validated.requirements ?? [];
    for (let i = 0; i < items.length; i++) {
      console.log(`[Requirement ${i + 1}] Parsed:`, items[i].title);
      await onPartialObject(items[i]);
    }

    console.log("[AI Stream] Complete —", items.length, "requirements processed");

    // Deliver the full result (includes dependencies etc.)
    if (onComplete) onComplete(validated as T);
  } catch (error) {
    console.error(`AI streaming failed for task ${taskType}`, error);
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
