---
name: hud-configure
description: Configure HUD display options (layout, language, presets, display elements)
tools: Read, Write, AskUserQuestion
---

# Configure Claude HUD

**FIRST**: Use the Read tool to load `~/.claude/plugins/claude-hud-enhanced/config.json` if it exists.

Store current values and note whether config exists (determines which flow to use).

## Always On (Core Features)

These are always enabled and NOT configurable:
- Model name `[Opus]`
- Context bar `████░░░░░░ 45%`

Advanced settings such as `colors.*`, `pathLevels`, `display.timeFormat`,
`display.usageThreshold`, `display.usageValue`, `display.environmentThreshold`,
`display.contextWarningThreshold`, and `display.contextCriticalThreshold` are
preserved when saving but are not edited by this guided flow.

---

## Two Flows Based on Config State

### Flow A: New User (no config)
Questions: **Layout → Preset → Language → Theme → Turn Off → Turn On → Custom Line**

### Flow B: Update Config (config exists)
Questions: **Turn Off → Turn On → Git Style → Layout/Reset → Theme → Language → Custom Line** (7 questions max)

---

## Flow A: New User (7 Questions)

### Q1: Layout
- header: "Layout"
- question: "Choose your HUD layout:"
- multiSelect: false
- options:
  - "Expanded (Recommended)" - Split into semantic lines (identity, project, environment, usage)
  - "Compact" - Everything on one line
  - "Compact + Separators" - One line with separator before activity

### Q2: Preset
- header: "Preset"
- question: "Choose a starting configuration:"
- multiSelect: false
- options:
  - **"Recommended"** - Balanced full-featured setup (中文, Matrix主题, 所有功能)
  - "Full" - Everything enabled (all features + advanced options)
  - "Essential" - Activity + git, minimal info

### Q3: Language
- header: "Language"
- question: "Choose your HUD label language:"
- multiSelect: false
- options:
  - "English (Recommended)" - Default, simplest onboarding path
  - "中文" - Show HUD labels and status text in Chinese

Save as `language: "en"` or `language: "zh-Hans"`.

### Q4: Theme
- header: "Theme"
- question: "Choose your HUD color theme:"
- multiSelect: false
- options:
  - "默认 (Default)" - 经典配色方案
  - "Solarized 暗色" - 温暖的暗色主题
  - "Dracula" - 紫色主题
  - "Nord" - 北极蓝主题
  - "Catppuccin Mocha" - 柔和的咖啡色调
  - "Monokai" - 经典编辑器主题
  - "Gruvbox" - 复古配色
  - "霓虹 (Neon)" - 高对比霓虹灯效果
  - "赛博朋克 (Synthwave)" - 80年代复古未来风格
  - "黑客帝国 (Matrix)" - 经典绿色代码风格
  - "日落 (Sunset)" - 温暖的日落渐变
  - "海洋 (Ocean)" - 深海蓝色调

Save the corresponding theme name to `display.theme`:
- "默认 (Default)" → `"default"`
- "Solarized 暗色" → `"solarized-dark"`
- "Dracula" → `"dracula"`
- "Nord" → `"nord"`
- "Catppuccin Mocha" → `"catppuccin-mocha"`
- "Monokai" → `"monokai"`
- "Gruvbox" → `"gruvbox"`
- "霓虹 (Neon)" → `"neon"`
- "赛博朋克 (Synthwave)" → `"synthwave"`
- "黑客帝国 (Matrix)" → `"matrix"`
- "日落 (Sunset)" → `"sunset"`
- "海洋 (Ocean)" → `"ocean"`

### Q5: Turn Off (based on chosen preset)
- header: "Turn Off"
- question: "Disable any of these? (enabled by your preset)"
- multiSelect: true
- options: **ONLY items that are ON in the chosen preset** (max 4)
  - "Tools activity" - ◐ Edit: file.ts | ✓ Read ×3
  - "Agents status" - ◐ explore [haiku]: Finding code
  - "Todo progress" - ▸ Fix bug (2/5 tasks)
  - "Project name" - my-project path display
  - "Git status" - git:(main*) branch indicator
  - "Config counts" - 2 CLAUDE.md | 4 rules
  - "Token breakdown" - (in: 45k, cache: 12k)
  - "Output speed" - out: 42.1 tok/s
  - "Usage limits" - 5h: 25% | 7d: 10%
  - "Compact usage" - 5h: 25% (1h 30m) shorter format
  - "Session duration" - ⏱️ 5m
  - "Session name" - fix-auth-bug (session slug or custom title)
  - "Session tokens" - Tokens 12.8M (in: 7k, out: 28k, cache: 12.8M)
  - "Advisor model" - Advisor: Opus 4.7 (when /advisor is configured)
  - "Effort level" - ◕ xhigh reasoning effort indicator
  - "Prompt cache" - cache:5m TTL countdown
  - "Session cost" - $12.11 cost estimate
  - "Background tasks" - bg:2/5 task slots (OMC)
  - "Added directories" - extra working directory paths
  - "Output style" - output mode indicator

### Q6: Turn On (based on chosen preset)
- header: "Turn On"
- question: "Enable any of these? (disabled by your preset)"
- multiSelect: true
- options: **ONLY items that are OFF in the chosen preset** (max 4)
  - (same list as above, filtered to OFF items)

**Note:** If preset has all items ON (Full), Q6 shows "Nothing to enable - Full preset has everything!"
If preset has all items OFF (Minimal), Q5 shows "Nothing to disable - Minimal preset is already minimal!"

### Q7: Custom Line (optional)
- header: "Custom Line"
- question: "Add a custom phrase to display in the HUD? (e.g. a motto, max 80 chars)"
- multiSelect: false
- options:
  - "Skip" - No custom line
  - "Enter custom text" - Ask user for their phrase via AskUserQuestion (free text input)

If user chooses "Enter custom text", use AskUserQuestion to get their text. Save as `display.customLine` in config.

---

## Flow B: Update Config (7 Questions)

### Q1: Turn Off
- header: "Turn Off"
- question: "What do you want to DISABLE? (currently enabled)"
- multiSelect: true
- options: **ONLY items currently ON** (max 4, prioritize Activity first)
  - "Tools activity" - ◐ Edit: file.ts | ✓ Read ×3
  - "Agents status" - ◐ explore [haiku]: Finding code
  - "Todo progress" - ▸ Fix bug (2/5 tasks)
  - "Project name" - my-project path display
  - "Git status" - git:(main*) branch indicator
  - "Session name" - fix-auth-bug (session slug or custom title)
  - "Session tokens" - Tokens 12.8M (in: 7k, out: 28k, cache: 12.8M)
  - "Advisor model" - Advisor: Opus 4.7 (when /advisor is configured)
  - "Usage bar style" - ██░░ 25% visual bar (only if usageBarEnabled is true)
  - "Compact usage" - 5h: 25% (1h 30m) shorter format (only if usageCompact is false)
  - "Effort level" - ◕ xhigh reasoning effort indicator
  - "Prompt cache" - cache:5m TTL countdown
  - "Session cost" - $12.11 cost estimate
  - "Background tasks" - bg:2/5 task slots (OMC)
  - "Added directories" - extra working directory paths
  - "Output style" - output mode indicator

If more than 4 items ON, show Activity items (Tools, Agents, Todos, Project, Git) first.
Info items (Counts, Tokens, Usage, Speed, Duration) can be turned off via "Reset to Minimal" in Q4.

### Q2: Turn On
- header: "Turn On"
- question: "What do you want to ENABLE? (currently disabled)"
- multiSelect: true
- options: **ONLY items currently OFF** (max 4)
  - "Config counts" - 2 CLAUDE.md | 4 rules
  - "Token breakdown" - (in: 45k, cache: 12k)
  - "Output speed" - out: 42.1 tok/s
  - "Usage limits" - 5h: 25% | 7d: 10%
  - "Usage bar style" - ██░░ 25% visual bar (only if usageBarEnabled is false)
  - "Compact usage" - 5h: 25% (1h 30m) shorter format (only if usageCompact is false)
  - "Session name" - fix-auth-bug (session slug or custom title)
  - "Session tokens" - Tokens 12.8M (in: 7k, out: 28k, cache: 12.8M)
  - "Session duration" - ⏱️ 5m
  - "Advisor model" - Advisor: Opus 4.7 (when /advisor is configured)
  - "Effort level" - ◕ xhigh reasoning effort indicator
  - "Prompt cache" - cache:5m TTL countdown
  - "Session cost" - $12.11 cost estimate
  - "Background tasks" - bg:2/5 task slots (OMC)
  - "Added directories" - extra working directory paths
  - "Output style" - output mode indicator

### Q3: Git Style (only if Git is currently enabled)
- header: "Git Style"
- question: "How much git info to show?"
- multiSelect: false
- options:
  - "Branch only" - git:(main)
  - "Branch + dirty" - git:(main*) shows uncommitted changes
  - "Full details" - git:(main* ↑2 ↓1) includes ahead/behind
  - "File stats" - git:(main* !2 +1 ?3) Starship-compatible format

**Skip Q3 if Git is OFF** - proceed to Q4.

### Q4: Layout/Reset
- header: "Layout/Reset"
- question: "Change layout or reset to preset?"
- multiSelect: false
- options:
  - "Keep current" - No layout/preset changes (current: Expanded/Compact/Compact + Separators)
  - "Switch to Expanded" - Split into semantic lines (if not current)
  - "Switch to Compact" - Everything on one line (if not current)
  - "Reset to Recommended" - Apply recommended defaults (中文, Matrix, 全功能)
  - "Reset to Full" - Enable everything (all features + advanced)
  - "Reset to Essential" - Activity + git only

### Q5: Theme
- header: "Theme"
- question: "Choose your HUD color theme? (current: '{current theme name or default}')"
- multiSelect: false
- options:
  - "Keep current" - No change
  - "默认 (Default)" - 经典配色方案
  - "Solarized 暗色" - 温暖的暗色主题
  - "Dracula" - 紫色主题
  - "Nord" - 北极蓝主题
  - "Catppuccin Mocha" - 柔和的咖啡色调
  - "Monokai" - 经典编辑器主题
  - "Gruvbox" - 复古配色
  - "霓虹 (Neon)" - 高对比霓虹灯效果
  - "赛博朋克 (Synthwave)" - 80年代复古未来风格
  - "黑客帝国 (Matrix)" - 经典绿色代码风格
  - "日落 (Sunset)" - 温暖的日落渐变
  - "海洋 (Ocean)" - 深海蓝色调

If user chooses "Keep current", leave `display.theme` unchanged.
Otherwise, save the corresponding theme name to `display.theme`:
- "默认 (Default)" → `"default"`
- "Solarized 暗色" → `"solarized-dark"`
- "Dracula" → `"dracula"`
- "Nord" → `"nord"`
- "Catppuccin Mocha" → `"catppuccin-mocha"`
- "Monokai" → `"monokai"`
- "Gruvbox" → `"gruvbox"`
- "霓虹 (Neon)" → `"neon"`
- "赛博朋克 (Synthwave)" → `"synthwave"`
- "黑客帝国 (Matrix)" → `"matrix"`
- "日落 (Sunset)" → `"sunset"`
- "海洋 (Ocean)" → `"ocean"`

### Q6: Language
- header: "Language"
- question: "Update HUD label language? (current: '{English or 中文}')"
- multiSelect: false
- options:
  - "Keep current" - No change
  - "English (Recommended)" - Use English HUD labels
  - "中文" - Use Chinese HUD labels

If user chooses "Keep current", leave `language` unchanged.
If user chooses "English (Recommended)", save `language: "en"`.
If user chooses "中文", save `language: "zh-Hans"`.

### Q7: Custom Line (optional)
- header: "Custom Line"
- question: "Update your custom phrase? (currently: '{current customLine or none}')"
- multiSelect: false
- options:
  - "Keep current" - No change (skip if no customLine set)
  - "Enter custom text" - Set or update custom phrase (max 80 chars)
  - "Remove" - Clear the custom line (only show if customLine is currently set)

If user chooses "Enter custom text", use AskUserQuestion to get their text. Save as `display.customLine` in config.
If user chooses "Remove", set `display.customLine` to `""` in config.

---

## Preset Definitions

### Recommended (推荐 - 你的当前设置)
默认启用绝大多数功能，提供最丰富的信息展示：
- **基础**: Language: `zh-Hans`, Layout: `expanded`, Separators: `true`, PathLevels: `2`
- **主题**: `matrix` (黑客帝国绿)
- **ElementOrder**: model, project, git, context, usage, promptCache, tools, agents, todos, sessionTime
- **Activity**: Tools ON, Agents ON, Todos ON
- **Info**: Counts ON, Tokens ON, Usage ON, Duration ON, Session Name ON, Session Tokens ON
- **Enhanced**: Effort ON, PromptCache ON (300s), Cost ON, BackgroundTasks ON (5 slots), OutputStyle ON, Speed ON, TokenBreakdown ON, AddedDirs ON, MemoryUsage ON, Advisor ON, SessionStartDate ON, LastResponseAt ON
- **Git**: ON (dirty + ahead/behind + fileStats)
- **自定义行**: "📊 Dashboard Mode" (first position)
- **时间格式**: `both` (relative + absolute)
- **模型格式**: `full`
- **ContextValue**: `percentTokens` (显示百分比+token数+速度)
- **UsageValue**: `both`
- **安全模式**: OFF (保留ANSI颜色)

**对应的默认配置:**
```json
{
  "language": "zh-Hans",
  "lineLayout": "expanded",
  "showSeparators": true,
  "pathLevels": 2,
  "elementOrder": ["model", "project", "git", "context", "usage", "promptCache", "tools", "agents", "todos", "sessionTime"],
  "gitStatus": { "enabled": true, "showDirty": true, "showAheadBehind": true, "showFileStats": true },
  "display": {
    "showModel": true, "showProject": true, "showAddedDirs": true, "showContextBar": true, "contextValue": "percentTokens",
    "showConfigCounts": true, "showCost": true, "showDuration": true, "showSpeed": true,
    "showTokenBreakdown": true, "showUsage": true, "usageValue": "both", "usageBarEnabled": true,
    "showTools": true, "toolsMaxVisible": 8, "showAgents": true, "showTodos": true,
    "showSessionName": true, "showEffortLevel": true, "showMemoryUsage": true, "showPromptCache": true, "promptCacheTtlSeconds": 300,
    "showSessionTokens": true, "showOutputStyle": true, "showSessionStartDate": true, "showLastResponseAt": true,
    "showBackgroundTasks": true, "backgroundTaskSlots": 5, "showAdvisor": true, "theme": "matrix",
    "customLine": "📊 Dashboard Mode", "customLinePosition": "first", "timeFormat": "both",
    "safeMode": false
  }
}
```

### Full (全功能)
开启**所有**功能，包括所有增强特性和高级选项：
- **基础**: Language: `zh-Hans`, Layout: `expanded`, Separators: `true`, PathLevels: `3`
- **主题**: `matrix` 或用户选择
- **所有 Activity**: Tools, Agents, Todos 全开启 (最大可见数)
- **所有 Info**: Counts, Tokens, Usage, Duration, Session Name, Session Tokens 全开启
- **所有 Enhanced**: Effort, PromptCache, Cost, BackgroundTasks, AddedDirs, OutputStyle, Speed, TokenBreakdown, MemoryUsage, Advisor, SessionStartDate, LastResponseAt 全开启
- **所有 Git**: dirty, ahead/behind, fileStats, branch overflow 全开启
- **高级**: customLine, modelFormat (full), timeFormat (both), usageCompact/bar 等
- **ContextValue**: `percentTokens`
- **UsageValue**: `both`
- **安全模式**: OFF

### Essential (精简模式)
保留核心活动信息和Git状态：
- **基础**: Language: `en`, Layout: `compact`, PathLevels: `1`
- **主题**: `default`
- **Activity**: Tools ON, Agents ON, Todos ON
- **Info**: Duration ON, 其他 Info OFF
- **Enhanced**: 全部 OFF (除 BackgroundTasks ON)
- **Git**: ON (仅 dirty)

---

## Layout Mapping

| Option | Config |
|--------|--------|
| Expanded | `lineLayout: "expanded", showSeparators: false` |
| Compact | `lineLayout: "compact", showSeparators: false` |
| Compact + Separators | `lineLayout: "compact", showSeparators: true` |

---

## Language Mapping

| Option | Config |
|--------|--------|
| English (Recommended) | `language: "en"` |
| 中文 | `language: "zh-Hans"` |

---

## Git Style Mapping

| Option | Config |
|--------|--------|
| Branch only | `gitStatus: { enabled: true, showDirty: false, showAheadBehind: false, showFileStats: false }` |
| Branch + dirty | `gitStatus: { enabled: true, showDirty: true, showAheadBehind: false, showFileStats: false }` |
| Full details | `gitStatus: { enabled: true, showDirty: true, showAheadBehind: true, showFileStats: false }` |
| File stats | `gitStatus: { enabled: true, showDirty: true, showAheadBehind: false, showFileStats: true }` |

---

## Theme Mapping

| Option | Config Value | Description |
|--------|--------------|-------------|
| 默认 (Default) | `"default"` | 经典配色方案 |
| Solarized 暗色 | `"solarized-dark"` | 温暖的暗色主题 |
| Dracula | `"dracula"` | 紫色主题 |
| Nord | `"nord"` | 北极蓝主题 |
| Catppuccin Mocha | `"catppuccin-mocha"` | 柔和的咖啡色调 |
| Monokai | `"monokai"` | 经典编辑器主题 |
| Gruvbox | `"gruvbox"` | 复古配色 |
| 霓虹 (Neon) | `"neon"` | 高对比霓虹灯效果 |
| 赛博朋克 (Synthwave) | `"synthwave"` | 80年代复古未来风格 |
| 黑客帝国 (Matrix) | `"matrix"` | 经典绿色代码风格 |
| 日落 (Sunset) | `"sunset"` | 温暖的日落渐变 |
| 海洋 (Ocean) | `"ocean"` | 深海蓝色调 |

**Config Key:** `display.theme`

---

## Element Mapping

| Element | Config Key |
|---------|------------|
| Tools activity | `display.showTools` |
| Agents status | `display.showAgents` |
| Todo progress | `display.showTodos` |
| Project name | `display.showProject` |
| Git status | `gitStatus.enabled` |
| Config counts | `display.showConfigCounts` |
| Token breakdown | `display.showTokenBreakdown` |
| Output speed | `display.showSpeed` |
| Usage limits | `display.showUsage` |
| Usage bar style | `display.usageBarEnabled` |
| Compact usage | `display.usageCompact` |
| Usage value | `display.usageValue` |
| Session name | `display.showSessionName` |
| Session duration | `display.showDuration` |
| Session tokens | `display.showSessionTokens` |
| Session start date | `display.showSessionStartDate` |
| Last response time | `display.showLastResponseAt` |
| Advisor model | `display.showAdvisor` |
| Effort level | `display.showEffortLevel` |
| Prompt cache | `display.showPromptCache` |
| Session cost | `display.showCost` |
| Background tasks | `display.showBackgroundTasks` |
| Added directories | `display.showAddedDirs` |
| Output style | `display.showOutputStyle` |
| Custom line | `display.customLine` |
| Custom line position | `display.customLinePosition` |

**Always true (not configurable):**
- `display.showModel: true`
- `display.showContextBar: true`

---

## Usage Style Mapping

| Option | Config | Example |
|--------|--------|---------|
| Bar style | `usageBarEnabled: true` | `Usage ██░░ 25% (resets in 1h 30m)` |
| Text style | `usageBarEnabled: false` | `Usage 5h 25% (resets in 1h 30m)` |
| Compact | `usageCompact: true` | `5h: 25% (1h 30m)` — no "Usage" label, shorter reset format |

`usageCompact` takes precedence over `usageBarEnabled` when both are set. Compact mode always uses the text format (no bar).

**Note**: Usage style only applies when `display.showUsage: true`. When 7d usage >= 80%, it also shows with the same style.
Set `display.usageValue: "remaining"` manually to show remaining quota percentages while keeping warning thresholds based on used quota.

---

## Processing Logic

### For New Users (Flow A):
1. Apply chosen preset as base
2. Apply chosen language
3. Apply chosen theme to `display.theme`
4. Apply Turn Off selections (set those items to OFF)
5. Apply Turn On selections (set those items to ON)
6. Apply chosen layout

### For Returning Users (Flow B):
1. Start from current config
2. Apply Turn Off selections (set to OFF, including usageBarEnabled if selected)
3. Apply Turn On selections (set to ON, including usageBarEnabled if selected)
4. Apply Git Style selection (if shown)
5. If "Reset to [preset]" selected, override with preset values
6. If layout change selected, apply it
7. If theme change selected, apply to `display.theme`
8. If language change selected, apply it

---

## Before Writing - Validate & Preview

**GUARDS - Do NOT write config if:**
- User cancels (Esc) → say "Configuration cancelled."
- No changes from current config → say "No changes needed - config unchanged."

**Show preview before saving:**

1. **Summary of changes:**
```
Layout: Compact → Expanded
Language: English → 中文
Theme: default → Dracula
Git style: Branch + dirty
Changes:
  - Usage limits: OFF → ON
  - Config counts: ON → OFF
```

2. **Preview of HUD (Expanded layout):**
```
[Opus | Pro] │ my-project git:(main*)
Context ████░░░░░ 45% │ Usage ██░░░░░░░░ 25% (1h 30m / 5h)
◐ Edit: file.ts | ✓ Read ×3
▸ Fix auth bug (2/5)
```

**Preview of HUD (Compact layout):**
```
[Opus | Pro] ████░░░░░ 45% | my-project git:(main*) | 5h: 25% | ⏱️ 5m
◐ Edit: file.ts | ✓ Read ×3
▸ Fix auth bug (2/5)
```

3. **Confirm**: "Save these changes?"

---

## Write Configuration

Write to `~/.claude/plugins/claude-hud-enhanced/config.json`.

Merge with existing config, preserving:
- `pathLevels` (not in configure flow)
- `display.usageThreshold` (advanced config)
- `display.environmentThreshold` (advanced config)
- `display.contextWarningThreshold` (advanced config)
- `display.contextCriticalThreshold` (advanced config)
- `colors` (advanced manual palette overrides)

**Migration note**: Old configs with `layout: "default"` or `layout: "separators"` are automatically migrated to the new `lineLayout` + `showSeparators` format on load.

---

## After Writing

Say: "Configuration saved! The HUD will reflect your changes immediately."
