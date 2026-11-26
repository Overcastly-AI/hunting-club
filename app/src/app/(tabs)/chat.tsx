import { Screen } from '../../components/Screen';
import { RadioTestPanel } from '../../radio/ui/RadioTestPanel';

export default function ChatScreen() {
  return (
    <Screen title="Chat" description="Text your party over the radio, with no cell service.">
      <RadioTestPanel />
    </Screen>
  );
}
