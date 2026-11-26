import {
  NOTES_MAX,
  SPECIES_MAX,
  notesSchema,
  trimmedText,
  type HarvestSex,
} from '@huntclub/shared';
import type { HarvestToShare, OpenCheckIn } from '@huntclub/core';

import type { Audience } from '../domain/audience';
import { placeLabel } from '../map/labels';
import { placeOf } from '../map/place';
import type { LocalHarvest, NewHarvest, SharedWith } from './harvests';

/** Quick picks above the species field; any species can be typed. */
export const COMMON_SPECIES = ['Deer', 'Turkey', 'Elk', 'Bear', 'Hog'] as const;

export const SEX_LABELS: Record<HarvestSex, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Not sure',
};

export const SHARE_LABELS: Record<SharedWith, string> = {
  none: 'Private',
  party: 'Party',
  club: 'Club',
};

/** Private always; Party for everyone; Club only for club members. */
export function shareChoices(audience: Audience): readonly SharedWith[] {
  return audience === 'club' ? ['none', 'party', 'club'] : ['none', 'party'];
}

export type HarvestDraft = { species: string; sex: HarvestSex; notes: string; share: SharedWith };

export const EMPTY_DRAFT: HarvestDraft = { species: '', sex: 'unknown', notes: '', share: 'none' };

const speciesSchema = trimmedText(SPECIES_MAX);

/** What's wrong with the draft (shared validation rules), or null when it can be saved. */
export function draftProblem(draft: HarvestDraft): string | null {
  if (!speciesSchema.safeParse(draft.species).success) {
    return draft.species.trim()
      ? `Keep the species to ${SPECIES_MAX} characters`
      : 'Pick or type a species';
  }
  if (!notesSchema.safeParse(draft.notes.trim()).success)
    return `Keep notes to ${NOTES_MAX} characters`;
  return null;
}

/** The record to save: where comes from the open check-in, if any. Saved private; sharing marks it after it's sent. */
export function harvestFromDraft(
  draft: HarvestDraft,
  checkIn: OpenCheckIn | null,
  now: number,
): NewHarvest {
  const placement = checkIn?.placement;
  const notes = draft.notes.trim();
  return {
    species: draft.species.trim(),
    sex: draft.sex,
    ...(notes ? { notes } : {}),
    ...(placement
      ? {
          placeMode: placement.mode,
          placeLabel: placeLabel(placeOf(placement)),
          ...(placement.pin ? { pin: placement.pin } : {}),
          ...('standId' in placement && placement.standId
            ? { standMeshId: placement.standId }
            : {}),
          ...('areaId' in placement && placement.areaId ? { areaMeshId: placement.areaId } : {}),
        }
      : {}),
    sharedWith: 'none',
    harvestedAt: now,
  };
}

/** What goes over the mesh when a harvest is shared (core trims the note to fit). */
export function harvestToShare(h: LocalHarvest): HarvestToShare {
  return {
    species: h.species,
    sex: h.sex,
    ...(h.notes ? { note: h.notes } : {}),
    placement: {
      ...(h.placeMode !== undefined ? { mode: h.placeMode } : {}),
      ...(h.standMeshId ? { standId: h.standMeshId } : {}),
      ...(h.areaMeshId ? { areaId: h.areaMeshId } : {}),
      ...(h.pin ? { pin: h.pin } : {}),
    },
  };
}
