import { execFileSync } from 'node:child_process';
import { label } from '../colors.js';
import { t } from '../../i18n/index.js';

/**
 * Docker Context display module
 * Shows current Docker context/environment
 */
export function renderDockerContextLine(ctx) {
    const display = ctx.config?.display;
    if (display?.showDockerContext !== true) {
        return null;
    }

    const dockerContext = getDockerContext();
    if (!dockerContext) {
        return null;
    }

    const colors = ctx.config?.colors;
    return `${label(t('label.docker') + ':', colors)}${label(' ')}${dockerContext}`;
}

function getDockerContext() {
    try {
        // Get current docker context
        const stdout = execFileSync('docker', ['context', 'show'], {
            encoding: 'utf8',
            timeout: 2000,
            windowsHide: true
        });
        const context = stdout.trim();

        // Skip default unnamed context
        if (context === 'default' || context === '') {
            return null;
        }

        return context;
    } catch {
        // Docker not installed or not available
        return null;
    }
}

//# sourceMappingURL=docker-context-line.js.map
