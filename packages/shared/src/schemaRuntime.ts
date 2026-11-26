import { z } from 'zod';

/**
 * Validates without zod's eval-based fast path, for a web page under the
 * Content-Security-Policy (no 'unsafe-eval'): zod's probe for eval support, though caught,
 * is reported as a CSP violation. Zod probes when a schema is built, so this must run
 * before any schema module loads: import it from `@huntclub/shared/schema-runtime` (which
 * loads no schemas) and call it from the page's first import.
 */
export function validateWithoutEval(): void {
  z.config({ jitless: true });
}
