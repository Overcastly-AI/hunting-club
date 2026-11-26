import { useContext, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { makeStyles, spacing, textStyles } from '../theme';
import { ChatRadioContext, ChatSendError, nameOf, sendChat } from './ChatRadio';
import { chatStore, useChatItems } from './chatStore';
import { Composer, MessageBubble, QuickReplies, SystemCard } from './components';
import {
  SEGMENT_LABELS,
  chatSegments,
  conversationItems,
  directConversation,
  directPeers,
  groupConversation,
  type ChatSegment,
  type ConversationKey,
} from './model';

const NO_RADIO =
  'Connect your radio to chat. Messages travel over the radio, no cell service needed.';

/** Chat tab: Party (or Whole Club / Hunting Party) and Direct. */
export function ChatScreen() {
  const styles = useStyles();
  const radio = useContext(ChatRadioContext);
  const items = useChatItems();
  const segments = chatSegments(radio?.audience === 'club');
  const [segment, setSegment] = useState<ChatSegment>(segments[0]!);
  const [peer, setPeer] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const conversation: ConversationKey | null =
    segment === 'direct'
      ? peer === null
        ? null
        : directConversation(peer)
      : groupConversation(segment);
  const shown = useMemo(
    () => (conversation ? conversationItems(items, conversation).reverse() : []),
    [items, conversation],
  );

  const send = (text: string) => {
    if (!radio || !conversation) return;
    try {
      sendChat(radio, chatStore, conversation, text);
      setProblem(null);
      if (text === draft) setDraft('');
    } catch (error) {
      setProblem(
        error instanceof ChatSendError
          ? error.message
          : 'Your radio didn’t take the message. Try again.',
      );
    }
  };

  const people = radio
    ? [
        ...new Set([
          ...directPeers(items).map((p) => p.node),
          ...[...radio.client.nodes.keys()].filter((n) => n !== radio.client.myNodeNum),
        ]),
      ]
    : directPeers(items).map((p) => p.node);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Chat
          </Text>
          <SegmentedControl
            segments={segments}
            labels={SEGMENT_LABELS}
            selected={segment}
            onSelect={(s) => {
              setSegment(s);
              setPeer(null);
            }}
          />
          {!radio ? <Text style={styles.note}>{NO_RADIO}</Text> : null}
        </View>

        {segment === 'direct' && peer === null ? (
          <FlatList
            contentContainerStyle={styles.list}
            data={people}
            keyExtractor={(n) => String(n)}
            ListEmptyComponent={
              <Text style={styles.note}>
                Nobody to message yet. People appear once your radio hears them.
              </Text>
            }
            renderItem={({ item: node }) => (
              <Button
                label={radio ? nameOf(radio, node) : `!${node.toString(16)}`}
                onPress={() => setPeer(node)}
              />
            )}
          />
        ) : (
          <>
            {segment === 'direct' && peer !== null ? (
              <View style={styles.header}>
                <Button
                  label={`Back to people · ${radio ? nameOf(radio, peer) : ''}`}
                  onPress={() => setPeer(null)}
                />
              </View>
            ) : null}
            <FlatList
              inverted
              style={styles.flex}
              contentContainerStyle={styles.list}
              data={shown}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) =>
                item.kind === 'text' ? <MessageBubble item={item} /> : <SystemCard item={item} />
              }
            />
            <View style={styles.footer}>
              <QuickReplies onSend={send} disabled={!radio} />
              <Composer
                value={draft}
                onChange={setDraft}
                onSend={() => send(draft)}
                disabled={!radio}
              />
              {problem ? (
                <Text accessibilityLiveRegion="polite" style={[styles.note, styles.problem]}>
                  {problem}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.surface0 },
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  title: { ...textStyles.sheetTitle, color: theme.colors.text },
  list: { padding: spacing.md, gap: spacing.sm },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  note: { ...textStyles.body, color: theme.colors.textSecondary },
  problem: { color: theme.colors.warning },
}));
