import { Alert, type AlertButton } from 'react-native';

import { PERMISSION_BUTTONS } from '../permissions/askPermission';

/**
 * Answers every Alert.alert by pressing the button with the given text
 * (for permission explain / Settings dialogs). Returns the spy so tests can
 * check which dialogs were shown.
 */
export function answerAlerts(buttonText: string | ((title: string) => string)) {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((title, _message, buttons?: AlertButton[]) => {
      const text = typeof buttonText === 'string' ? buttonText : buttonText(title ?? '');
      buttons?.find((b) => b.text === text)?.onPress?.();
    });
}

/**
 * Answers permission dialogs like a hunter who says yes to the explanation
 * and "Not now" to the offer to open Settings after a refusal.
 */
export function answerPermissionAlerts() {
  return jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons?: AlertButton[]) => {
      const pick =
        buttons?.find((b) => b.text === PERMISSION_BUTTONS.continue) ??
        buttons?.find((b) => b.text === PERMISSION_BUTTONS.notNow);
      pick?.onPress?.();
    });
}
