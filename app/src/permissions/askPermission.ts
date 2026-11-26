import { Alert, Linking } from 'react-native';

/**
 * The one flow for every runtime permission (location, Bluetooth, …):
 * 1. explain in plain language, with "Not now" as a way out;
 * 2. show the system prompt;
 * 3. if the system refused, explain how to fix it and offer to open Settings.
 * Each feature supplies only its words and its platform request.
 */
export type PermissionCopy = {
  /** Shown before the system prompt. */
  askTitle: string;
  askBody: string;
  /** Shown after a refusal, with an "Open Settings" button. */
  deniedTitle: string;
  deniedBody: string;
};

/** Button words shared by every permission dialog. */
export const PERMISSION_BUTTONS = {
  continue: 'Continue',
  notNow: 'Not now',
  openSettings: 'Open Settings',
} as const;

function confirm(title: string, body: string, ok: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: PERMISSION_BUTTONS.notNow, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]),
  );
}

/** Explains a refusal and offers to open the app's page in Settings. */
export async function offerSettings(copy: PermissionCopy): Promise<void> {
  if (await confirm(copy.deniedTitle, copy.deniedBody, PERMISSION_BUTTONS.openSettings)) {
    await Linking.openSettings();
  }
}

export type AskPermissionOptions = {
  copy: PermissionCopy;
  /** Skip the explanation when the permission is already granted. */
  isGranted?: () => Promise<boolean>;
  /** Shows the system prompt(s); resolves true if granted. */
  request: () => Promise<boolean>;
};

/** Runs explain → system prompt → offer Settings. Resolves true if granted. */
export async function askPermission({
  copy,
  isGranted,
  request,
}: AskPermissionOptions): Promise<boolean> {
  if (isGranted && (await isGranted())) return true;
  if (!(await confirm(copy.askTitle, copy.askBody, PERMISSION_BUTTONS.continue))) return false;
  if (await request()) return true;
  await offerSettings(copy);
  return false;
}
