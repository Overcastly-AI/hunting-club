/**
 * Limits stock Meshtastic firmware applies to what the phone sends, so the
 * client can respect them instead of having packets dropped.
 */

/**
 * Firmware drops a text message (TEXT_MESSAGE_APP) from the phone if it comes
 * within this long of the last one it accepted on the same connection. It
 * still answers with a QueueStatus (res 0) and then a Routing
 * RATE_LIMIT_EXCEEDED error (PhoneAPI::handleToRadioPacket, TWO_SECONDS_MS;
 * firmware 2.5 to 2.7 at least).
 */
export const FIRMWARE_TEXT_RATE_LIMIT_MS = 2_000;
