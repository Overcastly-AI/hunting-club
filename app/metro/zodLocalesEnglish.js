// Served by metro.config.js in place of zod's `locales/index.js`, which
// re-exports all ~60 zod locales (about 300 KB of the app bundle, since
// Metro bundles every re-export). zod registers English itself; this keeps
// `z.locales.en` and drops the rest. The app never calls `z.config` with
// another locale (its error messages are its own copy).
export { default as en } from 'zod/v4/locales/en.js';
