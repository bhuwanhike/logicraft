/**
 * Node ESM resolver that appends `.js` to the repo's extensionless relative
 * imports, which Vite resolves but Node does not. Test-harness only.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.')) throw error;
    const base = dirname(fileURLToPath(context.parentURL));
    const candidate = resolvePath(base, specifier);
    for (const suffix of ['', '.js', '.jsx', '/index.js']) {
      if (existsSync(candidate + suffix)) {
        return next(pathToFileURL(candidate + suffix).href, context);
      }
    }
    throw error;
  }
}
