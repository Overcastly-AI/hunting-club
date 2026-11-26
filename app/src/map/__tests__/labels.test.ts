import { NOW, hunterFixture, openStandFixture } from '../../test-utils/mapFixtures';
import {
  hunterAccessibilityLabel,
  openStandAccessibilityLabel,
  placeLabel,
  yourAccessibilityLabel,
} from '../labels';

describe('placeLabel', () => {
  it('names the stand, area or spot, or says On the move', () => {
    expect(placeLabel({ kind: 'stand', name: 'Creek Stand' })).toBe('Creek Stand');
    expect(placeLabel({ kind: 'area', name: 'North 40' })).toBe('North 40');
    expect(placeLabel({ kind: 'spot', name: 'Big Oak' })).toBe('Big Oak');
    expect(placeLabel({ kind: 'spot' })).toBe('Spot');
    expect(placeLabel({ kind: 'moving' })).toBe('On the move');
    expect(placeLabel({ kind: 'moving', areaName: 'Creek Bottom' })).toBe(
      'On the move · Creek Bottom',
    );
  });
});

describe('hunterAccessibilityLabel', () => {
  it('matches the spec example', () => {
    expect(hunterAccessibilityLabel(hunterFixture(2), NOW)).toBe(
      'Creek Stand, Dale, updated 2 minutes ago',
    );
  });

  it('reads hunters on the move and fresh positions', () => {
    const hunter = hunterFixture(0, { displayName: 'Sam', place: { kind: 'moving' } });
    expect(hunterAccessibilityLabel(hunter, NOW)).toBe('On the move, Sam, updated just now');
  });

  it('says a faded position is only the last known one', () => {
    expect(hunterAccessibilityLabel(hunterFixture(14), NOW)).toBe(
      'Creek Stand, Dale, updated 14 minutes ago, last known position',
    );
  });
});

describe('other marker labels', () => {
  it('reads open stands with their type', () => {
    expect(openStandAccessibilityLabel(openStandFixture)).toBe('Ridge Stand, ladder stand, open');
  });

  it('mentions your scent only when the cone is shown', () => {
    expect(yourAccessibilityLabel(false)).toBe('You are here');
    expect(yourAccessibilityLabel(true)).toBe('You are here. Your scent drifts downwind');
  });
});
