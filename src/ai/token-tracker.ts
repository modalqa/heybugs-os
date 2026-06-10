import type { LlmUsage } from './llm-client';

export interface TokenCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface TokenTracker {
  addUsage(usage: LlmUsage, model: string): void;
  getTotal(): TokenCost;
  getSummary(): TokenTrackerSummary;
}

export interface TokenTrackerSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  invocationCount: number;
}

interface ModelPricing {
  inputCostPer1M: number;
  outputCostPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputCostPer1M: 0.15, outputCostPer1M: 0.60 },
  'gpt-4o': { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
  'gpt-4-turbo': { inputCostPer1M: 10.00, outputCostPer1M: 30.00 },
  'gpt-4': { inputCostPer1M: 30.00, outputCostPer1M: 60.00 },
  'gpt-3.5-turbo': { inputCostPer1M: 0.50, outputCostPer1M: 1.50 },
  'o1-preview': { inputCostPer1M: 15.00, outputCostPer1M: 60.00 },
  'o1-mini': { inputCostPer1M: 3.00, outputCostPer1M: 12.00 },
  'claude-3-5-sonnet-latest': { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
  'claude-3-5-sonnet-20241022': { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
  'claude-3-opus': { inputCostPer1M: 15.00, outputCostPer1M: 75.00 },
  'claude-3-sonnet': { inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
  'claude-3-haiku': { inputCostPer1M: 0.25, outputCostPer1M: 1.25 },
  'gemini-1.5-flash': { inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
  'gemini-1.5-pro': { inputCostPer1M: 1.25, outputCostPer1M: 5.00 },
  'gemini-1.5-flash-8b': { inputCostPer1M: 0.0375, outputCostPer1M: 0.15 },
  'openai/gpt-4o-mini': { inputCostPer1M: 0.15, outputCostPer1M: 0.60 },
  'openai/gpt-4o': { inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
};

function getModelPricing(model: string): ModelPricing {
  const modelLower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelLower.includes(key.toLowerCase())) {
      return pricing;
    }
  }
  if (modelLower.includes('claude')) {
    return { inputCostPer1M: 3.00, outputCostPer1M: 15.00 };
  }
  if (modelLower.includes('gemini')) {
    return { inputCostPer1M: 0.075, outputCostPer1M: 0.30 };
  }
  if (modelLower.includes('gpt-4o')) {
    return { inputCostPer1M: 0.15, outputCostPer1M: 0.60 };
  }
  if (modelLower.includes('gpt-4')) {
    return { inputCostPer1M: 2.50, outputCostPer1M: 10.00 };
  }
  return { inputCostPer1M: 0.50, outputCostPer1M: 1.50 };
}

function calculateCost(usage: LlmUsage, model: string): number {
  const pricing = getModelPricing(model);
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputCostPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputCostPer1M;
  return inputCost + outputCost;
}

export { calculateCost };

let globalTracker: TokenTracker | null = null;

export function getGlobalTokenTracker(): TokenTracker {
  if (!globalTracker) {
    globalTracker = createTokenTracker();
  }
  return globalTracker;
}

export function resetGlobalTokenTracker(): void {
  globalTracker = createTokenTracker();
}

export function createTokenTracker(): TokenTracker {
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCost = 0;
  let invocationCount = 0;

  return {
    addUsage(usage: LlmUsage, model: string): void {
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      totalCost += calculateCost(usage, model);
      invocationCount++;
    },
    getTotal(): TokenCost {
      return {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        cost: totalCost,
      };
    },
    getSummary(): TokenTrackerSummary {
      return {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        totalCost,
        invocationCount,
      };
    },
  };
}

export function formatCost(cost: number): string {
  if (cost < 0.0001) {
    return '$0.00';
  }
  return `$${cost.toFixed(4)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}