import {
  HARVEST_SEXES,
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  STAND_TYPES,
  STAND_TYPE_LABELS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
} from '../enums';
import { HARVEST_SEX_LABELS } from '../harvestReport';

// The one set of words for each shared enum, used by the app and the club admin alike.
describe.each([
  ['member roles', MEMBER_ROLES, MEMBER_ROLE_LABELS],
  ['stand types', STAND_TYPES, STAND_TYPE_LABELS],
  ['subscription statuses', SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_LABELS],
  ['harvest sexes', HARVEST_SEXES, HARVEST_SEX_LABELS],
] as const)('labels for %s', (_name, values, labels) => {
  it('cover every value and nothing else', () => {
    expect(Object.keys(labels).sort()).toEqual([...values].sort());
  });

  it('are distinct, mixed-case words', () => {
    const words = values.map((value) => (labels as Record<string, string>)[value]!);
    expect(new Set(words).size).toBe(values.length);
    for (const word of words) expect(word).toMatch(/^[A-Z][a-z ]+$/);
  });
});

it('names each stand type the way a hunter says it', () => {
  expect(STAND_TYPE_LABELS).toEqual({
    tree_stand: 'Tree stand',
    ladder: 'Ladder stand',
    ground_blind: 'Ground blind',
  });
});
