// The bottom sheet over the map on phones and tablets (docs/DESIGN.md "Map chrome" 4): peek,
// half and full (mapChrome.sheet), dragged by its 48 px handle zone, settling on the nearest
// detent or, flicked, on the next one its way (snapDetent). The peek never hides. The handle's
// button moves it from the keyboard (Enter, or the up and down arrows), and focus moving into
// a peeking sheet raises it, so nothing focused is out of sight.
import {
  ICON_SIZE,
  SHEET_DETENTS,
  sheetDetentHeights,
  snapDetent,
  type SheetDetent,
} from '@huntclub/design';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cx } from '../components/ui/cx';

const step = (detent: SheetDetent, by: 1 | -1): SheetDetent => {
  const at = SHEET_DETENTS.indexOf(detent) + by;
  return SHEET_DETENTS[Math.max(0, Math.min(SHEET_DETENTS.length - 1, at))]!;
};

export function MapSheet(props: {
  /** Names the sheet for screen readers. */
  label: string;
  detent: SheetDetent;
  onDetent: (detent: SheetDetent) => void;
  /** The height of the map the sheet rises over, in px. */
  mapHeight: number;
  /** The one line in the handle zone: a summary, or the draw bar while editing. */
  summary: ReactNode;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{
    y: number;
    from: number;
    last: { y: number; t: number };
    velocity: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const heights = sheetDetentHeights(props.mapHeight);
  const height = (d: { y: number; from: number }, y: number) =>
    Math.max(heights.peek, Math.min(heights.full, d.from + d.y - y));
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button, a, input, select, textarea'))
      return;
    const y = e.clientY;
    drag.current = { y, from: heights[props.detent], last: { y, t: e.timeStamp }, velocity: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = e.timeStamp - d.last.t;
    if (dt > 0) d.velocity = (e.clientY - d.last.y) / dt;
    d.last = { y: e.clientY, t: e.timeStamp };
    setDragging(true);
    // The live height goes straight to the element (CSSOM, which the strict CSP allows).
    sheet.current?.style.setProperty('--sheet-drag', `${height(d, e.clientY)}px`);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const moved = Math.abs(e.clientY - d.y);
    // A tap on the handle zone (no drag) raises a peeking sheet.
    if (moved < 4) {
      if (props.detent === 'peek') props.onDetent('half');
      return;
    }
    props.onDetent(snapDetent(heights, props.detent, height(d, e.clientY), d.velocity));
  };
  const top = props.detent === 'full';
  return (
    <section
      ref={sheet}
      className={cx('map-sheet', `map-sheet--${props.detent}`, dragging && 'map-sheet--dragging')}
      aria-label={props.label}
    >
      <div
        className="map-sheet__handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <span className="map-sheet__grabber" aria-hidden="true" />
        <div className="map-sheet__summary">{props.summary}</div>
        <button
          type="button"
          className="map-sheet__toggle"
          aria-label={top ? 'Show less' : 'Show more'}
          aria-expanded={props.detent !== 'peek'}
          onClick={() => props.onDetent(top ? 'peek' : step(props.detent, 1))}
          onKeyDown={(e) => {
            const by = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
            if (!by) return;
            e.preventDefault();
            props.onDetent(step(props.detent, by));
          }}
        >
          {top ? (
            <ChevronDown size={ICON_SIZE.md} aria-hidden />
          ) : (
            <ChevronUp size={ICON_SIZE.md} aria-hidden />
          )}
        </button>
      </div>
      <div
        className="map-sheet__body"
        onFocus={() => {
          if (props.detent === 'peek') props.onDetent('half');
        }}
      >
        {props.children}
      </div>
    </section>
  );
}
