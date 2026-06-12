/**
 * Autocompact buffer percentage.
 *
 * NOTE: This value is applied as a percentage of Claude Code's reported
 * context window size. The `33k/200k` example is just the 200k-window case.
 * It is empirically derived from current Claude Code `/context` output, is
 * not officially documented by Anthropic, and may need adjustment if users
 * report mismatches in future Claude Code versions.
 */
export declare const AUTOCOMPACT_BUFFER_PERCENT = 0.165;
/**
 * Known model context windows (tokens).
 * Used as fallback when Claude Code stdin doesn't provide context_window_size.
 */
export declare const KNOWN_MODEL_CONTEXT_WINDOWS: Record<string, number>;
/**
 * Infer context window size from model ID string.
 * Returns null if no match found (will use stdin value or default).
 */
export declare function inferContextWindow(modelId: string): number | null;
export declare function isOmcInstalled(): boolean;
/**
 * Reset OMC detection cache (for testing).
 */
export declare function resetOmcDetection(): void;
/**
 * Progressive display levels based on terminal width.
 * Controls which elements are visible at different widths.
 */
export type DisplayDensity = 'full' | 'normal' | 'compact' | 'minimal';
export interface DensityConfig {
    density: DisplayDensity;
    maxWidth: number;
    visibleElements: string[];
}
export declare const DISPLAY_DENSITY_LEVELS: DensityConfig[];
/**
 * Get display density based on terminal width.
 */
export declare function getDisplayDensity(columns: number | null): DisplayDensity;
/**
 * Check if an element should be visible at the current display density.
 */
export declare function isElementVisible(element: string, density: DisplayDensity): boolean;
/**
 * Color theme definitions.
 * Each theme provides a complete color palette for HUD elements.
 */
import type { HudColorOverrides } from './config.js';
export interface ColorTheme {
    name: string;
    displayName: string;
    colors: HudColorOverrides;
    description: string;
}
export declare const COLOR_THEMES: ColorTheme[];
/**
 * Get theme by name, returns default if not found.
 */
export declare function getTheme(themeName: string | null | undefined): ColorTheme;
/**
 * List all available theme names.
 */
export declare function listThemes(): ColorTheme[];
interface ModelHistory {
    current: string | null;
    previous: string | null;
    switchedAt: number | null;
}
export declare function getModelHistory(): ModelHistory;
export declare function setCurrentModel(modelId: string | null): {
    current: string | null;
    previous: string | null;
    switched: boolean;
};
export {};
//# sourceMappingURL=constants.d.ts.map