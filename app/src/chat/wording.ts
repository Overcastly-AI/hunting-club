import { MAX_TEXT_CHARS } from '@huntclub/mesh';

import { placeLabel } from '../map/labels';
import type { HunterPlace } from '../map/types';
import type { ChatItem } from './model';

/** System card text for a check-in, check-out, help request or shared harvest. */
export function systemCardText(
  event: Extract<ChatItem, { kind: 'system' }>['event'],
  name: string,
  detail?: { place?: HunterPlace; species?: string },
): string {
  switch (event) {
    case 'checkIn':
      return detail?.place
        ? detail.place.kind === 'moving'
          ? `${name} checked in: ${placeLabel(detail.place)}`
          : `${name} checked in at ${placeLabel(detail.place)}`
        : `${name} checked in`;
    case 'checkOut':
      return `${name} checked out`;
    case 'help':
      return `${name} asked for a hand`;
    case 'harvest':
      return detail?.species
        ? `${name} shared a harvest: ${detail.species}`
        : `${name} shared a harvest`;
  }
}

/** The live counter inside the text field: "11 of 200", or "3 too many" past the limit. */
export function charactersLeft(text: string): { left: number; text: string; over: boolean } {
  const used = [...text].length;
  const left = MAX_TEXT_CHARS - used;
  return {
    left,
    over: left < 0,
    text: left >= 0 ? `${used} of ${MAX_TEXT_CHARS}` : `${-left} too many`,
  };
}

/** Under our own bubble: "Sending…", "Delivered to 2 of 3", "Not sent". */
export function deliveryText(item: Extract<ChatItem, { kind: 'text' }>): string | undefined {
  if (!item.mine) return undefined;
  if (item.sendState === 'failed') return 'Not sent. Check your radio.';
  if (item.delivered && item.delivered.of > 0)
    return `Delivered to ${item.delivered.to} of ${item.delivered.of}`;
  if (item.sendState === 'sending') return 'Sending…';
  return 'Sent';
}

/** What a screen reader says for a bubble. */
export function bubbleLabel(item: Extract<ChatItem, { kind: 'text' }>, time: string): string {
  const who = item.mine ? 'You' : item.fromName;
  const where = item.place ? `, ${placeLabel(item.place)}` : '';
  const delivery = deliveryText(item);
  return `${who}${where}, ${time}: ${item.text}${delivery ? `. ${delivery}` : ''}`;
}
