import {
  READOUT_CELLS,
  READOUT_LABELS,
  type ConditionsReadout,
  type ReadoutCell,
  type Wording,
} from '@huntclub/shared';
import { Sunrise, Sunset, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import { StatGrid, StatTile } from './ui';

const ICONS: Record<ReadoutCell, LucideIcon> = {
  sunrise: Sunrise,
  sunset: Sunset,
  wind: Wind,
  temperature: Thermometer,
};

/** A value as it is shown ("6:52 am", "NW 6 mph", "—") and as it is read ("not known"). */
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
 * The conditions strip (sunrise, sunset, wind, temperature): the same four cells as the phone's
 * map and the site, from the shared conditionsReadout. Sunrise and sunset only, never legal
 * shooting hours. The web holds no forecast, so wind and temperature read "—" here.
 */
export function ConditionsStrip(props: { readout: ConditionsReadout }) {
  return (
    <StatGrid aria-label="Conditions today">
      {READOUT_CELLS.map((cell) => (
        <StatTile
          key={cell}
          icon={ICONS[cell]}
          label={READOUT_LABELS[cell]}
          value={<Spoken wording={props.readout[cell]} />}
        />
      ))}
    </StatGrid>
  );
}
