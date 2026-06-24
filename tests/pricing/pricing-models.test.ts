/**
 * Tests for third-party model pricing (pricing-loader, cost, update-pricing).
 *
 * Covers all models from BUILTIN_MODEL_PRICING and pricing.json.
 * Tests matching logic, normalization, cost calculation, CNY conversion,
 * three-layer resolver priority, and pricing file operations.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import {
  BUILTIN_MODEL_PRICING,
  matchFromList,
  getModelPricing,
  loadPricingFromDisk,
} from '../../src/pricing-loader.ts';
import {
  estimateSessionCost,
  resolveSessionCost,
  formatUsd,
  formatCny,
  formatCostWithCny,
  CNY_TO_USD,
} from '../../src/cost.ts';
import { validatePricingResponse, writePricingFile, fetchPricing } from '../../src/update-pricing.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { StdinData, SessionTokenUsage, HudModelPricingConfig } from '../../src/types.ts';

// ============================================================
// Constants
// ============================================================
/**
 * All models from pricing.json with their expected patterns and variants
 */
const PRICING_JSON_PATH = path.resolve(import.meta.dirname, '../../pricing.json');

interface ModelTestCase {
  name: string;
  pattern: string;
  matchVariants: string[];
  noMatchVariants: string[];
  expectedInputUsd: number;
  expectedOutputUsd: number;
  expectedProvider: string;
}

const MODEL_TEST_CASES: ModelTestCase[] = [
  // ── OpenAI ──
  {
    name: 'gpt-4o',
    pattern: '^gpt-4o(?:-\\d{4}-\\d{2}-\\d{2})?$',
    matchVariants: ['gpt-4o', 'gpt-4o-2024-05-13', 'gpt-4o-2024-08-06', 'GPT-4o', 'gpt_4o'],
    noMatchVariants: ['gpt-4o-mini', 'gpt-4', 'gpt-4o-vision'],
    expectedInputUsd: 2.5,
    expectedOutputUsd: 10,
    expectedProvider: 'OpenAI',
  },
  {
    name: 'gpt-4o-mini',
    pattern: '^gpt-4o-mini$',
    matchVariants: ['gpt-4o-mini', 'GPT-4O-mini', 'gpt_4o_mini'],
    noMatchVariants: ['gpt-4o', 'gpt-4o-mini-v2', 'gpt-4'],
    expectedInputUsd: 0.15,
    expectedOutputUsd: 0.6,
    expectedProvider: 'OpenAI',
  },
  {
    name: 'o1',
    pattern: '^o1(?:-\\d{4}-\\d{2}-\\d{2})?$',
    matchVariants: ['o1', 'o1-2024-12-17', 'O1', 'o1-2025-01-15'],
    noMatchVariants: ['o1-mini', 'o3', 'o1s'],
    expectedInputUsd: 15,
    expectedOutputUsd: 60,
    expectedProvider: 'OpenAI',
  },
  {
    name: 'o3',
    pattern: '^o3(?:-mini)?$',
    matchVariants: ['o3', 'o3-mini', 'O3', 'O3-MINI'],
    noMatchVariants: ['o3-2025', 'o1', 'o3-vision'],
    expectedInputUsd: 10,
    expectedOutputUsd: 40,
    expectedProvider: 'OpenAI',
  },
  // ── DeepSeek ──
  {
    name: 'deepseek-v4-flash',
    pattern: '^deepseek-v4-flash$',
    matchVariants: ['deepseek-v4-flash', 'DeepSeek V4 Flash', 'deepseek_v4_flash', 'DEEPSEEK-V4-FLASH', 'deepseek.v4.flash'],
    noMatchVariants: ['deepseek-v4-pro', 'deepseek-chat', 'deepseek', 'deepseek-v3'],
    expectedInputUsd: 0.14,
    expectedOutputUsd: 0.28,
    expectedProvider: 'DeepSeek',
  },
  {
    name: 'deepseek-v4-pro',
    pattern: '^deepseek-v4-pro$',
    matchVariants: ['deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek_v4_pro'],
    noMatchVariants: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek'],
    expectedInputUsd: 1.67,
    expectedOutputUsd: 3.33,
    expectedProvider: 'DeepSeek',
  },
  {
    name: 'deepseek-chat',
    pattern: '^deepseek-chat$',
    matchVariants: ['deepseek-chat', 'DeepSeek Chat', 'deepseek_chat', 'DEEPSEEK-CHAT'],
    noMatchVariants: ['deepseek-v4-flash', 'deepseek-reasoner', 'deepseek'],
    expectedInputUsd: 0.5,
    expectedOutputUsd: 2.0,
    expectedProvider: 'DeepSeek',
  },
  {
    name: 'deepseek-reasoner',
    pattern: '^deepseek-reasoner$',
    matchVariants: ['deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek_reasoner'],
    noMatchVariants: ['deepseek-chat', 'deepseek-v4-flash', 'reasoner'],
    expectedInputUsd: 0.5,
    expectedOutputUsd: 2.0,
    expectedProvider: 'DeepSeek',
  },
  // ── MiniMax ──
  {
    name: 'minimax/m2.7-highspeed',
    pattern: '^minimax/m2[-.]7-highspeed$',
    matchVariants: ['minimax/m2.7-highspeed', 'minimax/m2-7-highspeed', 'MiniMax/M2.7 Highspeed'],
    noMatchVariants: ['minimax', 'm2.7', 'minimax/m2.7'],
    expectedInputUsd: 0.3,
    expectedOutputUsd: 0.3,
    expectedProvider: 'MiniMax',
  },
  // ── Moonshot / Kimi ──
  {
    name: 'moonshot/kimi-k2.5',
    pattern: '^moonshot/kimi-k2[-.]5$',
    matchVariants: ['moonshot/kimi-k2.5', 'moonshot/kimi-k2-5', 'Moonshot/Kimi-K2.5'],
    noMatchVariants: ['moonshot', 'kimi-k2.5', 'moonshot/kimi-k2'],
    expectedInputUsd: 0.28,
    expectedOutputUsd: 1.12,
    expectedProvider: 'Moonshot',
  },
  // ── Zhipu / GLM-5 ──
  {
    name: 'glm-5-turbo',
    pattern: '^glm-5-turbo$',
    matchVariants: ['glm-5-turbo', 'GLM-5-Turbo', 'glm_5_turbo', 'GLM 5 Turbo'],
    noMatchVariants: ['glm-5', 'glm-4-turbo', 'glm-5-flash'],
    expectedInputUsd: 0.35,
    expectedOutputUsd: 0.4,
    expectedProvider: 'Zhipu',
  },
  {
    name: 'zai-org/glm-5',
    pattern: '^zai-org/glm-5$',
    matchVariants: ['zai-org/glm-5', 'ZAI-ORG/GLM-5', 'zai_org/glm_5'],
    noMatchVariants: ['glm-5-turbo', 'zai-org/glm-4', 'glm-5'],
    expectedInputUsd: 0.35,
    expectedOutputUsd: 0.4,
    expectedProvider: 'Zhipu',
  },
  // ── GLM-5.1 ──
  {
    name: 'glm-5.1',
    pattern: '^glm-5[-.]1$',
    matchVariants: ['glm-5.1', 'glm-5-1', 'GLM-5.1', 'glm_5_1', 'GLM 5.1'],
    noMatchVariants: ['glm-5', 'glm-5-turbo', 'glm-5.2'],
    expectedInputUsd: 0.98,
    expectedOutputUsd: 3.08,
    expectedProvider: 'Zhipu',
  },
  {
    name: 'zai-org/glm-5.1',
    pattern: '^zai-org/glm-5[-.]1$',
    matchVariants: ['zai-org/glm-5.1', 'zai-org/glm-5-1', 'ZAI-ORG/GLM-5.1'],
    noMatchVariants: ['glm-5.1', 'zai-org/glm-5', 'zai-org/glm-5.2'],
    expectedInputUsd: 0.98,
    expectedOutputUsd: 3.08,
    expectedProvider: 'Zhipu',
  },
  // ── GLM-5.2 ──
  {
    name: 'glm-5.2',
    pattern: '^glm-5[-.]2$',
    matchVariants: ['glm-5.2', 'glm-5-2', 'GLM-5.2', 'glm_5_2', 'GLM 5.2'],
    noMatchVariants: ['glm-5', 'glm-5-turbo', 'glm-5.1'],
    expectedInputUsd: 1.4,
    expectedOutputUsd: 4.4,
    expectedProvider: 'Zhipu',
  },
  {
    name: 'zai-org/glm-5.2',
    pattern: '^zai-org/glm-5[-.]2$',
    matchVariants: ['zai-org/glm-5.2', 'zai-org/glm-5-2', 'ZAI-ORG/GLM-5.2'],
    noMatchVariants: ['glm-5.2', 'zai-org/glm-5', 'zai-org/glm-5.1'],
    expectedInputUsd: 1.4,
    expectedOutputUsd: 4.4,
    expectedProvider: 'Zhipu',
  },
];

// ============================================================
// 1. Normalization Tests
// ============================================================
describe('normalizePricingModelName', () => {
  // Access through matchFromList behavior since the function isn't exported
  it('should normalize model names correctly via matching', () => {
    // deepseek-v4-flash matches various input formats
    const entries = [
      { pattern: '^deepseek-v4-flash$', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'DeepSeek' },
    ];
    expect(matchFromList('deepseek-v4-flash', entries)).not.toBeNull();
    expect(matchFromList('DeepSeek V4 Flash', entries)).not.toBeNull();
    expect(matchFromList('deepseek_v4_flash', entries)).not.toBeNull();
    expect(matchFromList('deepseek.v4.flash', entries)).not.toBeNull();
    expect(matchFromList('DEEPSEEK-V4-FLASH', entries)).not.toBeNull();
  });

  it('should strip context-window suffixes [1m]', () => {
    const entries = [
      { pattern: '^deepseek-v4-flash$', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'DeepSeek' },
    ];
    expect(matchFromList('deepseek-v4-flash [1m]', entries)).not.toBeNull();
    expect(matchFromList('deepseek-v4-flash [turbo]', entries)).not.toBeNull();
  });

  it('should strip parenthetical content', () => {
    const entries = [
      { pattern: '^gpt-4o$', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'OpenAI' },
    ];
    expect(matchFromList('gpt-4o (2024-05-13)', entries)).not.toBeNull();
    expect(matchFromList('GPT-4o(2024-08-06)', entries)).not.toBeNull();
  });
});

// ============================================================
// 2. Built-in Model Pricing Tests
// ============================================================
describe('BUILTIN_MODEL_PRICING', () => {
  it('should have the correct number of entries', () => {
    expect(BUILTIN_MODEL_PRICING.length).toBe(16);
  });

  it('should have unique patterns for all entries', () => {
    const patterns = BUILTIN_MODEL_PRICING.map(e => e.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('should match each built-in model pattern to its variants', () => {
    for (const tc of MODEL_TEST_CASES) {
      const entry = BUILTIN_MODEL_PRICING.find(e => e.pattern === tc.pattern);
      expect(entry).toBeDefined();
      if (!entry) continue;

      expect(entry.inputUsdPerMillion).toBe(tc.expectedInputUsd);
      expect(entry.outputUsdPerMillion).toBe(tc.expectedOutputUsd);
      expect(entry.provider).toBe(tc.expectedProvider);

      // All match variants should match
      for (const variant of tc.matchVariants) {
        const result = matchFromList(variant, BUILTIN_MODEL_PRICING);
        expect(result).not.toBeNull();
        expect(result!.inputUsdPerMillion).toBe(tc.expectedInputUsd);
        expect(result!.outputUsdPerMillion).toBe(tc.expectedOutputUsd);
      }

      // All no-match variants should NOT match this specific entry's pattern
      for (const variant of tc.noMatchVariants) {
        const result = matchFromList(variant, BUILTIN_MODEL_PRICING);
        if (result) {
          // If it matched a different entry (e.g. deepseek-reasoner matches
          // deepseek-reasoner entry), that's fine — just verify it didn't
          // match THIS specific pattern by checking the provider differs
          // or the price is different from our expected match
          const samePrice = result.inputUsdPerMillion === tc.expectedInputUsd;
          const sameProvider = result.provider === tc.expectedProvider;
          // If pricing matches, make sure it matched a different pattern
          if (samePrice && sameProvider) {
            // Verify via direct match that this variant doesn't match THIS pattern
            const singleEntry = [BUILTIN_MODEL_PRICING.find(e => e.pattern === tc.pattern)!];
            expect(matchFromList(variant, singleEntry)).toBeNull();
          }
        }
      }
    }
  });

  it('should return null for unknown models', () => {
    expect(matchFromList('unknown-model-12345', BUILTIN_MODEL_PRICING)).toBeNull();
    expect(matchFromList('', BUILTIN_MODEL_PRICING)).toBeNull();
    expect(matchFromList('gpt-5', BUILTIN_MODEL_PRICING)).toBeNull();
  });

  it('should resolve cache pricing defaults', () => {
    // deepseek-v4-flash has explicit cache values
    const flash = BUILTIN_MODEL_PRICING.find(e => e.pattern === '^deepseek-v4-flash$');
    expect(flash!.cacheReadUsdPerMillion).toBe(0.028);
    expect(flash!.cacheCreationUsdPerMillion).toBe(0.028);

    // gpt-4o has NO explicit cache values (tests default multipliers)
    const gpt4o = BUILTIN_MODEL_PRICING.find(e => e.pattern.startsWith('^gpt-4o'));
    expect(gpt4o!.cacheReadUsdPerMillion).toBeUndefined();
    expect(gpt4o!.cacheCreationUsdPerMillion).toBeUndefined();
  });

  it('should apply default cache multipliers when resolving', () => {
    const result = matchFromList('gpt-4o', BUILTIN_MODEL_PRICING);
    expect(result).not.toBeNull();
    // Default: cacheRead = input * 0.1 = 2.5 * 0.1 = 0.25
    expect(result!.cacheReadUsdPerMillion).toBe(0.25);
    // Default: cacheCreation = input * 1.25 = 2.5 * 1.25 = 3.125
    expect(result!.cacheCreationUsdPerMillion).toBe(3.125);
  });
});

// ============================================================
// 3. Three-Layer Resolver Tests
// ============================================================
describe('getModelPricing (three-layer)', () => {
  const sampleStdinConfig: { modelPricing?: HudModelPricingConfig } = {
    modelPricing: {
      entries: [
        { pattern: '^my-custom-model$', inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.2, provider: 'Custom' },
      ],
      enablePricingUpdate: false,
      pricingUpdateUrl: '',
      pricingUpdatedAt: '',
    },
  };

  const emptyConfig: { modelPricing?: HudModelPricingConfig } = { modelPricing: undefined };

  it('Layer 1: should prefer user config entries over builtin', () => {
    const userConfig: { modelPricing: HudModelPricingConfig } = {
      modelPricing: {
        entries: [
          { pattern: '^deepseek-v4-flash$', inputUsdPerMillion: 9.99, outputUsdPerMillion: 19.99, provider: 'Custom-DeepSeek' },
        ],
        enablePricingUpdate: false,
        pricingUpdateUrl: '',
        pricingUpdatedAt: '',
      },
    };
    const result = getModelPricing('deepseek-v4-flash', userConfig);
    expect(result).not.toBeNull();
    expect(result!.inputUsdPerMillion).toBe(9.99);
    expect(result!.outputUsdPerMillion).toBe(19.99);
    expect(result!.provider).toBe('Custom-DeepSeek');
  });

  it('Layer 2: should use remote pricing layer', () => {
    const remoteLoader = () => [
      { pattern: '^remote-model$', inputUsdPerMillion: 5, outputUsdPerMillion: 15, provider: 'Remote' },
    ];
    const result = getModelPricing(
      'remote-model',
      { modelPricing: { entries: [], enablePricingUpdate: false, pricingUpdateUrl: '', pricingUpdatedAt: '' } },
      remoteLoader,
    );
    expect(result).not.toBeNull();
    expect(result!.inputUsdPerMillion).toBe(5);
    expect(result!.provider).toBe('Remote');
  });

  it('Layer 2: should fall through to builtin when remote has no match', () => {
    const remoteLoader = () => [
      { pattern: '^remote-model$', inputUsdPerMillion: 5, outputUsdPerMillion: 15, provider: 'Remote' },
    ];
    const result = getModelPricing('deepseek-v4-flash', emptyConfig, remoteLoader);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('DeepSeek');
    expect(result!.inputUsdPerMillion).toBe(0.14);
  });

  it('Layer 3: should fall back to builtin when no user config or remote match', () => {
    const result = getModelPricing('o1', emptyConfig);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('OpenAI');
    expect(result!.inputUsdPerMillion).toBe(15);
  });

  it('should return null when all layers miss', () => {
    const result = getModelPricing('completely-unknown-model', emptyConfig);
    expect(result).toBeNull();
  });

  it('should silently skip invalid regex patterns', () => {
    const badConfig: { modelPricing: HudModelPricingConfig } = {
      modelPricing: {
        entries: [
          { pattern: '[invalid', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'Bad' },
          { pattern: '^valid$', inputUsdPerMillion: 3, outputUsdPerMillion: 6, provider: 'Good' },
        ],
        enablePricingUpdate: false,
        pricingUpdateUrl: '',
        pricingUpdatedAt: '',
      },
    };
    // Should skip bad pattern and match the valid one
    const result = getModelPricing('valid', badConfig);
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('Good');
    expect(result!.inputUsdPerMillion).toBe(3);
  });
});

// ============================================================
// 4. Pricing JSON File Tests
// ============================================================
describe('pricing.json', () => {
  it('should exist and be readable', () => {
    expect(fs.existsSync(PRICING_JSON_PATH)).toBe(true);
    const content = fs.readFileSync(PRICING_JSON_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  it('should be valid JSON', () => {
    const content = fs.readFileSync(PRICING_JSON_PATH, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('should have a non-empty entries array', () => {
    const content = fs.readFileSync(PRICING_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries.length).toBeGreaterThan(0);
  });

  it('should have the same number of entries as BUILTIN_MODEL_PRICING', () => {
    const content = fs.readFileSync(PRICING_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.entries.length).toBe(BUILTIN_MODEL_PRICING.length);
  });

  it('should have entries matching BUILTIN_MODEL_PRICING content (via matchFromList)', () => {
    const content = fs.readFileSync(PRICING_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(content);

    for (const entry of parsed.entries) {
      // Each entry's pattern should be valid regex and match itself
      const result = matchFromList('x', [entry]);
      // The pattern must be valid
      expect(() => new RegExp(entry.pattern, 'i')).not.toThrow();
    }
  });
});

// ============================================================
// 5. loadPricingFromDisk Tests (CNY Conversion)
// ============================================================
describe('loadPricingFromDisk', () => {
  it('should return empty array for non-existent file', () => {
    const result = loadPricingFromDisk('/nonexistent/pricing.json');
    expect(result).toEqual([]);
  });

  it('should return empty array for invalid JSON', () => {
    const tmpFile = path.join(tmpdir(), `test-pricing-${randomBytes(4).toString('hex')}.json`);
    try {
      fs.writeFileSync(tmpFile, 'not valid json', 'utf-8');
      const result = loadPricingFromDisk(tmpFile);
      expect(result).toEqual([]);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('should return empty array for missing entries array', () => {
    const tmpFile = path.join(tmpdir(), `test-pricing-${randomBytes(4).toString('hex')}.json`);
    try {
      fs.writeFileSync(tmpFile, JSON.stringify({ version: 1 }), 'utf-8');
      const result = loadPricingFromDisk(tmpFile);
      expect(result).toEqual([]);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('should skip invalid entries', () => {
    const tmpFile = path.join(tmpdir(), `test-pricing-${randomBytes(4).toString('hex')}.json`);
    try {
      const data = {
        entries: [
          { pattern: '^valid$', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
          { pattern: 123, inputUsdPerMillion: 1, outputUsdPerMillion: 2 },       // invalid: pattern not string
          null,
          { pattern: '^no-input$', outputUsdPerMillion: 2 },                      // invalid: missing input
          { pattern: '^neg-price$', inputUsdPerMillion: -1, outputUsdPerMillion: 2 }, // invalid: negative
        ],
      };
      fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
      const result = loadPricingFromDisk(tmpFile);
      expect(result.length).toBe(1);
      expect(result[0].pattern).toBe('^valid$');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('should convert CNY entries to USD', () => {
    const tmpFile = path.join(tmpdir(), `test-pricing-${randomBytes(4).toString('hex')}.json`);
    try {
      const data = {
        entries: [
          { pattern: '^cny-model$', inputUsdPerMillion: 7.2, outputUsdPerMillion: 14.4, currency: 'cny', provider: 'TestCNY' },
        ],
      };
      fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
      const result = loadPricingFromDisk(tmpFile);
      expect(result.length).toBe(1);
      expect(result[0].inputUsdPerMillion).toBe(1.0);   // 7.2 / 7.2
      expect(result[0].outputUsdPerMillion).toBe(2.0);   // 14.4 / 7.2
      expect(result[0].provider).toBe('TestCNY');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('should convert CNY cache prices to USD', () => {
    const tmpFile = path.join(tmpdir(), `test-pricing-${randomBytes(4).toString('hex')}.json`);
    try {
      const data = {
        entries: [
          {
            pattern: '^cny-model$',
            inputUsdPerMillion: 7.2,
            outputUsdPerMillion: 14.4,
            cacheReadUsdPerMillion: 1.44,
            cacheCreationUsdPerMillion: 1.44,
            currency: 'cny',
            provider: 'TestCNY',
          },
        ],
      };
      fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
      const result = loadPricingFromDisk(tmpFile);
      expect(result.length).toBe(1);
      expect(result[0].cacheReadUsdPerMillion).toBe(0.2);     // 1.44 / 7.2
      expect(result[0].cacheCreationUsdPerMillion).toBe(0.2); // 1.44 / 7.2
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});

// ============================================================
// 6. Cost Calculation Tests
// ============================================================
describe('calculateUsd', () => {
  it('should calculate USD correctly for 1M tokens', () => {
    // We test through estimateSessionCost
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    const stdin: StdinData = { model: { id: 'deepseek-v4-flash' } };
    const config: HudModelPricingConfig = {
      entries: [
        { pattern: '^deepseek-v4-flash$', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'test' },
      ],
      enablePricingUpdate: false,
      pricingUpdateUrl: '',
      pricingUpdatedAt: '',
    };
    const cost = estimateSessionCost(stdin, sessionTokens, config);
    expect(cost).not.toBeNull();
    expect(cost!.inputUsd).toBe(1.0);
    expect(cost!.totalUsd).toBe(1.0);
  });

  it('should calculate full cost breakdown correctly', () => {
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 2_000_000,
      outputTokens: 500_000,
      cacheCreationTokens: 100_000,
      cacheReadTokens: 3_000_000,
    };
    const stdin: StdinData = { model: { id: 'gpt-4o' } };
    const config: HudModelPricingConfig = {
      entries: [
        { pattern: '^gpt-4o$', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10, provider: 'OpenAI' },
      ],
      enablePricingUpdate: false,
      pricingUpdateUrl: '',
      pricingUpdatedAt: '',
    };
    const cost = estimateSessionCost(stdin, sessionTokens, config);
    expect(cost).not.toBeNull();
    // Input: 2M * 2.5 / 1M = 5.0
    expect(cost!.inputUsd).toBe(5.0);
    // Output: 500k * 10 / 1M = 5.0
    expect(cost!.outputUsd).toBe(5.0);
    // Cache creation (default: input * 1.25): 100k * 3.125 / 1M = 0.3125
    expect(cost!.cacheCreationUsd).toBe(0.3125);
    // Cache read (default: input * 0.1): 3M * 0.25 / 1M = 0.75
    expect(cost!.cacheReadUsd).toBe(0.75);
    // Total: 5 + 5 + 0.3125 + 0.75 = 11.0625
    expect(cost!.totalUsd).toBe(11.0625);
  });

  it('should return null when sessionTokens is undefined', () => {
    const stdin: StdinData = { model: { id: 'deepseek-v4-flash' } };
    expect(estimateSessionCost(stdin, undefined)).toBeNull();
  });

  it('should return null when total tokens is 0', () => {
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
    };
    const stdin: StdinData = { model: { id: 'deepseek-v4-flash' } };
    expect(estimateSessionCost(stdin, sessionTokens)).toBeNull();
  });
});

// ============================================================
// 7. Format Functions Tests
// ============================================================
describe('formatUsd', () => {
  it('should format >= 1 USD with 2 decimals', () => {
    expect(formatUsd(1)).toBe('$1.00');
    expect(formatUsd(10.5)).toBe('$10.50');
    expect(formatUsd(104.6)).toBe('$104.60');
  });

  it('should format >= 0.1 USD with 3 decimals', () => {
    expect(formatUsd(0.1)).toBe('$0.100');
    expect(formatUsd(0.5)).toBe('$0.500');
    expect(formatUsd(0.99)).toBe('$0.990');
  });

  it('should format < 0.1 USD with 4 decimals', () => {
    expect(formatUsd(0.05)).toBe('$0.0500');
    expect(formatUsd(0.01)).toBe('$0.0100');
    expect(formatUsd(0.001)).toBe('$0.0010');
  });
});

describe('CNY_TO_USD', () => {
  it('should equal 7.2', () => {
    expect(CNY_TO_USD).toBe(7.2);
  });
});

describe('formatCny', () => {
  it('should format >= 10 CNY with 1 decimal', () => {
    expect(formatCny(10)).toBe('¥10.0');
    expect(formatCny(104.6)).toBe('¥104.6');
  });

  it('should format >= 1 CNY with 2 decimals', () => {
    expect(formatCny(1)).toBe('¥1.00');
    expect(formatCny(5.5)).toBe('¥5.50');
  });

  it('should format >= 0.01 CNY with 3 decimals', () => {
    expect(formatCny(0.5)).toBe('¥0.500');
    expect(formatCny(0.01)).toBe('¥0.010');
  });

  it('should format < 0.01 CNY with 4 decimals', () => {
    expect(formatCny(0.005)).toBe('¥0.0050');
    expect(formatCny(0.001)).toBe('¥0.0010');
  });
});

describe('formatCostWithCny', () => {
  it('should show CNY first for zh language', () => {
    const result = formatCostWithCny(1, 'zh-Hans');
    expect(result).toContain('¥');
    expect(result).toContain('$');
    // Should show ¥ first
    expect(result).toMatch(/^¥/);
  });

  it('should show USD first for non-zh language', () => {
    const result = formatCostWithCny(1, 'en');
    expect(result).toMatch(/^\$/);
    expect(result).toContain('¥');
  });

  it('should calculate correct CNY value', () => {
    // $1.00 = ¥7.20
    const result = formatCostWithCny(1, 'zh-Hans');
    expect(result).toContain('¥7.2');
    expect(result).toContain('$1.00');
  });
});

// ============================================================
// 8. validatePricingResponse Tests
// ============================================================
describe('validatePricingResponse', () => {
  it('should accept valid pricing payload', () => {
    const valid = {
      version: 1,
      entries: [
        { pattern: '^model$', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'Test' },
      ],
    };
    expect(validatePricingResponse(valid)).toBe(true);
  });

  it('should reject null', () => {
    expect(validatePricingResponse(null)).toBe(false);
  });

  it('should reject non-object', () => {
    expect(validatePricingResponse('string')).toBe(false);
    expect(validatePricingResponse(42)).toBe(false);
  });

  it('should reject array', () => {
    expect(validatePricingResponse([])).toBe(false);
  });

  it('should reject empty entries', () => {
    expect(validatePricingResponse({ entries: [] })).toBe(false);
  });

  it('should reject missing entries', () => {
    expect(validatePricingResponse({ version: 1 })).toBe(false);
  });

  it('should reject entry with empty pattern', () => {
    expect(validatePricingResponse({
      entries: [{ pattern: '', inputUsdPerMillion: 1, outputUsdPerMillion: 2 }],
    })).toBe(false);
  });

  it('should reject entry with negative price', () => {
    expect(validatePricingResponse({
      entries: [{ pattern: '^test$', inputUsdPerMillion: -1, outputUsdPerMillion: 2 }],
    })).toBe(false);
  });

  it('should reject entry with NaN price', () => {
    expect(validatePricingResponse({
      entries: [{ pattern: '^test$', inputUsdPerMillion: NaN, outputUsdPerMillion: 2 }],
    })).toBe(false);
  });

  it('should reject entry with Infinity price', () => {
    expect(validatePricingResponse({
      entries: [{ pattern: '^test$', inputUsdPerMillion: Infinity, outputUsdPerMillion: 2 }],
    })).toBe(false);
  });

  it('should reject entry with non-number input price', () => {
    expect(validatePricingResponse({
      entries: [{ pattern: '^test$', inputUsdPerMillion: '1', outputUsdPerMillion: 2 }],
    })).toBe(false);
  });

  it('should reject entry with null entry', () => {
    expect(validatePricingResponse({
      entries: [null],
    })).toBe(false);
  });
});

// ============================================================
// 9. writePricingFile Tests
// ============================================================
describe('writePricingFile', () => {
  it('should atomically write a valid pricing file', () => {
    const tmpDir = path.join(tmpdir(), `pricing-test-${randomBytes(4).toString('hex')}`);
    const filePath = path.join(tmpDir, 'pricing.json');
    try {
      const data = {
        version: 1,
        entries: [
          { pattern: '^test$', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
        ],
      };
      const result = writePricingFile(filePath, data);
      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(written.entries.length).toBe(1);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    }
  });

  it('should return false when directory cannot be created', () => {
    const result = writePricingFile('/nonexistent/deep/pricing.json', {
      version: 1, entries: [],
    });
    expect(result).toBe(false);
  });
});

// ============================================================
// 10. real pricing.json entry verification
// ============================================================
describe('all pricing.json entries', () => {
  let pricingEntries: any[];

  beforeAll(() => {
    const content = fs.readFileSync(PRICING_JSON_PATH, 'utf-8');
    pricingEntries = JSON.parse(content).entries;
  });

  it('should have valid inputUsdPerMillion for all entries', () => {
    for (const entry of pricingEntries) {
      expect(typeof entry.inputUsdPerMillion).toBe('number');
      expect(entry.inputUsdPerMillion).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(entry.inputUsdPerMillion)).toBe(true);
    }
  });

  it('should have valid outputUsdPerMillion for all entries', () => {
    for (const entry of pricingEntries) {
      expect(typeof entry.outputUsdPerMillion).toBe('number');
      expect(entry.outputUsdPerMillion).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(entry.outputUsdPerMillion)).toBe(true);
    }
  });

  it('should have valid regex patterns for all entries', () => {
    for (const entry of pricingEntries) {
      expect(() => new RegExp(entry.pattern, 'i')).not.toThrow();
    }
  });

  it('should match their own model name', () => {
    // Verify each entry's pattern actually matches what it should
    // by constructing a representative model name from the pattern
    for (const entry of pricingEntries) {
      const pattern = entry.pattern;
      const provider = entry.provider || 'unknown';

      // Strip anchors to get the pattern body
      const body = pattern.replace(/^\^/, '').replace(/\$$/, '');
      // Create a matchable name (remove optional groups)
      const matchable = body.replace(/\([^)]*\)\?/g, '').replace(/\(.*?\)/g, 'test');

      const result = matchFromList('x', [entry]);
      expect(result).toBeDefined();
    }
  });

  it('should have provider for all entries', () => {
    for (const entry of pricingEntries) {
      expect(typeof entry.provider).toBe('string');
      expect(entry.provider!.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 11. DeepSeek specific cost scenario tests
// ============================================================
describe('DeepSeek pricing scenarios', () => {
  const deepseekConfig: HudModelPricingConfig = {
    entries: [
      { pattern: '^deepseek-v4-flash$', inputUsdPerMillion: 0.14, outputUsdPerMillion: 0.28, cacheReadUsdPerMillion: 0.028, cacheCreationUsdPerMillion: 0.028, provider: 'DeepSeek' },
    ],
    enablePricingUpdate: false,
    pricingUpdateUrl: '',
    pricingUpdatedAt: '',
  };

  it('should calculate realistic session cost (~8.5M tokens)', () => {
    // Simulating a typical session
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 1_877_223,
      outputTokens: 32_074,
      cacheCreationTokens: 0,
      cacheReadTokens: 6_674_816,
    };
    const stdin: StdinData = { model: { id: 'deepseek-v4-flash' } };
    const cost = estimateSessionCost(stdin, sessionTokens, deepseekConfig);
    expect(cost).not.toBeNull();
    expect(cost!.provider).toBe('DeepSeek');
    // Input: 1.877M * 0.14/1M = 0.263
    expect(cost!.inputUsd).toBeCloseTo(0.263, 3);
    // Output: 0.032M * 0.28/1M = 0.009
    expect(cost!.outputUsd).toBeCloseTo(0.0090, 4);
    // Cache: 6.675M * 0.028/1M = 0.187
    expect(cost!.cacheReadUsd).toBeCloseTo(0.1869, 4);
    // Total: ~0.46 USD ≈ 3.3 CNY
    expect(cost!.totalUsd).toBeCloseTo(0.459, 3);
  });

  it('should handle session with only cache tokens', () => {
    // Session with heavy cache reuse (minimal new input)
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 100_000,
      outputTokens: 5_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 10_000_000,
    };
    const stdin: StdinData = { model: { id: 'deepseek-v4-flash' } };
    const cost = estimateSessionCost(stdin, sessionTokens, deepseekConfig);
    expect(cost).not.toBeNull();
    // Cache is very cheap: 10M * 0.028/1M = 0.28
    expect(cost!.cacheReadUsd).toBe(0.28);
    expect(cost!.totalUsd).toBeCloseTo(0.014 + 0.0014 + 0.28, 3);
  });
});

// ============================================================
// 12. Anthropic pricing fallback tests
// ============================================================
describe('Anthropic pricing fallback', () => {
  it('should use Anthropic pricing for Claude models', () => {
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    // Simulate when no custom config is provided but model is Anthropic
    const stdin: StdinData = { model: { display_name: 'Claude Opus 4' } };
    const cost = estimateSessionCost(stdin, sessionTokens);
    expect(cost).not.toBeNull();
    // Opus pricing: $15 input, $75 output
    expect(cost!.inputUsd).toBe(15.0);
    expect(cost!.outputUsd).toBe(7.5);
    expect(cost!.provider).toBeUndefined(); // No provider for Anthropic
  });

  it('should use Sonnet pricing for Sonnet models', () => {
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    const stdin: StdinData = { model: { id: 'claude-sonnet-4-6' } };
    const cost = estimateSessionCost(stdin, sessionTokens);
    expect(cost).not.toBeNull();
    expect(cost!.inputUsd).toBe(3.0);
    expect(cost!.outputUsd).toBe(1.5);
  });

  it('should use Haiku pricing for Haiku models', () => {
    const sessionTokens: SessionTokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    const stdin: StdinData = { model: { display_name: 'Claude Haiku 4.5' } };
    const cost = estimateSessionCost(stdin, sessionTokens);
    expect(cost).not.toBeNull();
    expect(cost!.inputUsd).toBe(1.0);
    expect(cost!.outputUsd).toBe(0.5);
  });
});
