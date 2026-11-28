// The bottom sheet over the map on phones and tablets (docs/DESIGN.md "Map chrome" 4): peek,
// half and full (mapChrome.sheet), dragged by its 48 px handle zone, settling on the nearest
// detent or, flicked, on the next one its way (snapDetent). The peek never hides. The handle's
// button moves it from the keyboard (Enter, or the up and down arrows), and focus moving into
// a peeking sheet raises it, so nothing focused is out of sight. At full it covers the map: its
// handle zone becomes its own header (`title` and the collapse button) and the page hides the
// map's chrome. It lifts the map's footer line with it (--map-footer-lift on its parent, live
// while dragging), so the credit is never under it. Mouse, touch and pen drag it alike.
import {
  ICON_SIZE,
  SHEET_DETENTS,
  sheetDetentHeights,
  snapDetent,
  type SheetDetent,
} from '@huntclub/design';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
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
  /** At full, the header in place of the summary (null: keep the summary, e.g. the draw bar). */
  title?: ReactNode;
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
  /** The sheet's top over the map, for the footer line above it. */
  const lift = (px: number) =>
    sheet.current?.parentElement?.style.setProperty('--map-footer-lift', `${px}px`);
  useLayoutEffect(() => {
    lift(heights[props.detent]);
  }, [props.detent, heights[props.detent]]);
  useLayoutEffect(() => {
    const parent = sheet.current?.parentElement;
    return () => void parent?.style.removeProperty('--map-footer-lift');
  }, []);
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
    const now = height(d, e.clientY);
    sheet.current?.style.setProperty('--sheet-drag', `${now}px`);
    lift(now);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    lift(heights[props.detent]);
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
          lift(heights[props.detent]);
        }}
      >
        <span className="map-sheet__grabber" aria-hidden="true" />
        <div className="map-sheet__summary">{top && props.title ? props.title : props.summary}</div>
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
