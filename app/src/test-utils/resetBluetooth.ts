import { PERMISSION_BUTTONS } from '../permissions/askPermission';
import { resetBluetoothPermissionForTests } from '../permissions/bluetooth';
import { resetBleStartedForTests } from '../radio/bleManager';
import { answerAlerts } from './alerts';
import { resetFakeBle } from './fakeBleManager';

/**
 * Fresh Bluetooth state for screens that scan and ask for permission
 * (needs react-native-ble-manager mocked with fakeBleManagerModule).
 * Every permission explanation is answered with Continue.
 */
export function resetBluetoothForTests(): void {
  resetFakeBle();
  resetBleStartedForTests();
  resetBluetoothPermissionForTests();
  answerAlerts(PERMISSION_BUTTONS.continue);
}
