import { ADMIN_PATH } from '@huntclub/shared/app';

export function NotFound() {
  return (
    <section>
      <div className="wrap">
        <h1>Page not found</h1>
        <p className="lead">This page does not exist. Check the address, or go to the home page.</p>
        <div className="actions">
          <a className="button primary" href="/">
            Go to the home page
          </a>
          <a className="button" href={ADMIN_PATH}>
            Sign in to the club admin
          </a>
        </div>
      </div>
    </section>
  );
}
