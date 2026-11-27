// The sample property in the shape ClubMap draws. The property itself is shared with the app
// (@huntclub/shared/sample).
import { SAMPLE_PROPERTY } from '@huntclub/shared/sample';

/** The sample in the shape ClubMap draws (ids are the names: nothing is stored). */
export const SAMPLE_PLAN = {
  boundary: SAMPLE_PROPERTY.boundary,
  areas: Object.values(SAMPLE_PROPERTY.areas).map((a) => ({ id: a.name, ...a })),
  stands: SAMPLE_PROPERTY.stands.map((s) => ({ id: s.name, ...s })),
};
