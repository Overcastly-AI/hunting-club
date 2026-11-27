import {
  defaultSeason,
  HARVEST_SEX_LABELS,
  HARVEST_SEXES,
  harvestReport,
  isSeason,
  localDay,
  type Area,
  type CountRow,
  type Harvest,
  type HarvestReport,
  type Member,
  type Season,
  type Stand,
} from '@huntclub/shared';
import { useMemo, useState } from 'react';
import type { ClubApi } from '../api/types';
import { Field } from '../components/Field';
import { Loadable } from '../components/Loadable';
import { isOffline, useAsync } from '../components/useAsync';
import { Page } from '../components/Page';
import { DataTable } from '../components/DataTable';
import { toCsv } from '../csv';
import { saveFile } from '../download';
import { formatDate } from '../format';

/** The admin's own time zone: harvest days and weeks are local calendar days. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface ClubHarvests {
  harvests: readonly Harvest[];
  members: readonly Member[];
  stands: readonly Stand[];
  areas: readonly Area[];
}

/**
 * Season summaries of the harvests members shared with the club. The season is
 * whatever date range the admin picks; changing it needs no network.
 */
export function Harvests(props: { api: ClubApi }) {
  const club = useAsync(
    async (): Promise<ClubHarvests> => {
      const [harvests, members, stands, areas] = await Promise.all([
        props.api.listHarvests(),
        props.api.listMembers(),
        props.api.listStands(),
        props.api.listAreas(),
      ]);
      return { harvests, members, stands, areas };
    },
    [props.api],
    { keepLastOn: isOffline },
  );
  const [season, setSeason] = useState<Season>(() =>
    defaultSeason(localDay(new Date().toISOString(), TIME_ZONE)),
  );

  return (
    <Page title="Harvests" description="Harvests that members shared with the club.">
      <div className="row">
        <Field
          label="Season starts"
          type="date"
          value={season.from}
          onChange={(e) => setSeason((s) => ({ ...s, from: e.target.value }))}
        />
        <Field
          label="Season ends"
          type="date"
          value={season.to}
          onChange={(e) => setSeason((s) => ({ ...s, to: e.target.value }))}
        />
      </div>
      <Loadable state={club}>
        {(data) =>
          isSeason(season) ? (
            <Report data={data} season={season} onRefresh={club.reload} />
          ) : (
            <p className="error" role="alert">
              Pick a season end on or after its start.
            </p>
          )
        }
      </Loadable>
    </Page>
  );
}

function Report(props: { data: ClubHarvests; season: Season; onRefresh: () => void }) {
  const { data, season } = props;
  const report = useMemo(
    () => harvestReport(data.harvests, season, TIME_ZONE),
    [data.harvests, season],
  );
  const names = useMemo(() => memberNames(data.members), [data.members]);

  return (
    <>
      <p>
        {/* No "0 harvests" line: the empty state below says it. */}
        {report.total > 0 ? (
          <>
            <strong>{report.total}</strong> {report.total === 1 ? 'harvest' : 'harvests'} from{' '}
            {formatDay(season.from)} to {formatDay(season.to)}.{' '}
          </>
        ) : null}
        <button className="button" type="button" onClick={props.onRefresh}>
          Refresh
        </button>{' '}
        <button
          className="button"
          type="button"
          disabled={report.total === 0}
          aria-describedby={report.total === 0 ? 'export-hint' : undefined}
          onClick={() =>
            saveFile(
              `harvests-${season.from}-to-${season.to}.csv`,
              harvestCsv(report, data, names),
              'text/csv;charset=utf-8',
            )
          }
        >
          Export CSV
        </button>
        {report.total === 0 ? (
          <span id="export-hint" className="muted">
            {' '}
            Nothing to export yet
          </span>
        ) : null}
      </p>
      {report.total === 0 ? (
        <p>No shared harvests in this season yet.</p>
      ) : (
        <>
          <CountTable title="By species" heading="Species" rows={report.bySpecies} />
          <CountTable
            title="By sex"
            heading="Sex"
            rows={HARVEST_SEXES.map((sex) => ({
              key: sex,
              label: HARVEST_SEX_LABELS[sex],
              count: report.bySex[sex],
            }))}
          />
          <CountTable
            title="By member"
            heading="Member"
            rows={report.byMember
              .map((r) => ({ ...r, label: names(r.key) }))
              .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))}
          />
          <CountTable
            title="By week"
            heading="Week of"
            rows={report.byWeek.map((r) => ({ ...r, label: formatDay(r.key) }))}
          />
        </>
      )}
    </>
  );
}

function CountTable(props: { title: string; heading: string; rows: readonly CountRow[] }) {
  return (
    <>
      <h2>{props.title}</h2>
      <DataTable
        caption={`Harvests ${props.title.toLowerCase()}`}
        rows={props.rows}
        rowKey={(r) => r.key}
        columns={[
          { label: props.heading, cell: (r) => r.label },
          { label: 'Harvests', cell: (r) => r.count },
        ]}
      />
    </>
  );
}

/** Display name by user id; people who have left the club are not named. */
function memberNames(members: readonly Member[]) {
  const byId = new Map(members.map((m) => [m.userId, m.displayName]));
  return (userId: string) => byId.get(userId) ?? 'Former member';
}

/** "November 15, 2026" from a calendar day (no time zone shift). */
const formatDay = (day: string) => formatDate(`${day}T00:00:00.000Z`);

/** One row per harvest in the season: what a club keeps for its own records. */
function harvestCsv(
  report: HarvestReport,
  data: ClubHarvests,
  names: (userId: string) => string,
): string {
  const place = (list: readonly { id: string; name: string }[], id?: string) =>
    (id && list.find((p) => p.id === id)?.name) ?? '';
  return toCsv([
    ['Date', 'Species', 'Sex', 'Member', 'Stand', 'Area', 'Notes'],
    ...report.harvests.map((h) => [
      localDay(h.harvestedAt, TIME_ZONE),
      h.species.trim(),
      HARVEST_SEX_LABELS[h.sex],
      names(h.userId),
      place(data.stands, h.standId),
      place(data.areas, h.areaId),
      h.notes ?? '',
    ]),
  ]);
}
