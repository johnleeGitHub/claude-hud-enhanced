/**
 * Tests for theme integration
 */

import { describe, it, expect } from 'bun:test';
import { COLOR_THEMES } from '../../src/constants.ts';

describe('Theme Color Values', () => {
  it('should have valid hex colors for Dracula', () => {
    const dracula = COLOR_THEMES.find(t => t.name === 'dracula')!;

    // Check key colors are valid hex
    expect(dracula.colors.context).toMatch(/^#[0-9a-f]{6}$/i);
    expect(dracula.colors.usage).toMatch(/^#[0-9a-f]{6}$/i);
    expect(dracula.colors.model).toMatch(/^#[0-9a-f]{6}$/i);
    expect(dracula.colors.git).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should have valid hex colors for Gruvbox', () => {
    const gruvbox = COLOR_THEMES.find(t => t.name === 'gruvbox')!;

    expect(gruvbox.colors.context).toMatch(/^#[0-9a-f]{6}$/i);
    expect(gruvbox.colors.usage).toMatch(/^#[0-9a-f]{6}$/i);
    expect(gruvbox.colors.model).toMatch(/^#[0-9a-f]{6}$/i);
    expect(gruvbox.colors.git).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should have distinct colors for different elements in Dracula', () => {
    const dracula = COLOR_THEMES.find(t => t.name === 'dracula')!;

    // Key colors should be different
    expect(dracula.colors.context).not.toBe(dracula.colors.model);
    expect(dracula.colors.model).not.toBe(dracula.colors.git);
    expect(dracula.colors.context).not.toBe(dracula.colors.usage);
  });

  it('should have distinct colors for different elements in Gruvbox', () => {
    const gruvbox = COLOR_THEMES.find(t => t.name === 'gruvbox')!;

    expect(gruvbox.colors.context).not.toBe(gruvbox.colors.model);
    expect(gruvbox.colors.model).not.toBe(gruvbox.colors.git);
  });

  it('should have 12 themes', () => {
    expect(COLOR_THEMES.length).toBe(12);
  });

  it('should have Dracula with purple model color #bd93f9', () => {
    const dracula = COLOR_THEMES.find(t => t.name === 'dracula')!;
    expect(dracula.colors.model).toBe('#bd93f9');
    expect(dracula.displayName).toBe('Dracula');
  });

  it('should have Gruvbox with green context #98971a', () => {
    const gruvbox = COLOR_THEMES.find(t => t.name === 'gruvbox')!;
    expect(gruvbox.colors.context).toBe('#98971a');
    expect(gruvbox.displayName).toBe('Gruvbox');
  });
});
