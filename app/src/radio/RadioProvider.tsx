import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { BoardRadioContext } from '../board/BoardRadio';
import { ChatRadioContext } from '../chat/ChatRadio';
import { CheckInRadioContext } from '../checkin/CheckInRadio';
import { HarvestRadioContext } from '../harvest/HarvestRadio';
import { mapDataStore, type MapDataStore } from '../map/dataSource';
import { connectMapData } from '../map/meshMapData';
import { PartyRadioContext } from '../party/PartyRadio';
import { SafetyRadioContext } from '../safety/SafetyRadio';
import { RadioController, type RadioControllerDeps, type RadioSnapshot } from './RadioController';
import {
  DEFAULT_SERVICES_OPTIONS,
  RadioServices,
  type RadioServicesOptions,
} from './RadioServices';

export type RadioContextValue = RadioSnapshot &
  Pick<RadioController, 'pair' | 'reconnect' | 'forget'>;

const RadioContext = createContext<RadioContextValue | null>(null);

/** Radio link state and actions. The only way screens talk to the radio. */
export function useRadio(): RadioContextValue {
  const value = useContext(RadioContext);
  if (!value) throw new Error('useRadio must be used inside <RadioProvider>');
  return value;
}

type Props = RadioControllerDeps & {
  children: ReactNode;
  /** Party/club settings for the core services (defaults: free party). */
  services?: Partial<RadioServicesOptions>;
  /** Where the map's data goes (defaults to the app's store). */
  mapStore?: MapDataStore;
};

/**
 * Exposes one RadioController to the app; reconnects to the remembered radio
 * on mount. For each radio link it creates the core services once
 * (RadioServices) and provides them to the screens, and feeds the map.
 */
export function RadioProvider({
  children,
  services: serviceOptions,
  mapStore = mapDataStore,
  ...deps
}: Props) {
  // One controller for the provider's lifetime; deps are fixed at mount.
  const [controller] = useState(() => new RadioController(deps));

  useEffect(() => {
    void controller.init();
    return () => {
      void controller.dispose();
    };
  }, [controller]);

  const [options] = useState<RadioServicesOptions>(() => ({
    ...DEFAULT_SERVICES_OPTIONS,
    ...(deps.clientOptions?.random ? { random: deps.clientOptions.random } : {}),
    ...(deps.now ? { now: deps.now } : {}),
    ...serviceOptions,
  }));
  const [services, setServices] = useState<RadioServices | null>(null);

  // New services for each radio link; the old ones are disposed with it.
  useEffect(() => {
    let current: RadioServices | null = null;
    const replace = (next: RadioServices | null) => {
      current?.dispose();
      current = next;
      setServices(next);
    };
    const off = controller.on('client', (client) =>
      replace(client ? new RadioServices(client, options) : null),
    );
    if (controller.client) replace(new RadioServices(controller.client, options));
    return () => {
      off();
      current?.dispose();
    };
  }, [controller, options]);

  // The map shows live party members while there is a link.
  useEffect(() => {
    if (!services) return;
    const stop = connectMapData(services.mapRadio, mapStore, options.names);
    return () => {
      stop();
      // Keep the last known positions, but never show them as live.
      const last = mapStore.getSnapshot();
      mapStore.set({ ...last, mesh: { ...last.mesh, radioConnected: false } });
    };
  }, [services, mapStore, options.names]);

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const value = useMemo<RadioContextValue>(
    () => ({
      ...snapshot,
      pair: controller.pair,
      reconnect: controller.reconnect,
      forget: controller.forget,
    }),
    [snapshot, controller],
  );

  return (
    <RadioContext.Provider value={value}>
      <CheckInRadioContext.Provider value={services?.checkInRadio ?? null}>
        <SafetyRadioContext.Provider value={services?.safetyRadio ?? null}>
          <ChatRadioContext.Provider value={services?.chatRadio ?? null}>
            <HarvestRadioContext.Provider value={services?.harvestRadio ?? null}>
              <BoardRadioContext.Provider value={services?.boardRadio ?? null}>
                <PartyRadioContext.Provider value={services?.party ?? null}>
                  {children}
                </PartyRadioContext.Provider>
              </BoardRadioContext.Provider>
            </HarvestRadioContext.Provider>
          </ChatRadioContext.Provider>
        </SafetyRadioContext.Provider>
      </CheckInRadioContext.Provider>
    </RadioContext.Provider>
  );
}
