// `npm run lighthouse -- <env> [outDir]` (default dev, lighthouse-reports): audits the
// deployed public pages with Lighthouse on the local Chrome, mobile and desktop, writes
// JSON and HTML reports to outDir and prints a markdown summary. Report only: exits 0
// whatever the scores. Lighthouse runs through npx; it is not a repo dependency.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getEnvConfig } from '../config';
import { formatLighthouseSummary, lighthouseRuns, type LighthouseResult } from '../src/lighthouse';

/** Pinned so runs compare like with like; bump on purpose. */
const LIGHTHOUSE = 'lighthouse@13.6.0';

function main() {
  const config = getEnvConfig(process.argv[2]);
  const outDir = resolve(process.argv[3] ?? 'lighthouse-reports');
  mkdirSync(outDir, { recursive: true });

  const rows = lighthouseRuns(config, outDir).map((run) => {
    console.error(`Lighthouse: ${run.url} (${run.formFactor})`);
    spawnSync(
      'npx',
      [
        '--yes',
        LIGHTHOUSE,
        run.url,
        '--output=json',
        '--output=html',
        `--output-path=${run.outputPrefix}`,
        '--chrome-flags=--headless=new --no-sandbox',
        '--quiet',
        ...(run.formFactor === 'desktop' ? ['--preset=desktop'] : []),
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    const json = `${run.outputPrefix}.report.json`;
    const lhr = existsSync(json)
      ? (JSON.parse(readFileSync(json, 'utf8')) as LighthouseResult)
      : undefined;
    return { run, lhr };
  });

  console.log(formatLighthouseSummary(config, rows));
}

main();
