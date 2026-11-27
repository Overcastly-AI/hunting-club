import { DISPLAY_NAME_PURPOSE, INITIALS_HINT } from '@huntclub/shared';

/** Words for the name prompt (onboarding, first check-in, Party tab). */
export const nameCopy = {
  title: 'Your name',
  /** What the name is for, and that it needs no account or signal. */
  body: `${DISPLAY_NAME_PURPOSE} It is saved on this phone and your radio, so it works with no signal and no account.`,
  nameLabel: 'Your name',
  initialsLabel: 'Initials',
  initialsHint: INITIALS_HINT,
  fromRadio: 'From your radio. Change it if it isn’t you.',
  save: 'Save name',
  skip: 'Skip for now',
  /** Party tab. */
  section: {
    notSet: 'Not set yet. Others see your radio’s name.',
    set: 'Set your name',
    change: 'Change name',
  },
} as const;
