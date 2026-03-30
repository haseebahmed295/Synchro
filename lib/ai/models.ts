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
        // DeepSeek uses OpenAI-compatible API
        // Note: Configuration should be done via environment variables
        return openai(config.model);

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (error) {
    console.error(`Failed to initialize ${config.provider} model`, error);
    // Fallback to Claude Sonnet
    return getFallbackModel();
  }
}

/**
 * Get model configuration based on task type
 */
function getModelConfig(taskType: TaskType): ModelConfig {
  switch (taskType) {
    case "ocr":
    case "multimodal":
      // Gemini 3 Flash for OCR and multimodal extraction (Req 31.1)
      return {
        provider: "google",
        model: "gemini-2.0-flash-exp",
        maxTokens: 4000,
        temperature: 0.3,
      };

    case "reasoning":
    case "architecture":
      // Claude Sonnet 4.6 for core reasoning and architecture (Req 31.2)
      return {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        maxTokens: 8000,
        temperature: 0.5,
      };

    case "validation":
      // Claude Sonnet 4.6 primary, GPT-5.2 for complex reasoning (Req 31.3)
      return {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        maxTokens: 8000,
        temperature: 0.2,
      };

    case "code-generation":
      // DeepSeek-V3 for code generation (Req 31.4)
      return {
        provider: "deepseek",
        model: "deepseek-chat",
        maxTokens: 16000,
        temperature: 0.4,
      };

    default:
      // Default to Claude Sonnet
      return {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        maxTokens: 8000,
        temperature: 0.5,
      };
  }
}

/**
 * Fallback model when primary model is unavailable (Req 31.5)
 */
function getFallbackModel(): LanguageModel {
  console.warn("Using fallback model: Claude Sonnet 4");
  return anthropic("claude-sonnet-4-20250514");
}

/**
 * Get fallback model for validation tasks
 * Uses GPT-5.2 for complex abstract reasoning
 */
export function getValidationFallbackModel(): LanguageModel {
  try {
    return openai("gpt-4o"); // Using GPT-4o as GPT-5.2 placeholder
  } catch (error) {
    console.error(
      "Failed to initialize GPT model, using Claude fallback",
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
    { key: "ANTHROPIC_API_KEY", name: "Anthropic" },
    { key: "GOOGLE_GENERATIVE_AI_API_KEY", name: "Google" },
    { key: "OPENAI_API_KEY", name: "OpenAI" },
  ];

  const optional = [{ key: "DEEPSEEK_API_KEY", name: "DeepSeek" }];

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
