// Builds src/noEval.ts as its own entry and loads it before the app's script (module
// scripts run in document order). Zod probes for eval while the app's schema modules load,
// so turning that off from inside the app's own entry would run too late; this way the
// page never attempts eval under its Content-Security-Policy (no 'unsafe-eval').
import type { Plugin, Rollup } from 'vite';

const ENTRY = 'src/noEval.ts';
const NAME = 'no-eval';

export function noEvalEntry(): Plugin {
  let base = '/';
  return {
    name: 'huntclub-no-eval-entry',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: ENTRY, name: NAME });
    },
    // After Vite adds the app's script, put this entry's script just before it.
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => {
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (c): c is Rollup.OutputChunk => c.type === 'chunk' && c.isEntry && c.name === NAME,
        );
        if (!chunk) throw new Error(`No ${ENTRY} chunk in the build`);
        const app = '<script type="module"';
        if (!html.includes(app)) throw new Error('No app script in index.html');
        const tag = `<script type="module" crossorigin src="${base}${chunk.fileName}"></script>`;
        return html.replace(app, `${tag}\n    ${app}`);
      },
    },
  };
}
