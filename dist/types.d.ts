import type { HudConfig } from './config.js';
import type { GitStatus } from './git.js';
export interface StdinData {
    transcript_path?: string;
    cwd?: string;
    workspace?: {
        current_dir?: string;
        project_dir?: string;
        added_dirs?: string[];
        git_worktree?: string;
    } | null;
    model?: {
        id?: string;
        display_name?: string;
    };
    context_window?: {
        context_window_size?: number;
        total_input_tokens?: number | null;
        total_output_tokens?: number | null;
        current_usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        } | null;
        used_percentage?: number | null;
        remaining_percentage?: number | null;
    };
    cost?: {
        total_cost_usd?: number | null;
        total_duration_ms?: number | null;
        total_api_duration_ms?: number | null;
        total_lines_added?: number | null;
        total_lines_removed?: number | null;
    } | null;
    rate_limits?: {
        five_hour?: {
            used_percentage?: number | null;
            resets_at?: number | null;
        } | null;
        seven_day?: {
            used_percentage?: number | null;
            resets_at?: number | null;
        } | null;
    } | null;
    effort?: string | {
        level?: string | null;
        [key: string]: unknown;
    } | null;
}
export interface ToolEntry {
    id: string;
    name: string;
    target?: string;
    status: 'running' | 'completed' | 'error';
    startTime: Date;
    endTime?: Date;
}
export interface AgentEntry {
    id: string;
    type: string;
    model?: string;
    description?: string;
    status: 'running' | 'completed';
    startTime: Date;
    endTime?: Date;
    background?: boolean;
}
export interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}
export interface UsageData {
    fiveHour: number | null;
    sevenDay: number | null;
    fiveHourResetAt: Date | null;
    sevenDayResetAt: Date | null;
    balanceLabel?: string | null;
}
export interface ExternalUsageSnapshot {
    five_hour?: {
        used_percentage?: number | null;
        resets_at?: string | number | null;
    } | null;
    seven_day?: {
        used_percentage?: number | null;
        resets_at?: string | number | null;
    } | null;
    updated_at?: string | number | null;
    balance_label?: string | null;
}
export interface MemoryInfo {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
}
/** Check if usage limit is reached (either window at 100%) */
export declare function isLimitReached(data: UsageData): boolean;
export interface SessionTokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
}
/** A single pricing entry for a model, matched by regex pattern against model.id */
export interface ModelPricingEntry {
    /** Regex pattern matched against model.id or model.display_name (case-insensitive) */
    pattern: string;
    /** Input price in USD per million tokens (cache miss / normal input) */
    inputUsdPerMillion: number;
    /** Output price in USD per million tokens */
    outputUsdPerMillion: number;
    /** Optional: per-million price for cache reads. Defaults to inputUsdPerMillion × 0.1 */
    cacheReadUsdPerMillion?: number;
    /** Optional: per-million price for cache creation. Defaults to inputUsdPerMillion × 1.25 */
    cacheCreationUsdPerMillion?: number;
    /** Optional display label, e.g. "DeepSeek", "OpenAI" */
    provider?: string;
}
/** Resolved pricing for cost calculation (all fields resolved to concrete values) */
export interface ModelPricing {
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
    cacheReadUsdPerMillion: number;
    cacheCreationUsdPerMillion: number;
    /** Provider display label (e.g. "DeepSeek", "OpenAI") propagated from matched entry */
    provider?: string;
}
/** Config section for third-party model pricing stored in HudConfig.modelPricing */
export interface HudModelPricingConfig {
    /** User-defined pricing entries (highest priority) */
    entries: ModelPricingEntry[];
    /** Enable web-based pricing updates */
    enablePricingUpdate: boolean;
    /** URL to fetch latest pricing.json from */
    pricingUpdateUrl: string;
    /** ISO timestamp of last successful update */
    pricingUpdatedAt: string;
}
export interface TranscriptData {
    tools: ToolEntry[];
    agents: AgentEntry[];
    todos: TodoItem[];
    sessionStart?: Date;
    sessionName?: string;
    lastAssistantResponseAt?: Date;
    sessionTokens?: SessionTokenUsage;
    lastCompactBoundaryAt?: Date;
    lastCompactPostTokens?: number;
    advisorModel?: string;
}
export interface RenderContext {
    stdin: StdinData;
    transcript: TranscriptData;
    claudeMdCount: number;
    rulesCount: number;
    mcpCount: number;
    hooksCount: number;
    sessionDuration: string;
    gitStatus: GitStatus | null;
    usageData: UsageData | null;
    memoryUsage: MemoryInfo | null;
    config: HudConfig;
    extraLabel: string | null;
    outputStyle?: string;
    claudeCodeVersion?: string;
    effortLevel?: string;
    effortSymbol?: string;
    isOmc: boolean;
    modelSwitched?: boolean;
    previousModel?: string;
}
//# sourceMappingURL=types.d.ts.map