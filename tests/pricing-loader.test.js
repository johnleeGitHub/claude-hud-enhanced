import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  BUILTIN_MODEL_PRICING,
  matchFromList,
  getModelPricing,
  loadPricingFromDisk,
} from '../dist/pricing-loader.js';

// ---------------------------------------------------------------------------
// matchFromList tests
// ---------------------------------------------------------------------------

test('matchFromList returns null for empty list', () => {
  const result = matchFromList('gpt-4o', []);
  assert.equal(result, null);
});

test('matchFromList matches by exact pattern', () => {
  const entries = [
    { pattern: 'gpt-4o', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
  ];
  const result = matchFromList('gpt-4o', entries);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 2.5);
  assert.equal(result.outputUsdPerMillion, 10);
});

test('matchFromList is case-insensitive', () => {
  const entries = [
    { pattern: 'gpt-4o', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
  ];
  const result = matchFromList('GPT-4O', entries);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 2.5);
});

test('matchFromList returns first match by order', () => {
  const entries = [
    { pattern: 'gpt-4o', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
    { pattern: 'gpt-4o', inputUsdPerMillion: 99, outputUsdPerMillion: 199 },
  ];
  const result = matchFromList('gpt-4o', entries);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 1);
  assert.equal(result.outputUsdPerMillion, 2);
});

test('matchFromList normalizes model names (strips parentheticals)', () => {
  const entries = [
    { pattern: 'gpt-4o(?:-\\d{4}-\\d{2}-\\d{2})?', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
  ];
  // The parenthetical "(2024-05-13)" is stripped, leaving "gpt-4o"
  const result = matchFromList('GPT-4o (2024-05-13)', entries);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 2.5);
});

test('matchFromList strips Claude prefix', () => {
  const entries = [
    { pattern: 'gpt-4o', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
  ];
  const result = matchFromList('Claude GPT-4o', entries);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 2.5);
});

test('matchFromList with anchored patterns distinguishes gpt-4o from gpt-4o-mini', () => {
  const entries = [
    { pattern: '^gpt-4o(?:-\\d{4}-\\d{2}-\\d{2})?$', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
    { pattern: '^gpt-4o-mini$', inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
  ];
  // gpt-4o-mini should NOT match the gpt-4o pattern
  const result = matchFromList('gpt-4o-mini', entries);
  assert.ok(result);
  assert.equal(result.inputUsdPerMillion, 0.15);
  assert.equal(result.outputUsdPerMillion, 0.6);

  // gpt-4o should still match its own pattern
  const result2 = matchFromList('gpt-4o', entries);
  assert.ok(result2);
  assert.equal(result2.inputUsdPerMillion, 2.5);
});

test('matchFromList resolves default cache values', () => {
  const entries = [
    { pattern: 'gpt-4o', inputUsdPerMillion: 10, outputUsdPerMillion: 20 },
  ];
  const result = matchFromList('gpt-4o', entries);
  assert.notEqual(result, null);
  // cacheRead defaults to inputUsdPerMillion * 0.1
  assert.equal(result.cacheReadUsdPerMillion, 1);
  // cacheCreation defaults to inputUsdPerMillion * 1.25
  assert.equal(result.cacheCreationUsdPerMillion, 12.5);
});

test('matchFromList preserves explicit cache values', () => {
  const entries = [
    {
      pattern: 'deepseek-v4-flash',
      inputUsdPerMillion: 0.14,
      outputUsdPerMillion: 0.28,
      cacheReadUsdPerMillion: 0.028,
    },
  ];
  const result = matchFromList('deepseek-v4-flash', entries);
  assert.notEqual(result, null);
  assert.equal(result.cacheReadUsdPerMillion, 0.028);
  // cacheCreation still uses default since not specified
  assert.equal(result.cacheCreationUsdPerMillion, 0.14 * 1.25);
});

test('matchFromList gracefully handles invalid regex patterns', () => {
  const entries = [
    { pattern: '[invalid', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
    { pattern: 'valid-model', inputUsdPerMillion: 3, outputUsdPerMillion: 4 },
  ];
  // Should skip the invalid regex and match the valid one
  const result = matchFromList('valid-model', entries);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 3);
});

// ---------------------------------------------------------------------------
// getModelPricing tests
// ---------------------------------------------------------------------------

test('getModelPricing with empty config returns null for unknown model', async () => {
  const config = { modelPricing: { entries: [] } };
  const result = await getModelPricing('unknown-model', config);
  assert.equal(result, null);
});

test('getModelPricing uses user config entries first (priority)', async () => {
  // Config entries have different pricing than builtin
  const config = {
    modelPricing: {
      entries: [
        { pattern: 'gpt-4o', inputUsdPerMillion: 99, outputUsdPerMillion: 199 },
      ],
    },
  };
  const result = await getModelPricing('gpt-4o', config);
  assert.notEqual(result, null);
  // Should get config pricing, not builtin ($2.5/$10)
  assert.equal(result.inputUsdPerMillion, 99);
  assert.equal(result.outputUsdPerMillion, 199);
});

test('getModelPricing falls back to remote entries', () => {
  const config = { modelPricing: { entries: [] } };
  const loadRemote = () => [
    { pattern: 'custom-remote', inputUsdPerMillion: 5, outputUsdPerMillion: 15 },
  ];
  const result = getModelPricing('custom-remote', config, loadRemote);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 5);
  assert.equal(result.outputUsdPerMillion, 15);
});

test('getModelPricing falls back to builtin table', async () => {
  const config = { modelPricing: { entries: [] } };
  const loadRemote = () => [];
  const result = await getModelPricing('gpt-4o', config, loadRemote);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 2.5);
  assert.equal(result.outputUsdPerMillion, 10);
});

test('user config overrides builtin entries for same pattern', async () => {
  const config = {
    modelPricing: {
      entries: [
        { pattern: 'gpt-4o', inputUsdPerMillion: 0.5, outputUsdPerMillion: 1 },
      ],
    },
  };
  const loadRemote = () => [];
  const result = await getModelPricing('gpt-4o', config, loadRemote);
  assert.notEqual(result, null);
  // Config pricing (Layer 1) should win over builtin ($2.5/$10)
  assert.equal(result.inputUsdPerMillion, 0.5);
  assert.equal(result.outputUsdPerMillion, 1);
});

test('getModelPricing respects layer order (config > remote > builtin)', async () => {
  // All three layers could match; lowest-numbered layer should win
  const config = {
    modelPricing: {
      entries: [
        { pattern: 'multi-layer-model', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
      ],
    },
  };
  const loadRemote = () => [
    { pattern: 'multi-layer-model', inputUsdPerMillion: 10, outputUsdPerMillion: 20 },
  ];
  const result = await getModelPricing('multi-layer-model', config, loadRemote);
  assert.notEqual(result, null);
  // Should get config (Layer 1) pricing, not remote
  assert.equal(result.inputUsdPerMillion, 1);
});

test('getModelPricing skips layer 2 when it throws', async () => {
  const config = { modelPricing: { entries: [] } };
  const loadRemote = () => { throw new Error('Network error'); };
  // Should fall through to builtin without throwing
  const result = await getModelPricing('gpt-4o', config, loadRemote);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 2.5);
});

test('getModelPricing handles deepseek-v4-flash from builtin', async () => {
  const config = { modelPricing: { entries: [] } };
  const result = await getModelPricing('deepseek-v4-flash', config);
  assert.notEqual(result, null);
  assert.equal(result.inputUsdPerMillion, 0.14);
  assert.equal(result.outputUsdPerMillion, 0.28);
  assert.equal(result.cacheReadUsdPerMillion, 0.028);
});

test('getModelPricing returns null when no loadRemote and unknown model', async () => {
  const config = { modelPricing: { entries: [] } };
  const result = await getModelPricing('completely-unknown-model-xyz', config);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// loadPricingFromDisk tests
// ---------------------------------------------------------------------------

test('loadPricingFromDisk returns entries when file is valid', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'pricing.json');
    await writeFile(filePath, JSON.stringify({
      entries: [
        { pattern: 'test-model', inputUsdPerMillion: 1, outputUsdPerMillion: 2, provider: 'Test' },
      ],
    }), 'utf8');

    const result = loadPricingFromDisk(filePath);
    assert.equal(result.length, 1);
    assert.equal(result[0].pattern, 'test-model');
    assert.equal(result[0].inputUsdPerMillion, 1);
    assert.equal(result[0].outputUsdPerMillion, 2);
    assert.equal(result[0].provider, 'Test');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadPricingFromDisk returns empty array for missing file', () => {
  const result = loadPricingFromDisk('/nonexistent/pricing.json');
  assert.deepEqual(result, []);
});

test('loadPricingFromDisk returns empty array for invalid JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'invalid.json');
    await writeFile(filePath, 'not valid json', 'utf8');

    const result = loadPricingFromDisk(filePath);
    assert.deepEqual(result, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadPricingFromDisk returns empty array for missing entries key', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'no-entries.json');
    await writeFile(filePath, JSON.stringify({ notEntries: [] }), 'utf8');

    const result = loadPricingFromDisk(filePath);
    assert.deepEqual(result, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadPricingFromDisk handles CNY currency conversion', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'pricing-cny.json');
    await writeFile(filePath, JSON.stringify({
      entries: [
        {
          pattern: 'cny-model',
          inputUsdPerMillion: 7.2,
          outputUsdPerMillion: 14.4,
          cacheReadUsdPerMillion: 0.72,
          cacheCreationUsdPerMillion: 9.0,
          currency: 'cny',
          provider: 'CNY-Provider',
        },
      ],
    }), 'utf8');

    const result = loadPricingFromDisk(filePath);
    assert.equal(result.length, 1);
    // Use approximate comparison for floating-point division
    assert.ok(Math.abs(result[0].inputUsdPerMillion - 1) < 1e-10, 'inputUsdPerMillion should be ~1');
    assert.ok(Math.abs(result[0].outputUsdPerMillion - 2) < 1e-10, 'outputUsdPerMillion should be ~2');
    assert.ok(Math.abs(result[0].cacheReadUsdPerMillion - 0.1) < 1e-10, 'cacheReadUsdPerMillion should be ~0.1');
    assert.ok(Math.abs(result[0].cacheCreationUsdPerMillion - 1.25) < 1e-10, 'cacheCreationUsdPerMillion should be ~1.25');
    // Provider preserved
    assert.equal(result[0].provider, 'CNY-Provider');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadPricingFromDisk CNY conversion rounds to 4 decimals for non-round values', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'pricing-cny-rounding.json');
    await writeFile(filePath, JSON.stringify({
      entries: [
        {
          pattern: 'cny-round-model',
          inputUsdPerMillion: 1.23,
          outputUsdPerMillion: 5.55,
          cacheReadUsdPerMillion: 0.33,
          cacheCreationUsdPerMillion: 2.99,
          currency: 'cny',
        },
      ],
    }), 'utf8');

    const result = loadPricingFromDisk(filePath);
    assert.equal(result.length, 1);
    // 1.23 / 7.2 = 0.1708333... → .toFixed(4) → 0.1708
    assert.equal(result[0].inputUsdPerMillion, 0.1708);
    // 5.55 / 7.2 = 0.7708333... → .toFixed(4) → 0.7708
    assert.equal(result[0].outputUsdPerMillion, 0.7708);
    // 0.33 / 7.2 = 0.0458333... → .toFixed(4) → 0.0458
    assert.equal(result[0].cacheReadUsdPerMillion, 0.0458);
    // 2.99 / 7.2 = 0.4152777... → .toFixed(4) → 0.4153
    assert.equal(result[0].cacheCreationUsdPerMillion, 0.4153);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadPricingFromDisk skips invalid entries', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'mixed-entries.json');
    await writeFile(filePath, JSON.stringify({
      entries: [
        { pattern: 'valid', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
        { pattern: 'no-output', inputUsdPerMillion: 1 }, // missing outputUsdPerMillion → invalid
        { pattern: 'negative-input', inputUsdPerMillion: -1, outputUsdPerMillion: 2 }, // negative → invalid
        null,
        'string',
        42,
        { pattern: 'valid-2', inputUsdPerMillion: 3, outputUsdPerMillion: 4 },
      ],
    }), 'utf8');

    const result = loadPricingFromDisk(filePath);
    assert.equal(result.length, 2);
    assert.equal(result[0].pattern, 'valid');
    assert.equal(result[1].pattern, 'valid-2');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('BUILTIN_MODEL_PRICING has expected entries', () => {
  assert.ok(Array.isArray(BUILTIN_MODEL_PRICING));
  assert.ok(BUILTIN_MODEL_PRICING.length > 0);

  // Spot check specific entries by unique prices
  const gpt4o = BUILTIN_MODEL_PRICING.find(e => e.inputUsdPerMillion === 2.5 && e.outputUsdPerMillion === 10);
  assert.ok(gpt4o, 'gpt-4o entry exists');
  assert.equal(gpt4o.pattern, '^gpt-4o(?:-\\d{4}-\\d{2}-\\d{2})?$');

  const deepseekFlash = BUILTIN_MODEL_PRICING.find(e => e.inputUsdPerMillion === 0.14 && e.outputUsdPerMillion === 0.28);
  assert.ok(deepseekFlash, 'deepseek-v4-flash entry exists');
  assert.equal(deepseekFlash.pattern, '^deepseek-v4-flash$');
  assert.equal(deepseekFlash.cacheReadUsdPerMillion, 0.028);
});
