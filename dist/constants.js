/**
 * Constants and enhanced features for Claude HUD Enhanced.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
/**
 * Autocompact buffer percentage.
 *
 * NOTE: This value is applied as a percentage of Claude Code's reported
 * context window size. The `33k/200k` example is just the 200k-window case.
 * It is empirically derived from current Claude Code `/context` output, is
 * not officially documented by Anthropic, and may need adjustment if users
 * report mismatches in future Claude Code versions.
 */
export const AUTOCOMPACT_BUFFER_PERCENT = 0.165;
/**
 * Known model context windows (tokens).
 * Used as fallback when Claude Code stdin doesn't provide context_window_size.
 */
export const KNOWN_MODEL_CONTEXT_WINDOWS = {
    // DeepSeek
    'deepseek': 1000000,
    'deepseek-v4': 1000000,
    // MiniMax (AI公司)
    'minimax': 1000000,
    // Moonshot (月之暗面 Kimi)
    'moonshot': 128000,
    'kimi': 128000,
    // Zhipu AI (智谱GLM)
    'glm': 128000,
    'zhipu': 128000,
    // Claude (Anthropic)
    'claude-opus': 200000,
    'claude-sonnet': 200000,
    'claude-haiku': 200000,
    'opus': 200000,
    'sonnet': 200000,
    'haiku': 200000,
    // OpenAI
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4': 128000,
    'gpt-35-turbo': 16385,
    // Google
    'gemini': 1000000,
    'gemini-pro': 32768,
    // Meta
    'llama': 4096,
    // Mistral
    'mistral': 32768,
    'mixtral': 32768,
};
/**
 * Infer context window size from model ID string.
 * Returns null if no match found (will use stdin value or default).
 */
export function inferContextWindow(modelId) {
    if (!modelId)
        return null;
    const lower = modelId.toLowerCase();
    for (const [key, size] of Object.entries(KNOWN_MODEL_CONTEXT_WINDOWS)) {
        if (lower.includes(key)) {
            return size;
        }
    }
    return null;
}
/**
 * OMC detection - checks if oh-my-claudecode is installed.
 * Used to conditionally enable OMC-specific features like background tasks.
 */
let _omcDetected = null;
export function isOmcInstalled() {
    if (_omcDetected !== null) {
        return _omcDetected;
    }
    try {
        const homeDir = os.homedir();
        const omcPath = path.join(homeDir, '.claude', 'omc');
        _omcDetected = fs.existsSync(omcPath);
    }
    catch {
        _omcDetected = false;
    }
    return _omcDetected;
}
/**
 * Reset OMC detection cache (for testing).
 */
export function resetOmcDetection() {
    _omcDetected = null;
}
export const DISPLAY_DENSITY_LEVELS = [
    {
        density: 'minimal',
        maxWidth: 80,
        visibleElements: ['model', 'project', 'context', 'git'],
    },
    {
        density: 'compact',
        maxWidth: 120,
        visibleElements: ['model', 'project', 'context', 'git', 'usage', 'tools'],
    },
    {
        density: 'normal',
        maxWidth: 180,
        visibleElements: ['model', 'project', 'context', 'git', 'usage', 'tools', 'agents', 'todos', 'session'],
    },
    {
        density: 'full',
        maxWidth: Infinity,
        visibleElements: ['*'], // All elements
    },
];
/**
 * Get display density based on terminal width.
 */
export function getDisplayDensity(columns) {
    if (columns === null || columns <= 0) {
        return 'full';
    }
    for (const level of DISPLAY_DENSITY_LEVELS) {
        if (columns <= level.maxWidth) {
            return level.density;
        }
    }
    return 'full';
}
/**
 * Check if an element should be visible at the current display density.
 */
export function isElementVisible(element, density) {
    const config = DISPLAY_DENSITY_LEVELS.find(l => l.density === density);
    if (!config)
        return true;
    if (config.visibleElements.includes('*'))
        return true;
    return config.visibleElements.includes(element);
}
export const COLOR_THEMES = [
    {
        name: 'default',
        displayName: '默认',
        description: '经典配色方案',
        colors: {
            context: 'green',
            usage: 'brightBlue',
            warning: 'yellow',
            usageWarning: 'brightMagenta',
            critical: 'red',
            model: 'cyan',
            project: 'yellow',
            git: 'magenta',
            gitBranch: 'cyan',
            label: 'dim',
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'solarized-dark',
        displayName: 'Solarized暗色',
        description: '温暖的暗色主题',
        colors: {
            context: '#859900', // green
            usage: '#268bd2', // blue
            warning: '#b58900', // yellow
            usageWarning: '#d33682', // magenta
            critical: '#dc322f', // red
            model: '#2aa198', // cyan
            project: '#b58900', // yellow
            git: '#d33682', // magenta
            gitBranch: '#2aa198', // cyan
            label: '#586e75', // dim gray
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'dracula',
        displayName: 'Dracula',
        description: '紫色主题',
        colors: {
            context: '#50fa7b', // green
            usage: '#8be9fd', // cyan
            warning: '#f1fa8c', // yellow
            usageWarning: '#ff79c6', // pink
            critical: '#ff5555', // red
            model: '#bd93f9', // purple
            project: '#f8f8f2', // white
            git: '#ff79c6', // pink
            gitBranch: '#8be9fd', // cyan
            label: '#6272a4', // dim
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'nord',
        displayName: 'Nord',
        description: '北极蓝主题',
        colors: {
            context: '#a3be8c', // green
            usage: '#88c0d0', // cyan
            warning: '#ebcb8b', // yellow
            usageWarning: '#d08770', // orange
            critical: '#bf616a', // red
            model: '#81a1c1', // blue
            project: '#ebcb8b', // yellow
            git: '#b48ead', // purple
            gitBranch: '#8fbcbb', // light cyan
            label: '#4c566a', // dim
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'catppuccin-mocha',
        displayName: 'Catppuccin Mocha',
        description: '柔和的咖啡色调',
        colors: {
            context: '#a6e3a1', // green
            usage: '#89dceb', // sky
            warning: '#f9e2af', // yellow
            usageWarning: '#fab387', // peach
            critical: '#f38ba8', // red
            model: '#cba6f7', // mauve
            project: '#f5e0dc', // rosewater
            git: '#f5c2e7', // pink
            gitBranch: '#94e2d5', // teal
            label: '#6c7086', // overlay0
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'monokai',
        displayName: 'Monokai',
        description: '经典编辑器主题',
        colors: {
            context: '#a6e22e', // green
            usage: '#66d9ef', // blue
            warning: '#e6db74', // yellow
            usageWarning: '#fd971f', // orange
            critical: '#f92672', // red
            model: '#ae81ff', // purple
            project: '#f8f8f0', // white
            git: '#f92672', // pink
            gitBranch: '#66d9ef', // blue
            label: '#75715e', // comment
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'gruvbox',
        displayName: 'Gruvbox',
        description: '复古配色',
        colors: {
            context: '#98971a', // green
            usage: '#458588', // blue
            warning: '#d79921', // yellow
            usageWarning: '#cc241d', // red
            critical: '#fb4913', // bright red
            model: '#b16286', // purple
            project: '#fabd2f', // yellow
            git: '#d65d0e', // orange
            gitBranch: '#83a598', // teal
            label: '#928374', // dim gray
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    // ===== 醒目主题 =====
    {
        name: 'neon',
        displayName: '霓虹',
        description: '高对比霓虹灯效果',
        colors: {
            context: '#00ff41', // 霓虹绿
            usage: '#00d4ff', // 霓虹蓝
            warning: '#ffff00', // 亮黄
            usageWarning: '#ff6b00', // 橙色
            critical: '#ff0040', // 霓虹红
            model: '#ff00ff', // 品红
            project: '#00ff41', // 霓虹绿
            git: '#ff6b00', // 橙色
            gitBranch: '#00d4ff', // 霓虹蓝
            label: '#888888', // 灰色
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'synthwave',
        displayName: '赛博朋克',
        description: '80年代复古未来风格',
        colors: {
            context: '#ff2a6d', // 粉红
            usage: '#05d9e8', // 青色
            warning: '#d1f7ff', // 亮白
            usageWarning: '#ff2a6d', // 粉红
            critical: '#ff0040', // 深红
            model: '#d300c5', // 紫色
            project: '#ff2a6d', // 粉红
            git: '#ff9e00', // 金色
            gitBranch: '#05d9e8', // 青色
            label: '#777777', // 灰色
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'matrix',
        displayName: '黑客帝国',
        description: '经典绿色代码风格',
        colors: {
            context: '#00ff00', // 纯绿
            usage: '#00ff00', // 纯绿
            warning: '#ffff00', // 黄色
            usageWarning: '#ff6600', // 橙色
            critical: '#ff0000', // 红色
            model: '#00ff00', // 纯绿
            project: '#00ff00', // 纯绿
            git: '#00ff00', // 纯绿
            gitBranch: '#00ff00', // 纯绿
            label: '#008800', // 深绿
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'sunset',
        displayName: '日落',
        description: '温暖的日落渐变',
        colors: {
            context: '#ff6b6b', // 珊瑚红
            usage: '#4ecdc4', // 青绿
            warning: '#ffe66d', // 金黄
            usageWarning: '#ff8c42', // 橙色
            critical: '#c44569', // 深红
            model: '#ff6b6b', // 珊瑚红
            project: '#ffe66d', // 金黄
            git: '#ff8c42', // 橙色
            gitBranch: '#4ecdc4', // 青绿
            label: '#999999', // 灰色
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
    {
        name: 'ocean',
        displayName: '海洋',
        description: '深海蓝色调',
        colors: {
            context: '#00ff88', // 海绿
            usage: '#00bfff', // 天蓝
            warning: '#ffd700', // 金色
            usageWarning: '#ff6347', // 番茄红
            critical: '#ff4500', // 橙红
            model: '#00bfff', // 天蓝
            project: '#00ff88', // 海绿
            git: '#ffd700', // 金色
            gitBranch: '#87ceeb', // 浅蓝
            label: '#778899', // 灰蓝
            custom: 208,
            barFilled: '█',
            barEmpty: '░',
        },
    },
];
/**
 * Get theme by name, returns default if not found.
 */
export function getTheme(themeName) {
    if (!themeName) {
        return COLOR_THEMES[0]; // default
    }
    const theme = COLOR_THEMES.find(t => t.name === themeName);
    return theme ?? COLOR_THEMES[0];
}
/**
 * List all available theme names.
 */
export function listThemes() {
    return COLOR_THEMES;
}
const MODEL_HISTORY_FILE = '.model-history.json';
function getModelHistoryPath() {
    return path.join(os.homedir(), '.claude', 'plugins', 'claude-hud', MODEL_HISTORY_FILE);
}
export function getModelHistory() {
    try {
        const filePath = getModelHistoryPath();
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch { /* ignore */ }
    return { current: null, previous: null, switchedAt: null };
}
export function setCurrentModel(modelId) {
    const history = getModelHistory();
    const switched = history.current !== null && history.current !== modelId;
    const newHistory = {
        current: modelId,
        previous: switched ? history.current : history.previous,
        switchedAt: switched ? Date.now() : history.switchedAt,
    };
    try {
        const dir = path.dirname(getModelHistoryPath());
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(getModelHistoryPath(), JSON.stringify(newHistory), 'utf-8');
    }
    catch { /* ignore */ }
    return {
        current: newHistory.current,
        previous: newHistory.previous,
        switched,
    };
}
//# sourceMappingURL=constants.js.map