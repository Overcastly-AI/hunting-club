import { clockReadout, READOUT_LABELS, type SunReadout, type Wording } from '@huntclub/shared';
import { AlarmClock, Sunrise, Sunset } from 'lucide-react';
import { StatGrid, StatTile } from './ui';

/** The strip's word for the time the club's overdue alert goes out (sunset plus the grace). */
export const OVERDUE_ALERT_LABEL = 'Overdue at';

/** A value as it is shown ("6:52 am", "—") and as it is read ("not known"). */
export function Spoken(props: { wording: Wording }) {
  const { short, spoken } = props.wording;
  if (short === spoken) return <>{short}</>;
  return (
    <>
      <span aria-hidden="true">{short}</span>
      <span className="visually-hidden">{spoken}</span>
    </>
  );
}

/**
 * The web's conditions strip: sunrise and sunset (the shared sunReadout, the same cells as the
 * phone's map) and when the club's overdue alert goes out. Sunrise and sunset only, never legal
 * shooting hours. The web holds no forecast, so it has no wind or temperature cells.
 */
export function ConditionsStrip(props: { sun: SunReadout; overdueAt: number | undefined }) {
  const cells = [
    { key: 'sunrise', icon: Sunrise, label: READOUT_LABELS.sunrise, wording: props.sun.sunrise },
    { key: 'sunset', icon: Sunset, label: READOUT_LABELS.sunset, wording: props.sun.sunset },
    {
      key: 'overdue',
      icon: AlarmClock,
      label: OVERDUE_ALERT_LABEL,
      wording: clockReadout(props.overdueAt),
    },
  ];
  return (
    <StatGrid aria-label="Conditions today" three>
      {cells.map((cell) => (
        <StatTile
          key={cell.key}
          icon={cell.icon}
          label={cell.label}
          value={<Spoken wording={cell.wording} />}
        />
      ))}
    </StatGrid>
  );
}
