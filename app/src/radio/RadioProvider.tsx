import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { RadioController, type RadioControllerDeps, type RadioSnapshot } from './RadioController';

export type RadioContextValue = RadioSnapshot &
  Pick<RadioController, 'pair' | 'reconnect' | 'forget' | 'sendText'>;

const RadioContext = createContext<RadioContextValue | null>(null);

/** Radio link state and actions. The only way screens talk to the radio. */
export function useRadio(): RadioContextValue {
  const value = useContext(RadioContext);
  if (!value) throw new Error('useRadio must be used inside <RadioProvider>');
  return value;
}

type Props = RadioControllerDeps & { children: ReactNode };

/** Exposes one RadioController to the app; reconnects to the remembered radio on mount. */
export function RadioProvider({ children, ...deps }: Props) {
  // One controller for the provider's lifetime; deps are fixed at mount.
  const [controller] = useState(() => new RadioController(deps));

  useEffect(() => {
    void controller.init();
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const value = useMemo<RadioContextValue>(
    () => ({
      ...snapshot,
      pair: controller.pair,
      reconnect: controller.reconnect,
      forget: controller.forget,
      sendText: controller.sendText,
    }),
    [snapshot, controller],
  );

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}
