import type { AvatarConfig } from '../avatar/types';
import type { Team, MatchStatus, Flag, MatchRulesConfig } from '../ctf/types';
import type { WeaponType } from '../combat/types';
import type { RefillStationType } from '../map/types';

export interface PlayerSnapshot {
  id: string;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  health: number;
  isInvulnerable?: boolean;
  isBoosting: boolean;
  isDead: boolean;
  avatar: AvatarConfig;
  carryingFlag: boolean;
  isGrounded?: boolean;
  weaponType?: WeaponType;
}

export interface ShootEvent {
  shooterId: string;
  team: Team;
  weaponType: WeaponType;
  originX: number;
  originY: number;
  aimAngle: number;
  spreadOffsets?: number[];
  speedScale?: number;
}

export interface DamageEvent {
  targetId: string;
  dealerId: string;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  weaponType?: WeaponType;
  sourceX?: number;
  sourceY?: number;
}

export interface KillFeedEvent {
  id: string;
  killerId: string;
  killerCallsign: string;
  killerTeam: Team;
  victimId: string;
  victimCallsign: string;
  victimTeam: Team;
  weaponType: WeaponType | 'hazard' | 'self';
}

export interface FlagSyncEvent {
  action: 'pickup' | 'drop' | 'return' | 'capture';
  team: Team;
  carrierId?: string;
  x?: number;
  y?: number;
}

export interface MatchSyncStatePayload {
  seq: number;
  score: { blue: number; red: number };
  targetCaptures: number;
  matchRules?: MatchRulesConfig;
  timeRemainingSec?: number;
  isOvertime?: boolean;
  matchStatus: MatchStatus;
  winner: Team | null;
  bannerMessage: string | null;
  flags: Record<Team, Flag>;
  lastScorer?: {
    playerId: string;
    callsign: string;
    team: Team;
    captureSeq: number;
  } | null;
}

export interface PickupSyncEvent {
  action: 'claim' | 'taken';
  pickupId: string;
  playerId: string;
  weaponType: WeaponType;
}

export interface StationSyncEvent {
  action: 'claim' | 'taken';
  stationId: string;
  playerId: string;
  stationType: RefillStationType;
}

export interface MatchSyncEvent {
  scoreBlue: number;
  scoreRed: number;
  status: MatchStatus;
}

export interface PeerInfo {
  peerId: string;
  callsign: string;
  team: Team;
  avatar?: AvatarConfig;
  isReady: boolean;
  isHost?: boolean;
  lastSeen: number;
}

export interface RosterMember {
  playerId: string;
  peerId: string;
  slot?: number;
  callsign: string;
  team: Team;
  avatar: AvatarConfig;
  isReady: boolean;
  isHost: boolean;
  isOnline: boolean;
}

export interface AuthJoinRequest {
  type: 'join_request';
  playerId: string;
  callsign: string;
  team: Team;
  avatar: AvatarConfig;
}

export interface AuthJoinResponse {
  type: 'join_response';
  accepted: boolean;
  reason?: string;
  gamePhase?: 'staging' | 'in_game';
  mapId?: string;
  matchRules?: MatchRulesConfig;
  team?: Team;
  roster?: RosterMember[];
  hostPeerId?: string;
  matchState?: MatchSyncStatePayload;
  pickupCooldowns?: { id: string; remainingSec: number }[];
  stationCooldowns?: { id: string; remainingSec: number }[];
}

export interface HostBeaconEvent {
  type: 'host_beacon';
  hostPeerId: string;
  gamePhase: 'staging' | 'in_game';
  mapId: string;
  matchRules?: MatchRulesConfig;
  timeRemainingSec?: number;
  isOvertime?: boolean;
  totalPlayers: number;
  roster?: RosterMember[];
}
