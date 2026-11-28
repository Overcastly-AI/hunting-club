// Editing on the map is its own mode (docs/DESIGN.md "Map chrome" 7): an editor (the shape and
// stand editors) puts its Done and Cancel in the top pill, its tools on the draw bar (the sheet's
// peek on a phone, the top of the panel on a desktop) and its fields in the sheet or panel. The
// page owns those places; an editor reaches them through these slots, portalled.
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface EditSlots {
  /** Where the editing pill goes, over the map's top left. */
  pill: HTMLElement | null;
  /** The draw bar: the editor's count and tools. */
  bar: HTMLElement | null;
  /** The editor's fields, notes and errors. */
  body: HTMLElement | null;
  /** Brings the fields into view (raises a phone's sheet), e.g. to show what to fix. */
  reveal: () => void;
}

const NONE: EditSlots = { pill: null, bar: null, body: null, reveal: () => {} };

export const EditSlotsContext = createContext<EditSlots>(NONE);

export const useEditSlots = () => useContext(EditSlotsContext);

/** Renders `children` into one of the page's edit slots (nothing until it is mounted). */
export function InSlot(props: { slot: Exclude<keyof EditSlots, 'reveal'>; children: ReactNode }) {
  const target = useEditSlots()[props.slot];
  return target ? createPortal(props.children, target) : null;
}
