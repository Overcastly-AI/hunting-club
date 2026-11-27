// The logo bar, shared by the signed-in shell and the pages off /app/. Its own module, so
// the Checkout return and Page not found pages never load the admin shell.
import { APP_NAME } from '@huntclub/shared/app';
import type { ReactNode } from 'react';
import { LogoMark } from '../components/LogoMark';
import { SHELL } from '../components/ui/sizes';

/** The logo mark and the app name (the name hides on the rail and the phone top bar). */
export function Brand() {
  return (
    <div className="shell-brand">
      <LogoMark size={SHELL.logo} className="shell-brand__mark" />
      <span className="shell-brand__name">{APP_NAME}</span>
    </div>
  );
}

/**
 * Pages off /app/ (Checkout return, Page not found): no sign-in, so no club or nav; the
 * same top bar with the logo, and the same content column.
 */
export function PublicShell(props: { children: ReactNode }) {
  return (
    <div className="shell shell--public">
      <header className="shell-public-bar">
        <Brand />
      </header>
      <main id="main" className="shell-public-main">
        {props.children}
      </main>
    </div>
  );
}
