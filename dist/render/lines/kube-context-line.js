import { execFileSync } from 'node:child_process';
import { label, cyan } from '../colors.js';
import { t } from '../../i18n/index.js';

/**
 * Kubernetes Context display module
 * Shows current Kubernetes context/cluster
 */
export function renderKubeContextLine(ctx) {
    const display = ctx.config?.display;
    if (display?.showKubeContext !== true) {
        return null;
    }

    const kubeContext = getKubeContext();
    if (!kubeContext) {
        return null;
    }

    const colors = ctx.config?.colors;
    return `${label(t('label.kube') + ':', colors)}${cyan(kubeContext, colors)}`;
}

function getKubeContext() {
    try {
        // Try kubectl first (more common)
        const stdout = execFileSync('kubectl', ['config', 'current-context'], {
            encoding: 'utf8',
            timeout: 2000,
            windowsHide: true
        });
        const context = stdout.trim();
        if (!context || context === '') {
            return null;
        }
        return context;
    } catch {
        // kubectl not available, try k9s
        try {
            const stdout = execFileSync('k9s', ['info'], {
                encoding: 'utf8',
                timeout: 2000,
                windowsHide: true
            });
            // k9s info output format varies, extract cluster if possible
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes('Context:')) {
                    const parts = line.split(':');
                    if (parts.length > 1) {
                        const ctx = parts[1].trim();
                        if (ctx && ctx !== '') return ctx;
                    }
                }
            }
        } catch {
            // k9s not available either
        }
        return null;
    }
}

//# sourceMappingURL=kube-context-line.js.map
