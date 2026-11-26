# Milestone 2: real-radio test checklist

For the owner, with two phones (ideally one iPhone and one Android) and two Meshtastic radios. Agents have no hardware, so everything below is untested on real radios.

## Before you start

- [ ] Install a development build on both phones (`eas build --profile development`, or `npx expo run:ios` / `npx expo run:android` on a dev machine). Expo Go can't load the Bluetooth module.
- [ ] Both radios run Meshtastic firmware 2.6 or newer, are charged, and share the same primary channel and region (for now, set them up once with the official Meshtastic app, then close that app completely: one phone per radio at a time).
- [ ] Note each radio's firmware version and whether it has a screen.

## 1. Pairing (each phone)

- [ ] Open the app, go to **Party** → **Pair your radio** → **Find radios**.
- [ ] Android 12+: the "Nearby devices" prompt appears with a plain reason. Android 11 or older: a location prompt appears instead. iPhone: the Bluetooth prompt shows our wording.
- [ ] Your radio appears in the list by name, with a word signal label (Strong / Good / Weak). Moving it farther away changes the label after **Search again**.
- [ ] Tap the radio. The phone asks for a PIN:
  - [ ] Radio with a screen: the PIN shown on the radio's screen works.
  - [ ] Radio without a screen: `123456` works.
- [ ] Status shows "Connected to your radio" with the radio's name, battery and software version.
- [ ] A wrong PIN shows "Could not connect. Check the PIN and try again." and does not loop.
- [ ] Close and reopen the app: it reconnects to the same radio on its own, without asking for the PIN again.

## 2. Texting with no cell service (the Milestone 2 acceptance test)

- [ ] Put both phones in airplane mode, then turn Bluetooth back on (airplane mode turns it off on some phones).
- [ ] On phone A, open **Chat** → **Radio test**, type a message and tap **Send**.
- [ ] Phone B shows the message with the sender's radio name and time.
- [ ] Phone A's status under the message changes from "Sending…" to "Heard by the mesh" or "Delivered". Write down which one and how long it took.
- [ ] Reply from phone B; phone A receives it.
- [ ] The text box stops at 200 characters and shows how many are left.
- [ ] Try one message with an emoji or accented letters (é, ñ).

## 3. Reconnect after walking out of range

- [ ] With both phones texting, walk phone A away from its radio until the status shows "Radio out of reach. Reconnecting…". Note the distance.
- [ ] Walk back. The link comes back on its own within about 30 seconds, without the PIN, and texting works again.
- [ ] Turn the radio off and on: the app reconnects by itself.
- [ ] Turn the phone's Bluetooth off and on: the app reconnects quickly.
- [ ] Messages sent by phone B while A was disconnected: note whether they arrive after A reconnects.

## 4. Forget and re-pair

- [ ] In the phone's Bluetooth settings, forget/unpair the radio (leave the app's pairing in place). Return to the app: it should show "Your phone and radio need to pair again" with **Open Bluetooth settings**. Note how long it takes and what the app showed.
- [ ] **Forget this radio** in the app, then **Find radios** and pair again with the PIN: works.
- [ ] Android: if you ever see repeated connection failures (GATT 133), note whether the app recovered by itself or showed the re-pair hint.
- [ ] Open the official Meshtastic app while ours is connected: confirm only one app can hold the radio; note what our app shows, and that it reconnects when the official app is closed.

## 5. Background link

**Android**

- [ ] While connected, a persistent notification "Connected to your radio" appears. Android 13+: the app asked for notification permission first (saying no is allowed; the link should still work).
- [ ] Lock the phone for 10 minutes. Send a text from phone B. Unlock phone A: the text is there, and the link never dropped.
- [ ] Swipe the app away from recent apps: note whether the notification and the link stay up.
- [ ] **Forget this radio** removes the notification.
- [ ] Repeat with battery saver on.

**iPhone**

- [ ] Lock the phone for 10 minutes. Send a text from phone B. Unlock: the text is there.
- [ ] Put the app in the background (home screen), walk out of range and back: note whether it reconnected while in the background.
- [ ] Force-quit the app (swipe up): expected to lose the link until reopened (iOS rule). Confirm it reconnects on reopening.

## Report back

For each failed box, note the phone model and OS version, radio model and firmware, and what the screen said. Include rough distances for range tests.
