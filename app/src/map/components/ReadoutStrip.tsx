import { READOUT_LABELS, type ConditionsReadout, type Wording } from '@huntclub/shared';
import { Sunrise, Sunset, type LucideIcon } from 'lucide-react-native';
import { Text, View, useWindowDimensions } from 'react-native';

import { WindArrowIcon } from '../../components/icons';
import { ICON_SIZE, makeStyles, spacing, textStyles, useTheme } from '../../theme';

/** Units drawn small after a readout: "6:52" "am", "NW 6" "mph", "34" "°F". */
const UNIT = /^(.*\S)\s?(AM|PM|am|pm|mph|°F)$/;

/** Splits a readout into its number and its unit ("NW 6 mph" → "NW 6" and "mph"). */
export function splitUnit(short: string): { value: string; unit: string | null } {
  const match = UNIT.exec(short);
  return match ? { value: match[1]!, unit: match[2]!.toLowerCase() } : { value: short, unit: null };
}

/** Above this text size the four cells take two rows, so no readout is ever cut. */
const TWO_ROWS_FROM_FONT_SCALE = 1.5;

type Props = {
  readout: ConditionsReadout;
  /** "Updated 3 hr ago" once the forecast is old; null while it is current. */
  updated?: Wording | null;
};

/**
 * The conditions strip (docs/DESIGN.md "Read out, do not decorate"): sunrise, sunset, wind
 * from and temperature in hairline-divided cells, condensed tabular numbers. Anything not known
 * is "—". Sunrise and sunset only: never legal shooting hours.
 */
export function ReadoutStrip({ readout, updated }: Props) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const twoRows = fontScale >= TWO_ROWS_FROM_FONT_SCALE;
  const spoken = [
    `Sunrise ${readout.sunrise.spoken}, sunset ${readout.sunset.spoken}.`,
    `Wind ${readout.wind.spoken}.`,
    `Temperature ${readout.temperature.spoken}.`,
    updated ? `${updated.spoken}.` : null,
  ];
  return (
    <View accessible accessibilityLabel={spoken.filter(Boolean).join(' ')}>
      <View style={styles.cells}>
        {cells(readout).map((cell, index) => (
          <Cell
            key={cell.label}
            {...cell}
            twoRows={twoRows}
            // Hairlines only between cells: none before the first in each row, none above the first row.
            edgeLeft={twoRows ? index % 2 === 1 : index > 0}
            edgeTop={twoRows && index >= 2}
          />
        ))}
      </View>
      {updated ? <Text style={styles.updated}>{updated.short}</Text> : null}
    </View>
  );
}

type CellSpec = {
  label: string;
  icon?: LucideIcon;
  value: string;
  /** The wind cell: where the arrow points. */
  towardDeg?: number | null;
  wide?: boolean;
};

/** The four cells, in the order the site, the admin and the phone all use. */
const cells = (readout: ConditionsReadout): CellSpec[] => [
  { label: READOUT_LABELS.sunrise, icon: Sunrise, value: readout.sunrise.short },
  { label: READOUT_LABELS.sunset, icon: Sunset, value: readout.sunset.short },
  {
    label: READOUT_LABELS.wind,
    value: readout.wind.short,
    towardDeg: readout.wind.towardDeg,
    wide: true,
  },
  { label: READOUT_LABELS.temperature, value: readout.temperature.short },
];

function Cell({
  label,
  icon: Icon,
  value,
  towardDeg = null,
  wide,
  twoRows,
  edgeLeft,
  edgeTop,
}: CellSpec & { twoRows: boolean; edgeLeft: boolean; edgeTop: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const { value: number, unit } = splitUnit(value);
  return (
    <View
      style={[
        styles.cell,
        wide && styles.wide,
        twoRows && styles.half,
        edgeLeft && styles.edgeLeft,
        edgeTop && styles.edgeTop,
      ]}
    >
      <View style={styles.labelRow}>
        {Icon ? (
          <Icon
            size={ICON_SIZE.sm}
            color={theme.colors.textSecondary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {number}
          {unit ? <Text style={styles.unit}> {unit}</Text> : null}
        </Text>
        {towardDeg !== null ? <WindArrowIcon towardDeg={towardDeg} /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  cells: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingVertical: spacing.sm,
    borderColor: theme.colors.borderSubtle,
    gap: spacing.xs / 2,
  },
  edgeLeft: { borderLeftWidth: 1 },
  edgeTop: { borderTopWidth: 1 },
  // The wind cell holds the longest readout ("NW 12 mph"): a little more room.
  wide: { flexGrow: 1.3 },
  half: { flexBasis: '50%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...textStyles.markerDetail, color: theme.colors.textSecondary },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs / 2 },
  value: { ...textStyles.readout, color: theme.colors.text },
  unit: { ...textStyles.markerDetail, color: theme.colors.textSecondary },
  updated: {
    ...textStyles.caption,
    color: theme.colors.textSecondary,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingBottom: spacing.sm,
  },
}));
