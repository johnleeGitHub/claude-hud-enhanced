import { label } from '../colors.js';
import { t } from '../../i18n/index.js';
import { getOutputSpeed } from '../../speed-tracker.js';
export function renderCostLine(ctx) {
    const cost = ctx.stdin.cost?.total_cost_usd;
    if (typeof cost !== 'number' || cost <= 0) {
        return null;
    }
    const colors = ctx.config?.colors;
    return label(`$${cost.toFixed(2)}`, colors);
}
export function renderSpeedLine(ctx) {
    const display = ctx.config?.display;
    if (display?.showSpeed === false) {
        return null;
    }
    const speed = getOutputSpeed(ctx.stdin);
    if (speed === null) {
        return null;
    }
    const colors = ctx.config?.colors;
    return label(`${t('format.out')}: ${speed.toFixed(1)} ${t('format.tokPerSec')}`, colors);
}
//# sourceMappingURL=cost-speed.js.map