import { ADMIN_PATH } from '@huntclub/shared';
import { PAGE_PATHS } from '@huntclub/site/routes';
import { dev } from '../config/dev';
import {
  formatLighthouseSummary,
  LIGHTHOUSE_NOINDEX_NOTE,
  LIGHTHOUSE_SKIPPED_NOTE,
  lighthouseRuns,
  type LighthouseResult,
} from '../src/lighthouse';

const SITE = `https://${dev.domainName}`;

const LHR: LighthouseResult = {
  categories: {
    accessibility: { score: 1 },
    performance: { score: 0.874 },
    'best-practices': { score: 0.96 },
    seo: { score: null },
  },
  audits: {
    'largest-contentful-paint': { numericValue: 2345.6 },
    'cumulative-layout-shift': { numericValue: 0.01234 },
    'total-blocking-time': { numericValue: 50.2 },
  },
};

describe('lighthouseRuns', () => {
  it('audits Home, Pricing and the admin sign-in, mobile and desktop, from the shared paths', () => {
    const runs = lighthouseRuns(dev, '/out');
    expect(runs.map((r) => `${r.url} ${r.formFactor}`)).toEqual([
      `${SITE}${PAGE_PATHS.home} mobile`,
      `${SITE}${PAGE_PATHS.home} desktop`,
      `${SITE}${PAGE_PATHS.pricing} mobile`,
      `${SITE}${PAGE_PATHS.pricing} desktop`,
      `${SITE}${ADMIN_PATH} mobile`,
      `${SITE}${ADMIN_PATH} desktop`,
    ]);
    expect(new Set(runs.map((r) => r.outputPrefix)).size).toBe(runs.length);
    expect(runs[0]?.outputPrefix).toBe('/out/home-mobile');
  });
});

describe('formatLighthouseSummary', () => {
  const [mobile, desktop] = lighthouseRuns(dev, '/out');

  it('shows the four scores, LCP, CLS and TBT per run, and the skipped-pages note', () => {
    const text = formatLighthouseSummary(dev, [{ run: mobile!, lhr: LHR }]);
    expect(text).toContain('### Lighthouse (dev)');
    expect(text).toContain(
      `| [Home](${SITE}/) | mobile | 100 | 87 | 96 | n/a | 2,346 ms | 0.012 | 50 ms |`,
    );
    expect(text).toContain(LIGHTHOUSE_SKIPPED_NOTE);
  });

  it('explains the SEO score only where the environment is noindex', () => {
    const rows = [{ run: mobile!, lhr: LHR }];
    expect(formatLighthouseSummary(dev, rows)).toContain(LIGHTHOUSE_NOINDEX_NOTE);
    expect(formatLighthouseSummary({ ...dev, searchIndexing: true }, rows)).not.toContain(
      LIGHTHOUSE_NOINDEX_NOTE,
    );
  });

  it('keeps a row, with the reason, when Lighthouse produced no usable report', () => {
    const text = formatLighthouseSummary(dev, [
      { run: mobile!, lhr: undefined },
      { run: desktop!, lhr: { ...LHR, runtimeError: { message: 'NO_FCP' } } },
    ]);
    const rows = text.split('\n').filter((l) => l.startsWith('| [Home]'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('| mobile | no report |');
    expect(rows[1]).toContain('| desktop | NO_FCP |');
    // Same column count as the header.
    const cols = (l: string) => l.split('|').length;
    const header = text.split('\n').find((l) => l.startsWith('| Page'))!;
    expect(rows.every((r) => cols(r) === cols(header))).toBe(true);
  });
});
