// The one sample property, shared by the web admin (drawn behind the sign-in form, captioned as a
// sample, and the tests' and demo's in-memory club) and the app's dev-only screenshot mode. Made
// up, in central Illinois: about a square mile, L-shaped, with two areas and three stands.
import type { StandType } from './enums';

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

/**
 * The sample property's public aerial map pack: the archive is committed at
 * web/sample-pack/<key> (built by web/scripts/sample-pack.ts) and deployed by infra's Web stack
 * to packs/sample/<id>.pmtiles. A new archive takes a new id: packs are cached for a year.
 */
export const SAMPLE_PACK_ID = '5e0a3b4c-6d7e-4f8a-9b0c-1d2e3f4a5b90';
/** The key folder of the public sample pack (not a club). */
export const SAMPLE_PACK_OWNER = 'sample';
/**
 * The web workspace folder that holds the committed archive at its bucket key
 * (web/sample-pack/packs/sample/<id>.pmtiles): infra deploys the folder as it is.
 */
export const SAMPLE_PACK_FOLDER = 'sample-pack';
