import type { HudModelPricingConfig, ModelPricing, SessionTokenUsage, StdinData } from './types.js';
import { isBedrockModelId, isVertexModelId } from './stdin.js';
import { getModelPricing } from './pricing-loader.js';

type AnthropicPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export interface SessionCostEstimate {
  totalUsd: number;
  inputUsd: number;
  cacheCreationUsd: number;
  cacheReadUsd: number;
  outputUsd: number;
}

export interface SessionCostDisplay {
  totalUsd: number;
  source: 'native' | 'estimate';
}

const TOKENS_PER_MILLION = 1_000_000;
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

// Patterns are tried in order; the first match wins. Families with more specific
// model lines (Haiku 4.x differs from Haiku 3.5) must come before any broader
// fallback patterns to avoid silent under-pricing.
const ANTHROPIC_MODEL_PRICING: Array<{ pattern: RegExp; pricing: AnthropicPricing }> = [
  { pattern: /\bopus 4(?: \d+)?\b/i, pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
  { pattern: /\bsonnet 4(?: \d+)?\b/i, pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { pattern: /\bsonnet 3 7\b/i, pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { pattern: /\bsonnet 3 5\b/i, pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { pattern: /\bhaiku 4(?: \d+)?\b/i, pricing: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 } },
  { pattern: /\bhaiku 3 5\b/i, pricing: { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 } },
  // Enterprise plan aliases (e.g. opusplan, sonnetplan, haikuplan)
  { pattern: /\bopusplan\b/i, pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
  { pattern: /\bsonnetplan\b/i, pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { pattern: /\bhaikuplan\b/i, pricing: { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 } },
];

function normalizeModelName(modelName: string): string {
  return modelName
    .toLowerCase()
    .replace(/^claude\s+/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAnthropicPricing(modelName: string): AnthropicPricing | null {
  const normalized = normalizeModelName(modelName);
  for (const entry of ANTHROPIC_MODEL_PRICING) {
    if (entry.pattern.test(normalized)) {
      return entry.pricing;
    }
  }
  return null;
}

function calculateUsd(tokens: number, usdPerMillion: number): number {
  return (tokens * usdPerMillion) / TOKENS_PER_MILLION;
}

function calculateCostFromPricing(
  tokens: SessionTokenUsage,
  pricing: ModelPricing,
): SessionCostEstimate {
  const inputUsd = calculateUsd(tokens.inputTokens, pricing.inputUsdPerMillion);
  const cacheCreationUsd = calculateUsd(tokens.cacheCreationTokens, pricing.cacheCreationUsdPerMillion);
  const cacheReadUsd = calculateUsd(tokens.cacheReadTokens, pricing.cacheReadUsdPerMillion);
  const outputUsd = calculateUsd(tokens.outputTokens, pricing.outputUsdPerMillion);

  return {
    totalUsd: inputUsd + cacheCreationUsd + cacheReadUsd + outputUsd,
    inputUsd,
    cacheCreationUsd,
    cacheReadUsd,
    outputUsd,
  };
}

function getAnthropicPricing(stdin: StdinData): AnthropicPricing | null {
  const candidates = [
    stdin.model?.display_name?.trim(),
    stdin.model?.id?.trim(),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const pricing = matchAnthropicPricing(candidate);
    if (pricing) {
      return pricing;
    }
  }

  return null;
}

export function estimateSessionCost(
  stdin: StdinData,
  sessionTokens: SessionTokenUsage | undefined,
  modelPricingConfig?: HudModelPricingConfig,
): SessionCostEstimate | null {
  if (!sessionTokens) return null;
  if (isBedrockModelId(stdin.model?.id)) return null;
  if (isVertexModelId(stdin.model?.id)) return null;

  const totalTokens = sessionTokens.inputTokens
    + sessionTokens.cacheCreationTokens
    + sessionTokens.cacheReadTokens
    + sessionTokens.outputTokens;
  if (totalTokens === 0) return null;

  // 1. Try Anthropic pricing
  const anthropicPricing = getAnthropicPricing(stdin);
  if (anthropicPricing) {
    return calculateCostFromPricing(sessionTokens, {
      inputUsdPerMillion: anthropicPricing.inputUsdPerMillion,
      outputUsdPerMillion: anthropicPricing.outputUsdPerMillion,
      cacheReadUsdPerMillion: anthropicPricing.inputUsdPerMillion * CACHE_READ_MULTIPLIER,
      cacheCreationUsdPerMillion: anthropicPricing.inputUsdPerMillion * CACHE_WRITE_MULTIPLIER,
    });
  }

  // 2. Try third-party pricing
  if (modelPricingConfig) {
    const modelId = stdin.model?.id ?? stdin.model?.display_name ?? '';
    if (!modelId) return null;
    const thirdPartyPricing = getModelPricing(modelId, { modelPricing: modelPricingConfig });
    if (thirdPartyPricing) {
      return calculateCostFromPricing(sessionTokens, thirdPartyPricing);
    }
  }

  return null;
}

function getNativeCostUsd(stdin: StdinData): number | null {
  const nativeCost = stdin.cost?.total_cost_usd;
  if (typeof nativeCost !== 'number' || !Number.isFinite(nativeCost)) {
    return null;
  }

  if (isBedrockModelId(stdin.model?.id)) {
    return null;
  }

  if (isVertexModelId(stdin.model?.id)) {
    return null;
  }

  return nativeCost;
}

export function resolveSessionCost(
  stdin: StdinData,
  sessionTokens: SessionTokenUsage | undefined,
  modelPricingConfig?: HudModelPricingConfig,
): SessionCostDisplay | null {
  const nativeCostUsd = getNativeCostUsd(stdin);
  if (nativeCostUsd !== null) {
    return {
      totalUsd: nativeCostUsd,
      source: 'native',
    };
  }

  const estimate = estimateSessionCost(stdin, sessionTokens, modelPricingConfig);
  if (!estimate) {
    return null;
  }

  return {
    totalUsd: estimate.totalUsd,
    source: 'estimate',
  };
}

export function formatUsd(amount: number): string {
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`;
  }
  if (amount >= 0.1) {
    return `$${amount.toFixed(3)}`;
  }
  return `$${amount.toFixed(4)}`;
}
