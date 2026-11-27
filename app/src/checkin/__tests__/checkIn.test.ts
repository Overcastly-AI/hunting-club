import { CORE_CONFIG, type CheckInController } from '@huntclub/core';
import { CheckInMode } from '@huntclub/mesh';

import { describeDelivery, type CheckInRadio } from '../CheckInRadio';
import { checkInChoices } from '../modes';
import { overdueNote } from '../overdueNote';
import { placementFrom, sortStands, type ClubStand } from '../placement';
import { placeLabel } from '../../map/labels';
import { placeOf } from '../../map/place';

// Compile-time check: core's controller is what RadioProvider will pass.
type Fits<T, U extends T> = U;
export type ControllerFits = Fits<CheckInRadio['checkIns'], CheckInController>;

const HERE = { lat: 40.79, lon: -77.86 };

describe('check-in choices', () => {
  it('offers Right here and On the move to free parties: no stand needed', () => {
    expect(checkInChoices(false).map((c) => c.label)).toEqual(['Right here', 'On the move']);
  });

  it('adds At a stand and In an area for clubs, first, in the design’s order', () => {
    expect(checkInChoices(true).map((c) => c.label)).toEqual([
      'At a stand',
      'In an area',
      'Right here',
      'On the move',
    ]);
  });
});

describe('placementFrom', () => {
  it('needs your location for a spot and keeps an optional name', () => {
    expect(placementFrom({ mode: CheckInMode.Spot })).toEqual({
      ok: false,
      missing: 'Waiting for your location',
    });
    expect(placementFrom({ mode: CheckInMode.Spot, pin: HERE, spotName: '  Big Oak ' })).toEqual({
      ok: true,
      placement: { mode: CheckInMode.Spot, pin: HERE, name: 'Big Oak' },
    });
    expect(placementFrom({ mode: CheckInMode.Spot, pin: HERE, spotName: '   ' })).toEqual({
      ok: true,
      placement: { mode: CheckInMode.Spot, pin: HERE },
    });
  });

  it('lets you go On the move with or without a location', () => {
    expect(placementFrom({ mode: CheckInMode.Moving })).toEqual({
      ok: true,
      placement: { mode: CheckInMode.Moving },
    });
    expect(placementFrom({ mode: CheckInMode.Moving, pin: HERE })).toEqual({
      ok: true,
      placement: { mode: CheckInMode.Moving, pin: HERE },
    });
  });

  it('asks for a stand or area in club modes', () => {
    expect(placementFrom({ mode: CheckInMode.Stand })).toEqual({
      ok: false,
      missing: 'Pick a stand',
    });
    expect(placementFrom({ mode: CheckInMode.Area })).toEqual({
      ok: false,
      missing: 'Pick an area',
    });
    expect(placementFrom({ mode: CheckInMode.Stand, standId: 4 })).toEqual({
      ok: true,
      placement: { mode: CheckInMode.Stand, standId: 4 },
    });
  });

  it('names our own check-in the way the map does', () => {
    const result = placementFrom({ mode: CheckInMode.Spot, pin: HERE, spotName: 'Big Oak' });
    if (!result.ok) throw new Error('expected a placement');
    expect(placeLabel(placeOf(result.placement))).toBe('Big Oak');
    expect(placeLabel(placeOf({ mode: CheckInMode.Moving }))).toBe('On the move');
  });
});

describe('sortStands', () => {
  const stand = (meshId: number, lat: number, occupiedBy?: string): ClubStand => ({
    meshId,
    name: `Stand ${meshId}`,
    position: { lat, lon: HERE.lon },
    ...(occupiedBy ? { occupiedBy } : {}),
  });

  it('puts the nearest open stand first and occupied stands last', () => {
    const sorted = sortStands([stand(1, 40.9), stand(2, 40.795, 'Dale'), stand(3, 40.8)], HERE);
    expect(sorted.map((s) => s.meshId)).toEqual([3, 1, 2]);
  });
});

describe('overdueNote', () => {
  const nov30 = new Date(2026, 10, 30, 7, 0).getTime();

  it('says the overdue time from sunset plus grace, and gives the time to draw in ink', () => {
    const note = overdueNote(nov30, HERE, 30, 'party');
    expect(note.text).toMatch(
      /^If you haven’t checked out by \d{1,2}:\d{2} PM, your party gets an overdue alert\. That is sunset plus 30 minutes\.$/,
    );
    expect(note.time).toMatch(/^\d{1,2}:\d{2} PM$/);
    expect(note.text).toContain(note.time);
  });

  it('falls back to words when your location is unknown, and names the club', () => {
    expect(overdueNote(nov30, undefined, CORE_CONFIG.overdue.graceMinutes, 'club')).toEqual({
      text: 'If you haven’t checked out by sunset plus 30 minutes, club members get an overdue alert.',
      time: null,
    });
  });

  it('never mentions legal shooting hours, first light or last light', () => {
    expect(overdueNote(nov30, HERE, 30, 'party').text).not.toMatch(/shooting|legal|light/i);
  });
});

describe('describeDelivery', () => {
  it('says plainly whether the radio sent it', () => {
    expect(describeDelivery({ status: 'sent' }, 'Checked in')).toEqual({
      tone: 'ok',
      text: 'Checked in',
    });
    expect(describeDelivery({ status: 'acked', by: 1, implicit: true }, 'Checked out').tone).toBe(
      'ok',
    );
    expect(describeDelivery({ status: 'timeout' }, 'Checked in').tone).toBe('problem');
    expect(describeDelivery({ status: 'failed', code: 1, reason: 'x' }, 'Checked in').text).toMatch(
      /radio/,
    );
  });
});
