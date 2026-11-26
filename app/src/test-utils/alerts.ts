import { Alert, type AlertButton } from 'react-native';

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
