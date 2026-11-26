import type { PartyService } from '@huntclub/core';
import { createContext } from 'react';

/** The free party service for the current radio link (null with no radio). */
export const PartyRadioContext = createContext<PartyService | null>(null);
