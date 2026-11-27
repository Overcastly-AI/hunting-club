import { AreaCreateSchema, AreaUpdateSchema, ClubCreateSchema, ClubUpdateSchema } from '../club';
import {
  AREA_PROBLEMS,
  areaProblem,
  PROPERTY_LINE_LIMITS,
  PROPERTY_LINE_PROBLEMS,
  propertyLinePolygon,
  propertyLineProblem,
  ringAcres,
  ringCorners,
  ringCrossesItself,
} from '../propertyLine';
import { SAMPLE_PROPERTY } from '../sample';
import type { Ring } from '../maps';

/** A square `side` degrees across with its south-west corner at (-90, 40). */
const square = (side: number): Ring => [
  [-90, 40],
  [-90 + side, 40],
  [-90 + side, 40 + side],
  [-90, 40 + side],
];

describe('the property line rule', () => {
  it('accepts the sample property (an L shape) and the closed polygon the draw tool saves', () => {
    expect(propertyLineProblem(SAMPLE_PROPERTY.boundary)).toBeNull();
    expect(propertyLineProblem(propertyLinePolygon(square(0.01)))).toBeNull();
    expect(propertyLinePolygon(square(0.01)).coordinates[0]).toHaveLength(5);
  });

  it('reads corners without the closing repeat or a corner twice in a row', () => {
    expect(
      ringCorners([
        [1, 1],
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 1],
      ]),
    ).toEqual([
      [1, 1],
      [2, 1],
      [2, 2],
    ]);
  });

  it('refuses too few or too many corners', () => {
    expect(propertyLineProblem(propertyLinePolygon(square(0.01).slice(0, 2)))).toBe('tooFewPoints');
    const many: Ring = Array.from({ length: PROPERTY_LINE_LIMITS.maxPoints + 1 }, (_, i) => {
      const a = (2 * Math.PI * i) / (PROPERTY_LINE_LIMITS.maxPoints + 1);
      return [-90 + 0.01 * Math.cos(a), 40 + 0.01 * Math.sin(a)];
    });
    expect(propertyLineProblem(propertyLinePolygon(many))).toBe('tooManyPoints');
  });

  it('refuses a line that crosses itself, touches itself or folds back', () => {
    const bowTie: Ring = [
      [-90, 40],
      [-89.99, 40.01],
      [-89.99, 40],
      [-90, 40.01],
    ];
    expect(ringCrossesItself(bowTie)).toBe(true);
    expect(propertyLineProblem(propertyLinePolygon(bowTie))).toBe('crosses');
    // A corner placed on another side.
    const touching: Ring = [...square(0.01), [-89.995, 40]];
    expect(ringCrossesItself(touching)).toBe(true);
    // Back along the same side: a spike.
    const spike: Ring = [
      [-90, 40],
      [-89.99, 40],
      [-89.995, 40],
      [-89.995, 40.01],
    ];
    expect(ringCrossesItself(spike)).toBe(true);
    expect(ringCrossesItself(square(0.01))).toBe(false);
  });

  it('measures acres and refuses a slip of the mouse or a property too big for a map pack', () => {
    // 0.01° square at 40° N: about 1113 m by 853 m, 234 acres.
    expect(ringAcres(square(0.01))).toBeCloseTo(234.6, 0);
    expect(propertyLineProblem(propertyLinePolygon(square(0.0005)))).toBe('tooSmall');
    expect(propertyLineProblem(propertyLinePolygon(square(1)))).toBe('tooBig');
  });

  it('is what the club create and update requests apply, with its own words', () => {
    const bowTie = propertyLinePolygon([
      [-90, 40],
      [-89.99, 40.01],
      [-89.99, 40],
      [-90, 40.01],
    ]);
    const update = ClubUpdateSchema.safeParse({ boundary: bowTie });
    expect(update.success).toBe(false);
    expect(update.error!.issues[0]!.message).toBe(PROPERTY_LINE_PROBLEMS.crosses);
    expect(ClubUpdateSchema.safeParse({ boundary: SAMPLE_PROPERTY.boundary }).success).toBe(true);
    expect(
      ClubCreateSchema.safeParse({ name: 'Oak', boundary: propertyLinePolygon(square(1)) }).success,
    ).toBe(false);
  });
});

describe('the area rule', () => {
  it('is the shape rule alone: corners and sides that do not cross, any size', () => {
    // Smaller than a property may be (a food plot) and bigger than a pack: both fine for an area.
    expect(areaProblem(propertyLinePolygon(square(0.0005)))).toBeNull();
    expect(areaProblem(propertyLinePolygon(square(1)))).toBeNull();
    expect(areaProblem(propertyLinePolygon(square(0.01).slice(0, 2)))).toBe('tooFewPoints');
    const bowTie = propertyLinePolygon([
      [-90, 40],
      [-89.99, 40.01],
      [-89.99, 40],
      [-90, 40.01],
    ]);
    expect(areaProblem(bowTie)).toBe('crosses');
    const create = AreaCreateSchema.safeParse({ name: 'Bow Tie', boundary: bowTie });
    expect(create.success).toBe(false);
    expect(create.error!.issues[0]!.message).toBe(AREA_PROBLEMS.crosses);
    expect(AreaUpdateSchema.safeParse({ boundary: bowTie }).success).toBe(false);
    expect(
      AreaCreateSchema.safeParse({ name: 'Plot', boundary: propertyLinePolygon(square(0.0005)) })
        .success,
    ).toBe(true);
  });
});
