import { isLegalDocId, LEGAL_DOCS } from '@huntclub/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { LegalScreen } from '../../about/LegalScreen';

export default function LegalRoute() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isLegalDocId(doc)) return <Redirect href="/" />;
  return (
    <LegalScreen
      doc={LEGAL_DOCS[doc]}
      onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
