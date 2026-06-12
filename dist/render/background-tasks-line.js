import { yellow, green, label } from './colors.js';
/**
 * Background tasks display (OMC-style)
 * Shows bg:X/Y where X is running and Y is total slots
 */
export function renderBackgroundTasksLine(ctx) {
    const { agents } = ctx.transcript;
    // Count running background agents
    const runningBg = agents.filter((a) => a.background && a.status === 'running').length;
    // Total background slots (default 5, configurable)
    const totalSlots = ctx.config?.display?.backgroundTaskSlots ?? 5;
    if (runningBg === 0) {
        return null;
    }
    const countDisplay = `${runningBg}/${totalSlots}`;
    const colorFn = runningBg >= totalSlots ? yellow : green;
    const countLabel = colorFn(`bg:${countDisplay}`);
    return `${label('tasks:', ctx.config?.colors)}${label(' ')}${countLabel}`;
}
//# sourceMappingURL=background-tasks-line.js.map