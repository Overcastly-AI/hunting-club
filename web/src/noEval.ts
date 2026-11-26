// Runs before the admin's own script (its own entry, loaded first: ../no-eval-entry.ts):
// turns off zod's eval probe before any schema loads, so the page runs clean under its
// Content-Security-Policy (no 'unsafe-eval').
import { validateWithoutEval } from '@huntclub/shared/schema-runtime';

validateWithoutEval();
