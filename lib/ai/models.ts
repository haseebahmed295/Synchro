/**
 * Multi-Model AI Strategy
 * Configures AI model clients and selection logic
 */

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ModelProvider = "anthropic" | "google" | "openai" | "deepseek";

export type TaskType =
  | "ocr"
  | "multimodal"
  | "reasoning"
  | "architecture"
  | "validation"
  | "code-generation";

/**
 * Model configuration for each provider
 */
export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Get the appropriate model for a given task type
 * Implements the multi-model strategy from requirements 31.1-31.5
 */
export function getModelForTask(taskType: TaskType): LanguageModel {
  const config = getModelConfig(taskType);

  try {
    switch (config.provider) {
      case "anthropic":
        return anthropic(config.model);

      case "google":
        return google(config.model);

      case "openai":
        return openai(config.model);

      case "deepseek":
        // DeepSeek support (requires custom OpenAI configuration)
        // Set OPENAI_BASE_URL=https://api.deepseek.com in environment
        return openai(config.model);

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (error) {
    console.error(`Failed to initialize ${config.provider} model`, error);
    // Fallback to DeepSeek
    return getFallbackModel();
  }
}

/**
 * Get model configuration based on task type
 */
function getModelConfig(taskType: TaskType): ModelConfig {
  // Use OpenAI GPT-5.4-nano for all tasks
  return {
    provider: "openai",
    model: "gpt-5.4-nano",
    maxTokens: 16000,
    temperature: taskType === "validation" ? 0.2 : taskType === "code-generation" ? 0.4 : 0.5,
  };
}

/**
 * Fallback model when primary model is unavailable (Req 31.5)
 */
function getFallbackModel(): LanguageModel {
  console.warn("Using fallback model: GPT-5.4-nano");
  return openai("gpt-5.4-nano");
}

/**
 * Get fallback model for validation tasks
 * Uses GPT-4o as fallback
 */
export function getValidationFallbackModel(): LanguageModel {
  try {
    return openai("gpt-5.4-nano");
  } catch (error) {
    console.error(
      "Failed to initialize OpenAI model",
      error,
    );
    return getFallbackModel();
  }
}

/**
 * Check if all required API keys are configured
 */
export function validateApiKeys(): { valid: boolean; missing: string[] } {
  const required = [
    { key: "OPENAI_API_KEY", name: "OpenAI" },
  ];

  const optional = [
    { key: "DEEPSEEK_API_KEY", name: "DeepSeek" },
    { key: "ANTHROPIC_API_KEY", name: "Anthropic" },
    { key: "GOOGLE_GENERATIVE_AI_API_KEY", name: "Google" },
  ];

  const missing: string[] = [];

  for (const { key, name } of required) {
    if (!process.env[key]) {
      missing.push(name);
    }
  }

  // Warn about optional keys
  for (const { key, name } of optional) {
    if (!process.env[key]) {
      console.warn(`Optional API key not configured: ${name}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
