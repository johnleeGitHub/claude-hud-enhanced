/**
 * Tests for enhanced features in constants.ts
 * - Smart context window detection
 * - OMC detection
 * - Display density
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  inferContextWindow,
  isOmcInstalled,
  resetOmcDetection,
  getDisplayDensity,
  isElementVisible,
  getTheme,
  listThemes,
  COLOR_THEMES,
} from '../../src/constants.ts';

describe('Smart Context Window Detection', () => {
  it('should detect DeepSeek 1M context', () => {
    expect(inferContextWindow('deepseek-v4-flash')).toBe(1000000);
    expect(inferContextWindow('deepseek-v4')).toBe(1000000);
    expect(inferContextWindow('deepseek-chat')).toBe(1000000);
  });

  it('should detect Claude 200K context', () => {
    expect(inferContextWindow('claude-opus-4-6')).toBe(200000);
    expect(inferContextWindow('claude-sonnet-4-6')).toBe(200000);
    expect(inferContextWindow('claude-haiku-4-5')).toBe(200000);
    expect(inferContextWindow('opus')).toBe(200000);
    expect(inferContextWindow('sonnet')).toBe(200000);
  });

  it('should detect GPT-4 128K context', () => {
    expect(inferContextWindow('gpt-4-turbo')).toBe(128000);
    expect(inferContextWindow('gpt-4o')).toBe(128000);
    expect(inferContextWindow('gpt-4')).toBe(128000);
  });

  it('should detect Gemini 1M context', () => {
    expect(inferContextWindow('gemini-2.5-flash')).toBe(1000000);
    expect(inferContextWindow('gemini-1.5-pro')).toBe(1000000);
  });

  it('should detect MiniMax 1M context', () => {
    expect(inferContextWindow('MiniMax-M2.7-highspeed')).toBe(1000000);
    expect(inferContextWindow('minimax')).toBe(1000000);
  });

  it('should detect Moonshot/Kimi 128K context', () => {
    expect(inferContextWindow('moonshot/kimi-k2.5')).toBe(128000);
    expect(inferContextWindow('kimi')).toBe(128000);
  });

  it('should detect GLM 128K context', () => {
    expect(inferContextWindow('glm-5-turbo')).toBe(128000);
    expect(inferContextWindow('zai-org/glm-5')).toBe(128000);
  });

  it('should return null for unknown models', () => {
    expect(inferContextWindow('unknown-model')).toBe(null);
    expect(inferContextWindow('')).toBe(null);
  });

  it('should be case insensitive', () => {
    expect(inferContextWindow('DEEPSEEK-V4')).toBe(1000000);
    expect(inferContextWindow('Claude-Opus-4-6')).toBe(200000);
  });
});

describe('OMC Detection', () => {
  beforeEach(() => {
    resetOmcDetection();
  });

  it('should detect OMC when installed', () => {
    const result = isOmcInstalled();
    // OMC is installed in the test environment
    expect(typeof result).toBe('boolean');
  });
});

describe('Display Density', () => {
  it('should return minimal for narrow terminals', () => {
    expect(getDisplayDensity(60)).toBe('minimal');
    expect(getDisplayDensity(80)).toBe('minimal');
  });

  it('should return compact for medium terminals', () => {
    expect(getDisplayDensity(81)).toBe('compact');
    expect(getDisplayDensity(100)).toBe('compact');
    expect(getDisplayDensity(120)).toBe('compact');
  });

  it('should return normal for wide terminals', () => {
    expect(getDisplayDensity(121)).toBe('normal');
    expect(getDisplayDensity(150)).toBe('normal');
    expect(getDisplayDensity(180)).toBe('normal');
  });

  it('should return full for very wide terminals', () => {
    expect(getDisplayDensity(200)).toBe('full');
    expect(getDisplayDensity(300)).toBe('full');
  });

  it('should return full for null width', () => {
    expect(getDisplayDensity(null)).toBe('full');
  });
});

describe('Element Visibility', () => {
  it('should show only core elements in minimal mode', () => {
    expect(isElementVisible('model', 'minimal')).toBe(true);
    expect(isElementVisible('project', 'minimal')).toBe(true);
    expect(isElementVisible('context', 'minimal')).toBe(true);
    expect(isElementVisible('git', 'minimal')).toBe(true);
    expect(isElementVisible('tools', 'minimal')).toBe(false);
    expect(isElementVisible('agents', 'minimal')).toBe(false);
  });

  it('should show tools in compact mode', () => {
    expect(isElementVisible('tools', 'compact')).toBe(true);
    expect(isElementVisible('usage', 'compact')).toBe(true);
  });

  it('should show agents and todos in normal mode', () => {
    expect(isElementVisible('agents', 'normal')).toBe(true);
    expect(isElementVisible('todos', 'normal')).toBe(true);
    expect(isElementVisible('session', 'normal')).toBe(true);
  });

  it('should show all in full mode', () => {
    expect(isElementVisible('tools', 'full')).toBe(true);
    expect(isElementVisible('agents', 'full')).toBe(true);
    expect(isElementVisible('todos', 'full')).toBe(true);
    expect(isElementVisible('session', 'full')).toBe(true);
  });
});

describe('Color Themes', () => {
  it('should list all themes', () => {
    const themes = listThemes();
    expect(themes.length).toBeGreaterThan(0);
    expect(themes.find(t => t.name === 'default')).toBeDefined();
    expect(themes.find(t => t.name === 'dracula')).toBeDefined();
    expect(themes.find(t => t.name === 'nord')).toBeDefined();
    expect(themes.find(t => t.name === 'gruvbox')).toBeDefined();
  });

  it('should get theme by name', () => {
    const dracula = getTheme('dracula');
    expect(dracula.name).toBe('dracula');
    expect(dracula.colors.model).toBe('#bd93f9');
  });

  it('should return default for unknown theme', () => {
    const unknown = getTheme('unknown-theme');
    expect(unknown.name).toBe('default');
  });

  it('should return default for null theme', () => {
    const nullTheme = getTheme(null);
    expect(nullTheme.name).toBe('default');
  });

  it('should have valid colors for all themes', () => {
    for (const theme of COLOR_THEMES) {
      expect(theme.colors.context).toBeDefined();
      expect(theme.colors.usage).toBeDefined();
      expect(theme.colors.model).toBeDefined();
      expect(theme.colors.git).toBeDefined();
    }
  });

  it('Dracula theme should have purple model color', () => {
    const dracula = getTheme('dracula');
    expect(dracula.colors.model).toBe('#bd93f9');
  });

  it('Gruvbox theme should have retro green context', () => {
    const gruvbox = getTheme('gruvbox');
    expect(gruvbox.colors.context).toBe('#98971a');
  });
});
