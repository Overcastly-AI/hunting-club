import { FAVICON_ICO, FAVICON_SVG, logoMarkSvg } from '@huntclub/design';
import { APP_NAME, SAFETY_NOTE } from '@huntclub/shared';
import type { ReactNode } from 'react';
import { MENU_LABELS, MENU_SHEET_ID, MENU_TOGGLE_CLASS } from './menu/menu';
import { jsonLd } from './structuredData';
import {
  canonicalUrl,
  FOOTER_GROUPS,
  GET_THE_APP,
  NAV_LINKS,
  OG_IMAGE,
  SIGN_IN,
  type SiteLink,
  THEME_COLOR,
} from './routes';

/** Meshtastic's trademark notice: required wherever the name is used. */
export const MESHTASTIC_ATTRIBUTION = `Meshtastic® is a registered trademark of Meshtastic LLC. ${APP_NAME} is not affiliated with or endorsed by the Meshtastic project.`;

export interface PageAssets {
  /** The fingerprinted Archivo WOFF2 (preloaded and used by the stylesheet). */
  readonly fontUrl: string;
  /** The site stylesheet's URL (a content-hashed file in assets/, so the CSP needs no inline styles). */
  readonly cssUrl: string;
  /** The home page's bookmark forward (HASH_FORWARD_SCRIPT) as a content-hashed file. */
  readonly forwardScriptUrl: string;
  /** The phone header menu's script (src/menu/main.ts), a self-hosted module on every page. */
  readonly menuScriptUrl: string;
  /** The home hero's aerial picture (@huntclub/design/aerial), a content-hashed SVG file. */
  readonly aerialUrl: string;
}

/** What a page's head says about it (from the route registry). */
export interface PageMeta {
  readonly title: string;
  readonly description: string;
  /** The page's path: og:url, and the canonical URL unless noindex. No path: noindex. */
  readonly path?: string;
  /** Kept out of search results (no canonical), but still previewed when shared (/join). */
  readonly noindex?: boolean;
  /** The Open Graph card's path (ogImagePath): a large preview when shared. */
  readonly ogImage?: string;
  /** schema.org JSON-LD for the page (structuredData.ts). */
  readonly structuredData?: readonly object[];
  /**
   * A self-hosted classic script that runs before the page renders (the home page's
   * bookmark forward). Never inline: the CSP allows this origin's script files only.
   */
  readonly blockingScriptSrc?: string;
  /** A self-hosted module script (/join's), loaded after the page is parsed. */
  readonly scriptSrc?: string;
  /** Send no Referer from this page (/join: its URL holds an invite). */
  readonly noReferrer?: boolean;
}

/** A whole page: head from the registry, then header, main content and footer. */
export function Document(props: { meta: PageMeta; assets: PageAssets; children: ReactNode }) {
  const { meta, assets } = props;
  const url = meta.path === undefined ? undefined : canonicalUrl(meta.path);
  const indexed = url !== undefined && !meta.noindex;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {meta.noReferrer ? <meta name="referrer" content="no-referrer" /> : null}
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        {indexed ? <link rel="canonical" href={url} /> : <meta name="robots" content="noindex" />}
        {url ? (
          <>
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content={APP_NAME} />
            <meta property="og:title" content={meta.title} />
            <meta property="og:description" content={meta.description} />
            <meta property="og:url" content={url} />
            {meta.ogImage ? (
              <>
                <meta property="og:image" content={canonicalUrl(meta.ogImage)} />
                <meta property="og:image:type" content="image/png" />
                <meta property="og:image:width" content={String(OG_IMAGE.width)} />
                <meta property="og:image:height" content={String(OG_IMAGE.height)} />
                <meta property="og:image:alt" content={meta.title} />
              </>
            ) : null}
            <meta name="twitter:card" content={meta.ogImage ? 'summary_large_image' : 'summary'} />
          </>
        ) : null}
        <meta name="theme-color" content={THEME_COLOR.dark} media="(prefers-color-scheme: dark)" />
        <meta
          name="theme-color"
          content={THEME_COLOR.light}
          media="(prefers-color-scheme: light)"
        />
        <link rel="icon" href={`/${FAVICON_ICO.file}`} sizes="48x48" />
        <link rel="icon" type="image/svg+xml" href={`/${FAVICON_SVG}`} />
        <link rel="preload" as="font" type="font/woff2" href={assets.fontUrl} crossOrigin="" />
        <link rel="stylesheet" href={assets.cssUrl} />
        {meta.blockingScriptSrc ? <script src={meta.blockingScriptSrc} /> : null}
        <script type="module" src={assets.menuScriptUrl} />
        {meta.scriptSrc ? <script type="module" src={meta.scriptSrc} /> : null}
        {(meta.structuredData ?? []).map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
          />
        ))}
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header current={meta.path} />
        <main id="main">{props.children}</main>
        <Footer />
      </body>
    </html>
  );
}

/** The mark, transparent: the stylesheet paints it with the theme (it shows in both). */
const MARK = { __html: logoMarkSvg({ background: 'none' }) };

function LinkList(props: { links: readonly SiteLink[]; label: string }) {
  return (
    <ul className="nav-list" aria-label={props.label}>
      {props.links.map((link) => (
        <li key={link.href}>
          <a href={link.href}>{link.label}</a>
        </li>
      ))}
    </ul>
  );
}

function Header(props: { current: string | undefined }) {
  return (
    <header className="site-header">
      <div className="bar">
        <a className="brand" href="/">
          <span aria-hidden="true" dangerouslySetInnerHTML={MARK} />
          {APP_NAME}
        </a>
        <nav className="site-nav" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.href === props.current ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="btn plain" href={SIGN_IN.href}>
            {SIGN_IN.label}
          </a>
          <a className="btn go" href={GET_THE_APP.href}>
            {GET_THE_APP.label}
          </a>
        </div>
        {/*
          Phones: the header is the logo and this one button. The menu script (./menu, a
          self-hosted file on every page) opens the sheet; the footer repeats every link.
        */}
        <button
          type="button"
          className={MENU_TOGGLE_CLASS}
          aria-expanded="false"
          aria-controls={MENU_SHEET_ID}
        >
          {MENU_LABELS.closed}
        </button>
        <nav id={MENU_SHEET_ID} aria-label="Main menu" hidden>
          <LinkList links={[...NAV_LINKS, SIGN_IN, GET_THE_APP]} label="Main menu" />
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <nav className="footer-groups" aria-label="Footer">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="footer-heading">{group.heading}</h2>
              <LinkList links={group.links} label={group.heading} />
            </div>
          ))}
        </nav>
        <p>{SAFETY_NOTE}</p>
        <p>{MESHTASTIC_ATTRIBUTION}</p>
      </div>
    </footer>
  );
}
