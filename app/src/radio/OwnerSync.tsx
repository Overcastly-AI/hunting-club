import { ownerFromProfile, type Owner } from '@huntclub/mesh';
import { useEffect } from 'react';

import type { MyProfile } from '../db/appState';
import type { RadioInfo } from './RadioController';
import { useRadio } from './RadioProvider';

/** The owner to write to the radio, or null when it already carries the hunter's name. */
export function ownerToWrite(
  radio: RadioInfo | null,
  profile: MyProfile | null | undefined,
): Owner | null {
  if (!radio || !profile) return null;
  const owner = ownerFromProfile(profile);
  return radio.longName === owner.longName && radio.shortName === owner.shortName ? null : owner;
}

/**
 * Keeps the linked radio's owner (Meshtastic long and short name) set to the
 * hunter's name and initials, so the party sees who they are: after the name
 * step, after pairing later, and after changing radios.
 */
export function OwnerSync({ profile }: { profile: MyProfile | null | undefined }) {
  const { link, radio, setOwner } = useRadio();
  const owner = link === 'ready' ? ownerToWrite(radio, profile) : null;
  const longName = owner?.longName;
  const shortName = owner?.shortName;
  useEffect(() => {
    if (longName !== undefined && shortName !== undefined) setOwner({ longName, shortName });
  }, [longName, shortName, setOwner]);
  return null;
}
