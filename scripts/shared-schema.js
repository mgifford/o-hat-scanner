/**
 * Validation helper for the shared result schema
 */
export function validateSchema(data) {
    const required = ['runId', 'startedAt', 'finishedAt', 'toolVersion', 'mode', 'config', 'targets', 'resultsByUrl'];
    for (const field of required) {
        if (!data[field]) {
            throw new Error(`Invalid schema: missing field ${field}`);
        }
    }
    if (!['ci', 'standalone'].includes(data.mode)) {
        throw new Error(`Invalid mode: ${data.mode}`);
    }
    return true;
}

function getRunTimestamp() {
    const override = process.env.RUN_TIMESTAMP;
    if (override && !Number.isNaN(Date.parse(override))) return new Date(override).toISOString();
    return new Date().toISOString();
}

export function sanitizeLabel(label = '') {
    const clean = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
    return clean || 'run';
}

export function domainSlugFromUrl(url) {
    if (!url) return '';
    try {
        const { hostname } = new URL(url);
        return sanitizeLabel(hostname.replace(/\./g, '-'));
    } catch {
        return '';
    }
}

export function buildRunId(labelOrOptions, options = {}) {
    const isObjectInput = labelOrOptions && typeof labelOrOptions === 'object' && !Array.isArray(labelOrOptions);
    const label = isObjectInput ? (labelOrOptions.label || '') : (labelOrOptions || '');
    const baseUrl = isObjectInput ? (labelOrOptions.baseUrl || '') : (options.baseUrl || '');
    const targets = isObjectInput ? (labelOrOptions.targets || []) : (options.targets || []);

    const domainCandidate = baseUrl || (Array.isArray(targets) && targets.length ? targets[0] : '');
    const domainSlug = domainSlugFromUrl(domainCandidate);
    const timestamp = getRunTimestamp().replace(/[:.]/g, '-');
    const labelPart = label ? `--${sanitizeLabel(label)}` : '';
    const prefix = domainSlug ? `${domainSlug}--` : '';
    return `${prefix}${timestamp}${labelPart}`;
}

export function createEmptyResult(mode, config, targets, label) {
    const runLabel = label || (config && config.label) || null;
    const startedAt = getRunTimestamp();
    return {
        runId: buildRunId({ label: runLabel, baseUrl: config?.baseUrl, targets }),
        startedAt,
        finishedAt: null,
        toolVersion: '1.0.0',
        mode: mode,
        config: { ...(config || {}), label: runLabel },
        targets: targets || [],
        resultsByUrl: {}
    };
}
