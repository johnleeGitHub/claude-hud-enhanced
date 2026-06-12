import type { RenderContext } from "../../types.js";
import {
  getContextPercent,
  getBufferedPercent,
  getTotalTokens,
  getEffectiveContextWindow,
} from "../../stdin.js";
import { coloredBar, label, getContextColor, RESET } from "../colors.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { t } from "../../i18n/index.js";
import { progressLabel } from "./label-align.js";
import { getOutputSpeed } from "../../speed-tracker.js";

const DEBUG =
  process.env.DEBUG?.includes("claude-hud-enhanced") || process.env.DEBUG?.includes("claude-hud") || process.env.DEBUG === "*";

export function renderIdentityLine(
  ctx: RenderContext,
  alignLabels = false,
): string {
  const autoCompactWindow = ctx.config?.display?.autoCompactWindow ?? null;
  const rawPercent = getContextPercent(ctx.stdin, autoCompactWindow);
  const bufferedPercent = getBufferedPercent(ctx.stdin, autoCompactWindow);
  const autocompactMode = ctx.config?.display?.autocompactBuffer ?? "enabled";
  const percent = autocompactMode === "disabled" ? rawPercent : bufferedPercent;
  const colors = ctx.config?.colors;

  if (DEBUG && autocompactMode === "disabled") {
    console.error(
      `[claude-hud-enhanced:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`,
    );
  }

  const display = ctx.config?.display;
  const contextThresholds = {
    warning: display?.contextWarningThreshold,
    critical: display?.contextCriticalThreshold,
  };
  const contextValueMode = display?.contextValue ?? "percent";
  const contextValue = formatContextValue(ctx, percent, contextValueMode);
  const contextValueDisplay = `${getContextColor(percent, colors, contextThresholds)}${contextValue}${RESET}`;

  let line =
    display?.showContextBar !== false
      ? `${progressLabel("label.context", colors, alignLabels)} ${coloredBar(percent, getAdaptiveBarWidth(), colors, contextThresholds)} ${contextValueDisplay}`
      : `${progressLabel("label.context", colors, alignLabels)} ${contextValueDisplay}`;

  if (display?.showTokenBreakdown !== false && percent >= (display?.contextCriticalThreshold ?? 85)) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (usage) {
      const input = formatTokens(usage.input_tokens ?? 0);
      const cache = formatTokens(
        (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0),
      );
      line += label(
        ` (${t("format.in")}: ${input}, ${t("format.cache")}: ${cache})`,
        colors,
      );
    }
  }

  // Add speed after context bar
  if (display?.showSpeed) {
    const speed = getOutputSpeed(ctx.stdin);
    if (speed !== null) {
      line += label(` │ ${t("format.out")}: ${speed.toFixed(1)} ${t("format.tokPerSec")}`, colors);
    }
  }

  return line;
}

function formatTokens(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(0)}k`;
  }
  return n.toString();
}

function formatContextValue(
  ctx: RenderContext,
  percent: number,
  mode: "percent" | "tokens" | "remaining" | "both" | "percentTokens",
): string {
  const totalTokens = getTotalTokens(ctx.stdin);
  const autoCompactWindow = ctx.config?.display?.autoCompactWindow ?? null;
  const size = getEffectiveContextWindow(ctx.stdin, autoCompactWindow);

  if (mode === "tokens") {
    if (size > 0) {
      return `${formatTokens(totalTokens)}/${formatTokens(size)}`;
    }
    return formatTokens(totalTokens);
  }

  if (mode === "both") {
    if (size > 0) {
      return `${percent}% (${formatTokens(totalTokens)}/${formatTokens(size)})`;
    }
    return `${percent}%`;
  }

  if (mode === "percentTokens") {
    let result = size > 0 ? `${percent}% ${formatTokens(totalTokens)}/${formatTokens(size)}` : `${percent}%`;
    // Add speed if available
    const speed = getOutputSpeed(ctx.stdin);
    if (speed !== null && ctx.config?.display?.showSpeed !== false) {
      result += ` │ out: ${speed.toFixed(1)} tok/s`;
    }
    return result;
  }

  if (mode === "remaining") {
    return `${Math.max(0, 100 - percent)}%`;
  }

  return `${percent}%`;
}
