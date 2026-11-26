import type { HelpState, SelfPromptEvent } from '@huntclub/core';
import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';

import { alertStore } from './alertStore';
import { SafetyRadioContext, type SafetyRadio } from './SafetyRadio';

/** The safety radio (null until a radio is connected). */
export function useSafetyRadio() {
  return useContext(SafetyRadioContext);
}

type Help = SafetyRadio['help'];
/** `help.current` returns a fresh copy each call; keep the last one so snapshots stay stable. */
const lastHelpState = new WeakMap<Help, HelpState | null>();
const noRadio = () => () => undefined;

/** Our own Ask for a Hand, kept current (null when we haven't asked). */
export function useHelpState(): HelpState | null {
  const radio = useSafetyRadio();
  const subscribe = useCallback(
    (onChange: () => void) =>
      radio
        ? radio.help.on('change', (state) => {
            lastHelpState.set(radio.help, state);
            onChange();
          })
        : noRadio(),
    [radio],
  );
  return useSyncExternalStore(subscribe, () => {
    if (!radio) return null;
    if (!lastHelpState.has(radio.help)) lastHelpState.set(radio.help, radio.help.current);
    return lastHelpState.get(radio.help) ?? null;
  });
}

/** Core's "Still out?" prompt at our deadline; null once answered or cleared. */
export function useSelfPrompt(): SelfPromptEvent | null {
  const radio = useSafetyRadio();
  const [prompt, setPrompt] = useState<SelfPromptEvent | null>(null);
  useEffect(() => {
    if (!radio) return;
    const offs = [
      radio.overdue.on('selfPrompt', setPrompt),
      radio.overdue.on('selfPromptCleared', () => setPrompt(null)),
    ];
    return () => offs.forEach((off) => off());
  }, [radio]);
  return radio ? prompt : null;
}

/** Other hunters' help requests and overdue alerts. */
export function useIncomingAlerts() {
  return useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot);
}
