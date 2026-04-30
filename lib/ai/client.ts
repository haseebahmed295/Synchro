/**
 * AI Client
 * Primary: OpenAI (gpt-4o). Fallback: NVIDIA DeepSeek endpoint.
 */

import { generateText } from "ai";
import OpenAI from "openai";
import type { z } from "zod";
import {
  getModelForTask,
  getValidationFallbackModel,
  type TaskType,
} from "./models";

// Primary — OpenAI
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fallback — NVIDIA DeepSeek
const nvidiaClient = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

const OPENAI_MODEL = "gpt-5-mini-2025-08-07"; 
const NVIDIA_MODEL = "deepseek-ai/deepseek-v4-flash";

/** Run fn with openaiClient first; if it throws, retry with nvidiaClient. */
async function withFallback<T>(
  fn: (client: OpenAI, model: string, isNvidia: boolean) => Promise<T>,
): Promise<T> {  if (process.env.OPENAI_API_KEY) {
    try {
      return await fn(openaiClient, OPENAI_MODEL, false);
    } catch (err) {
      console.warn("[AI] OpenAI failed, falling back to NVIDIA:", (err as Error).message);
    }
  }
  return fn(nvidiaClient, NVIDIA_MODEL, true);
}

/**
 * Generate text using the appropriate model for the task
 */
export async function generateAIText(
  taskType: TaskType,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const completion = await withFallback<{ choices: Array<{ message: { content: string } }> }>(
    (client, model, isNvidia) =>
    (client.chat.completions.create as any)({
      model,
      messages,
      ...(isNvidia ? {
        temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
        extra_body: { chat_template_kwargs: { thinking: true, reasoning_effort: "high" } },
      } : {}),
    })
  );

  return completion.choices[0]?.message?.content || "";
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
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const completion = await withFallback<{ choices: Array<{ message: { content: string } }> }>(
    (client, model, isNvidia) =>
    (client.chat.completions.create as any)({
      model,
      messages,
      response_format: { type: "json_object" },
      ...(isNvidia ? {
        temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
        extra_body: { chat_template_kwargs: { thinking: true, reasoning_effort: "high" } },
      } : {}),
    })
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI model");

  const parsed = JSON.parse(content);
  console.log("[AI Response]", JSON.stringify(parsed, null, 2));
  // Normalize: if AI returns {} or omits suggestions key, default to empty array
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.suggestions === undefined) {
    parsed.suggestions = [];
  }
  // Filter out non-actionable suggestion types (e.g. "no_change") and normalize field names
  if (Array.isArray(parsed.suggestions)) {
    parsed.suggestions = parsed.suggestions
      .filter((s: any) => s.type !== "no_change" && s.action !== "no_change")
      .map((s: any) => ({
        ...s,
        // Normalize reason → reasoning
        reasoning: s.reasoning ?? s.reason ?? s.recommendation ?? "",
      }));
  }
  return schema.parse(parsed) as T;
}

/**
 * Generate structured object using streaming.
 * Parses each requirement incrementally as its JSON object completes in the stream.
 * Falls back to processing the full buffered response if incremental parsing fails.
 */
export async function generateAIObjectStreaming<T>(
  taskType: TaskType,
  prompt: string,
  schema: z.ZodSchema<T>,
  systemPrompt: string | undefined,
  onPartialObject: (obj: any) => Promise<void>,
  onComplete?: (fullResult: T) => void,
): Promise<void> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const temperature = taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5;

  // Try to get a stream — OpenAI first, NVIDIA fallback
  let stream: any;
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("No OpenAI key");
    stream = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      response_format: { type: "json_object" },
      stream: true,
    });
  } catch (err) {
    console.warn("[AI] OpenAI streaming failed, falling back to NVIDIA:", (err as Error).message);
    stream = await (nvidiaClient.chat.completions.create as any)({
      model: NVIDIA_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature,
      stream: true,
      extra_body: { chat_template_kwargs: { thinking: true, reasoning_effort: "high" } },
    });
  }

  try {
    let fullContent = "";
    let inRequirementsArray = false;
    let depth = 0;
    let objectStart = -1;
    let processedCount = 0;
    const failedItems: any[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (!delta) continue;

      for (let ci = 0; ci < delta.length; ci++) {
        const ch = delta[ci];
        const pos = fullContent.length + ci;
        const currentContent = fullContent + delta.slice(0, ci + 1);

        // Detect entry into the requirements array
        if (!inRequirementsArray) {
          const soFar = fullContent + delta.slice(0, ci + 1);
          if (/"requirements"\s*:\s*\[/.test(soFar) && depth === 0) {
            inRequirementsArray = true;
          }
          continue;
        }

        if (ch === "{") {
          if (depth === 0) objectStart = pos;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && objectStart !== -1) {
            // We have a complete object — extract it
            const combined = fullContent + delta.slice(0, ci + 1);
            const objStr = combined.slice(objectStart, pos + 1);
            try {
              const item = JSON.parse(objStr);
              processedCount++;
              console.log(`[Requirement ${processedCount}] Parsed:`, item.title);
              await onPartialObject(item);
            } catch {
              // Collect failed items for fallback processing
              failedItems.push(objStr);
            }
            objectStart = -1;
          } else if (depth < 0) {
            // Exited the requirements array
            inRequirementsArray = false;
            depth = 0;
          }
        }
      }

      fullContent += delta;
    }

    console.log("[AI Stream] Complete —", processedCount, "requirements processed incrementally");

    // Parse the full response to get dependencies and validate schema
    let validated: any;
    try {
      const parsed = JSON.parse(fullContent);
      validated = schema.parse(parsed);
    } catch (parseError) {
      console.error("[AI Stream] Full response parse failed:", parseError);
      throw parseError;
    }

    // If any items failed incremental parsing, process them now from the full result
    if (failedItems.length > 0 || processedCount === 0) {
      const allItems: any[] = validated.requirements ?? [];
      const remaining = allItems.slice(processedCount);
      for (let i = 0; i < remaining.length; i++) {
        console.log(`[Requirement ${processedCount + i + 1}] Parsed (fallback):`, remaining[i].title);
        await onPartialObject(remaining[i]);
      }
    }

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
