import { useContext, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeft, MessagesSquare, UserRound, Users } from 'lucide-react-native';

import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
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
          {!radio ? <Banner tone="info">{NO_RADIO}</Banner> : null}
        </View>

        {segment === 'direct' && peer === null ? (
          <FlatList
            contentContainerStyle={styles.list}
            data={people}
            keyExtractor={(n) => String(n)}
            ListEmptyComponent={
              <EmptyState icon={Users} title="Nobody to message yet">
                People appear once your radio hears them.
              </EmptyState>
            }
            renderItem={({ item: node }) => (
              <Button
                icon={UserRound}
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
                  variant="tertiary"
                  icon={ChevronLeft}
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
              ListEmptyComponent={
                // The list is inverted, so its empty slot is drawn upside down without this.
                <View style={styles.inverted}>
                  <EmptyState icon={MessagesSquare} title="No messages yet">
                    Texts, check-ins and shared harvests show up here. They travel over the radio,
                    no cell service needed.
                  </EmptyState>
                </View>
              }
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
                <Banner tone="warning" live>
                  {problem}
                </Banner>
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
  title: { ...textStyles.title1, color: theme.colors.text },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  inverted: { transform: [{ scaleY: -1 }] },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
}));
