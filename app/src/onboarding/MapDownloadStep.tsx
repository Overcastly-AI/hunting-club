import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { DownloadAreaSheet } from '../map/components/DownloadAreaSheet';
import { boundsAroundPoint, MILE_M } from '../map/geo';
import type { DownloadRequest } from '../map/offline';
import type { Bounds } from '../map/tiles';
import { ensureLocationPermission } from '../permissions/location';
import { radioCopy } from '../radio/copy';
import { makeStyles, textStyles } from '../theme';
import { onboardingCopy } from './copy';

/** How far around the hunter the onboarding download reaches (a 4-mile square). */
export const ONBOARDING_MAP_RADIUS_M = 2 * MILE_M;

type Props = {
  onNext: () => void;
  /** Starts an offline download (useMapPacks().start in the app). */
  onDownload: (request: DownloadRequest) => Promise<void>;
};

type Status = 'idle' | 'finding' | 'noLocation' | 'downloading';

/**
 * Onboarding step (spec: Screens → 5. Onboarding, "Download the map for your
 * area"): finds the hunter, then offers the usual download sheet for the area
 * around them. The download keeps going after onboarding.
 */
export function MapDownloadStep({ onNext, onDownload }: Props) {
  const styles = useStyles();
  const copy = onboardingCopy.map;
  const [status, setStatus] = useState<Status>('idle');
  const [bounds, setBounds] = useState<Bounds | null>(null);

  const findArea = async () => {
    setStatus('finding');
    const here = await ensureLocationPermission();
    if (!here) {
      setStatus('noLocation');
      return;
    }
    setStatus('idle');
    setBounds(boundsAroundPoint(here, ONBOARDING_MAP_RADIUS_M));
  };

  const download = async (request: DownloadRequest) => {
    await onDownload(request);
    setStatus('downloading');
  };

  return (
    <Screen title={copy.title} description={copy.body}>
      {status === 'downloading' ? (
        <>
          <Text style={styles.body}>{copy.downloading}</Text>
          <Button variant="primary" label={copy.continue} onPress={onNext} />
        </>
      ) : (
        <>
          {status === 'noLocation' ? <Text style={styles.body}>{copy.noLocation}</Text> : null}
          <Button
            variant="primary"
            label={status === 'finding' ? copy.finding : copy.findArea}
            disabled={status === 'finding'}
            onPress={() => void findArea()}
          />
          <Button label={radioCopy.pair.setUpLater} onPress={onNext} />
        </>
      )}
      <DownloadAreaSheet
        visible={bounds !== null}
        bounds={bounds}
        intro={copy.sheetIntro}
        onStart={download}
        onClose={() => setBounds(null)}
      />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.bodyLarge, color: theme.colors.textSecondary },
}));
