import { ADMIN_PATH } from '@huntclub/shared/app';

export function NotFound() {
  return (
    <div className="wrap page-head">
      <h1>Page not found</h1>
      <p className="lede">This page does not exist. Check the address, or go to the home page.</p>
      <div className="actions">
        <a className="btn go" href="/">
          Go to the home page
        </a>
        <a className="btn" href={ADMIN_PATH}>
          Sign in to the club admin
        </a>
      </div>
    </div>
  );
}
