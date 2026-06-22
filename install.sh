#!/usr/bin/env bash
# claude-hud-enhanced installer (macOS / Linux)
#
# Registers HUD skills so Claude Code can discover them.
#
# Usage:
#   ./install.sh                       Interactive install
#   ./install.sh --update              Pull latest + re-link symlinks
#   ./install.sh --uninstall           Remove symlinks
#   ./install.sh --help
#
# Curl-pipe (one-liner):
#   curl -fsSL https://raw.githubusercontent.com/johnleeGitHub/claude-hud-enhanced/main/install.sh | bash

set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SKILLS_TARGET="$CLAUDE_DIR/skills"
SKILL_NAMES=("hud-setup" "hud-configure" "hud-update-pricing")

# ── Resolve plugin cache path ──────────────────────────────────────────────
resolve_plugin_cache() {
  local base="$CLAUDE_DIR/plugins/cache/claude-hud-enhanced/claude-hud-enhanced"
  if [[ ! -d "$base" ]]; then
    printf 'Plugin cache not found at %s\n' "$base" >&2
    printf 'Run "/plugin install claude-hud-enhanced" in Claude Code first.\n' >&2
    exit 1
  fi
  local latest
  latest="$(ls -1 "$base" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | sort -V | tail -1)"
  if [[ -z "$latest" ]]; then
    printf 'No version directory found in %s\n' "$base" >&2
    exit 1
  fi
  printf '%s/%s\n' "$base" "$latest"
}

# ── Symlink skills into target ─────────────────────────────────────────────
link_skills() {
  local source_root="$1"
  mkdir -p "$SKILLS_TARGET"
  local count=0
  for name in "${SKILL_NAMES[@]}"; do
    local src="$source_root/skills/$name"
    local dst="$SKILLS_TARGET/$name"
    if [[ ! -d "$src" ]]; then
      printf '  ⚠ skill not found: %s (skip)\n' "$src" >&2
      continue
    fi
    ln -sfn "$src" "$dst"
    printf '  ✓ %s → %s\n' "$dst" "$src"
    count=$((count + 1))
  done
  printf '\nLinked %d skill(s) into %s\n' "$count" "$SKILLS_TARGET"
}

# ── Remove symlinks ────────────────────────────────────────────────────────
unlink_skills() {
  local count=0
  for name in "${SKILL_NAMES[@]}"; do
    local dst="$SKILLS_TARGET/$name"
    if [[ -L "$dst" ]]; then
      rm -f "$dst"
      printf '  ✓ removed %s\n' "$dst"
      count=$((count + 1))
    fi
  done
  if [[ $count -eq 0 ]]; then
    printf 'No symlinks to remove.\n'
  else
    printf '\nRemoved %d skill symlink(s).\n' "$count"
  fi
}

# ── Commands ───────────────────────────────────────────────────────────────
cmd_install() {
  printf '→ Resolving plugin cache path...\n'
  local cache_path
  cache_path="$(resolve_plugin_cache)"
  printf '  Plugin: %s\n' "$cache_path"

  printf '→ Linking skills...\n'
  link_skills "$cache_path"

  printf '\n✓ Installed! Restart Claude Code to pick up the new skills.\n'
  printf '  Then run: /hud-setup    (to configure the HUD statusline)\n'
}

cmd_update() {
  local cache_path
  cache_path="$(resolve_plugin_cache)"
  printf '→ Re-linking skills from %s\n' "$cache_path"
  unlink_skills
  link_skills "$cache_path"
  printf '\n✓ Updated.\n'
}

cmd_uninstall() {
  printf '→ Removing skill symlinks...\n'
  unlink_skills
  printf '\n✓ Uninstalled. The plugin cache can be removed from Claude Code.\n'
}

usage() {
  cat <<USAGE
claude-hud-enhanced installer

Usage:
  install.sh              Interactive install
  install.sh --update     Pull latest + re-link symlinks
  install.sh --uninstall  Remove symlinks
  install.sh --help

Environment:
  CLAUDE_CONFIG_DIR  Override Claude config directory (default: \$HOME/.claude)
USAGE
}

main() {
  case "${1:-}" in
    -h|--help)     usage ;;
    --update)      cmd_update ;;
    --uninstall)   cmd_uninstall ;;
    "")            cmd_install ;;
    *)             printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 1 ;;
  esac
}

main "$@"
