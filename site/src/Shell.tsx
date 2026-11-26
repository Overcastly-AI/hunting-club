import { colors, logoMarkSvg } from '@huntclub/design';
import { APP_NAME, SAFETY_NOTE } from '@huntclub/shared';
import type { ReactNode } from 'react';
import {
  canonicalUrl,
  FOOTER_LINKS,
  GET_THE_APP,
  NAV_LINKS,
  SIGN_IN,
  type SiteLink,
  type SitePath,
  type SiteRoute,
} from './routes';

/** Meshtastic's trademark notice: required wherever the name is used. */
export const MESHTASTIC_ATTRIBUTION = `Meshtastic® is a registered trademark of Meshtastic LLC. ${APP_NAME} is not affiliated with or endorsed by the Meshtastic project.`;

export interface PageAssets {
  /** The fingerprinted Archivo WOFF2 (preloaded and used by the stylesheet). */
  readonly fontUrl: string;
  /** The inlined stylesheet. */
  readonly css: string;
}

/** A whole page: head from the registry entry, then header, main content and footer. */
export function Document(props: {
  route: SiteRoute & { path: SitePath };
  assets: PageAssets;
  children: ReactNode;
}) {
  const { route, assets } = props;
  const url = canonicalUrl(route.path);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{route.title}</title>
        <meta name="description" content={route.description} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={APP_NAME} />
        <meta property="og:title" content={route.title} />
        <meta property="og:description" content={route.description} />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary" />
        <meta name="theme-color" content={colors.surface} />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preload" as="font" type="font/woff2" href={assets.fontUrl} crossOrigin="" />
        <style dangerouslySetInnerHTML={{ __html: assets.css }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{props.children}</main>
        <Footer />
      </body>
    </html>
  );
}

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

function Header() {
  const links = [...NAV_LINKS, SIGN_IN];
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href="/">
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: logoMarkSvg() }} />
          {APP_NAME}
        </a>
        <nav className="desktop" aria-label="Main">
          <LinkList links={links} label="Main" />
        </nav>
        <a className="button primary" href={GET_THE_APP.href}>
          {GET_THE_APP.label}
        </a>
        {/* No JavaScript: a native disclosure, labelled with a word, holds the menu on phones. */}
        <details className="menu">
          <summary>Menu</summary>
          <nav aria-label="Main menu">
            <LinkList links={links} label="Main menu" />
          </nav>
        </details>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <nav aria-label="Footer">
          <LinkList links={FOOTER_LINKS} label="Footer" />
        </nav>
        <p>{MESHTASTIC_ATTRIBUTION}</p>
        <p>{SAFETY_NOTE}</p>
      </div>
    </footer>
  );
}
