import type { LegalDocId } from '@huntclub/shared';

/** Expo Router path of the Privacy or Terms screen (src/app/legal/[doc].tsx). */
export const legalRoute = (doc: LegalDocId) => `/legal/${doc}` as const;
