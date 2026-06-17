import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, chmod as chmodAsync } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import {
  validatePricingResponse,
  writePricingFile,
} from '../dist/update-pricing.js';

// ---------------------------------------------------------------------------
// validatePricingResponse tests
// ---------------------------------------------------------------------------

test('validatePricingResponse rejects non-object — null', () => {
  assert.equal(validatePricingResponse(null), false);
});

test('validatePricingResponse rejects non-object — string', () => {
  assert.equal(validatePricingResponse('hello'), false);
});

test('validatePricingResponse rejects non-object — number', () => {
  assert.equal(validatePricingResponse(42), false);
});

test('validatePricingResponse rejects missing entries', () => {
  assert.equal(validatePricingResponse({}), false);
  assert.equal(validatePricingResponse({ entries: [] }), false);
  assert.equal(validatePricingResponse({ entries: null }), false);
});

test('validatePricingResponse rejects invalid entries — empty object entry', () => {
  assert.equal(validatePricingResponse({ entries: [{}] }), false);
});

test('validatePricingResponse rejects invalid entries — missing pattern', () => {
  assert.equal(
    validatePricingResponse({
      entries: [{ inputUsdPerMillion: 1, outputUsdPerMillion: 2 }],
    }),
    false,
  );
});

test('validatePricingResponse rejects invalid entries — missing prices', () => {
  assert.equal(
    validatePricingResponse({
      entries: [{ pattern: 'test' }],
    }),
    false,
  );
});

test('validatePricingResponse rejects invalid entries — negative price', () => {
  assert.equal(
    validatePricingResponse({
      entries: [{ pattern: 'test', inputUsdPerMillion: -1, outputUsdPerMillion: 2 }],
    }),
    false,
  );
});

test('validatePricingResponse rejects invalid entries — non-number price', () => {
  assert.equal(
    validatePricingResponse({
      entries: [{ pattern: 'test', inputUsdPerMillion: 'abc', outputUsdPerMillion: 2 }],
    }),
    false,
  );
});

test('validatePricingResponse accepts valid response with minimal entry', () => {
  const data = {
    entries: [
      { pattern: '^gpt-4o$', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
    ],
  };
  assert.equal(validatePricingResponse(data), true);
});

test('validatePricingResponse accepts valid response with optional fields', () => {
  const data = {
    version: 1,
    updatedAt: '2026-06-01T00:00:00Z',
    entries: [
      {
        pattern: '^deepseek-v4-flash$',
        inputUsdPerMillion: 0.14,
        outputUsdPerMillion: 0.28,
        cacheReadUsdPerMillion: 0.028,
        cacheCreationUsdPerMillion: 0.175,
        provider: 'DeepSeek',
      },
    ],
  };
  assert.equal(validatePricingResponse(data), true);
});

test('validatePricingResponse accepts valid response with multiple entries', () => {
  const data = {
    entries: [
      { pattern: 'a', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
      { pattern: 'b', inputUsdPerMillion: 3, outputUsdPerMillion: 4 },
    ],
  };
  assert.equal(validatePricingResponse(data), true);
});

test('validatePricingResponse rejects zero-price entries (zero is non-negative, so valid)', () => {
  // Zero is technically non-negative and therefore valid
  const data = {
    entries: [
      { pattern: 'free-model', inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
    ],
  };
  assert.equal(validatePricingResponse(data), true);
});

// ---------------------------------------------------------------------------
// writePricingFile tests
// ---------------------------------------------------------------------------

test('writePricingFile atomically writes and returns true', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'pricing.json');
    const data = {
      entries: [
        { pattern: '^gpt-4o$', inputUsdPerMillion: 2.5, outputUsdPerMillion: 10, provider: 'OpenAI' },
      ],
    };

    const result = writePricingFile(filePath, data);
    assert.equal(result, true);

    // Read back and verify content
    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    assert.deepEqual(written, data);

    // Verify no temp files remain
    const dirContents = await import('node:fs/promises').then(m => m.readdir(dir));
    const tmpFiles = dirContents.filter(f => f.startsWith('.pricing.'));
    assert.equal(tmpFiles.length, 0, 'temp files should be cleaned up');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writePricingFile writes with correct entries structure', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    const filePath = path.join(dir, 'nested', 'sub', 'pricing.json');
    const data = {
      version: 1,
      updatedAt: '2026-06-01T00:00:00Z',
      entries: [
        {
          pattern: '^deepseek-v4-flash$',
          inputUsdPerMillion: 0.14,
          outputUsdPerMillion: 0.28,
          cacheReadUsdPerMillion: 0.028,
          cacheCreationUsdPerMillion: 0.175,
          provider: 'DeepSeek',
        },
        {
          pattern: '^gpt-4o-mini$',
          inputUsdPerMillion: 0.15,
          outputUsdPerMillion: 0.6,
        },
      ],
    };

    const result = writePricingFile(filePath, data);
    assert.equal(result, true);

    const written = JSON.parse(readFileSync(filePath, 'utf-8'));
    assert.deepEqual(written, data);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writePricingFile returns false for invalid path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pricing-test-'));
  try {
    // Make the directory read-only (no write permission)
    await chmodAsync(dir, 0o555); // r-xr-xr-x
    const filePath = path.join(dir, 'pricing.json');
    const data = {
      entries: [
        { pattern: 'test', inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
      ],
    };

    const result = writePricingFile(filePath, data);
    assert.equal(result, false);

    // File should not have been created
    assert.throws(() => readFileSync(filePath, 'utf-8'));
  } finally {
    // Restore permissions so cleanup can proceed
    await chmodAsync(dir, 0o755).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
});
