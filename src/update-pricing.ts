/**
 * Web-based pricing update module for third-party model cost estimation.
 *
 * Provides utilities to:
 * - Validate a parsed JSON pricing payload (validatePricingResponse)
 * - Atomically write pricing data to disk (writePricingFile)
 * - Fetch pricing JSON from a remote URL (fetchPricing)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

/**
 * Internal type for the pricing payload expected from a remote pricing.json
 * or written to disk. Not exported — consumers interact through the functions
 * and the already-public ModelPricingEntry type.
 */
interface PricingPayload {
  version?: number;
  updatedAt?: string;
  entries: Array<{
    pattern: string;
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
    cacheReadUsdPerMillion?: number;
    cacheCreationUsdPerMillion?: number;
    provider?: string;
  }>;
}

/**
 * Validate that an unknown value is a well-formed PricingPayload.
 *
 * Checks:
 * - data is a non-null, non-array object
 * - has a non-empty `entries` array
 * - each entry has a non-empty string pattern, non-negative finite numbers
 *   for inputUsdPerMillion and outputUsdPerMillion
 *
 * @returns true if data conforms to PricingPayload
 */
export function validatePricingResponse(data: unknown): data is PricingPayload {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.entries) || obj.entries.length === 0) {
    return false;
  }

  for (const entry of obj.entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }

    const e = entry as Record<string, unknown>;

    // pattern must be a non-empty string
    if (typeof e.pattern !== 'string' || e.pattern.length === 0) {
      return false;
    }

    // inputUsdPerMillion must be a finite non-negative number
    if (
      typeof e.inputUsdPerMillion !== 'number' ||
      !Number.isFinite(e.inputUsdPerMillion) ||
      e.inputUsdPerMillion < 0
    ) {
      return false;
    }

    // outputUsdPerMillion must be a finite non-negative number
    if (
      typeof e.outputUsdPerMillion !== 'number' ||
      !Number.isFinite(e.outputUsdPerMillion) ||
      e.outputUsdPerMillion < 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Atomically write a PricingPayload to a JSON file on disk.
 *
 * Writing is done to a temp file first, then renamed to the target path,
 * ensuring the target file is never left in a partially-written state.
 * The file is created with exclusive write ('wx') and mode 0o600.
 *
 * @param filePath - destination path for the pricing JSON file
 * @param data     - validated pricing payload to write
 * @returns true on success, false if any I/O error occurred
 */
export function writePricingFile(filePath: string, data: PricingPayload): boolean {
  const dir = path.dirname(filePath);
  const tmpName = `.pricing.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`;
  const tmpPath = path.join(dir, tmpName);

  try {
    // Ensure the target directory exists
    fs.mkdirSync(dir, { recursive: true });

    // Write to temp file with exclusive create and restricted permissions
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, json, { mode: 0o600, flag: 'wx', encoding: 'utf-8' });

    // Atomically rename temp to target
    fs.renameSync(tmpPath, filePath);

    // Ensure target file has the correct permissions
    fs.chmodSync(filePath, 0o600);

    return true;
  } catch {
    // Clean up temp file on error
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Silently ignore cleanup errors
    }
    return false;
  }
}

/**
 * Fetch pricing JSON from a remote URL.
 *
 * Uses Node.js 18+ global fetch with a 15-second timeout and an
 * `Accept: application/json` header.
 *
 * @param url - the remote pricing.json URL
 * @returns the parsed JSON body
 * @throws if the HTTP response is not ok or the request times out
 */
export async function fetchPricing(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<unknown>;
}
