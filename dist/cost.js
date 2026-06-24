import { isBedrockModelId, isVertexModelId, isThirdPartyModelId } from './stdin.js';
import { getModelPricing } from './pricing-loader.js';
const TOKENS_PER_MILLION = 1_000_000;
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;
// Patterns are tried in order; the first match wins. Families with more specific
// model lines (Haiku 4.x differs from Haiku 3.5) must come before any broader
// fallback patterns to avoid silent under-pricing.
const ANTHROPIC_MODEL_PRICING = [
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
function normalizeModelName(modelName) {
    return modelName
        .toLowerCase()
        .replace(/^claude\s+/, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function matchAnthropicPricing(modelName) {
    const normalized = normalizeModelName(modelName);
    for (const entry of ANTHROPIC_MODEL_PRICING) {
        if (entry.pattern.test(normalized)) {
            return entry.pricing;
        }
    }
    return null;
}
function calculateUsd(tokens, usdPerMillion) {
    return (tokens * usdPerMillion) / TOKENS_PER_MILLION;
}
function calculateCostFromPricing(tokens, pricing) {
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
        provider: pricing.provider,
    };
}
function getAnthropicPricing(stdin) {
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
export function estimateSessionCost(stdin, sessionTokens, modelPricingConfig) {
    if (!sessionTokens)
        return null;
    if (isBedrockModelId(stdin.model?.id))
        return null;
    if (isVertexModelId(stdin.model?.id))
        return null;
    const totalTokens = sessionTokens.inputTokens
        + sessionTokens.cacheCreationTokens
        + sessionTokens.cacheReadTokens
        + sessionTokens.outputTokens;
    if (totalTokens === 0)
        return null;
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
        if (!modelId)
            return null;
        const thirdPartyPricing = getModelPricing(modelId, { modelPricing: modelPricingConfig });
        if (thirdPartyPricing) {
            return calculateCostFromPricing(sessionTokens, thirdPartyPricing);
        }
    }
    return null;
}
function getNativeCostUsd(stdin) {
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
    // Third-party models (DeepSeek, OpenAI, etc.) report inaccurate native cost
    // from the proxy. Fall back to estimate with configured pricing instead.
    if (isThirdPartyModelId(stdin.model?.id) || isThirdPartyModelId(stdin.model?.display_name)) {
        return null;
    }
    return nativeCost;
}
export function resolveSessionCost(stdin, sessionTokens, modelPricingConfig) {
    const nativeCostUsd = getNativeCostUsd(stdin);
    if (nativeCostUsd !== null) {
        const modelId = stdin.model?.id ?? stdin.model?.display_name ?? '';
        const pricing = modelPricingConfig ? getModelPricing(modelId, { modelPricing: modelPricingConfig }) : null;
        return {
            totalUsd: nativeCostUsd,
            source: 'native',
            provider: pricing?.provider,
        };
    }
    const estimate = estimateSessionCost(stdin, sessionTokens, modelPricingConfig);
    if (!estimate) {
        return null;
    }
    return {
        totalUsd: estimate.totalUsd,
        source: 'estimate',
        provider: estimate.provider,
    };
}
export function formatUsd(amount) {
    if (amount >= 1) {
        return `$${amount.toFixed(2)}`;
    }
    if (amount >= 0.1) {
        return `$${amount.toFixed(3)}`;
    }
    return `$${amount.toFixed(4)}`;
}
/** CNY→USD rate used when displaying cost in both currencies */
export const CNY_TO_USD = 7.2;
export function formatCny(amount) {
    if (amount >= 10)
        return `¥${amount.toFixed(1)}`;
    if (amount >= 1)
        return `¥${amount.toFixed(2)}`;
    if (amount >= 0.01)
        return `¥${amount.toFixed(3)}`;
    return `¥${amount.toFixed(4)}`;
}
/**
 * Format cost with both USD and CNY, prioritizing based on locale.
 *
 * - zh-first (language starts with 'zh'):  ¥0.55≈$0.077
 * - usd-first (default):                   $0.077 (¥0.55)
 */
export function formatCostWithCny(usd, language) {
    const cny = usd * CNY_TO_USD;
    const usdStr = formatUsd(usd);
    const cnyStr = formatCny(cny);
    if (language.startsWith('zh')) {
        return `${cnyStr}≈${usdStr}`;
    }
    return `${usdStr} (${cnyStr})`;
}
//# sourceMappingURL=cost.js.map