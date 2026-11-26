// What the strict Content-Security-Policy (infra/src/security-headers.ts: script-src and
// style-src 'self', no hashes) would block in a page. The site tests run it on every built
// page, and the deploy smoke check runs it on the live home page.

/** A `<script>` tag with no src: allowed only as a JSON-LD data block (never executed). */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>/gi;

const RULES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'inline script', pattern: INLINE_SCRIPT },
  { name: 'style element', pattern: /<style[\s>]/gi },
  { name: 'style attribute', pattern: /<[^>]+\sstyle=/gi },
  { name: 'event handler attribute', pattern: /<[^>]+\son[a-z]+=/gi },
  { name: 'javascript: URL', pattern: /\s(?:href|src|action)="\s*javascript:/gi },
];

/** Each kind of inline code in `html` the CSP would refuse (empty: none). */
export function cspViolations(html: string): string[] {
  return RULES.filter((rule) => (html.match(rule.pattern) ?? []).length > 0).map((r) => r.name);
}
