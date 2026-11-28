// The map-first pieces of the site (docs/DESIGN.md): the example club on the aerial, its
// markers (the same components draw the home page's legend), and the readout strip.
// Positions come from SAMPLE_CLUB through classes in mapCss(): no style attributes (CSP).
import { AERIAL_WORLD } from '@huntclub/design/aerial';
import { type Freshness, STAND_TYPE_ICON_NAMES, type StandType } from '@huntclub/shared';
import {
  ArrowUp,
  ArrowUpFromLine,
  type LucideIcon,
  Sunrise,
  Sunset,
  Tent,
  TreePine,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  hunterFreshness,
  openStands,
  SAMPLE_CLUB,
  SAMPLE_CONDITIONS,
  SAMPLE_LABELS,
  SAMPLE_MESH,
  SAMPLE_SCALE,
  SCENT_LABEL,
} from './sampleClub';

/** One lucide icon per stand type, by the shared names the app and the admin use. */
const STAND_ICONS = { TreePine, ArrowUpFromLine, Tent } as const satisfies Record<
  (typeof STAND_TYPE_ICON_NAMES)[StandType],
  LucideIcon
>;

/** Classes that place things on the aerial (mapCss writes their positions). */
export const AT = {
  label: (i: number) => `at-l${i}`,
  stand: (i: number) => `at-s${i}`,
  hunter: (i: number) => `at-h${i}`,
  you: 'at-you',
  camp: 'at-camp',
  scentLabel: 'at-scent',
} as const;

/** The ring around a hunter, by how fresh their position is (freshness.ts). */
export const RING_CLASS: Record<Freshness, string> = {
  fresh: 'ring-fresh',
  stale: 'ring-stale',
  faded: 'ring-faded',
};

export function StandMarker(props: { type: StandType; className?: string; children?: ReactNode }) {
  const Icon = STAND_ICONS[STAND_TYPE_ICON_NAMES[props.type]];
  return (
    <span className={`mk stand ${props.className ?? ''}`.trim()}>
      <span className="sq">
        <Icon className="ic" aria-hidden="true" size={22} />
      </span>
      {props.children}
    </span>
  );
}

export function HunterMarker(props: {
  initials: string;
  freshness: Freshness;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`mk hunter ${RING_CLASS[props.freshness]} ${props.className ?? ''}`.trim()}>
      <span className="dot">{props.initials}</span>
      {props.children}
    </span>
  );
}

export function YouMarker(props: { className?: string; children?: ReactNode }) {
  return (
    <span className={`mk you ${props.className ?? ''}`.trim()}>
      <span className="dot" />
      {props.children}
    </span>
  );
}

/** A marker's plate: the place first, then who and how long ago. */
function Plate(props: { name: string; detail?: string; detailClass?: string }) {
  return (
    <span className="tag">
      <b>{props.name}</b>
      {props.detail ? <i className={props.detailClass}>{props.detail}</i> : null}
    </span>
  );
}

/** Your scent cone: drawn downwind from your dot (the sample wind is from the north-west). */
export function ScentCone(props: { className?: string }) {
  return (
    <svg
      className={`scent ${props.className ?? ''}`.trim()}
      width="150"
      height="150"
      viewBox="0 0 150 150"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 0L128 62A96 96 0 0 1 62 128Z" />
    </svg>
  );
}

/** Spoken summary of the example map (the picture itself is one image to a screen reader). */
export const MAP_DESCRIPTION = `Example club map of ${SAMPLE_CLUB.name}: the property line, ${SAMPLE_CLUB.stands.length} stands, ${SAMPLE_CLUB.hunters.length} hunters checked in with how long ago each was heard, and you.`;

/** The example club on the aerial, with every marker and label. */
export function World(props: { aerialUrl: string }) {
  const { width, height } = AERIAL_WORLD;
  const open = new Set(openStands().map((s) => s.name));
  return (
    <div className="world" role="img" aria-label={MAP_DESCRIPTION}>
      <img className="world-map" src={props.aerialUrl} width={width} height={height} alt="" />
      {SAMPLE_LABELS.map((l, i) => (
        <span key={l.text} className={`lbl lbl-${l.kind} ${AT.label(i)}`}>
          {l.text}
        </span>
      ))}
      <ScentCone className={AT.you} />
      <span className={`lbl lbl-name ${AT.scentLabel}`}>{SCENT_LABEL.text}</span>
      <span className={`mk place ${AT.camp}`}>
        <Plate name="Camp" />
      </span>
      {SAMPLE_CLUB.stands.map((s, i) =>
        open.has(s.name) ? (
          <StandMarker
            key={s.name}
            type={s.type}
            className={`${AT.stand(i)}${'left' in s ? ' left' : ''}`}
          >
            <Plate name={s.name} detail="Open" detailClass="open" />
          </StandMarker>
        ) : null,
      )}
      {SAMPLE_CLUB.hunters.map((h, i) => {
        const heard = hunterFreshness(h);
        return (
          <HunterMarker
            key={h.initials}
            initials={h.initials}
            freshness={heard.freshness}
            className={`${AT.hunter(i)}${'left' in h ? ' left' : ''}`}
          >
            <Plate name={h.where} detail={`${h.name}, ${heard.short}`} />
          </HunterMarker>
        );
      })}
      <YouMarker className={AT.you}>
        <Plate name="You" />
      </YouMarker>
    </div>
  );
}

/** "6:52 AM" → ["6:52", "AM"]; "NW 6 mph" → ["NW 6", "mph"]; "34°F" → ["34", "°F"]. */
export function splitUnit(readout: string): [string, string] {
  const m = /^(.*?)\s?(AM|PM|mph|°F)$/.exec(readout);
  return m ? [m[1]!, m[2]!] : [readout, ''];
}

/** The strip's cell labels. Wind is always "last known": it comes from the last forecast synced. */
export const READOUT_LABELS = {
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  wind: 'Last known wind',
  temperature: 'Temp',
} as const;

function Cell(props: { label: string; value: string; icon?: LucideIcon; after?: ReactNode }) {
  const [figure, unit] = splitUnit(props.value);
  const Icon = props.icon;
  return (
    <div className="field">
      <dt>
        {Icon ? <Icon className="ic" aria-hidden="true" size={15} /> : null}
        {props.label}
      </dt>
      <dd className="num">
        {figure}
        {unit ? <small>{unit}</small> : null}
        {props.after}
      </dd>
    </div>
  );
}

/** The four-cell readout strip (sunrise, sunset, wind, temperature) and the mesh line. */
export function ReadoutStrip() {
  const c = SAMPLE_CONDITIONS;
  return (
    <div className="live plate">
      <dl className="fields">
        <Cell label={READOUT_LABELS.sunrise} value={c.sunrise} icon={Sunrise} />
        <Cell label={READOUT_LABELS.sunset} value={c.sunset} icon={Sunset} />
        <Cell
          label={READOUT_LABELS.wind}
          value={c.wind.short}
          after={<ArrowUp className="ic toward" aria-hidden="true" size={17} />}
        />
        <Cell label={READOUT_LABELS.temperature} value={c.temperature.short} />
      </dl>
      <p className="mesh">
        <span className="meshdot" aria-hidden="true" />
        Mesh: {SAMPLE_MESH.radios} radios, {SAMPLE_MESH.heard.short}. No internet in use.
      </p>
    </div>
  );
}

/** The map window: the example club behind floating plates (the hero's own plate is `children`). */
export function MapHero(props: { aerialUrl: string; children: ReactNode }) {
  return (
    <section className="hero mapview">
      <World aerialUrl={props.aerialUrl} />
      {props.children}
      <ReadoutStrip />
      <div className="scale" aria-hidden="true">
        {SAMPLE_SCALE.label}
      </div>
      <p className="map-note">Example club</p>
    </section>
  );
}
