import type { HudModelPricingConfig, SessionTokenUsage, StdinData } from './types.js';
export interface SessionCostEstimate {
    totalUsd: number;
    inputUsd: number;
    cacheCreationUsd: number;
    cacheReadUsd: number;
    outputUsd: number;
    /** Provider label for third-party estimates, e.g. "DeepSeek" */
    provider?: string;
}
export interface SessionCostDisplay {
    totalUsd: number;
    source: 'native' | 'estimate';
    /** Provider label for third-party estimates, e.g. "DeepSeek" */
    provider?: string;
}
export declare function estimateSessionCost(stdin: StdinData, sessionTokens: SessionTokenUsage | undefined, modelPricingConfig?: HudModelPricingConfig): SessionCostEstimate | null;
export declare function resolveSessionCost(stdin: StdinData, sessionTokens: SessionTokenUsage | undefined, modelPricingConfig?: HudModelPricingConfig): SessionCostDisplay | null;
export declare function formatUsd(amount: number): string;
/** CNY→USD rate used when displaying cost in both currencies */
export declare const CNY_TO_USD = 7.2;
export declare function formatCny(amount: number): string;
/**
 * Format cost with both USD and CNY, prioritizing based on locale.
 *
 * - zh-first (language starts with 'zh'):  ¥0.55≈$0.077
 * - usd-first (default):                   $0.077 (¥0.55)
 */
export declare function formatCostWithCny(usd: number, language: string): string;
//# sourceMappingURL=cost.d.ts.map