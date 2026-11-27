// Lighthouse audit of a deployed environment (`npm run lighthouse -w @huntclub/infra -- <env>`,
// run by .github/workflows/lighthouse.yml after Deploy dev). Report only: scores never
// fail the run. Every URL comes from the single sources (the env config, the site's
// PAGE_PATHS, ADMIN_PATH); nothing here signs in.
import { ADMIN_PATH } from '@huntclub/shared';
import { PAGE_PATHS } from '@huntclub/site/routes';
import type { EnvConfig } from '../config';

/** The public pages audited. Signed-in admin pages (My club, roster) need credentials. */
export const LIGHTHOUSE_PAGES = [
  { slug: 'home', name: 'Home', path: PAGE_PATHS.home },
  { slug: 'pricing', name: 'Pricing', path: PAGE_PATHS.pricing },
  { slug: 'sign-in', name: 'Sign in (club admin)', path: ADMIN_PATH },
] as const;

/** Lighthouse's two form factors: its default mobile emulation and `--preset=desktop`. */
export const LIGHTHOUSE_FORM_FACTORS = ['mobile', 'desktop'] as const;
export type LighthouseFormFactor = (typeof LIGHTHOUSE_FORM_FACTORS)[number];

/** Category ids in the order the summary shows them. */
export const LIGHTHOUSE_CATEGORIES = [
  { id: 'accessibility', label: 'A11y' },
  { id: 'performance', label: 'Perf' },
  { id: 'best-practices', label: 'Best practices' },
  { id: 'seo', label: 'SEO' },
] as const;

/** Why some pages are not audited; shown under the summary table. */
export const LIGHTHOUSE_SKIPPED_NOTE =
  'Signed-in club admin pages (My club, roster, map) are not audited: they need a Cognito sign-in, and this workflow holds no credentials.';

/** Why SEO scores lower on an environment that asks search engines not to index it. */
export const LIGHTHOUSE_NOINDEX_NOTE =
  'This environment sends noindex (searchIndexing off), so the SEO audit "Page is blocked from indexing" fails by design.';

export interface LighthouseRun {
  slug: string;
  name: string;
  url: string;
  formFactor: LighthouseFormFactor;
  /** Report path prefix: Lighthouse writes `<prefix>.report.json` and `.report.html`. */
  outputPrefix: string;
}

/** Every page × form factor to audit for an environment, with its report file prefix. */
export function lighthouseRuns(config: EnvConfig, outDir: string): LighthouseRun[] {
  return LIGHTHOUSE_PAGES.flatMap((page) =>
    LIGHTHOUSE_FORM_FACTORS.map((formFactor) => ({
      slug: page.slug,
      name: page.name,
      url: `https://${config.domainName}${page.path}`,
      formFactor,
      outputPrefix: `${outDir}/${page.slug}-${formFactor}`,
    })),
  );
}

/** The parts of a Lighthouse result (LHR) JSON the summary reads. */
export interface LighthouseResult {
  categories: Record<string, { score: number | null } | undefined>;
  audits: Record<string, { numericValue?: number } | undefined>;
  runtimeError?: { message?: string };
}

const metric = (lhr: LighthouseResult, id: string) => lhr.audits[id]?.numericValue;

function score(lhr: LighthouseResult, id: string): string {
  const s = lhr.categories[id]?.score;
  return s == null ? 'n/a' : String(Math.round(s * 100));
}

function ms(value: number | undefined): string {
  return value == null ? 'n/a' : `${Math.round(value).toLocaleString('en-US')} ms`;
}

/** One summary row per run; `lhr` is undefined when Lighthouse wrote no report. */
export function formatLighthouseSummary(
  config: EnvConfig,
  rows: readonly { run: LighthouseRun; lhr: LighthouseResult | undefined }[],
): string {
  const head = [
    'Page',
    'Form factor',
    ...LIGHTHOUSE_CATEGORIES.map((c) => c.label),
    'LCP',
    'CLS',
    'TBT',
  ];
  const lines = [
    `### Lighthouse (${config.name})`,
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
  ];
  for (const { run, lhr } of rows) {
    const page = `[${run.name}](${run.url})`;
    if (!lhr || lhr.runtimeError) {
      const why = lhr?.runtimeError?.message ?? 'no report';
      lines.push(`| ${page} | ${run.formFactor} | ${why} |${' |'.repeat(head.length - 3)}`);
      continue;
    }
    const cls = metric(lhr, 'cumulative-layout-shift');
    lines.push(
      `| ${[
        page,
        run.formFactor,
        ...LIGHTHOUSE_CATEGORIES.map((c) => score(lhr, c.id)),
        ms(metric(lhr, 'largest-contentful-paint')),
        cls == null ? 'n/a' : cls.toFixed(3),
        ms(metric(lhr, 'total-blocking-time')),
      ].join(' | ')} |`,
    );
  }
  lines.push(
    '',
    'Scores are 0 to 100 and report only (the run never fails on them). HTML reports are in the run artifact.',
    '',
    LIGHTHOUSE_SKIPPED_NOTE,
  );
  if (!config.searchIndexing) lines.push('', LIGHTHOUSE_NOINDEX_NOTE);
  return lines.join('\n');
}
