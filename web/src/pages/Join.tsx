import { APP_NAME } from '@huntclub/shared/app';
import { decodeJoinUrl, encodeJoinUrl, type JoinLink } from '@huntclub/mesh';
import { QrCode } from '../components/QrCode';
import { useDocumentTitle } from '../title';

/** The page an https invite link opens when the app is not installed (or on a computer). */
export function Join(props: { href: string }) {
  let link: JoinLink | null = null;
  try {
    link = decodeJoinUrl(props.href);
  } catch {
    link = null;
  }
  const club = link?.target.kind === 'club';
  const title = !link ? 'Invite' : club ? 'Club invite' : 'Hunting party invite';
  useDocumentTitle(title);

  if (!link) {
    return (
      <section aria-labelledby="join-title">
        <h1 id="join-title">{title}</h1>
        <p className="error" role="alert">
          This invite link is not complete. Ask for a new QR code.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="join-title">
      <h1 id="join-title">{title}</h1>
      <p>
        {club
          ? `You are invited to join a hunting club in ${APP_NAME}.`
          : `You are invited to hunt with a party in ${APP_NAME}.`}{' '}
        Open the invite on your phone. The app sets up your radio, and it keeps working with no cell
        service.
      </p>
      {/* The app link carries the same invite; the app's own scheme opens it directly. */}
      <a className="button primary" href={encodeJoinUrl(link)}>
        Open in the app
      </a>
      <p className="muted">
        No app yet? Install {APP_NAME} on your phone, then open this link again.
      </p>
      <h2>On a computer?</h2>
      <p>Scan this with your phone camera.</p>
      <QrCode value={props.href} label="Invite QR code" />
    </section>
  );
}
