import { label } from '../colors.js';
import { t } from '../../i18n/index.js';
/**
 * Timestamp display module
 * Shows current time in configurable format
 */
export function renderTimestampLine(ctx) {
    const display = ctx.config?.display;
    if (display?.showTimestamp !== true) {
        return null;
    }
    const format = display?.timestampFormat ?? 'HH:mm';
    const timeStr = formatTime(format);
    const colors = ctx.config?.colors;
    return `${label(t('label.time') + ':', colors)}${label(' ')}${timeStr}`;
}
function formatTime(format) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    switch (format) {
        case 'HH:mm':
            return `${hours}:${minutes}`;
        case 'HH:mm:ss':
            return `${hours}:${minutes}:${seconds}`;
        case 'h:mm a':
            const h = now.getHours();
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            return `${hour12}:${minutes} ${ampm}`;
        default:
            return `${hours}:${minutes}`;
    }
}
//# sourceMappingURL=timestamp-line.js.map
