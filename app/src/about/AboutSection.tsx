import { LEGAL_DOCS, type LegalDocId } from '@huntclub/shared';
import { router } from 'expo-router';
import { ScrollText } from 'lucide-react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { legalRoute } from './routes';

const DOCS = Object.keys(LEGAL_DOCS) as LegalDocId[];

/** Settings → About: Privacy and Terms, readable offline. */
export function AboutSection() {
  return (
    <Card title="About">
      {DOCS.map((id) => (
        <Button
          key={id}
          icon={ScrollText}
          label={LEGAL_DOCS[id].title}
          onPress={() => router.push(legalRoute(id))}
        />
      ))}
    </Card>
  );
}
