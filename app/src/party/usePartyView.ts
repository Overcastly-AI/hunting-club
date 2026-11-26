import type { PartyService, PartyView } from '@huntclub/core';
import { useEffect, useState } from 'react';

/** The current party from the service, kept up to date; null with no party or no service. */
export function usePartyView(service: PartyService | null): PartyView | null {
  const [state, setState] = useState(() => ({ service, view: service?.current ?? null }));
  // A new radio link brings a new service: start from its current party.
  if (state.service !== service) setState({ service, view: service?.current ?? null });

  useEffect(() => service?.on('change', (view) => setState({ service, view })), [service]);
  return state.service === service ? state.view : (service?.current ?? null);
}
