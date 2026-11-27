// The one sample property: drawn behind the sign-in form (captioned as a sample, since nobody
// is signed in yet) and used by the tests' and the demo's in-memory club. Made up, in central
// Illinois: about a square mile, L-shaped, with two areas and three stands.
import type { StandType } from '@huntclub/shared';

/** A closed GeoJSON Polygon from [lon, lat] points (the first point repeated last). */
const polygon = (...points: [number, number][]) => ({
  type: 'Polygon' as const,
  coordinates: [[...points, points[0]!]],
});

export const SAMPLE_PROPERTY = {
  name: 'Oak Ridge Hunt Club',
  boundary: polygon(
    [-90, 40],
    [-89.981, 40],
    [-89.981, 40.007],
    [-89.986, 40.007],
    [-89.986, 40.0145],
    [-90, 40.0145],
  ),
  areas: {
    north: {
      name: 'North 40',
      boundary: polygon(
        [-89.9995, 40.0085],
        [-89.9905, 40.0085],
        [-89.9905, 40.014],
        [-89.9995, 40.014],
      ),
    },
    creek: {
      name: 'Creek Bottom',
      boundary: polygon(
        [-89.998, 40.0015],
        [-89.989, 40.0015],
        [-89.986, 40.005],
        [-89.995, 40.0065],
        [-89.998, 40.0045],
      ),
    },
  },
  stands: [
    {
      name: 'Creek Stand',
      type: 'tree_stand',
      area: 'creek',
      lat: 40.0035,
      lon: -89.994,
      active: true,
    },
    {
      name: 'Big Oak Ladder',
      type: 'ladder',
      area: 'north',
      lat: 40.0118,
      lon: -89.9965,
      active: true,
    },
    {
      name: 'Field Blind',
      type: 'ground_blind',
      area: 'north',
      lat: 40.0098,
      lon: -89.9925,
      active: false,
    },
  ],
} as const;

/** Every sample stand is a real stand type (checked here, not at each use). */
SAMPLE_PROPERTY.stands satisfies readonly { type: StandType }[];

/** The sample in the shape ClubMap draws (ids are the names: nothing is stored). */
export const SAMPLE_PLAN = {
  boundary: SAMPLE_PROPERTY.boundary,
  areas: Object.values(SAMPLE_PROPERTY.areas).map((a) => ({ id: a.name, ...a })),
  stands: SAMPLE_PROPERTY.stands.map((s) => ({ id: s.name, ...s })),
};
