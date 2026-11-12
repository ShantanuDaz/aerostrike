import type { Team } from '../ctf/types';

export type ChatKind = 'text' | 'emoji';

export interface QuickEmojiOption {
  emoji: string;
  label: string;
}

export const QUICK_EMOJIS: QuickEmojiOption[] = [
  { emoji: '👍', label: 'Roger' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🚩', label: 'Flag' },
  { emoji: '🆘', label: 'Help' },
  { emoji: '💀', label: 'GG' },
];

export const MAX_CHAT_TEXT_LENGTH = 160;
export const MAX_CHAT_EMOJI_LENGTH = 16;
export const CHAT_BUBBLE_DURATION_MS = 3200;

export interface ChatMessage {
  id: string;
  senderId: string;
  senderCallsign: string;
  senderTeam: Team;
  kind: ChatKind;
  text: string;
  createdAtMs: number;
}

export interface ChatWirePayload {
  id: string;
  kind: ChatKind;
  text: string;
  senderId?: string;
  senderCallsign?: string;
  senderTeam?: Team;
  createdAtMs?: number;
}

export interface VoiceStatePayload {
  playerId: string;
  peerId: string;
  micEnabled: boolean;
}

export interface ActiveCommsBubble {
  senderId: string;
  kind: ChatKind;
  text: string;
  senderTeam: Team;
  expiresAtMs: number;
}
