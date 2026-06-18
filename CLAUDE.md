# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude HUD is a Claude Code plugin that displays a real-time multi-line statusline. It shows context health, tool activity, agent status, todo progress, cost tracking, and more.

## Build Commands

```bash
npm ci               # Install dependencies
npm run build        # Build TypeScript to dist/
npm run dev          # Watch mode for development

# Test
npm test             # Run all tests
npm run test:coverage # Run tests with coverage

# Manual testing with sample stdin
echo '{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000}}' | node dist/index.js
```

## Architecture

### Data Flow

```
Claude Code → stdin JSON → parse → render lines → stdout → Claude Code displays
           ↘ transcript_path → parse JSONL → tools/agents/todos
```

**Key insight**: The statusline is invoked every ~300ms by Claude Code. Each invocation:
1. Receives JSON via stdin (model, context, tokens - native accurate data)
2. Parses the transcript JSONL file for tools, agents, and todos
3. Renders multi-line output to stdout
4. Claude Code displays all lines

### Data Sources

**Native from stdin JSON** (accurate, no estimation):
- `model.display_name` - Current model
- `context_window.current_usage` - Token counts
- `context_window.context_window_size` - Max context
- `transcript_path` - Path to session transcript
- `rate_limits.*` - Subscriber usage limits

**From transcript JSONL parsing**:
- `tool_use` blocks → tool name, input, start time
- `tool_result` blocks → completion, duration
- Running tools = `tool_use` without matching `tool_result`
- `TodoWrite` calls → todo list
- `Task` calls → agent info
- Session start time, last response timestamp

**From config files**:
- MCP count from `~/.claude/settings.json` (mcpServers)
- Hooks count from `~/.claude/settings.json` (hooks)
- Rules count from CLAUDE.md files

### File Structure

```
src/
├── index.ts              # Entry point, orchestrates data flow
├── stdin.ts              # Parse Claude's JSON input
├── transcript.ts         # Parse transcript JSONL
├── config-reader.ts      # Count MCP/hooks/rules
├── config.ts             # Load/validate user config
├── git.ts                # Git status (branch, dirty, ahead/behind)
├── types.ts              # TypeScript interfaces
├── memory.ts             # System RAM usage
├── cost.ts               # Session cost tracking (Anthropic + third-party model pricing)
├── pricing-loader.ts      # Three-layer model pricing resolver (builtin/remote/user)
├── update-pricing.ts      # Web-based pricing update (fetch, validate, atomic write)
├── speed-tracker.ts      # Output token speed
├── effort.ts             # Effort level display
├── extra-cmd.ts          # Custom command execution
├── version.ts            # Claude Code version detection
├── context-cache.ts       # Prompt cache countdown
├── external-usage.ts     # External usage snapshot support
├── constants.ts          # Shared constants (OMC check, etc.)
├── i18n/                 # Internationalization
│   ├── index.ts          # i18n setup and t() function
│   └── zh-Hans.ts        # Chinese translations
└── render/
    ├── index.ts          # Main render coordinator
    ├── colors.ts         # ANSI color helpers
    ├── width.ts          # Terminal width detection
    ├── format-reset-time.ts  # Usage reset time formatting
    ├── session-line.ts    # Model, project, git, context bar
    ├── tools-line.ts      # Tool activity (opt-in)
    ├── agents-line.ts     # Agent status (opt-in)
    ├── todos-line.ts      # Todo progress (opt-in)
    └── background-tasks-line.ts  # Background tasks (opt-in)
```

### Dependency Injection

The `main()` function in `src/index.ts` accepts dependency overrides for testing. All I/O operations are injected:

```typescript
export type MainDeps = {
  readStdin, getUsageFromStdin, getUsageFromExternalSnapshot,
  writeExternalUsageSnapshot, parseTranscript, countConfigs,
  getGitStatus, loadConfig, parseExtraCmdArg, runExtraCmd,
  getClaudeCodeVersion, getMemoryUsage, applyContextWindowFallback,
  render, now, log, isOmcInstalled
};
```

## Configuration

**Setup commands:**
- `/claude-hud:setup` - Initial statusLine configuration
- `/claude-hud:configure` - Guided configuration (presets, toggles, layout)

**Config file:** `~/.claude/plugins/claude-hud/config.json`

Key options:
| Option | Default | Description |
|--------|---------|-------------|
| `language` | `en` | Label language (`en`, `zh`, `zh-Hans`) |
| `lineLayout` | `expanded` | `expanded` (multi-line) or `compact` (single line) |
| `pathLevels` | `1` | Directory levels in project path (1-3) |
| `display.showTools` | `false` | Show tools activity |
| `display.showAgents` | `false` | Show agents status |
| `display.showTodos` | `false` | Show todo progress |
| `display.showCost` | `false` | Show session cost |
| `display.showPromptCache` | `false` | Show prompt cache countdown |
| `modelPricing.entries` | `[]` | Custom pricing entries (override built-in third-party pricing) |
| `modelPricing.enablePricingUpdate` | `true` | Enable `/claude-hud:update-pricing` command |
| `modelPricing.pricingUpdateUrl` | GitHub URL | Remote URL for pricing updates |

## Output Format

**Default (expanded):**
```
[Opus] │ my-project git:(main*)
Context █████░░░░░ 45% │ Usage ██░░░░░░░░ 25% (1h 30m / 5h)
```

**Compact (single line):**
```
[Opus] █████░░░░░ 45% │ project │ 5h: 25% │ ⏱️ 5m
```

### Context Thresholds

| Threshold | Color | Action |
|-----------|-------|--------|
| <70% | Green | Normal |
| 70-85% | Yellow | Warning |
| >85% | Red | Show token breakdown |

## Testing

Tests use Node.js built-in `node:test` with snapshot testing:

```bash
npm test                              # Run all tests
npm run test:coverage                 # With coverage report
UPDATE_SNAPSHOTS=1 npm test           # Update snapshots
```

Snapshot fixtures are in `tests/fixtures/`. Test stdin parsing with sample JSON piped to `dist/index.js`.

## Contributing

**Important:** PRs should only modify files in `src/` — do not include changes to `dist/`. CI automatically builds and commits `dist/` after merges.

Version updates require changing three files:
1. `package.json` → `version`
2. `.claude-plugin/plugin.json` → `version`
3. `.claude-plugin/marketplace.json` → `version`

## Plugin Configuration

The plugin manifest is in `.claude-plugin/plugin.json` (metadata only).

**StatusLine configuration** must be added to `~/.claude/settings.json` via `/claude-hud:setup`.

## Dependencies

- **Runtime**: Node.js 18+ or Bun
- **Build**: TypeScript 5, ES2022 target, NodeNext modules
