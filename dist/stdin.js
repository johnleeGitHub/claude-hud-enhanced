import { AUTOCOMPACT_BUFFER_PERCENT, inferContextWindow } from './constants.js';
const DEFAULT_FIRST_BYTE_TIMEOUT_MS = 250;
const DEFAULT_IDLE_TIMEOUT_MS = 30;
const DEFAULT_MAX_STDIN_BYTES = 256 * 1024;
export async function readStdin(stream = process.stdin, options = {}) {
    if (stream.isTTY) {
        return null;
    }
    const firstByteTimeoutMs = options.firstByteTimeoutMs ?? DEFAULT_FIRST_BYTE_TIMEOUT_MS;
    const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_STDIN_BYTES;
    try {
        stream.setEncoding('utf8');
    }
    catch {
        return null;
    }
    return await new Promise((resolve) => {
        let raw = '';
        let settled = false;
        let sawData = false;
        let firstByteTimer;
        let idleTimer;
        const cleanup = () => {
            if (firstByteTimer) {
                clearTimeout(firstByteTimer);
                firstByteTimer = undefined;
            }
            if (idleTimer) {
                clearTimeout(idleTimer);
                idleTimer = undefined;
            }
            stream.off('data', onData);
            stream.off('end', onEnd);
            stream.off('error', onError);
            stream.pause();
        };
        const finish = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve(value);
        };
        const tryParse = () => {
            const trimmed = raw.trim();
            if (!trimmed) {
                return null;
            }
            try {
                return JSON.parse(trimmed);
            }
            catch {
                return undefined;
            }
        };
        const scheduleIdleParse = () => {
            if (idleTimer) {
                clearTimeout(idleTimer);
            }
            idleTimer = setTimeout(() => {
                const parsed = tryParse();
                finish(parsed ?? null);
            }, idleTimeoutMs);
        };
        const onData = (chunk) => {
            sawData = true;
            if (firstByteTimer) {
                clearTimeout(firstByteTimer);
                firstByteTimer = undefined;
            }
            raw += String(chunk);
            if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
                finish(null);
                return;
            }
            const parsed = tryParse();
            if (parsed !== undefined) {
                finish(parsed);
                return;
            }
            scheduleIdleParse();
        };
        const onEnd = () => {
            const parsed = tryParse();
            finish(parsed ?? null);
        };
        const onError = () => {
            finish(null);
        };
        firstByteTimer = setTimeout(() => {
            if (!sawData) {
                finish(null);
            }
        }, firstByteTimeoutMs);
        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
    });
}
export function getTotalTokens(stdin) {
    // Use total_input_tokens if available (includes all token types)
    const totalInput = stdin.context_window?.total_input_tokens;
    if (typeof totalInput === 'number' && totalInput > 0) {
        return totalInput;
    }
    // Fallback: sum individual token types
    const usage = stdin.context_window?.current_usage;
    return ((usage?.input_tokens ?? 0) +
        (usage?.cache_creation_input_tokens ?? 0) +
        (usage?.cache_read_input_tokens ?? 0));
}
/**
 * Get effective context window size with intelligent fallback.
 * Priority:
 * 1. Explicit autoCompactWindow config (for buffer threshold only, not display)
 * 2. Native context_window_size from Claude Code stdin
 * 3. Infer from model ID (DeepSeek 1M, Claude 200K, etc.) — if native size seems wrong
 * 4. Default 200K
 */
export function getEffectiveContextWindow(stdin, autoCompactWindow) {
    // 1. Explicit config
    if (typeof autoCompactWindow === 'number' && autoCompactWindow > 0) {
        return autoCompactWindow;
    }
    // 2. Native size from Claude Code
    const nativeSize = stdin.context_window?.context_window_size;
    const modelId = stdin.model?.id || stdin.model?.display_name || '';
    const inferred = inferContextWindow(modelId);
    // 3. Check if native size matches model inference
    // If Claude Code reports a size that contradicts the known model context window,
    // prefer the model inference (e.g., Claude Code might report 200K for DeepSeek 1M)
    if (typeof nativeSize === 'number' && nativeSize > 0) {
        // If model inference exists and differs significantly from native, prefer model
        if (inferred !== null && Math.abs(nativeSize - inferred) > nativeSize * 0.1) {
            // Native differs by >10%, use model inference
            return inferred;
        }
        return nativeSize;
    }
    // 3. Infer from model ID
    if (inferred !== null) {
        return inferred;
    }
    // 4. Default
    return 200000;
}
/**
 * Get native percentage from Claude Code v2.1.6+ if available.
 * Returns null if not available or invalid, triggering fallback to manual calculation.
 *
 * A value of 0 is treated as "not yet populated": on a fresh session Claude Code
 * may emit used_percentage=0 before the first API response arrives, while
 * current_usage already contains the real initial-context tokens (system prompt,
 * tools, memory files, etc.).  Falling through to the token-based calculation
 * ensures those tokens are reflected in the context bar from the very first tick.
 */
function getNativePercent(stdin) {
    const nativePercent = stdin.context_window?.used_percentage;
    if (typeof nativePercent === 'number' && !Number.isNaN(nativePercent) && nativePercent > 0) {
        return Math.min(100, Math.max(0, Math.round(nativePercent)));
    }
    return null;
}
export function getContextPercent(stdin, autoCompactWindow) {
    if (typeof autoCompactWindow === 'number' && autoCompactWindow > 0) {
        const totalTokens = getTotalTokens(stdin);
        return Math.min(100, Math.round((totalTokens / autoCompactWindow) * 100));
    }
    // Always use manual calculation to match token display (69k/1.0M)
    // This ensures percentage aligns with the actual token count shown
    const size = getEffectiveContextWindow(stdin, autoCompactWindow);
    if (!size || size <= 0) {
        return 0;
    }
    const totalTokens = getTotalTokens(stdin);
    return Math.min(100, Math.round((totalTokens / size) * 100));
}
export function getBufferedPercent(stdin, autoCompactWindow) {
    if (typeof autoCompactWindow === 'number' && autoCompactWindow > 0) {
        const totalTokens = getTotalTokens(stdin);
        return Math.min(100, Math.round((totalTokens / autoCompactWindow) * 100));
    }
    // Check if native percentage might be misleading due to context window mismatch.
    // When Claude Code reports a different context window than the actual model supports
    // (e.g., reports 200K but DeepSeek is 1M), the native percentage is calculated
    // against the wrong window and doesn't match our token display.
    const native = getNativePercent(stdin);
    const nativeSize = stdin.context_window?.context_window_size;
    const modelId = stdin.model?.id || stdin.model?.display_name || '';
    const inferredSize = inferContextWindow(modelId);
    // Use native percentage only when context windows are consistent
    if (native !== null) {
        const hasMismatch = typeof nativeSize === 'number' && nativeSize > 0
            && inferredSize !== null
            && Math.abs(nativeSize - inferredSize) > nativeSize * 0.1;
        if (!hasMismatch) {
            return native;
        }
        // Mismatch detected: fall through to manual calculation
    }
    // Fallback: manual calculation with buffer for older Claude Code versions
    // Use intelligent context window detection
    const size = getEffectiveContextWindow(stdin, autoCompactWindow);
    if (!size || size <= 0) {
        return 0;
    }
    const totalTokens = getTotalTokens(stdin);
    // Scale buffer by raw usage: no buffer at ≤5% (e.g. after /clear),
    // full buffer at ≥50%. Autocompact doesn't kick in at very low usage.
    const rawRatio = totalTokens / size;
    const LOW = 0.05;
    const HIGH = 0.50;
    const scale = Math.min(1, Math.max(0, (rawRatio - LOW) / (HIGH - LOW)));
    const buffer = size * AUTOCOMPACT_BUFFER_PERCENT * scale;
    return Math.min(100, Math.round(((totalTokens + buffer) / size) * 100));
}
// Enterprise plan alias → human-readable display name
const ENTERPRISE_ALIAS_LABELS = {
    opusplan: 'Claude Opus',
    sonnetplan: 'Claude Sonnet',
    haikuplan: 'Claude Haiku',
};
export function getModelName(stdin) {
    const displayName = stdin.model?.display_name?.trim();
    if (displayName) {
        return displayName;
    }
    const modelId = stdin.model?.id?.trim();
    if (!modelId) {
        return 'Unknown';
    }
    // Resolve enterprise plan aliases to readable labels
    const enterpriseLabel = ENTERPRISE_ALIAS_LABELS[modelId.toLowerCase()];
    if (enterpriseLabel) {
        return enterpriseLabel;
    }
    const normalizedBedrockLabel = normalizeBedrockModelLabel(modelId);
    return normalizedBedrockLabel ?? modelId;
}
export function isBedrockModelId(modelId) {
    if (!modelId) {
        return false;
    }
    const normalized = modelId.toLowerCase();
    return normalized.includes('anthropic.claude-');
}
// Vertex AI model IDs use '@' as version separator (e.g. claude-3-5-sonnet@20241022)
export function isVertexModelId(modelId) {
    if (!modelId) {
        return false;
    }
    return modelId.includes('@');
}
const ENTERPRISE_MODEL_IDS = new Set(['opusplan', 'sonnetplan', 'haikuplan']);
export function isEnterpriseModelId(modelId) {
    if (!modelId) {
        return false;
    }
    return ENTERPRISE_MODEL_IDS.has(modelId.toLowerCase());
}
export function getProviderLabel(stdin) {
    if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') {
        return 'Bedrock';
    }
    if (process.env.CLAUDE_CODE_USE_VERTEX === '1') {
        return 'Vertex';
    }
    if (isEnterpriseModelId(stdin.model?.id)) {
        return 'Enterprise';
    }
    return null;
}
export function shouldHideUsage(stdin) {
    return getProviderLabel(stdin) === 'Bedrock' || isBedrockModelId(stdin.model?.id);
}
function parseRateLimitPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return Math.round(Math.min(100, Math.max(0, value)));
}
function parseRateLimitResetAt(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }
    return new Date(value * 1000);
}
export function getUsageFromStdin(stdin) {
    const rateLimits = stdin.rate_limits;
    if (!rateLimits) {
        return null;
    }
    const fiveHour = parseRateLimitPercent(rateLimits.five_hour?.used_percentage);
    const sevenDay = parseRateLimitPercent(rateLimits.seven_day?.used_percentage);
    if (fiveHour === null && sevenDay === null) {
        return null;
    }
    return {
        fiveHour,
        sevenDay,
        fiveHourResetAt: parseRateLimitResetAt(rateLimits.five_hour?.resets_at),
        sevenDayResetAt: parseRateLimitResetAt(rateLimits.seven_day?.resets_at),
    };
}
/**
 * Strips redundant context-window size suffixes from model display names.
 *
 * Claude Code may include the context window size in the display name
 * (e.g. "Opus 4.6 (1M context)"), but the HUD already shows context
 * usage via the context bar — so the parenthetical is redundant.
 */
export function stripContextSuffix(name) {
    return name.replace(/\s*\([^)]*\bcontext\b[^)]*\)/i, '').trim();
}
/**
 * Formats a model name according to the user's chosen display settings.
 *
 * When `override` is set, it replaces the model name entirely.
 * Otherwise, `format` controls how the raw name is abbreviated:
 *
 *   full:    Return raw name unchanged   (e.g. "Opus 4.6 (1M context)")
 *   compact: Strip context-window suffix (e.g. "Opus 4.6")
 *   short:   Strip context suffix AND leading "Claude " prefix (e.g. "Opus 4.6")
 */
export function formatModelName(name, format, override) {
    if (override) {
        return override;
    }
    if (!format || format === 'full') {
        return name;
    }
    let result = stripContextSuffix(name);
    if (format === 'short') {
        result = result.replace(/^Claude\s+/i, '');
    }
    return result;
}
function normalizeBedrockModelLabel(modelId) {
    if (!isBedrockModelId(modelId)) {
        return null;
    }
    const lowercaseId = modelId.toLowerCase();
    const claudePrefix = 'anthropic.claude-';
    const claudeIndex = lowercaseId.indexOf(claudePrefix);
    if (claudeIndex === -1) {
        return null;
    }
    let suffix = lowercaseId.slice(claudeIndex + claudePrefix.length);
    suffix = suffix.replace(/-v\d+:\d+$/, '');
    suffix = suffix.replace(/-\d{8}$/, '');
    const tokens = suffix.split('-').filter(Boolean);
    if (tokens.length === 0) {
        return null;
    }
    const familyIndex = tokens.findIndex((token) => token === 'haiku' || token === 'sonnet' || token === 'opus');
    if (familyIndex === -1) {
        return null;
    }
    const family = tokens[familyIndex];
    const beforeVersion = readNumericVersion(tokens, familyIndex - 1, -1).reverse();
    const afterVersion = readNumericVersion(tokens, familyIndex + 1, 1);
    const versionParts = beforeVersion.length >= afterVersion.length ? beforeVersion : afterVersion;
    const version = versionParts.length ? versionParts.join('.') : null;
    const familyLabel = family[0].toUpperCase() + family.slice(1);
    return version ? `Claude ${familyLabel} ${version}` : `Claude ${familyLabel}`;
}
function readNumericVersion(tokens, startIndex, step) {
    const parts = [];
    for (let i = startIndex; i >= 0 && i < tokens.length; i += step) {
        if (!/^\d+$/.test(tokens[i])) {
            break;
        }
        parts.push(tokens[i]);
        if (parts.length === 2) {
            break;
        }
    }
    return parts;
}
//# sourceMappingURL=stdin.js.map