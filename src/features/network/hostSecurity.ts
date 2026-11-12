import type { AvatarConfig, HeadgearType, JetpackStyle, VisorStyle } from '../avatar/types';
import { WEAPONS } from '../combat/weaponsConfig';
import type { Flag, GameMode, MatchStatus, Team } from '../ctf/types';
import type {
  DamageEvent,
  FlagSyncEvent,
  KillFeedEvent,
  PeerInfo,
  RosterMember,
  ShootEvent,
} from './types';
import {
  CHAT_RATE_WINDOW_MS,
  DAMAGE_RATE_WINDOW_MS,
  FLAG_INTERACT_RADIUS_PX,
  MAX_CHAT_MESSAGES_PER_WINDOW,
  MAX_DAMAGE_PACKETS_PER_SEC,
  MAX_DAMAGE_PER_TARGET_PAIR_SEC,
  type AuthoritativeActorPosition,
} from './wireTypes';
import {
  MAX_CHAT_EMOJI_LENGTH,
  MAX_CHAT_TEXT_LENGTH,
  type ChatMessage,
  type ChatWirePayload,
  type VoiceStatePayload,
} from '../comms/types';
import { stripControlChars } from '../comms/chatStore';

export class DamageRateTracker {
  private dealerBudget = new Map<string, { windowStartMs: number; packetCount: number }>();
  private pairBudget = new Map<string, { windowStartMs: number; damageSum: number }>();

  public clear() {
    this.dealerBudget.clear();
    this.pairBudget.clear();
  }

  public checkAndRecord(
    dealerId: string,
    targetId: string,
    damage: number,
    nowMs: number = performance.now(),
  ): boolean {
    const dealerWindow = this.dealerBudget.get(dealerId);
    if (!dealerWindow || nowMs - dealerWindow.windowStartMs >= DAMAGE_RATE_WINDOW_MS) {
      this.dealerBudget.set(dealerId, {
        windowStartMs: nowMs,
        packetCount: 1,
      });
    } else {
      if (dealerWindow.packetCount + 1 > MAX_DAMAGE_PACKETS_PER_SEC) {
        console.warn(`[Host Security] Rate-limited damage flood from ${dealerId}`);
        return false;
      }
      dealerWindow.packetCount += 1;
    }

    const pairKey = `${dealerId}->${targetId}`;
    const pairWindow = this.pairBudget.get(pairKey);
    if (!pairWindow || nowMs - pairWindow.windowStartMs >= DAMAGE_RATE_WINDOW_MS) {
      this.pairBudget.set(pairKey, {
        windowStartMs: nowMs,
        damageSum: damage,
      });
    } else {
      if (pairWindow.damageSum + damage > MAX_DAMAGE_PER_TARGET_PAIR_SEC) {
        console.warn(
          `[Host Security] Throttled excessive DPS (${pairWindow.damageSum + damage} HP/s) for ${pairKey}`,
        );
        return false;
      }
      pairWindow.damageSum += damage;
    }

    return true;
  }
}

export interface DamageValidationContext {
  payload: unknown;
  senderPeerId: string;
  senderMember?: RosterMember;
  targetMember?: RosterMember;
  hostPlayerId: string;
  hostPeerId: string | null;
  localPlayer: { id: string; isDead: boolean; invulnerableTimer: number };
  remoteTarget?: { isDead: boolean; isInvulnerable: boolean };
  isInActiveBattle: boolean;
  gamePhase: 'staging' | 'in_game';
  mode?: GameMode;
  rateTracker: DamageRateTracker;
  nowMs?: number;
}

export function validateIncomingDamage(ctx: DamageValidationContext): boolean {
  const {
    payload,
    senderPeerId,
    senderMember,
    targetMember,
    hostPlayerId,
    hostPeerId,
    localPlayer,
    remoteTarget,
    isInActiveBattle,
    gamePhase,
    mode = 'ctf',
    rateTracker,
    nowMs = performance.now(),
  } = ctx;

  if (!isInActiveBattle || gamePhase !== 'in_game') {
    return false;
  }
  if (!payload || typeof payload !== 'object') return false;

  const evt = payload as DamageEvent;
  if (typeof evt.targetId !== 'string' || !evt.targetId) return false;
  if (typeof evt.dealerId !== 'string' || !evt.dealerId) return false;
  if (!Number.isFinite(evt.damage) || evt.damage <= 0) return false;
  if (
    !Number.isFinite(evt.knockbackX) ||
    !Number.isFinite(evt.knockbackY) ||
    Math.hypot(evt.knockbackX, evt.knockbackY) > 30
  ) {
    return false;
  }

  if (
    (evt.sourceX !== undefined && !Number.isFinite(evt.sourceX)) ||
    (evt.sourceY !== undefined && !Number.isFinite(evt.sourceY))
  ) {
    return false;
  }

  if (
    senderMember &&
    evt.dealerId !== senderMember.playerId &&
    evt.dealerId !== senderPeerId
  ) {
    console.warn(
      `[Host Security] Dropped spoofed damage dealerId="${evt.dealerId}" from peer="${senderPeerId}"`,
    );
    return false;
  }
  const canonicalDealerId = senderMember?.playerId || evt.dealerId;

  if (typeof evt.weaponType !== 'string' || !WEAPONS[evt.weaponType]) {
    console.warn(
      `[Host Security] Dropped damage with missing/unknown weaponType="${String(evt.weaponType)}"`,
    );
    return false;
  }

  const weaponCfg = WEAPONS[evt.weaponType];
  const maxSingleHit =
    evt.weaponType === 'rocket' || evt.weaponType === 'grenade'
      ? Math.round(weaponCfg.damage) + 2
      : Math.round(weaponCfg.damage * 1.3) + 2;

  if (evt.damage > maxSingleHit) {
    console.warn(
      `[Host Security] Dropped excessive damage=${evt.damage} (cap=${maxSingleHit}) from ${canonicalDealerId}`,
    );
    return false;
  }

  const canonicalTargetId = targetMember?.playerId || evt.targetId;
  if (
    mode !== 'ffa' &&
    senderMember &&
    targetMember &&
    canonicalDealerId !== canonicalTargetId &&
    senderMember.team === targetMember.team
  ) {
    console.warn(
      `[Host Security] Dropped friendly-fire damage ${canonicalDealerId} -> ${canonicalTargetId}`,
    );
    return false;
  }

  const targetIsHost =
    evt.targetId === hostPlayerId ||
    evt.targetId === hostPeerId ||
    evt.targetId === localPlayer.id ||
    canonicalTargetId === hostPlayerId;

  if (targetIsHost) {
    if (localPlayer.isDead || localPlayer.invulnerableTimer > 0) {
      return false;
    }
  } else if (remoteTarget && (remoteTarget.isDead || remoteTarget.isInvulnerable)) {
    return false;
  }

  return rateTracker.checkAndRecord(canonicalDealerId, canonicalTargetId, evt.damage, nowMs);
}

export function validateIncomingShoot(
  payload: unknown,
  senderPeerId: string,
  senderMember: RosterMember | undefined,
  isInActiveBattle: boolean,
  gamePhase: 'staging' | 'in_game',
): ShootEvent | null {
  if (!isInActiveBattle || gamePhase !== 'in_game') return null;
  if (!payload || typeof payload !== 'object') return null;
  const evt = payload as ShootEvent;

  if (typeof evt.shooterId !== 'string' || !evt.shooterId) return null;
  if (!Number.isFinite(evt.originX) || !Number.isFinite(evt.originY) || !Number.isFinite(evt.aimAngle)) {
    return null;
  }
  const weaponCfg = WEAPONS[evt.weaponType];
  if (!weaponCfg) return null;

  if (
    senderMember &&
    evt.shooterId !== senderMember.playerId &&
    evt.shooterId !== senderPeerId
  ) {
    console.warn(
      `[Host Security] Dropped spoofed shoot shooterId="${evt.shooterId}" from peer="${senderPeerId}"`,
    );
    return null;
  }

  if (evt.spreadOffsets !== undefined) {
    if (
      !Array.isArray(evt.spreadOffsets) ||
      evt.spreadOffsets.length > weaponCfg.pellets ||
      evt.spreadOffsets.some((o) => !Number.isFinite(o) || Math.abs(o) > 1.0)
    ) {
      return null;
    }
  }

  if (evt.speedScale !== undefined) {
    if (!Number.isFinite(evt.speedScale) || evt.speedScale < 0.5 || evt.speedScale > 1.5) {
      return null;
    }
  }

  return {
    ...evt,
    shooterId: senderMember?.playerId || evt.shooterId,
    team: senderMember?.team || (evt.team === 'red' ? 'red' : 'blue'),
  };
}

export function validateIncomingKillFeed(
  payload: unknown,
  senderPeerId: string,
  senderMember: RosterMember | undefined,
  isInActiveBattle: boolean,
  gamePhase: 'staging' | 'in_game',
  mode: GameMode = 'ctf',
): KillFeedEvent | null {
  if (!isInActiveBattle || gamePhase !== 'in_game') return null;
  if (!payload || typeof payload !== 'object') return null;
  const evt = payload as KillFeedEvent;

  if (
    typeof evt.id !== 'string' ||
    !evt.id ||
    typeof evt.killerId !== 'string' ||
    !evt.killerId ||
    typeof evt.victimId !== 'string' ||
    !evt.victimId ||
    typeof evt.killerCallsign !== 'string' ||
    typeof evt.victimCallsign !== 'string'
  ) {
    return null;
  }
  if (evt.killerTeam !== 'blue' && evt.killerTeam !== 'red') return null;
  if (evt.victimTeam !== 'blue' && evt.victimTeam !== 'red') return null;

  const validWeapon =
    evt.weaponType === 'hazard' || evt.weaponType === 'self' || Boolean(WEAPONS[evt.weaponType]);
  if (!validWeapon) return null;

  if (
    mode !== 'ffa' &&
    evt.killerId !== evt.victimId &&
    evt.weaponType !== 'hazard' &&
    evt.weaponType !== 'self' &&
    evt.killerTeam === evt.victimTeam
  ) {
    console.warn(`[Host Security] Dropped same-team kill_feed claim in mode="${mode}"`);
    return null;
  }

  if (senderMember) {
    const senderMatchesVictim =
      evt.victimId === senderMember.playerId || evt.victimId === senderPeerId;
    const senderMatchesKiller =
      evt.killerId === senderMember.playerId || evt.killerId === senderPeerId;
    if (!senderMatchesVictim && !senderMatchesKiller) {
      console.warn(
        `[Host Security] Dropped uninvolved kill_feed claim from "${senderMember.playerId}"`,
      );
      return null;
    }
  }

  return evt;
}

const VALID_HEADGEAR_TYPES: HeadgearType[] = [
  'none',
  'soldier_helmet',
  'beret',
  'headband',
  'gas_mask',
  'robo_visor',
  'horns',
];
const VALID_VISOR_STYLES: VisorStyle[] = ['classic', 'cyborg', 'sunglasses', 'goggles', 'neon'];
const VALID_JETPACK_STYLES: JetpackStyle[] = ['dual_tank', 'single_heavy', 'falcon_wings'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export function sanitizeIncomingAvatar(raw: unknown): AvatarConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<AvatarConfig>;
  if (typeof candidate.callsign !== 'string') return undefined;
  const callsign = candidate.callsign.trim().slice(0, 20);
  if (!callsign) return undefined;
  if (
    typeof candidate.bodyColor !== 'string' ||
    !HEX_COLOR_RE.test(candidate.bodyColor) ||
    typeof candidate.skinTone !== 'string' ||
    !HEX_COLOR_RE.test(candidate.skinTone) ||
    typeof candidate.headgearColor !== 'string' ||
    !HEX_COLOR_RE.test(candidate.headgearColor) ||
    typeof candidate.visorColor !== 'string' ||
    !HEX_COLOR_RE.test(candidate.visorColor)
  ) {
    return undefined;
  }
  if (
    !VALID_HEADGEAR_TYPES.includes(candidate.headgear as HeadgearType) ||
    !VALID_VISOR_STYLES.includes(candidate.visorStyle as VisorStyle) ||
    !VALID_JETPACK_STYLES.includes(candidate.jetpackStyle as JetpackStyle)
  ) {
    return undefined;
  }

  return {
    callsign,
    bodyColor: candidate.bodyColor,
    skinTone: candidate.skinTone,
    headgear: candidate.headgear as HeadgearType,
    headgearColor: candidate.headgearColor,
    visorStyle: candidate.visorStyle as VisorStyle,
    visorColor: candidate.visorColor,
    jetpackStyle: candidate.jetpackStyle as JetpackStyle,
  };
}

export function sanitizeIncomingPeerMeta(
  payload: unknown,
  isHostRole: boolean,
): Partial<PeerInfo> {
  if (!payload || typeof payload !== 'object') return {};
  const raw = payload as Partial<PeerInfo>;
  const cleaned: Partial<PeerInfo> = {};

  if (typeof raw.callsign === 'string') {
    const trimmed = raw.callsign.trim().slice(0, 20);
    if (trimmed.length > 0) {
      cleaned.callsign = trimmed;
    }
  }
  if (raw.team === 'blue' || raw.team === 'red') {
    cleaned.team = raw.team;
  }
  if (raw.avatar !== undefined) {
    const cleanAvatar = sanitizeIncomingAvatar(raw.avatar);
    if (cleanAvatar) {
      cleaned.avatar = cleanAvatar;
    }
  }
  if (typeof raw.isReady === 'boolean') {
    cleaned.isReady = raw.isReady;
  }
  // Cadets may NEVER claim Host privilege over the wire
  if (!isHostRole && typeof raw.isHost === 'boolean') {
    cleaned.isHost = raw.isHost;
  }

  return cleaned;
}

export function isWithinInteractRadius(
  actorPos: AuthoritativeActorPosition | undefined,
  targetX: number,
  targetY: number,
  radiusPx: number,
): boolean {
  if (!actorPos) return true;
  if (actorPos.isDead) return false;
  return Math.hypot(actorPos.x - targetX, actorPos.y - targetY) <= radiusPx;
}

export interface ValidatedFlagCommand {
  action: FlagSyncEvent['action'];
  team: Team;
  actorId: string;
  actorCallsign: string;
  x?: number;
  y?: number;
}

export function validateFlagEvent(
  flagEvt: unknown,
  actorMember: RosterMember | undefined,
  actorPos: AuthoritativeActorPosition | undefined,
  flags: Record<Team, Flag>,
  isInActiveBattle: boolean,
  matchStatus: MatchStatus,
  mode: GameMode = 'ctf',
): ValidatedFlagCommand | null {
  if (mode !== 'ctf') return null;
  if (!isInActiveBattle || matchStatus !== 'playing') return null;
  if (!actorMember) return null;
  if (!flagEvt || typeof flagEvt !== 'object') return null;
  const evt = flagEvt as FlagSyncEvent;
  if (evt.team !== 'blue' && evt.team !== 'red') return null;

  const actorId = actorMember.playerId;
  const actorTeam = actorMember.team;
  const enemyTeam: Team = actorTeam === 'blue' ? 'red' : 'blue';

  switch (evt.action) {
    case 'pickup': {
      if (evt.team !== enemyTeam) return null;
      const targetFlag = flags[enemyTeam];
      if (targetFlag.status === 'carried') return null;
      if (!isWithinInteractRadius(actorPos, targetFlag.x, targetFlag.y, FLAG_INTERACT_RADIUS_PX)) {
        return null;
      }
      return {
        action: 'pickup',
        team: enemyTeam,
        actorId,
        actorCallsign: actorMember.callsign,
      };
    }

    case 'return': {
      if (evt.team !== actorTeam) return null;
      const ownFlag = flags[actorTeam];
      if (ownFlag.status !== 'dropped') return null;
      if (!isWithinInteractRadius(actorPos, ownFlag.x, ownFlag.y, FLAG_INTERACT_RADIUS_PX)) {
        return null;
      }
      return {
        action: 'return',
        team: actorTeam,
        actorId,
        actorCallsign: actorMember.callsign,
      };
    }

    case 'drop': {
      if (evt.team !== enemyTeam) return null;
      if (typeof evt.x !== 'number' || typeof evt.y !== 'number' || !Number.isFinite(evt.x) || !Number.isFinite(evt.y)) {
        return null;
      }
      const targetFlag = flags[enemyTeam];
      if (targetFlag.status !== 'carried' || targetFlag.carrierId !== actorId) {
        return null;
      }
      return {
        action: 'drop',
        team: enemyTeam,
        actorId,
        actorCallsign: actorMember.callsign,
        x: evt.x,
        y: evt.y,
      };
    }

    case 'capture': {
      if (evt.team !== actorTeam) return null;
      const ownFlag = flags[actorTeam];
      const targetFlag = flags[enemyTeam];
      // Allow capture at home base regardless of own flag status (at_base / carried / dropped)
      if (
        targetFlag.status !== 'carried' ||
        targetFlag.carrierId !== actorId
      ) {
        return null;
      }
      if (!isWithinInteractRadius(actorPos, ownFlag.baseX, ownFlag.baseY, FLAG_INTERACT_RADIUS_PX)) {
        return null;
      }
      return {
        action: 'capture',
        team: actorTeam,
        actorId,
        actorCallsign: actorMember.callsign,
      };
    }

    default:
      return null;
  }
}

export class ChatRateTracker {
  private senderBudget = new Map<string, { windowStartMs: number; count: number }>();

  public clear() {
    this.senderBudget.clear();
  }

  public checkAndRecord(senderKey: string, nowMs: number = performance.now()): boolean {
    const bucket = this.senderBudget.get(senderKey);
    if (!bucket || nowMs - bucket.windowStartMs >= CHAT_RATE_WINDOW_MS) {
      this.senderBudget.set(senderKey, { windowStartMs: nowMs, count: 1 });
      return true;
    }
    if (bucket.count + 1 > MAX_CHAT_MESSAGES_PER_WINDOW) {
      console.warn(`[Host Security] Rate-limited chat spam from "${senderKey}"`);
      return false;
    }
    bucket.count += 1;
    return true;
  }
}

export function validateIncomingChat(
  payload: unknown,
  senderPeerId: string,
  senderMember: RosterMember | undefined,
  rateTracker?: ChatRateTracker,
  nowMs: number = performance.now(),
): ChatMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Partial<ChatWirePayload>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (raw.kind !== 'text' && raw.kind !== 'emoji') return null;
  if (typeof raw.text !== 'string') return null;

  const limit = raw.kind === 'emoji' ? MAX_CHAT_EMOJI_LENGTH : MAX_CHAT_TEXT_LENGTH;
  const cleanedText = stripControlChars(raw.text).trim().slice(0, limit);
  if (!cleanedText) return null;

  const canonicalSenderId = senderMember?.playerId || raw.senderId || senderPeerId;
  if (!canonicalSenderId) return null;

  if (rateTracker && !rateTracker.checkAndRecord(canonicalSenderId, nowMs)) {
    return null;
  }

  return {
    id: raw.id.trim().slice(0, 64),
    senderId: canonicalSenderId,
    senderCallsign:
      senderMember?.callsign ||
      (typeof raw.senderCallsign === 'string' && raw.senderCallsign.trim().slice(0, 20)) ||
      'PILOT',
    senderTeam: senderMember?.team || (raw.senderTeam === 'red' ? 'red' : 'blue'),
    kind: raw.kind,
    text: cleanedText,
    createdAtMs: Date.now(),
  };
}

export function validateIncomingVoiceState(
  payload: unknown,
  senderPeerId: string,
  senderMember: RosterMember | undefined,
): VoiceStatePayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Partial<VoiceStatePayload>;
  if (typeof raw.micEnabled !== 'boolean') return null;
  const canonicalPlayerId = senderMember?.playerId || raw.playerId;
  const canonicalPeerId = senderMember?.peerId || senderPeerId || raw.peerId;
  if (!canonicalPlayerId || !canonicalPeerId) return null;

  return {
    playerId: canonicalPlayerId,
    peerId: canonicalPeerId,
    micEnabled: raw.micEnabled,
  };
}
