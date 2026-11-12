import { create } from 'zustand';
import {
  CHAT_BUBBLE_DURATION_MS,
  MAX_CHAT_EMOJI_LENGTH,
  MAX_CHAT_TEXT_LENGTH,
  type ActiveCommsBubble,
  type ChatKind,
  type ChatMessage,
} from './types';

const MAX_CHAT_HISTORY = 60;

interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
  isHudChatOpen: boolean;
  isInputFocused: boolean;
  bubblesByPlayerId: Record<string, ActiveCommsBubble>;

  appendMessage: (msg: ChatMessage, markUnread?: boolean) => void;
  setHudChatOpen: (open: boolean) => void;
  toggleHudChat: () => void;
  setInputFocused: (focused: boolean) => void;
  clearUnread: () => void;
  clearChat: () => void;
  pruneExpiredBubbles: (nowMs?: number) => void;
}

export function stripControlChars(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      out += raw[i];
    }
  }
  return out;
}

export function sanitizeLocalChatInput(raw: string, kind: ChatKind): string {
  const cleaned = stripControlChars(raw).trim();
  const limit = kind === 'emoji' ? MAX_CHAT_EMOJI_LENGTH : MAX_CHAT_TEXT_LENGTH;
  return cleaned.slice(0, limit);
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,
  isHudChatOpen: false,
  isInputFocused: false,
  bubblesByPlayerId: {},

  appendMessage: (msg, markUnread = true) =>
    set((state) => {
      if (state.messages.some((existing) => existing.id === msg.id)) {
        return state;
      }

      const nextMessages = [...state.messages, msg];
      if (nextMessages.length > MAX_CHAT_HISTORY) {
        nextMessages.splice(0, nextMessages.length - MAX_CHAT_HISTORY);
      }

      const nowMs = Date.now();
      const nextBubbles: Record<string, ActiveCommsBubble> = {};
      for (const [pid, bubble] of Object.entries(state.bubblesByPlayerId)) {
        if (bubble.expiresAtMs > nowMs) {
          nextBubbles[pid] = bubble;
        }
      }
      nextBubbles[msg.senderId] = {
        senderId: msg.senderId,
        kind: msg.kind,
        text: msg.text,
        senderTeam: msg.senderTeam,
        expiresAtMs: nowMs + CHAT_BUBBLE_DURATION_MS,
      };

      const shouldIncrementUnread = markUnread && !state.isHudChatOpen;
      return {
        messages: nextMessages,
        unreadCount: shouldIncrementUnread ? state.unreadCount + 1 : state.unreadCount,
        bubblesByPlayerId: nextBubbles,
      };
    }),

  setHudChatOpen: (isHudChatOpen) =>
    set((state) => ({
      isHudChatOpen,
      unreadCount: isHudChatOpen ? 0 : state.unreadCount,
      isInputFocused: isHudChatOpen ? state.isInputFocused : false,
    })),

  toggleHudChat: () =>
    set((state) => {
      const nextOpen = !state.isHudChatOpen;
      return {
        isHudChatOpen: nextOpen,
        unreadCount: nextOpen ? 0 : state.unreadCount,
        isInputFocused: nextOpen ? state.isInputFocused : false,
      };
    }),

  setInputFocused: (isInputFocused) => set({ isInputFocused }),

  clearUnread: () => set({ unreadCount: 0 }),

  clearChat: () =>
    set({
      messages: [],
      unreadCount: 0,
      isHudChatOpen: false,
      isInputFocused: false,
      bubblesByPlayerId: {},
    }),

  pruneExpiredBubbles: (nowMs = Date.now()) =>
    set((state) => {
      let changed = false;
      const nextBubbles: Record<string, ActiveCommsBubble> = {};
      for (const [pid, bubble] of Object.entries(state.bubblesByPlayerId)) {
        if (bubble.expiresAtMs > nowMs) {
          nextBubbles[pid] = bubble;
        } else {
          changed = true;
        }
      }
      return changed ? { bubblesByPlayerId: nextBubbles } : state;
    }),
}));
