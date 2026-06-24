import * as fs from 'node:fs';
import type { HudModelPricingConfig, ModelPricing, ModelPricingEntry } from './types.js';

/** A function that loads pricing entries from a remote source (e.g., HTTP fetch) */
export type RemoteLoader = () => ModelPricingEntry[];

const CNY_TO_USD = 7.2;

/** Built-in pricing for known third-party models (USD per million tokens) */
export const BUILTIN_MODEL_PRICING: ModelPricingEntry[] = [
  // OpenAI
  { pattern: '^gpt-4o(?:-\\d{4}-\\d{2}-\\d{2})?$',   inputUsdPerMillion: 2.5,  outputUsdPerMillion: 10,   provider: 'OpenAI' },
  { pattern: '^gpt-4o-mini$',                           inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6,  provider: 'OpenAI' },
  { pattern: '^o1(?:-\\d{4}-\\d{2}-\\d{2})?$',        inputUsdPerMillion: 15,   outputUsdPerMillion: 60,   provider: 'OpenAI' },
  { pattern: '^o3(?:-mini)?$',                          inputUsdPerMillion: 10,   outputUsdPerMillion: 40,   provider: 'OpenAI' },
  // DeepSeek (all models support caching: cache hit = 20% of input price)
  { pattern: '^deepseek-v4-flash$',                     inputUsdPerMillion: 0.14,  outputUsdPerMillion: 0.28,  cacheReadUsdPerMillion: 0.028, cacheCreationUsdPerMillion: 0.028, provider: 'DeepSeek' },
  { pattern: '^deepseek-v4-pro$',                      inputUsdPerMillion: 1.67,  outputUsdPerMillion: 3.33,  cacheReadUsdPerMillion: 0.14,  cacheCreationUsdPerMillion: 0.14, provider: 'DeepSeek' },
  { pattern: '^deepseek-chat$',                         inputUsdPerMillion: 0.50,  outputUsdPerMillion: 2.00,  cacheReadUsdPerMillion: 0.10,  cacheCreationUsdPerMillion: 0.10, provider: 'DeepSeek' },
  { pattern: '^deepseek-reasoner$',                     inputUsdPerMillion: 0.50,  outputUsdPerMillion: 2.00,  cacheReadUsdPerMillion: 0.10,  cacheCreationUsdPerMillion: 0.10, provider: 'DeepSeek' },
  // MiniMax (supports caching ~50% discount)
  { pattern: '^minimax/m2[-.]7-highspeed$',              inputUsdPerMillion: 0.30, outputUsdPerMillion: 0.30,  cacheReadUsdPerMillion: 0.15,  cacheCreationUsdPerMillion: 0.15, provider: 'MiniMax' },
  // Moonshot / Kimi (cache hit = 50% of input)
  { pattern: '^moonshot/kimi-k2[-.]5$',                  inputUsdPerMillion: 0.28, outputUsdPerMillion: 1.12,  cacheReadUsdPerMillion: 0.14,  cacheCreationUsdPerMillion: 0.14,  provider: 'Moonshot' },
  // Zhipu / GLM-5 (cache hit ~25% of input per official GLM-5 pricing)
  { pattern: '^glm-5-turbo$',                           inputUsdPerMillion: 0.35, outputUsdPerMillion: 0.40,  cacheReadUsdPerMillion: 0.09,  cacheCreationUsdPerMillion: 0.09, provider: 'Zhipu' },
  { pattern: '^zai-org/glm-5$',                        inputUsdPerMillion: 0.35, outputUsdPerMillion: 0.40,  cacheReadUsdPerMillion: 0.09,  cacheCreationUsdPerMillion: 0.09, provider: 'Zhipu' },
];

/**
 * Normalize a model name for matching:
 * - lowercases
 * - strips leading "Claude " prefix
 * - removes parenthetical context like "(2024-05-13)"
 * - collapses whitespace
 */
function normalizePricingModelName(modelName: string): string {
  return modelName
    .toLowerCase()
    .replace(/^claude\s+/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')   // strip context-window suffixes like [1m]
    .replace(/[_\s.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

/**
 * Match a model ID against a list of pricing entries.
 * Returns the first matching ModelPricing with resolved defaults, or null.
 *
 * Defaults:
 * - cacheReadUsdPerMillion defaults to inputUsdPerMillion * 0.1
 * - cacheCreationUsdPerMillion defaults to inputUsdPerMillion * 1.25
 *
 * Invalid regex patterns are silently skipped.
 */
export function matchFromList(modelId: string, entries: ModelPricingEntry[]): ModelPricing | null {
  const normalized = normalizePricingModelName(modelId);

  for (const entry of entries) {
    try {
      const regex = new RegExp(entry.pattern, 'i');
      if (!regex.test(normalized)) {
        continue;
      }
    } catch {
      // Invalid regex pattern — skip this entry
      continue;
    }

    return {
      inputUsdPerMillion: entry.inputUsdPerMillion,
      outputUsdPerMillion: entry.outputUsdPerMillion,
      cacheReadUsdPerMillion: entry.cacheReadUsdPerMillion ?? entry.inputUsdPerMillion * 0.1,
      cacheCreationUsdPerMillion: entry.cacheCreationUsdPerMillion ?? entry.inputUsdPerMillion * 1.25,
      provider: entry.provider,
    };
  }

  return null;
}

/**
 * Three-layer model pricing resolver:
 * 1. Match from user config entries (highest priority)
 * 2. Call loadRemote() and match from the returned entries
 * 3. Match from built-in table (lowest priority)
 *
 * Returns null if all layers miss.
 */
export function getModelPricing(
  modelId: string,
  config: { modelPricing?: HudModelPricingConfig },
  loadRemote?: RemoteLoader,
): ModelPricing | null {
  // Layer 1: user config entries
  if (config.modelPricing?.entries && config.modelPricing.entries.length > 0) {
    const result = matchFromList(modelId, config.modelPricing.entries);
    if (result !== null) {
      return result;
    }
  }

  // Layer 2: remote pricing
  if (loadRemote) {
    try {
      const remoteEntries = loadRemote();
      if (remoteEntries.length > 0) {
        const result = matchFromList(modelId, remoteEntries);
        if (result !== null) {
          return result;
        }
      }
    } catch {
      // Remote load failed — fall through to builtin
    }
  }

  // Layer 3: builtin table
  return matchFromList(modelId, BUILTIN_MODEL_PRICING);
}

/**
 * Load pricing entries from a JSON file on disk.
 *
 * Expected format:
 * ```json
 * { "entries": [{ "pattern": "...", "inputUsdPerMillion": ..., "outputUsdPerMillion": ... }] }
 * ```
 *
 * An entry with `"currency": "cny"` has its prices converted from CNY to USD
 * using a rate of 7.2 CNY/USD.
 *
 * Missing file, invalid JSON, or missing `entries` array returns an empty array.
 */
export function loadPricingFromDisk(pricingJsonPath: string): ModelPricingEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(pricingJsonPath, 'utf-8');
  } catch {
    return [];
  }

  let parsed: { entries?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { entries?: unknown[] };
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.entries)) {
    return [];
  }

  const result: ModelPricingEntry[] = [];

  for (const rawEntry of parsed.entries) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;

    // Validate required fields
    if (typeof entry.pattern !== 'string' || entry.pattern.length === 0) continue;
    if (typeof entry.inputUsdPerMillion !== 'number' || !Number.isFinite(entry.inputUsdPerMillion) || entry.inputUsdPerMillion < 0) continue;
    if (typeof entry.outputUsdPerMillion !== 'number' || !Number.isFinite(entry.outputUsdPerMillion) || entry.outputUsdPerMillion < 0) continue;

    const pricingEntry: ModelPricingEntry = {
      pattern: entry.pattern,
      inputUsdPerMillion: entry.inputUsdPerMillion,
      outputUsdPerMillion: entry.outputUsdPerMillion,
    };

    // Optional fields
    if (typeof entry.cacheReadUsdPerMillion === 'number' && Number.isFinite(entry.cacheReadUsdPerMillion)) {
      pricingEntry.cacheReadUsdPerMillion = entry.cacheReadUsdPerMillion;
    }
    if (typeof entry.cacheCreationUsdPerMillion === 'number' && Number.isFinite(entry.cacheCreationUsdPerMillion)) {
      pricingEntry.cacheCreationUsdPerMillion = entry.cacheCreationUsdPerMillion;
    }
    if (typeof entry.provider === 'string') {
      pricingEntry.provider = entry.provider;
    }

    // Handle CNY to USD conversion
    const entryCurrency = entry.currency;
    const isCny = typeof entryCurrency === 'string' && entryCurrency.toLowerCase() === 'cny';
    if (isCny) {
      pricingEntry.inputUsdPerMillion = +(pricingEntry.inputUsdPerMillion / CNY_TO_USD).toFixed(4);
      pricingEntry.outputUsdPerMillion = +(pricingEntry.outputUsdPerMillion / CNY_TO_USD).toFixed(4);
      if (pricingEntry.cacheReadUsdPerMillion !== undefined) {
        pricingEntry.cacheReadUsdPerMillion = +(pricingEntry.cacheReadUsdPerMillion / CNY_TO_USD).toFixed(4);
      }
      if (pricingEntry.cacheCreationUsdPerMillion !== undefined) {
        pricingEntry.cacheCreationUsdPerMillion = +(pricingEntry.cacheCreationUsdPerMillion / CNY_TO_USD).toFixed(4);
      }
    }

    result.push(pricingEntry);
  }

  return result;
}
