import fs from 'fs';
import path from 'path';

// Robust synchronous recursive remove used by tests to avoid intermittent
// ENOTEMPTY errors on CI filesystems. Attempts fs.rmSync first, then falls
// back to manual recursive deletion if necessary.
export function safeRmSync(targetPath) {
    if (!fs.existsSync(targetPath)) return;
    try {
        // Prefer the modern API when available
        fs.rmSync(targetPath, { recursive: true, force: true });
        return;
    } catch (err) {
        // Fallback: manually remove contents then the directory
        try {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                for (const name of fs.readdirSync(targetPath)) {
                    const child = path.join(targetPath, name);
                    // Recursive call
                    safeRmSync(child);
                }
                // Attempt to remove the (now empty) directory
                try { fs.rmdirSync(targetPath); } catch (e) { /* ignore */ }
            } else {
                try { fs.unlinkSync(targetPath); } catch (e) { /* ignore */ }
            }
        } catch (e) {
            // If something unexpected happens, ignore to avoid breaking tests
        }
    }
}

export function ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}
