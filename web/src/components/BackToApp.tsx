import { ADMIN_PATH } from '@huntclub/shared/app';
import type { ClubSession } from '@huntclub/shared';
import { useEffect, useState } from 'react';

/** Whether this browser holds a session (a kept refresh token); false until known. */
export function useHasSession(session: Pick<ClubSession, 'isSignedIn'> | undefined): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!session) return;
    let live = true;
    void session.isSignedIn().then((signedIn) => live && setHas(signedIn));
    return () => {
      live = false;
    };
  }, [session]);
  return has;
}

/** The way back to the admin from a page outside it: the app when signed in, else sign-in. */
export function BackToApp(props: { signedIn: boolean; primary?: boolean }) {
  return (
    <a className={props.primary ? 'button primary' : 'button'} href={ADMIN_PATH}>
      {props.signedIn ? 'Back to the app' : 'Back to sign in'}
    </a>
  );
}
