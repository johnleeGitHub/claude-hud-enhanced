# Claude HUD Enhanced

基于 [claude-hud](https://github.com/jarrodwatts/claude-hud) 的增强版本，由 [johnleeGitHub](https://github.com/johnleeGitHub) 维护，添加了大量新功能和改进。

## ✨ 增强功能总览

### 🎨 12 个颜色主题
| 主题 | 描述 |
|------|------|
| `default` | 经典配色 |
| `solarized-dark` | 温暖暗色 |
| `dracula` | 紫色主题 |
| `nord` | 北极蓝 |
| `catppuccin-mocha` | 柔和咖啡 |
| `monokai` | 编辑器经典 |
| `gruvbox` | 复古配色 |
| `neon` | 霓虹高亮 |
| `synthwave` | 赛博朋克 |
| `matrix` ⭐ | 黑客帝国绿 (默认) |
| `sunset` | 日落渐变 |
| `ocean` | 深海蓝 |

### 🔥 新增显示功能

#### 1. 推理力度 (Effort Level)
```
[deepseek-v4-flash ◕ xhigh]
```
显示当前模型的推理力度等级：`xhigh` / `high` / `medium` / `low`

#### 2. Prompt 缓存倒计时 (Prompt Cache)
```
Cache ⏱ 4m32s
```
显示 prompt cache 剩余时间，5分钟倒计时，到期前变黄色警告。

#### 3. 会话费用 (Session Cost)
```
费用 ¥12.1≈$1.68 [DeepSeek]
```
实时估算当前会话的 API 费用，支持第三方模型定价。

**支持的第三方模型：**
| 提供商 | 模型 | 输入 ($/M tokens) | 输出 ($/M tokens) | 缓存 |
|--------|------|:---:|:---:|:---:|
| **OpenAI** | GPT-4o | $2.50 | $10.00 | 默认 |
| | GPT-4o-mini | $0.15 | $0.60 | 默认 |
| | o1 | $15.00 | $60.00 | 默认 |
| | o3 / o3-mini | $10.00 | $40.00 | 默认 |
| **DeepSeek** | V4 Flash | $0.14 | $0.28 | $0.028 |
| | V4 Pro | $1.67 | $3.33 | $0.14 |
| | Chat | $0.50 | $2.00 | $0.10 |
| | Reasoner | $0.50 | $2.00 | $0.10 |
| **MiniMax** | M2.7 Highspeed | $0.30 | $0.30 | $0.15 |
| **Moonshot** | Kimi K2.5 | $0.28 | $1.12 | $0.14 |
| **Zhipu** | GLM-5 Turbo | $0.35 | $0.40 | $0.09 |
| | ZAI-ORG/GLM-5 | $0.35 | $0.40 | $0.09 |

**三层定价解析器：**
```
Layer 1: 用户自定义配置 (最高优先级)
Layer 2: 远程 pricing.json 更新
Layer 3: 内置定价表 (最低优先级)
```

**CNY 定价支持：** 可在配置中直接填写人民币价格，系统自动按 ¥7.2/$1 转换为 USD。
```json
{
  "pattern": "^my-model$",
  "inputUsdPerMillion": 1.0,   // ¥7.2 ÷ 7.2 = $1.0
  "outputUsdPerMillion": 2.0,  // ¥14.4 ÷ 7.2 = $2.0
  "currency": "cny",
  "provider": "MyProvider"
}
```

> **注意**：对于第三方模型，HUD 会跳过 Claude Code 报告的原生费用（按 Anthropic 定价计算，不准确），改用基于实际 token 用量 × 配置单价的估算。

#### 4. 后台任务 (Background Tasks)
```
BG 2/5
```
OMC 风格的后台任务槽显示，最多显示 5 个槽位。

#### 5. 额外工作目录 (Added Directories)
```
添加目录: project-a, project-b
```
显示通过 `/add` 添加的额外工作目录。

#### 6. 输出风格 (Output Style)
```
风格: streaming
```
显示输出模式指示器。

#### 7. 会话 Token 统计 (Session Tokens)
```
Tok: 12.8M (入: 7k, 出: 28k, 缓存: 12.8M)
```
显示整个会话的累计 Token 使用量。

#### 8. Advisor 模型
```
顾问: Opus 4.7
```
当配置了 `/advisor` 时显示顾问模型。

#### 9. 上次响应时间 (Last Response At)
```
响应: 2m ago
```
显示最后一次 AI 响应的时间。

#### 10. 会话开始日期 (Session Start Date)
```
开始: 2025-06-12 14:30
```
显示会话开始日期时间。

#### 11. 内存使用 (Memory Usage)
```
内存: ████░░░░░░ 42%
```
显示系统内存使用情况。

#### 12. Claude Code 版本
```
CC v2.1.115
```
显示当前 Claude Code 版本号。

### 📊 显示模式改进

#### Context 显示模式
- `percent` - 仅百分比 (45%)
- `tokens` - 仅 Token 数 (111k/1.0M)
- `both` - 百分比 + Token 数
- `percentTokens` ⭐ - 百分比 + Token + 速度 (推荐)

#### Usage 显示模式
- `percent` - 使用百分比
- `remaining` - 剩余百分比
- `both` - 两者都显示

#### 时间格式
- `relative` - 相对时间 ("3分钟后")
- `absolute` - 绝对时间 ("14:30")
- `both` ⭐ - 两者都显示 (推荐)
- `elapsed` - 已用时间
- `elapsedAndAbsolute` - 已用 + 绝对

### 🎯 预设配置

#### Recommended (推荐) ⭐
默认配置，经过优化的全功能设置：
- 语言：中文
- 主题：Matrix (黑客帝国绿)
- 布局：Expanded (多行)
- 元素顺序：model → project → git → context → usage → promptCache → tools → agents → todos → sessionTime
- 启用：所有 Activity + Info + Enhanced 功能
- 自定义行：📊 Dashboard Mode

#### Full (全功能)
开启**所有**功能，包括所有高级选项和最大显示设置。

#### Essential (精简)
仅核心活动信息和 Git 状态。

### ⚙️ 配置示例

```json
{
  "language": "zh-Hans",
  "theme": "matrix",
  "lineLayout": "expanded",
  "showSeparators": true,
  "pathLevels": 2,
  "elementOrder": [
    "model", "project", "git", "context", "usage",
    "promptCache", "tools", "agents", "todos", "sessionTime"
  ],
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true,
    "showFileStats": true
  },
  "display": {
    "showModel": true,
    "showProject": true,
    "showContextBar": true,
    "contextValue": "percentTokens",
    "showConfigCounts": true,
    "showCost": true,
    "showDuration": true,
    "showSpeed": true,
    "showTokenBreakdown": true,
    "showUsage": true,
    "showTools": true,
    "showAgents": true,
    "showTodos": true,
    "showSessionName": true,
    "showEffortLevel": true,
    "showPromptCache": true,
    "showSessionTokens": true,
    "showOutputStyle": true,
    "showBackgroundTasks": true,
    "showAddedDirs": true,
    "showAdvisor": false,
    "theme": "matrix",
    "customLine": "📊 Dashboard Mode",
    "timeFormat": "both",
    "safeMode": false
  },
  "modelPricing": {
    "entries": [
      {
        "pattern": "^my-model$",
        "inputUsdPerMillion": 1.0,
        "outputUsdPerMillion": 2.0,
        "cacheReadUsdPerMillion": 0.2,
        "cacheCreationUsdPerMillion": 0.2,
        "currency": "cny",
        "provider": "MyProvider"
      }
    ],
    "enablePricingUpdate": true
  }
}
```

## 🚀 安装

### 方式一：GitHub 安装

```bash
/plugin install johnleeGitHub/claude-hud-enhanced
```

### 方式二：本地安装

```bash
# 克隆仓库
git clone https://github.com/johnleeGitHub/claude-hud-enhanced.git

# 安装
/plugin install /path/to/claude-hud-enhanced
```

## 🎮 使用

### 初始设置
```
/hud-setup
```

### 重新配置
```
/hud-configure
```

配置向导包含：
1. 布局选择 (Expanded/Compact)
2. 预设选择 (Recommended/Full/Essential)
3. 语言选择 (中文/English)
4. 主题选择 (12个主题)
5. 功能开关 (所有增强功能)

### 更新模型定价
```
/hud-update-pricing
```

## 📁 与原版差异

| 功能 | 原版 | 增强版 |
|------|------|--------|
| 主题数量 | 1 (default) | 12 |
| 推理力度显示 | ❌ | ✅ |
| Prompt Cache 倒计时 | ❌ | ✅ |
| 会话费用 | ❌ | ✅ |
| 后台任务 | ❌ | ✅ |
| 额外工作目录 | ❌ | ✅ |
| 输出风格 | ❌ | ✅ |
| 会话 Token 统计 | ❌ | ✅ |
| Advisor 模型 | ❌ | ✅ |
| 上次响应时间 | ❌ | ✅ |
| 会话开始日期 | ❌ | ✅ |
| 内存使用 | ❌ | ✅ |
| 速度显示位置 | Project 行 | Context 行后 |

## 📝 配置位置

```
~/.claude/plugins/claude-hud/config.json
```

## 🏷️ 版本

- 原版: `0.1.0`
- 增强版: `0.3.0`

## 📜 License

MIT - 基于 [claude-hud](https://github.com/jarrodwatts/claude-hud) by Jarrod Watts
