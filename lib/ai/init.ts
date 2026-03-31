/**
 * AI System Initialization
 * Validates configuration and API keys on startup
 */

import { validateApiKeys } from "./models";

/**
 * Initialize AI system and validate configuration
 * Should be called on application startup
 */
export function initializeAI(): void {
  console.log("Initializing AI system...");

  // Validate API keys
  const validation = validateApiKeys();

  if (!validation.valid) {
    console.error("Missing required API keys:", validation.missing.join(", "));
    throw new Error(
      `AI system initialization failed. Missing API keys: ${validation.missing.join(", ")}`,
    );
  }

  console.log("AI system initialized successfully");
  console.log("Available models:");
  console.log("  - GPT-5.4-nano (all tasks)");

  if (process.env.DEEPSEEK_API_KEY) {
    console.log("  - DeepSeek-V3 (optional)");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("  - Claude Sonnet 4.6 (optional)");
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log("  - Gemini 3 Flash (optional)");
  }
}

/**
 * Check if AI system is properly configured
 * Non-throwing version for conditional features
 */
export function isAIConfigured(): boolean {
  const validation = validateApiKeys();
  return validation.valid;
}
