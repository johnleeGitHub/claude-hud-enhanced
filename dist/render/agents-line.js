import { yellow, green, magenta, cyan, label } from './colors.js';
const MAX_RECENT_COMPLETED = 2;
const MAX_AGENTS_SHOWN = 3;
/**
 * Model tier codes (OMC-style)
 * O = Opus (high reasoning)
 * e = Sonnet (balanced)
 * s = Haiku (fast)
 */
function getAgentTierCode(agent) {
    const model = agent.model?.toLowerCase() ?? '';
    if (model.includes('opus'))
        return 'O';
    if (model.includes('sonnet'))
        return 'e';
    if (model.includes('haiku'))
        return 's';
    // Fallback based on agent type hints
    const type = agent.type.toLowerCase();
    if (type.includes('opus') || type.includes('architect') || type.includes('planner'))
        return 'O';
    if (type.includes('sonnet'))
        return 'e';
    if (type.includes('haiku'))
        return 's';
    return 'a'; // default agent
}
function getTierColor(code) {
    switch (code) {
        case 'O': return cyan; // Opus - cyan
        case 'e': return green; // Sonnet - green
        case 's': return yellow; // Haiku - yellow
        default: return magenta; // Default agent - magenta
    }
}
export function renderAgentsLine(ctx) {
    const { agents } = ctx.transcript;
    const colors = ctx.config?.colors;
    const runningAgents = agents.filter((a) => a.status === 'running');
    const recentCompleted = agents
        .filter((a) => a.status === 'completed')
        .slice(-MAX_RECENT_COMPLETED);
    const seen = new Set();
    const toShow = [...runningAgents, ...recentCompleted]
        .filter((a) => {
        if (seen.has(a.id))
            return false;
        seen.add(a.id);
        return true;
    })
        .slice(-MAX_AGENTS_SHOWN);
    if (toShow.length === 0) {
        return null;
    }
    const lines = [];
    for (let i = 0; i < toShow.length; i++) {
        const agent = toShow[i];
        const isLast = i === toShow.length - 1;
        lines.push(formatAgentMultiline(agent, colors, isLast));
    }
    return lines.join('\n');
}
/**
 * OMC-style multiline format with tree characters
 * ├─ O architect    2m   analyzing architecture patterns...
 * └─ e explore   45s   searching for test files
 */
function formatAgentMultiline(agent, colors, isLast = false) {
    const treeChar = isLast ? '└─' : '├─';
    const tierCode = getAgentTierCode(agent);
    const tierColorFn = getTierColor(tierCode);
    const tierDisplay = tierColorFn(tierCode);
    const statusIcon = agent.status === 'running' ? yellow('◐') : green('✓');
    const elapsed = formatElapsed(agent);
    const desc = agent.description
        ? label(` ${truncateDesc(agent.description, 45)}`, colors)
        : '';
    // Format: ├─ O architect    2m   description
    return `${treeChar} ${tierDisplay} ${label(elapsed, colors)}${desc}`;
}
function formatAgent(agent, colors) {
    const tierCode = getAgentTierCode(agent);
    const tierColorFn = getTierColor(tierCode);
    const statusIcon = agent.status === 'running' ? yellow('◐') : green('✓');
    const elapsed = formatElapsed(agent);
    const desc = agent.description
        ? label(`: ${truncateDesc(agent.description)}`, colors)
        : '';
    return `${statusIcon} ${tierColorFn(tierCode)}${desc} ${label(`(${elapsed})`, colors)}`;
}
function truncateDesc(desc, maxLen = 40) {
    if (desc.length <= maxLen)
        return desc;
    return desc.slice(0, maxLen - 3) + '...';
}
function formatElapsed(agent) {
    const now = Date.now();
    const start = agent.startTime.getTime();
    const end = agent.endTime?.getTime() ?? now;
    const ms = Math.max(0, end - start);
    if (ms < 1000)
        return '<1s';
    if (ms < 60_000)
        return `${Math.round(ms / 1000)}s`;
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins < 60)
        return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
}
//# sourceMappingURL=agents-line.js.map