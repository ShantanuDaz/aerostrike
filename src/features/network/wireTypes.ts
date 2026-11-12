import { util } from 'peerjs';
import type {
  AuthJoinRequest,
  AuthJoinResponse,
  DamageEvent,
  FlagSyncEvent,
  HostBeaconEvent,
  KillFeedEvent,
  MatchSyncStatePayload,
  PeerInfo,
  PickupSyncEvent,
  RosterMember,
  ShootEvent,
  StationSyncEvent,
} from './types';
import type { MatchRulesConfig, Team } from '../ctf/types';
import type { HostBatchSourceEntry, QuantizedPlayerState } from './fastProtocol';
import type { ChatWirePayload, VoiceStatePayload } from '../comms/types';

export const HOST_PEER_PREFIX = 'aerostrikeomegav2';

export const FAST_TICK_MS = 33; // ~30 Hz network update cadence
export const KEYFRAME_INTERVAL_TICKS = 15; // Full dirty+clean keyframe ~every 500ms
export const IDLE_HEARTBEAT_MS = 420; // ~2.4 Hz keepalive when completely stationary
export const URGENT_MIN_GAP_MS = 14;
export const FAST_BUFFER_HIGH_WATER = 65536;
export const CADET_HOST_SILENCE_MS = 10000;

export const DAMAGE_RATE_WINDOW_MS = 1000;
export const MAX_DAMAGE_PACKETS_PER_SEC = 25;
export const MAX_DAMAGE_PER_TARGET_PAIR_SEC = 220;

export const CHAT_RATE_WINDOW_MS = 4000;
export const MAX_CHAT_MESSAGES_PER_WINDOW = 6;

export const FLAG_INTERACT_RADIUS_PX = 160;
export const PICKUP_INTERACT_RADIUS_PX = 160;
export const STATION_INTERACT_RADIUS_PX = 160;

export function toHostPeerId(roomCode: string): string {
  const alphanumeric = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${HOST_PEER_PREFIX}${alphanumeric}`;
}

export function buildIceServers(): RTCIceServer[] {
  const base = Array.isArray(util.defaultConfig?.iceServers)
    ? util.defaultConfig.iceServers
    : [{ urls: 'stun:stun.l.google.com:19302' }];

  return [
    ...base,
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
}

export type MatchControlPayload = {
  type: 'start_match' | 'return_to_staging' | 'leave_battle' | 'rematch';
  launchId?: string;
  mapId?: string;
  matchRules?: MatchRulesConfig;
  hostPeerId?: string;
  playerId?: string;
  roster?: RosterMember[];
};

export interface AuthRejoinStateResponse {
  type: 'rejoin_state';
  mapId?: string;
  matchRules?: MatchRulesConfig;
  team?: Team;
  roster?: RosterMember[];
  hostPeerId?: string;
  matchState?: MatchSyncStatePayload;
  pickupCooldowns?: { id: string; remainingSec: number }[];
  stationCooldowns?: { id: string; remainingSec: number }[];
}

export type RoomAuthPayload =
  | AuthJoinRequest
  | AuthJoinResponse
  | AuthRejoinStateResponse
  | { type: 'rejoin_sync' }
  | { type: 'roster_sync'; roster: RosterMember[] }
  | HostBeaconEvent;

export type CompactFallbackBatchPayload = {
  tickSeq: number;
  entries: {
    slot: number;
    seq: number;
    q: QuantizedPlayerState;
  }[];
};

export type CompactFallbackClientPayload = {
  seq: number;
  q: QuantizedPlayerState;
};

export type WireMessage =
  | { kind: 'fast_client_fb'; senderId: string; payload: CompactFallbackClientPayload }
  | { kind: 'fast_batch_fb'; senderId: string; payload: CompactFallbackBatchPayload }
  | { kind: 'shoot'; senderId: string; payload: ShootEvent }
  | { kind: 'damage'; senderId: string; payload: DamageEvent }
  | { kind: 'kill_feed'; senderId: string; payload: KillFeedEvent }
  | { kind: 'flag'; senderId: string; payload: FlagSyncEvent }
  | { kind: 'match_state'; senderId: string; payload: MatchSyncStatePayload }
  | { kind: 'pickup_sync'; senderId: string; payload: PickupSyncEvent }
  | { kind: 'station_sync'; senderId: string; payload: StationSyncEvent }
  | { kind: 'peer_meta'; senderId: string; payload: Partial<PeerInfo> }
  | { kind: 'match_control'; senderId: string; payload: MatchControlPayload }
  | { kind: 'room_auth'; senderId: string; payload: RoomAuthPayload }
  | { kind: 'chat'; senderId: string; payload: ChatWirePayload }
  | { kind: 'voice_state'; senderId: string; payload: VoiceStatePayload };

export interface HostSlotState extends HostBatchSourceEntry {
  playerId: string;
  lastUpdatedMs: number;
}

export interface AuthoritativeActorPosition {
  x: number;
  y: number;
  isDead: boolean;
}
