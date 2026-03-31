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
): Promise<void> {
  try {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const stream = await openaiClient.chat.completions.create({
      model: "gpt-5.4-nano",
      messages,
      response_format: { type: "json_object" },
      temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
      stream: true,
    });

    let buffer = "";
    let requirementIndex = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (!content) continue;

      console.log("[AI Stream]", content); // Log streaming content
      buffer += content;

      // Try to extract complete requirement objects from buffer
      // Look for pattern: {...}, (requirement object followed by comma or closing bracket)
      const requirementsMatch = buffer.match(/"requirements"\s*:\s*\[([\s\S]*)/);
      if (requirementsMatch) {
        const arrayContent = requirementsMatch[1];
        
        // Find complete requirement objects (those followed by comma or closing bracket)
        let searchPos = 0;
        while (true) {
          // Find the start of a requirement object
          const objStart = arrayContent.indexOf('{', searchPos);
          if (objStart === -1) break;
          
          // Find the matching closing brace
          let braceCount = 0;
          let objEnd = -1;
          for (let i = objStart; i < arrayContent.length; i++) {
            if (arrayContent[i] === '{') braceCount++;
            else if (arrayContent[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                objEnd = i;
                break;
              }
            }
          }
          
          if (objEnd === -1) {
            // Incomplete object, wait for more data
            break;
          }
          
          // Check if this object is complete (followed by comma, closing bracket, or end)
          const afterObj = arrayContent.substring(objEnd + 1).trim();
          if (afterObj.startsWith(',') || afterObj.startsWith(']') || afterObj === '') {
            // Extract and parse the complete object
            const objStr = arrayContent.substring(objStart, objEnd + 1);
            try {
              const reqObj = JSON.parse(objStr);
              console.log(`[Requirement ${requirementIndex + 1}] Parsed:`, reqObj.title);
              
              // Validate with schema
              const validated = schema.parse({ requirements: [reqObj] });
              await onPartialObject((validated as any).requirements[0]);
              
              requirementIndex++;
              
              // Move search position past this object
              searchPos = objEnd + 1;
              
              // Remove processed requirement from buffer to save memory
              buffer = buffer.substring(0, requirementsMatch.index! + requirementsMatch[0].indexOf('[') + 1) + 
                       arrayContent.substring(objEnd + 1);
            } catch (e) {
              console.log("[Parse Error]", e instanceof Error ? e.message : "Unknown error");
              searchPos = objEnd + 1;
            }
          } else {
            // Object might not be complete yet
            break;
          }
        }
      }
    }

    console.log("[AI Stream] Complete -", requirementIndex, "requirements processed");
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
