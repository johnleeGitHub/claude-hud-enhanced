import { resolveSessionCost, formatUsd, formatCostWithCny } from '../../cost.js';
import { t } from '../../i18n/index.js';
import { label } from '../colors.js';
export function renderCostEstimate(ctx) {
    if (ctx.config?.display?.showCost !== true) {
        return null;
    }
    const cost = resolveSessionCost(ctx.stdin, ctx.transcript.sessionTokens, ctx.config?.modelPricing);
    if (!cost) {
        return null;
    }
    const labelKey = cost.source === 'native' ? 'label.cost' : 'label.estimatedCost';
    const providerTag = cost.provider ? ` [${cost.provider}]` : '';
    // Show CNY equivalent when explicitly enabled or when language is zh/zh-Hans
    const showCny = ctx.config.display.showCnyCost || (ctx.config.language?.startsWith('zh') ?? false);
    const formatted = showCny
        ? formatCostWithCny(cost.totalUsd, ctx.config.language)
        : formatUsd(cost.totalUsd);
    return label(`${t(labelKey)} ${formatted}${providerTag}`, ctx.config?.colors);
}
//# sourceMappingURL=cost.js.map