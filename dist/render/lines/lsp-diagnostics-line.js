import { execFileSync } from 'node:child_process';
import { label, red, yellow, green } from '../colors.js';
import { t } from '../../i18n/index.js';

/**
 * LSP Diagnostics display module
 * Shows Language Server Protocol diagnostics (errors, warnings)
 */
export function renderLspDiagnosticsLine(ctx) {
    const display = ctx.config?.display;
    if (display?.showLspDiags !== true) {
        return null;
    }

    const diags = getLspDiagnostics();
    if (!diags) {
        return null;
    }

    const colors = ctx.config?.colors;
    const parts = [];

    if (diags.errors > 0) {
        parts.push(`${red(`✗${diags.errors}`, colors)}`);
    }
    if (diags.warnings > 0) {
        parts.push(`${yellow(`⚠${diags.warnings}`, colors)}`);
    }
    if (diags.infos > 0 && display?.showLspInfos === true) {
        parts.push(`${green(`ℹ${diags.infos}`, colors)}`);
    }

    if (parts.length === 0) {
        return null;
    }

    const labelText = display?.showLspServer && diags.server
        ? `${t('label.lsp')}:${diags.server}`
        : t('label.lsp');

    return `${label(labelText + ':', colors)}${label(' ')}${parts.join(label(' ', colors))}`;
}

function getLspDiagnostics() {
    // Try to read from nvim LSP if available
    try {
        // Check for neovim with LSP
        const result = execFileSync('nvim', ['--headless', '-c', 'lua print(vim.inspect(vim.lsp.get_active_clients()))', '+qall'], {
            encoding: 'utf8',
            timeout: 3000,
            windowsHide: true
        });
        // Parse the output to get diagnostics
        const diags = parseNeovimLspOutput(result.stdout);
        if (diags) return diags;
    } catch { /* nvim not available */ }

    // Try to read from tsserver/js/ts-language-server diagnostics file
    try {
        const diagPath = getLspDiagsPath();
        if (diagPath) {
            const content = execFileSync('cat', [diagPath], {
                encoding: 'utf8',
                timeout: 1000,
                windowsHide: true
            });
            return parseDiagsFile(content);
        }
    } catch { /* not available */ }

    return null;
}

function getLspDiagsPath() {
    // Common LSP diagnostics file locations
    const candidates = [
        '/tmp/lsp-diags.json',
        '/tmp/ts-diags.json',
        process.env.HOME + '/.cache/lsp-diags.json'
    ];

    for (const path of candidates) {
        try {
            execFileSync('test', ['-f', path], { windowsHide: true });
            return path;
        } catch { continue; }
    }
    return null;
}

function parseNeovimLspOutput(output) {
    try {
        // Try to parse as JSON
        const clients = JSON.parse(output);
        if (!Array.isArray(clients) || clients.length === 0) {
            return null;
        }

        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfos = 0;
        let serverName = null;

        for (const client of clients) {
            if (client.name) {
                serverName = client.name;
            }
            if (client.diagnostics) {
                for (const diag of client.diagnostics) {
                    switch (diag.severity) {
                        case 1: totalErrors++; break;
                        case 2: totalWarnings++; break;
                        case 3: totalInfos++; break;
                    }
                }
            }
        }

        if (totalErrors === 0 && totalWarnings === 0 && totalInfos === 0) {
            return null;
        }

        return { errors: totalErrors, warnings: totalWarnings, infos: totalInfos, server: serverName };
    } catch {
        return null;
    }
}

function parseDiagsFile(content) {
    try {
        const data = JSON.parse(content);
        return {
            errors: data.errors || data.diagnostics?.error || 0,
            warnings: data.warnings || data.diagnostics?.warning || 0,
            infos: data.infos || data.diagnostics?.info || 0,
            server: data.server || data.languageServer || null
        };
    } catch {
        return null;
    }
}

//# sourceMappingURL=lsp-diagnostics-line.js.map
