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

export function sanitizeLabel(label = '') {
    const clean = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
    return clean || 'run';
}

export function buildRunId(label) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (!label) return timestamp;
    return `${timestamp}--${sanitizeLabel(label)}`;
}

export function createEmptyResult(mode, config, targets, label) {
    const runLabel = label || (config && config.label) || null;
    return {
        runId: buildRunId(runLabel),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        toolVersion: '1.0.0',
        mode: mode,
        config: { ...(config || {}), label: runLabel },
        targets: targets || [],
        resultsByUrl: {}
    };
}
