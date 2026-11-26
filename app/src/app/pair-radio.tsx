import { router } from 'expo-router';

import { PairRadioScreen } from '../radio/ui/PairRadioScreen';

export default function PairRadioRoute() {
  return (
    <PairRadioScreen onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
  );
}
