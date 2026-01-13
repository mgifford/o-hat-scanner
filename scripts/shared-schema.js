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

export function createEmptyResult(mode, config, targets) {
    return {
        runId: new Date().toISOString().replace(/[:.]/g, '-'), // Simple ID based on time
        startedAt: new Date().toISOString(),
        finishedAt: null,
        toolVersion: '1.0.0',
        mode: mode,
        config: config || {},
        targets: targets || [],
        resultsByUrl: {}
    };
}
