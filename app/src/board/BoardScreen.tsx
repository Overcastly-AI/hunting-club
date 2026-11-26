import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clubFeaturesOpen, useClubEntitlement } from '../club/entitlement';
import { PlaceholderScreen } from '../components/PlaceholderScreen';
import { formatClockTime } from '../conditions/clock';
import { useNow } from '../hooks/useNow';
import { sunLine, sunSentence } from '../map/components/ConditionsPanel';
import { nodePosition } from '../map/meshMapData';
import { SafetyLayer } from '../safety/SafetyLayer';
import { colors, spacing, textStyles } from '../theme';
import { useBoardRadio, type BoardRadio } from './BoardRadio';
import { boardLinkStatus, buildBoard } from './boardModel';
import { BoardMap } from './components/BoardMap';
import { LinkBanner } from './components/LinkBanner';
import { OpenStandsList } from './components/OpenStandsList';
import { OutList } from './components/OutList';

/** Clock and ages on the board refresh every 15 s. */
const BOARD_TICK_MS = 15_000;

/** Re-renders whenever the board radio hears a check-in change, a position or a link change. */
function useBoardRadioUpdates(radio: BoardRadio | null): void {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!radio) return;
    const bump = () => setVersion((v) => v + 1);
    const offs = [
      radio.board.on('change', bump),
      radio.client.on('state', bump),
      radio.client.on('nodeinfo', bump),
      radio.client.on('position', bump),
    ];
    return () => offs.forEach((off) => off());
  }, [radio]);
}

/**
 * Clubhouse board (club only): a landscape wall tablet with the map on one
 * side and everyone out on the other. Overdue hunters are highlighted, and the
 * full-screen alert comes from the same SafetyLayer as the phone app. The
 * screen stays awake. Safety alerts show even when the club's subscription
 * has lapsed; only the board itself freezes.
 */
export function BoardScreen() {
  useKeepAwake();
  const radio = useBoardRadio();
  const entitlement = useClubEntitlement();
  const now = useNow(BOARD_TICK_MS);
  useBoardRadioUpdates(radio);

  if (!clubFeaturesOpen(entitlement, now)) {
    return (
      <>
        <PlaceholderScreen
          title="Clubhouse board"
          description="The clubhouse board is part of a club subscription. Ask your club admin to sign this tablet in to the club. Ask for a Hand and overdue alerts still show here."
        />
        <SafetyLayer canReply={false} onShowOnMap={() => undefined} />
      </>
    );
  }

  const input = radio
    ? {
        myNodeNum: radio.client.myNodeNum,
        nodes: radio.client.nodes,
        checkIns: radio.board.all,
        stands: radio.stands,
        graceMinutes: radio.graceMinutes,
        ...(radio.names ? { names: radio.names } : {}),
      }
    : null;
  const board = input ? buildBoard(input, now) : { out: [], openStands: [] };
  const link = boardLinkStatus(radio ? radio.client.state : null, input ?? EMPTY, now);
  const self = radio?.client.nodes.get(radio.client.myNodeNum);
  const clubhouse = self ? nodePosition(self) : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.mapPane}>
        <BoardMap radio={radio} now={now} />
      </View>
      <SafeAreaView style={styles.listPane} edges={['top', 'right', 'bottom']}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {entitlement!.clubName}
          </Text>
          <Text style={styles.title}>{formatClockTime(new Date(now))}</Text>
        </View>
        <Text style={styles.sun}>{sunSentence(sunLine(clubhouse ?? null, now))}</Text>
        <LinkBanner {...link} />
        <ScrollView contentContainerStyle={styles.lists}>
          <OutList entries={board.out} />
          <OpenStandsList stands={board.openStands} />
        </ScrollView>
      </SafeAreaView>
      <SafetyLayer canReply={false} onShowOnMap={() => undefined} />
    </View>
  );
}

const EMPTY = { myNodeNum: 0, nodes: new Map() };

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface },
  mapPane: { flex: 1 },
  listPane: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  title: { ...textStyles.boardTitle, color: colors.text, flexShrink: 1 },
  sun: { ...textStyles.boardDetail, color: colors.text },
  lists: { gap: spacing.xl, paddingBottom: spacing.xl },
});
