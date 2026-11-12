import type { DataConnection } from 'peerjs';
import type {
  DamageEvent,
  FlagSyncEvent,
  KillFeedEvent,
  PickupSyncEvent,
  RosterMember,
  ShootEvent,
  StationSyncEvent,
} from './types';
import type { Team } from '../ctf/types';
import {
  PICKUP_INTERACT_RADIUS_PX,
  STATION_INTERACT_RADIUS_PX,
  type MatchControlPayload,
  type WireMessage,
} from './wireTypes';
import {
  ChatRateTracker,
  DamageRateTracker,
  isWithinInteractRadius,
  sanitizeIncomingPeerMeta,
  validateFlagEvent,
  validateIncomingChat,
  validateIncomingDamage,
  validateIncomingKillFeed,
  validateIncomingShoot,
  validateIncomingVoiceState,
} from './hostSecurity';
import { useChatStore } from '../comms/chatStore';
import { useVoiceStore } from '../comms/voiceStore';
import { voiceManager } from '../comms/voiceManager';
import { FastSyncController, type FastSyncTransportCallbacks } from './fastSyncController';
import { unpackQuantizedPlayerState, type WorldBatchEntry } from './fastProtocol';
import { handleRoomAuthMessage, syncLocalCarrierFlagFromCTF } from './roomAuthHandlers';
import { useNetworkStore } from './networkStore';
import { usePlayerStore } from '../player/playerStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { useMapStore } from '../map/mapStore';
import {
  WEAPONS,
  computeProjectileLaunchVelocity,
  getProjectileLifespanFrames,
} from '../combat/weaponsConfig';
import { getSafeMuzzlePoint } from '../combat/updateBullets';
import {
  clearOptimisticClaims,
  handleAuthoritativePickupTaken,
  handleAuthoritativeStationTaken,
} from '../combat/optimisticClaims';
import { engineWorld } from '../game/engineWorld';

export interface WireMessageContext {
  isHostRole: boolean;
  selfPeerId: string | null;
  targetHostPeerId: string | null;
  verifiedPeerIds: Set<string>;
  isInActiveBattle: boolean;
  fastSync: FastSyncController;
  fastTransportCallbacks: FastSyncTransportCallbacks;
  damageRateTracker: DamageRateTracker;
  chatRateTracker?: ChatRateTracker;
  findMemberByPeerId: (peerId: string) => RosterMember | undefined;
  findMemberByIdOrPeer: (id: string) => RosterMember | undefined;
  getClientConnections: () => IterableIterator<[string, DataConnection]>;
  safeSend: (conn: DataConnection | null, msg: WireMessage) => void;
  sendToNetwork: (msg: WireMessage, excludePeerId?: string) => void;
  onHostPacketReceived: () => void;
  nextRemoteBulletId: () => number;
  getLastHandledLaunchId: () => string | null;
  setLastHandledLaunchId: (launchId: string | null) => void;
  enterActiveBattleFromMatchControl: () => void;
  exitActiveBattleToStaging: () => void;
  broadcastKillFeed: (event: KillFeedEvent) => void;
  broadcastFlagEvent: (event: FlagSyncEvent) => void;
  dropFlagHeldByPlayer: (playerId: string) => void;
  onStartMatch: ((mapId: string) => void) | null;
  onRematch: ((mapId: string) => void) | null;
  onReturnToStaging: (() => void) | null;
  onRejoinMatch: ((mapId: string, team?: Team) => void) | null;
}

function handleShootMessage(
  msg: { senderId: string; payload: ShootEvent },
  senderPeerId: string,
  gamePhase: 'staging' | 'in_game',
  ctx: WireMessageContext,
) {
  let shoot = msg.payload;
  if (ctx.isHostRole) {
    const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
    const validated = validateIncomingShoot(
      msg.payload,
      senderPeerId,
      senderMember,
      ctx.isInActiveBattle,
      gamePhase,
    );
    if (!validated) return;
    shoot = validated;
    ctx.sendToNetwork({ kind: 'shoot', senderId: msg.senderId, payload: shoot }, senderPeerId);
  }

  const config = WEAPONS[shoot.weaponType];
  if (!config) return;

  const muzzle = getSafeMuzzlePoint(
    shoot.originX,
    shoot.originY,
    shoot.aimAngle,
    shoot.weaponType === 'grenade' ? 16 : 18,
    useMapStore.getState().selectedMap,
  );

  const newBullets = [];
  const spreadHalf = config.spread / 2;
  const speed = config.speed * (shoot.speedScale ?? 1);
  const bulletSeq = ctx.nextRemoteBulletId();
  const lifespan = getProjectileLifespanFrames(config);

  for (let i = 0; i < config.pellets; i++) {
    const fallbackOffset =
      config.pellets > 1
        ? -spreadHalf + (config.spread * i) / (config.pellets - 1)
        : 0;
    const angleOffset =
      shoot.spreadOffsets && i < shoot.spreadOffsets.length
        ? shoot.spreadOffsets[i]
        : fallbackOffset;

    const bulletAngle = shoot.aimAngle + angleOffset;
    const { vx, vy } = computeProjectileLaunchVelocity(shoot.weaponType, bulletAngle, speed);
    newBullets.push({
      id: `rb_${shoot.shooterId}_${bulletSeq}_${i}`,
      shooterId: shoot.shooterId,
      team: shoot.team,
      weaponType: shoot.weaponType,
      x: muzzle.x,
      y: muzzle.y,
      vx,
      vy,
      damage: config.damage,
      blastRadius: config.blastRadius,
      lifespan,
      maxLifespan: lifespan,
    });
  }
  engineWorld.addBullets(newBullets);
}

function handleDamageMessage(
  msg: { kind: 'damage'; senderId: string; payload: DamageEvent },
  senderPeerId: string,
  gamePhase: 'staging' | 'in_game',
  ctx: WireMessageContext,
) {
  const damageEvt = msg.payload;
  const localPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
  const myPlayerId = useAvatarStore.getState().playerId;

  if (ctx.isHostRole) {
    const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
    const targetMember = damageEvt?.targetId
      ? ctx.findMemberByIdOrPeer(damageEvt.targetId)
      : undefined;
    const canonicalTargetId = targetMember?.playerId || damageEvt?.targetId;
    const remoteTarget = canonicalTargetId
      ? engineWorld.remotePlayers.get(damageEvt.targetId) ??
        engineWorld.remotePlayers.get(canonicalTargetId)
      : undefined;

    if (
      !validateIncomingDamage({
        payload: damageEvt,
        senderPeerId,
        senderMember,
        targetMember,
        hostPlayerId: myPlayerId,
        hostPeerId: ctx.selfPeerId,
        localPlayer,
        remoteTarget,
        isInActiveBattle: ctx.isInActiveBattle,
        gamePhase,
        mode: useCTFStore.getState().matchRules.mode,
        rateTracker: ctx.damageRateTracker,
      })
    ) {
      return;
    }
    ctx.sendToNetwork(msg, senderPeerId);
  }

  if (
    !damageEvt ||
    !Number.isFinite(damageEvt.damage) ||
    damageEvt.damage <= 0 ||
    damageEvt.damage > 130
  ) {
    return;
  }

  if (
    damageEvt.targetId === myPlayerId ||
    damageEvt.targetId === ctx.selfPeerId ||
    damageEvt.targetId === localPlayer.id
  ) {
    const wasInvuln = localPlayer.invulnerableTimer > 0;
    const wasDead = localPlayer.isDead;
    const carryingBefore = localPlayer.carryingFlag;
    const wasKilled = usePlayerStore
      .getState()
      .applyDamage(damageEvt.damage, damageEvt.knockbackX, damageEvt.knockbackY);

    if (!wasInvuln && !wasDead && damageEvt.damage > 0) {
      let angle = Math.atan2(-damageEvt.knockbackY, -damageEvt.knockbackX);
      if (typeof damageEvt.sourceX === 'number' && typeof damageEvt.sourceY === 'number') {
        angle = Math.atan2(
          damageEvt.sourceY - localPlayer.y,
          damageEvt.sourceX - localPlayer.x,
        );
      } else {
        const shooterRemote = engineWorld.remotePlayers.get(damageEvt.dealerId);
        if (shooterRemote) {
          angle = Math.atan2(
            shooterRemote.renderY - localPlayer.y,
            shooterRemote.renderX - localPlayer.x,
          );
        }
      }
      engineWorld.addDamageIndicator(angle, damageEvt.damage);
    }

    if (wasKilled) {
      const killerMember = ctx.findMemberByIdOrPeer(damageEvt.dealerId);
      const killerRemote = engineWorld.remotePlayers.get(damageEvt.dealerId);
      const isSelf =
        damageEvt.dealerId === myPlayerId ||
        damageEvt.dealerId === ctx.selfPeerId ||
        damageEvt.dealerId === localPlayer.id;
      const killerTeam: Team =
        killerMember?.team ??
        killerRemote?.team ??
        (localPlayer.team === 'blue' ? 'red' : 'blue');

      const killerCallsign = isSelf
        ? localPlayer.avatar.callsign
        : killerMember?.callsign || killerRemote?.avatar.callsign || 'PILOT';
      const resolvedKillerTeam: Team = isSelf ? localPlayer.team : killerTeam;
      const resolvedWeapon = isSelf ? 'self' : damageEvt.weaponType ?? 'rifle';

      ctx.broadcastKillFeed({
        id: `kill_${myPlayerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        killerId: isSelf ? myPlayerId : killerMember?.playerId || damageEvt.dealerId,
        killerCallsign,
        killerTeam: resolvedKillerTeam,
        victimId: myPlayerId,
        victimCallsign: localPlayer.avatar.callsign,
        victimTeam: localPlayer.team,
        weaponType: resolvedWeapon,
      });

      useMatchStatsStore.getState().setLocalDeathSummary({
        killerCallsign,
        killerTeam: resolvedKillerTeam,
        weaponType: resolvedWeapon,
        atMs: Date.now(),
      });
    }

    if (wasKilled && carryingBefore && useCTFStore.getState().matchRules.mode === 'ctf') {
      const enemyTeam = localPlayer.team === 'blue' ? 'red' : 'blue';
      const updatedLocal = engineWorld.localPlayer ?? localPlayer;
      if (!ctx.isHostRole) {
        ctx.broadcastFlagEvent({
          action: 'drop',
          team: enemyTeam,
          carrierId: myPlayerId,
          x: updatedLocal.x,
          y: updatedLocal.y,
        });
      } else {
        useCTFStore.getState().dropFlag(enemyTeam, updatedLocal.x, updatedLocal.y);
      }
    }
  }
}

function handleKillFeedMessage(
  msg: { senderId: string; payload: KillFeedEvent },
  senderPeerId: string,
  gamePhase: 'staging' | 'in_game',
  ctx: WireMessageContext,
) {
  if (ctx.isHostRole) {
    const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
    const mode = useCTFStore.getState().matchRules.mode;
    const validated = validateIncomingKillFeed(
      msg.payload,
      senderPeerId,
      senderMember,
      ctx.isInActiveBattle,
      gamePhase,
      mode,
    );
    if (!validated) return;
    ctx.sendToNetwork({ kind: 'kill_feed', senderId: msg.senderId, payload: validated }, senderPeerId);
    useCTFStore.getState().recordAuthoritativeKill(validated);
  } else {
    // Non-host peers display the kill feed notification while Host stays the tally authority.
    useMatchStatsStore.getState().recordKillFeedOnly(msg.payload);
  }
}

function handleFlagMessage(
  payload: FlagSyncEvent,
  senderPeerId: string,
  ctx: WireMessageContext,
) {
  if (!ctx.isHostRole) return;
  const senderMember = ctx.findMemberByPeerId(senderPeerId);
  const actorPos = senderMember
    ? ctx.fastSync.getAuthoritativePosition(senderMember.playerId)
    : undefined;
  const ctf = useCTFStore.getState();

  const cmd = validateFlagEvent(
    payload,
    senderMember,
    actorPos,
    ctf.flags,
    ctx.isInActiveBattle,
    ctf.matchStatus,
    ctf.matchRules.mode,
  );
  if (!cmd) return;

  switch (cmd.action) {
    case 'pickup':
      ctf.pickupFlag(cmd.team, cmd.actorId);
      break;
    case 'drop':
      if (cmd.x !== undefined && cmd.y !== undefined) {
        ctf.dropFlag(cmd.team, cmd.x, cmd.y);
      }
      break;
    case 'return':
      ctf.returnFlag(cmd.team);
      break;
    case 'capture':
      ctf.captureFlag(cmd.team, cmd.actorCallsign, cmd.actorId);
      break;
  }
}

function handlePickupSyncMessage(
  evt: PickupSyncEvent,
  senderPeerId: string,
  ctx: WireMessageContext,
) {
  if (ctx.isHostRole && evt.action === 'claim') {
    if (!ctx.isInActiveBattle || useCTFStore.getState().matchStatus !== 'playing') return;
    const pickup = engineWorld.pickups.find((p) => p.id === evt.pickupId);
    if (!pickup || !engineWorld.isPickupAvailable(evt.pickupId)) {
      return;
    }
    const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
    const actorPos = senderMember
      ? ctx.fastSync.getAuthoritativePosition(senderMember.playerId)
      : undefined;
    if (!isWithinInteractRadius(actorPos, pickup.x, pickup.y, PICKUP_INTERACT_RADIUS_PX)) {
      return;
    }
    engineWorld.markPickupTaken(evt.pickupId, 20);
    ctx.sendToNetwork(
      {
        kind: 'pickup_sync',
        senderId: ctx.selfPeerId || 'host',
        payload: {
          action: 'taken',
          pickupId: evt.pickupId,
          playerId: senderMember?.playerId || evt.playerId,
          weaponType: pickup.weaponType,
        },
      },
      senderPeerId,
    );
  } else if (!ctx.isHostRole && evt.action === 'taken') {
    engineWorld.markPickupTaken(evt.pickupId, 20);
    handleAuthoritativePickupTaken(
      evt.pickupId,
      evt.playerId,
      useAvatarStore.getState().playerId,
    );
  }
}

function handleStationSyncMessage(
  evt: StationSyncEvent,
  senderPeerId: string,
  ctx: WireMessageContext,
) {
  if (ctx.isHostRole && evt.action === 'claim') {
    if (!ctx.isInActiveBattle || useCTFStore.getState().matchStatus !== 'playing') return;
    const station = engineWorld.stations.find((s) => s.id === evt.stationId);
    if (!station || !engineWorld.isStationAvailable(evt.stationId)) {
      return;
    }
    const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
    const actorPos = senderMember
      ? ctx.fastSync.getAuthoritativePosition(senderMember.playerId)
      : undefined;
    if (!isWithinInteractRadius(actorPos, station.x, station.y, STATION_INTERACT_RADIUS_PX)) {
      return;
    }
    engineWorld.markStationTaken(evt.stationId);
    ctx.sendToNetwork(
      {
        kind: 'station_sync',
        senderId: ctx.selfPeerId || 'host',
        payload: {
          action: 'taken',
          stationId: evt.stationId,
          playerId: senderMember?.playerId || evt.playerId,
          stationType: station.stationType,
        },
      },
      senderPeerId,
    );
  } else if (!ctx.isHostRole && evt.action === 'taken') {
    engineWorld.markStationTaken(evt.stationId);
    handleAuthoritativeStationTaken(
      evt.stationId,
      evt.playerId,
      useAvatarStore.getState().playerId,
    );
  }
}

function handlePeerMetaMessage(
  payload: unknown,
  senderPeerId: string,
  gamePhase: 'staging' | 'in_game',
  ctx: WireMessageContext,
) {
  const cleanedMeta = sanitizeIncomingPeerMeta(payload, ctx.isHostRole);
  if (Object.keys(cleanedMeta).length === 0) return;

  if (senderPeerId) {
    useNetworkStore.getState().updatePeer(senderPeerId, cleanedMeta);
    const rosterPatch: Partial<RosterMember> = { isOnline: true };
    if (cleanedMeta.callsign !== undefined) rosterPatch.callsign = cleanedMeta.callsign;
    if (cleanedMeta.team !== undefined) rosterPatch.team = cleanedMeta.team;
    if (cleanedMeta.avatar !== undefined) rosterPatch.avatar = cleanedMeta.avatar;
    if (cleanedMeta.isReady !== undefined) rosterPatch.isReady = cleanedMeta.isReady;
    if (!ctx.isHostRole && cleanedMeta.isHost !== undefined) {
      rosterPatch.isHost = cleanedMeta.isHost;
    }
    useNetworkStore.getState().updateRosterMember(senderPeerId, rosterPatch);
  }

  if (ctx.isHostRole && ctx.verifiedPeerIds.has(senderPeerId)) {
    const updatedRoster = Object.values(useNetworkStore.getState().roster);
    const rosterMsg: WireMessage = {
      kind: 'room_auth',
      senderId: ctx.selfPeerId || 'host',
      payload: { type: 'roster_sync', roster: updatedRoster },
    };
    for (const [peerId, clientConn] of ctx.getClientConnections()) {
      if (gamePhase === 'staging' || ctx.verifiedPeerIds.has(peerId)) {
        ctx.safeSend(clientConn, rosterMsg);
      }
    }
  }
}

function handleMatchControlMessage(
  evt: MatchControlPayload,
  senderPeerId: string,
  ctx: WireMessageContext,
) {
  if (evt.type === 'start_match' && evt.mapId) {
    if (ctx.isHostRole) return;
    if (evt.launchId && evt.launchId === ctx.getLastHandledLaunchId()) {
      return;
    }
    if (evt.launchId) {
      ctx.setLastHandledLaunchId(evt.launchId);
    }

    clearOptimisticClaims();
    useNetworkStore.getState().clearRemotePlayers();
    useCTFStore.getState().resetSequence();

    if (evt.matchRules) {
      useCTFStore.getState().setMatchRules(evt.matchRules);
    }
    useMapStore.getState().selectMap(evt.mapId);
    useNetworkStore.getState().setCurrentMapId(evt.mapId);
    useNetworkStore.getState().setGamePhase('in_game');
    if (evt.roster) {
      useNetworkStore.getState().setRoster(evt.roster);
    }
    ctx.enterActiveBattleFromMatchControl();
    ctx.onStartMatch?.(evt.mapId);
    return;
  }

  if (evt.type === 'rematch' && evt.mapId) {
    if (ctx.isHostRole) return;
    if (evt.launchId && evt.launchId === ctx.getLastHandledLaunchId()) {
      return;
    }
    if (evt.launchId) {
      ctx.setLastHandledLaunchId(evt.launchId);
    }

    clearOptimisticClaims();
    useNetworkStore.getState().clearRemotePlayers();
    useCTFStore.getState().resetSequence();

    if (evt.matchRules) {
      useCTFStore.getState().setMatchRules(evt.matchRules);
    }
    useMapStore.getState().selectMap(evt.mapId);
    useNetworkStore.getState().setCurrentMapId(evt.mapId);
    useNetworkStore.getState().setGamePhase('in_game');
    ctx.enterActiveBattleFromMatchControl();
    ctx.onRematch?.(evt.mapId);
    return;
  }

  if (evt.type === 'return_to_staging') {
    if (ctx.isHostRole) return;
    console.log('[PeerJS] Host signaled return_to_staging');
    clearOptimisticClaims();
    ctx.setLastHandledLaunchId(null);
    ctx.exitActiveBattleToStaging();
    useNetworkStore.getState().clearRemotePlayers();
    useNetworkStore.getState().setGamePhase('staging');
    ctx.onReturnToStaging?.();
    return;
  }

  if (evt.type === 'leave_battle') {
    const actorMember =
      ctx.isHostRole && senderPeerId
        ? ctx.findMemberByPeerId(senderPeerId)
        : evt.playerId
          ? ctx.findMemberByIdOrPeer(evt.playerId)
          : undefined;
    const targetPlayerId = actorMember?.playerId || evt.playerId;
    if (!targetPlayerId) return;

    if (ctx.isHostRole) {
      if (actorMember && typeof actorMember.slot === 'number') {
        ctx.fastSync.removeSlot(actorMember.slot);
      }
      ctx.dropFlagHeldByPlayer(targetPlayerId);
      ctx.sendToNetwork(
        {
          kind: 'match_control',
          senderId: ctx.selfPeerId || 'host',
          payload: { type: 'leave_battle', playerId: targetPlayerId },
        },
        senderPeerId,
      );
    }
    useNetworkStore.getState().removeRemotePlayer(targetPlayerId);
  }
}

export function routeIncomingWireMessage(
  msg: WireMessage,
  senderPeerId: string,
  conn: DataConnection | undefined,
  ctx: WireMessageContext,
) {
  if (!msg || typeof msg !== 'object' || !msg.kind) return;

  if (!ctx.isHostRole) {
    ctx.onHostPacketReceived();
  }

  if (
    ctx.isHostRole &&
    senderPeerId &&
    !ctx.verifiedPeerIds.has(senderPeerId) &&
    msg.kind !== 'room_auth'
  ) {
    return;
  }

  const netState = useNetworkStore.getState();

  switch (msg.kind) {
    case 'fast_client_fb': {
      if (!ctx.isHostRole || !ctx.isInActiveBattle) return;
      ctx.fastSync.ingestCadetFastState(
        senderPeerId,
        msg.payload.seq,
        msg.payload.q,
        ctx.fastTransportCallbacks,
      );
      break;
    }

    case 'fast_batch_fb': {
      if (ctx.isHostRole || !ctx.isInActiveBattle) return;
      const unpackedEntries: WorldBatchEntry[] = msg.payload.entries.map((e) => ({
        slot: e.slot,
        seq: e.seq,
        quantized: e.q,
        state: unpackQuantizedPlayerState(e.q),
      }));
      ctx.fastSync.ingestWorldBatch(
        msg.payload.tickSeq,
        unpackedEntries,
        ctx.fastTransportCallbacks,
      );
      break;
    }

    case 'shoot': {
      handleShootMessage(msg, senderPeerId, netState.gamePhase, ctx);
      break;
    }

    case 'damage': {
      handleDamageMessage(msg, senderPeerId, netState.gamePhase, ctx);
      break;
    }

    case 'kill_feed': {
      handleKillFeedMessage(msg, senderPeerId, netState.gamePhase, ctx);
      break;
    }

    case 'flag': {
      handleFlagMessage(msg.payload, senderPeerId, ctx);
      break;
    }

    case 'match_state': {
      if (ctx.isHostRole) break;
      useCTFStore.getState().applyAuthoritativeState(msg.payload);
      syncLocalCarrierFlagFromCTF(msg.payload);
      break;
    }

    case 'pickup_sync': {
      handlePickupSyncMessage(msg.payload, senderPeerId, ctx);
      break;
    }

    case 'station_sync': {
      handleStationSyncMessage(msg.payload, senderPeerId, ctx);
      break;
    }

    case 'peer_meta': {
      handlePeerMetaMessage(msg.payload, senderPeerId, netState.gamePhase, ctx);
      break;
    }

    case 'match_control': {
      handleMatchControlMessage(msg.payload, senderPeerId, ctx);
      break;
    }

    case 'room_auth': {
      handleRoomAuthMessage(msg.payload, senderPeerId, conn, {
        isHostRole: ctx.isHostRole,
        selfPeerId: ctx.selfPeerId,
        targetHostPeerId: ctx.targetHostPeerId,
        verifiedPeerIds: ctx.verifiedPeerIds,
        findMemberByPeerId: ctx.findMemberByPeerId,
        getClientConnections: ctx.getClientConnections,
        safeSend: ctx.safeSend,
        sendToNetwork: ctx.sendToNetwork,
        enterActiveBattleFromAuth: ctx.enterActiveBattleFromMatchControl,
        onStartMatch: ctx.onStartMatch,
        onRejoinMatch: ctx.onRejoinMatch,
      });
      break;
    }

    case 'chat': {
      const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
      const validated = validateIncomingChat(
        msg.payload,
        senderPeerId,
        senderMember,
        ctx.isHostRole ? ctx.chatRateTracker : undefined,
      );
      if (!validated) break;
      if (ctx.isHostRole) {
        ctx.sendToNetwork({ kind: 'chat', senderId: msg.senderId, payload: validated }, senderPeerId);
      }
      useChatStore.getState().appendMessage(validated, true);
      break;
    }

    case 'voice_state': {
      const senderMember = senderPeerId ? ctx.findMemberByPeerId(senderPeerId) : undefined;
      const validated = validateIncomingVoiceState(msg.payload, senderPeerId, senderMember);
      if (!validated) break;
      if (ctx.isHostRole) {
        ctx.sendToNetwork(
          { kind: 'voice_state', senderId: msg.senderId, payload: validated },
          senderPeerId,
        );
      }
      useVoiceStore.getState().setRemoteMicState(validated.playerId, validated.micEnabled);
      voiceManager.reconcileOutgoingCalls();
      break;
    }
  }
}
