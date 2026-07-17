import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { chatService } from "@/services/chatService";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/utils/haptics";
import type { ChatMessage, ChatThread } from "@/models/types";

/** "14:05" style bubble timestamp. */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The booking's chat — standard messenger layout: bubbles (yours right in
 * brand green, theirs left on surface), timestamps, an input bar pinned to
 * the keyboard, and gentle 10s polling while the screen is open.
 *
 * The chat exists for the parking's lifespan only. Once the parking ends the
 * server closes the thread (and deletes it) — the input is replaced by a
 * "chat has closed" notice.
 */
export default function Chat() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, spacing, typography, radius, shadows } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const bookingId: string = (route.params as any)?.bookingId ?? "";
  const spotTitle: string = (route.params as any)?.spotTitle ?? "Parking chat";

  const thread = useAsync<ChatThread>(
    () => chatService.getThread(bookingId),
    [bookingId]
  );
  // New messages from the other side appear without any spinner.
  useLiveRefresh(thread.refetchSilent, 10000);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const open = thread.data?.open ?? true;
  const other = thread.data?.with;

  // Inverted list wants newest first.
  const messages = useMemo(
    () => [...(thread.data?.messages ?? [])].reverse(),
    [thread.data?.messages]
  );

  const sendNow = useCallback(async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const sent = await chatService.send(bookingId, value);
      setText("");
      haptics.light();
      // Show instantly; the next poll reconciles with the server.
      thread.setData((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, sent] }
          : { open: true, with: { name: "..." }, messages: [sent] }
      );
    } catch (e: any) {
      haptics.error();
      toast.show(e?.message ?? "Couldn't send the message.", "error");
      thread.refetchSilent(); // maybe the chat just closed — reflect it
    } finally {
      setSending(false);
    }
  }, [text, sending, bookingId, thread, toast]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const mine = item.senderId === user?.id;
      return (
        <View
          style={[
            styles.bubbleRow,
            { justifyContent: mine ? "flex-end" : "flex-start" },
          ]}
        >
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: mine ? colors.primary : colors.surface,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                borderBottomLeftRadius: mine ? radius.lg : 4,
                borderBottomRightRadius: mine ? 4 : radius.lg,
                ...shadows.sm,
              },
            ]}
          >
            <Text
              style={{
                color: mine ? colors.white : colors.text,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.md,
                lineHeight: 21,
              }}
            >
              {item.text}
            </Text>
            <Text
              style={{
                marginTop: 3,
                alignSelf: "flex-end",
                color: mine ? "rgba(255,255,255,0.75)" : colors.textMuted,
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.xs - 1,
              }}
            >
              {timeLabel(item.at)}
            </Text>
          </View>
        </View>
      );
    },
    [user?.id, colors, radius, typography, shadows]
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={["top", "left", "right", "bottom"]}>
      {/* ── Header: who you're talking to ── */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Avatar uri={other?.avatar ?? undefined} name={other?.name} size={38} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontFamily: typography.fonts.bodySemi, fontSize: typography.sizes.md }}
          >
            {other?.name ?? "…"}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.textSecondary, fontFamily: typography.fonts.body, fontSize: typography.sizes.xs }}
          >
            {spotTitle}
          </Text>
        </View>
      </View>

      {/* Lifespan notice — sets the expectation that chats are temporary */}
      <View style={[styles.notice, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name="time-outline" size={13} color={colors.primary} />
        <Text
          style={{
            marginLeft: 5,
            flex: 1,
            color: colors.primaryDark ?? colors.primary,
            fontFamily: typography.fonts.bodyMedium,
            fontSize: typography.sizes.xs,
          }}
        >
          This chat lives only for this parking — it disappears once the parking ends.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages ── */}
        {thread.loading && !thread.data ? (
          <View style={[styles.flex, styles.center]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : thread.error && !thread.data ? (
          <ErrorState onRetry={thread.refetch} style={styles.flex} />
        ) : messages.length === 0 ? (
          <View style={[styles.flex, styles.center, { padding: spacing.xl }]}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.textSecondary,
                fontFamily: typography.fonts.bodyMedium,
                fontSize: typography.sizes.md,
                textAlign: "center",
              }}
            >
              {open
                ? `Say hello 👋 — sort out timings, gate codes,\nanything about the parking.`
                : "This chat has closed."}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ── Input bar / closed notice ── */}
        {open ? (
          <View
            style={[
              styles.inputBar,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.pill,
                  color: colors.text,
                  fontFamily: typography.fonts.body,
                  fontSize: typography.sizes.md,
                },
              ]}
            />
            <Pressable
              onPress={sendNow}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: text.trim() ? colors.primary : colors.surfaceAlt,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={text.trim() ? colors.white : colors.textMuted}
                />
              )}
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.closedBar,
              { backgroundColor: colors.surfaceAlt, borderTopColor: colors.border },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />
            <Text
              style={{
                marginLeft: 6,
                color: colors.textSecondary,
                fontFamily: typography.fonts.bodyMedium,
                fontSize: typography.sizes.sm,
              }}
            >
              This chat has closed — the parking has ended.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 3,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  closedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
