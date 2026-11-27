// A stand's details, opened from its marker on the club map: a panel down the right edge from the
// tablet width up and a bottom sheet on phones (Dialog placement="side"), so the map stays the
// page. Read-only: stands are placed and edited in the app, at the spot.
import { ICON_SIZE } from '@huntclub/design';
import {
  coordinatesReadout,
  HARVEST_SEX_LABELS,
  memberNames,
  recentStandHarvests,
  STAND_TYPE_LABELS,
  type Area,
  type Harvest,
  type Member,
  type Stand,
} from '@huntclub/shared';
import { useId } from 'react';
import { StandStatus } from '../components/StandStatus';
import { standIcon } from '../components/standIcons';
import { ButtonLink, Dialog } from '../components/ui';
import { formatLocalDay } from '../format';
import { pageHref } from '../shell/routes';

/** What the drawer says when the stand has no shared harvests, or they did not load. */
export const STAND_HARVESTS_EMPTY = 'No harvests shared at this stand yet.';
export const STAND_HARVESTS_UNKNOWN =
  'Harvests could not be loaded. Try again when you are online.';

/**
 * The stand's name, type, status, area, notes and place, and the latest harvests members shared
 * from it. `stand` null: closed. Lists that failed to load are undefined. Esc, the close button
 * and a tap outside close it, and focus goes back to the marker.
 */
export function StandDrawer(props: {
  stand: Stand | null;
  onClose: () => void;
  areas?: readonly Area[] | undefined;
  harvests?: readonly Harvest[] | undefined;
  members?: readonly Member[] | undefined;
}) {
  const { stand } = props;
  return (
    <Dialog
      open={stand !== null}
      onClose={props.onClose}
      placement="side"
      title={stand?.name}
      description={stand ? areaLine(stand, props.areas) : undefined}
    >
      {stand ? <StandDetails {...props} stand={stand} /> : null}
    </Dialog>
  );
}

/** "In Creek Bottom", or nothing for a stand outside any area. */
function areaLine(stand: Stand, areas?: readonly Area[]) {
  const area = stand.areaId ? areas?.find((a) => a.id === stand.areaId) : undefined;
  return area ? `In ${area.name}` : undefined;
}

function StandDetails(props: Parameters<typeof StandDrawer>[0] & { stand: Stand }) {
  const { stand } = props;
  const Icon = standIcon(stand.type);
  const place = coordinatesReadout(stand.lat, stand.lon);
  const notes = stand.notes?.trim();
  return (
    <>
      <dl className="stand-facts">
        <div className="stand-facts__row">
          <dt>Type</dt>
          <dd className="stand-facts__type">
            <Icon size={ICON_SIZE.md} aria-hidden />
            {STAND_TYPE_LABELS[stand.type]}
          </dd>
        </div>
        <div className="stand-facts__row">
          <dt>Check-in</dt>
          <dd>
            <StandStatus active={stand.active} />
          </dd>
        </div>
        {notes ? (
          <div className="stand-facts__row">
            <dt>Notes</dt>
            <dd className="stand-facts__notes">{notes}</dd>
          </div>
        ) : null}
        <div className="stand-facts__row">
          <dt>Coordinates</dt>
          <dd>
            <span className="text-readout-inline" aria-hidden="true">
              {place.short}
            </span>
            <span className="visually-hidden">{place.spoken}</span>
          </dd>
        </div>
      </dl>
      <RecentHarvests stand={stand} harvests={props.harvests} members={props.members} />
    </>
  );
}

function RecentHarvests(props: {
  stand: Stand;
  harvests?: readonly Harvest[] | undefined;
  members?: readonly Member[] | undefined;
}) {
  const id = useId();
  const recent = props.harvests ? recentStandHarvests(props.harvests, props.stand.id) : undefined;
  const name = memberNames(props.members ?? []);
  return (
    <section className="stand-harvests" aria-labelledby={id}>
      <h3 id={id} className="stand-harvests__title">
        Recent harvests
      </h3>
      {!recent ? (
        <p className="stand-harvests__empty">{STAND_HARVESTS_UNKNOWN}</p>
      ) : recent.length === 0 ? (
        <p className="stand-harvests__empty">{STAND_HARVESTS_EMPTY}</p>
      ) : (
        <ul className="rows">
          {recent.map((h) => (
            <li key={h.id} className="row-item">
              <div className="row-item__text">
                <p className="row-item__title">{h.species.trim()}</p>
                <p className="row-item__detail">
                  {formatLocalDay(h.harvestedAt)}, {name(h.userId)}
                </p>
              </div>
              <span className="row-item__where">{HARVEST_SEX_LABELS[h.sex]}</span>
            </li>
          ))}
        </ul>
      )}
      <ButtonLink size="sm" href={pageHref('harvests')}>
        All harvests
      </ButtonLink>
    </section>
  );
}
