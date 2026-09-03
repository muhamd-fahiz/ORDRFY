import type { AICapability, AIUnderstandingProvider } from "./types";
import { MockAIProvider } from "./mock";

/**
 * Distinguishes "no usable provider is configured/available" from any other error a caller
 * might throw -- audit finding #1: this factory previously threw a plain Error for an
 * unsupported AI_PROVIDER_CLASSIFICATION value, and lib/engine/automation.ts called it
 * OUTSIDE its own try/catch, so a misconfigured provider crashed webhook processing entirely
 * instead of degrading to the intended NEEDS_ATTENTION/ai_unavailable path. Callers should
 * catch this type specifically to record a precise fallback_reason (see
 * lib/engine/automation.ts's escalateToAiLayer).
 */
export class AIProviderUnavailableError extends Error {}

/**
 * The identifier of the provider that WOULD be selected for a capability, independent of
 * whether constructing it actually succeeds -- used so a failure to even initialize a
 * provider can still be recorded in automation_decision_log.ai_provider (audit finding #1's
 * provider-metadata clarification: a failed construction is not "no provider was involved,"
 * it's "this specific provider was attempted and could not be used").
 */
export function getConfiguredProviderName(capability: AICapability): string {
  switch (capability) {
    case "classification":
      return process.env.AI_PROVIDER_CLASSIFICATION ?? "mock";
    default: {
      const exhaustiveCheck: never = capability;
      throw new Error(`Unknown AI capability: ${exhaustiveCheck}`);
    }
  }
}

/**
 * automation.ts must obtain an AI provider only through this factory, never by importing a
 * concrete adapter directly -- the same discipline lib/channels/factory.ts already applies to
 * messaging providers (Non-Negotiable Architecture Rule 6), extended here to AI providers so
 * a future real-provider switch is a config change, not a code change.
 */
export function getAIProvider(capability: AICapability): AIUnderstandingProvider {
  switch (capability) {
    case "classification": {
      const mode = getConfiguredProviderName(capability);
      if (mode === "mock") return new MockAIProvider();
      throw new AIProviderUnavailableError(
        `AI_PROVIDER_CLASSIFICATION=${mode} not implemented yet -- real provider adapters are a later phase.`,
      );
    }
    default: {
      const exhaustiveCheck: never = capability;
      throw new Error(`Unknown AI capability: ${exhaustiveCheck}`);
    }
  }
}
