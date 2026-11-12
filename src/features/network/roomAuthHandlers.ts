import type { DataConnection } from 'peerjs';
import type {
  AuthJoinRequest,
  AuthJoinResponse,
  HostBeaconEvent,
  MatchSyncStatePayload,
  RosterMember,
} from './types';
import type { Team } from '../ctf/types';
import type {
  AuthRejoinStateResponse,
  RoomAuthPayload,
  WireMessage,
} from './wireTypes';
import { useNetworkStore } from './networkStore';
import { usePlayerStore } from '../player/playerStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { useMapStore } from '../map/mapStore';
import { clearOptimisticClaims } from '../combat/optimisticClaims';
import { engineWorld } from '../game/engineWorld';
import { voiceManager } from '../comms/voiceManager';
import { useVoiceStore } from '../comms/voiceStore';

export interface RoomAuthContext {
  isHostRole: boolean;
  selfPeerId: string | null;
  targetHostPeerId: string | null;
  verifiedPeerIds: Set<string>;
  findMemberByPeerId: (peerId: string) => RosterMember | undefined;
  getClientConnections: () => IterableIterator<[string, DataConnection]>;
  safeSend: (conn: DataConnection | null, msg: WireMessage) => void;
  sendToNetwork: (msg: WireMessage, excludePeerId?: string) => void;
  enterActiveBattleFromAuth: () => void;
  onStartMatch: ((mapId: string) => void) | null;
  onRejoinMatch: ((mapId: string, team?: Team) => void) | null;
}

export function syncLocalCarrierFlagFromCTF(payload: MatchSyncStatePayload) {
  const mode = payload.matchRules?.mode ?? useCTFStore.getState().matchRules.mode;
  const myPlayerId = useAvatarStore.getState().playerId;
  const localPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
  const enemyTeam: Team = localPlayer.team === 'blue' ? 'red' : 'blue';
  const enemyFlag = payload.flags[enemyTeam];
  const shouldCarry =
    mode === 'ctf' &&
    enemyFlag.status === 'carried' &&
    (enemyFlag.carrierId === myPlayerId || enemyFlag.carrierId === localPlayer.id);

  if (localPlayer.carryingFlag !== shouldCarry && !localPlayer.isDead) {
    const updated = { ...localPlayer, carryingFlag: shouldCarry };
    usePlayerStore.getState().setPlayer(updated);
    engineWorld.notifyUrgentLocalStateChange();
  }
}

function handleJoinRequest(
  req: AuthJoinRequest,
  senderPeerId: string,
  conn: DataConnection | undefined,
  ctx: RoomAuthContext,
) {
  if (!ctx.isHostRole) return;

  const currentPhase = useNetworkStore.getState().gamePhase;
  const currentRoster = useNetworkStore.getState().roster;
  const selectedMap = useMapStore.getState().selectedMap;

  if (currentPhase === 'staging') {
    console.log(`[Host Authority] Approving cadet ${req.callsign} (${req.playerId}) for Staging`);
    if (senderPeerId) {
      ctx.verifiedPeerIds.add(senderPeerId);
    }
    const newMember: RosterMember = {
      playerId: req.playerId,
      peerId: senderPeerId || 'cadet',
      callsign: req.callsign,
      team: req.team,
      avatar: req.avatar,
      isReady: true,
      isHost: false,
      isOnline: true,
    };
    useNetworkStore.getState().upsertRosterMember(newMember);

    const allMembers = Object.values(useNetworkStore.getState().roster);
    const response: AuthJoinResponse = {
      type: 'join_response',
      accepted: true,
      gamePhase: 'staging',
      mapId: selectedMap.id,
      matchRules: useCTFStore.getState().matchRules,
      roster: allMembers,
      hostPeerId: ctx.selfPeerId || 'host',
    };

    if (conn) {
      ctx.safeSend(conn, {
        kind: 'room_auth',
        senderId: ctx.selfPeerId || 'host',
        payload: response,
      });
    }
    ctx.sendToNetwork({
      kind: 'room_auth',
      senderId: ctx.selfPeerId || 'host',
      payload: { type: 'roster_sync', roster: allMembers },
    });
    voiceManager.syncWithRoster(allMembers);
    if (conn && useVoiceStore.getState().micEnabled) {
      ctx.safeSend(conn, {
        kind: 'voice_state',
        senderId: ctx.selfPeerId || 'host',
        payload: {
          playerId: useAvatarStore.getState().playerId,
          peerId: ctx.selfPeerId || 'host',
          micEnabled: true,
        },
      });
    }
    return;
  }

  const existingMember = currentRoster[req.playerId];
  if (existingMember) {
    console.log(`[Host Authority] Re-admitting verified cadet ${req.callsign} into live match`);
    if (senderPeerId) {
      ctx.verifiedPeerIds.add(senderPeerId);
    }
    const updatedMember: RosterMember = {
      ...existingMember,
      peerId: senderPeerId || existingMember.peerId,
      isOnline: true,
    };
    useNetworkStore.getState().upsertRosterMember(updatedMember);

    const allMembers = Object.values(useNetworkStore.getState().roster);
    const response: AuthJoinResponse = {
      type: 'join_response',
      accepted: true,
      gamePhase: 'in_game',
      mapId: selectedMap.id,
      matchRules: useCTFStore.getState().matchRules,
      team: existingMember.team,
      roster: allMembers,
      hostPeerId: ctx.selfPeerId || 'host',
      matchState: useCTFStore.getState().exportMatchState(),
      pickupCooldowns: engineWorld.exportPickupCooldowns(),
      stationCooldowns: engineWorld.exportStationCooldowns(),
    };
    if (conn) {
      ctx.safeSend(conn, {
        kind: 'room_auth',
        senderId: ctx.selfPeerId || 'host',
        payload: response,
      });
    }
    const rosterMsg: WireMessage = {
      kind: 'room_auth',
      senderId: ctx.selfPeerId || 'host',
      payload: { type: 'roster_sync', roster: allMembers },
    };
    for (const [peerId, clientConn] of ctx.getClientConnections()) {
      if (ctx.verifiedPeerIds.has(peerId)) {
        ctx.safeSend(clientConn, rosterMsg);
      }
    }
    voiceManager.syncWithRoster(allMembers);
    if (conn && useVoiceStore.getState().micEnabled) {
      ctx.safeSend(conn, {
        kind: 'voice_state',
        senderId: ctx.selfPeerId || 'host',
        payload: {
          playerId: useAvatarStore.getState().playerId,
          peerId: ctx.selfPeerId || 'host',
          micEnabled: true,
        },
      });
    }
    return;
  }

  if (senderPeerId) {
    ctx.verifiedPeerIds.delete(senderPeerId);
  }
  console.warn(
    `[Host Authority] Rejecting unauthorized cadet ${req.callsign} — match already underway`,
  );
  const response: AuthJoinResponse = {
    type: 'join_response',
    accepted: false,
    reason:
      'Match is currently in progress. Only enlisted squad members from the initial deployment can rejoin this battle.',
  };
  if (conn) {
    ctx.safeSend(conn, {
      kind: 'room_auth',
      senderId: ctx.selfPeerId || 'host',
      payload: response,
    });
  }
}

function handleRejoinSync(
  senderPeerId: string,
  conn: DataConnection | undefined,
  ctx: RoomAuthContext,
) {
  if (!ctx.isHostRole || !senderPeerId || !ctx.verifiedPeerIds.has(senderPeerId)) return;
  const member = ctx.findMemberByPeerId(senderPeerId);
  if (!member) return;

  const selectedMap = useMapStore.getState().selectedMap;
  const response: AuthRejoinStateResponse = {
    type: 'rejoin_state',
    mapId: selectedMap.id,
    matchRules: useCTFStore.getState().matchRules,
    team: member.team,
    roster: Object.values(useNetworkStore.getState().roster),
    hostPeerId: ctx.selfPeerId || 'host',
    matchState: useCTFStore.getState().exportMatchState(),
    pickupCooldowns: engineWorld.exportPickupCooldowns(),
    stationCooldowns: engineWorld.exportStationCooldowns(),
  };
  if (conn) {
    ctx.safeSend(conn, {
      kind: 'room_auth',
      senderId: ctx.selfPeerId || 'host',
      payload: response,
    });
  }
}

function handleRejoinState(payload: AuthRejoinStateResponse, ctx: RoomAuthContext) {
  if (ctx.isHostRole) return;
  if (payload.mapId) {
    useNetworkStore.getState().setCurrentMapId(payload.mapId);
    useMapStore.getState().selectMap(payload.mapId);
  }
  if (payload.matchRules) {
    useCTFStore.getState().setMatchRules(payload.matchRules);
  }
  if (payload.roster && payload.roster.length > 0) {
    useNetworkStore.getState().setRoster(payload.roster);
    voiceManager.syncWithRoster(payload.roster);
    const stats = useMatchStatsStore.getState();
    for (const member of payload.roster) {
      stats.registerParticipant(member.playerId, member.callsign, member.team);
    }
  }
  if (payload.team) {
    usePlayerStore.getState().setTeam(payload.team);
  }
  if (payload.pickupCooldowns) {
    engineWorld.applyPickupCooldowns(payload.pickupCooldowns);
  }
  if (payload.stationCooldowns) {
    engineWorld.applyStationCooldowns(payload.stationCooldowns);
  }
  if (payload.matchState) {
    useCTFStore.getState().applyAuthoritativeState(payload.matchState, true);
    syncLocalCarrierFlagFromCTF(payload.matchState);
  }
}

function handleJoinResponse(res: AuthJoinResponse, ctx: RoomAuthContext) {
  console.log('[PeerJS] Received join_response from host:', res);

  if (!res.accepted) {
    useNetworkStore.getState().setJoinRejected(true, res.reason);
    return;
  }

  const resolvedHostId = res.hostPeerId || ctx.targetHostPeerId;
  if (resolvedHostId) {
    useNetworkStore.getState().setHostPeerId(resolvedHostId);
    useNetworkStore.getState().addPeer(resolvedHostId, { isHost: true });
  }
  useNetworkStore.getState().setJoinRejected(false);
  useNetworkStore.getState().setIsAuthApproved(true);
  if (res.mapId) {
    useNetworkStore.getState().setCurrentMapId(res.mapId);
    useMapStore.getState().selectMap(res.mapId);
  }
  if (res.matchRules && !ctx.isHostRole) {
    useCTFStore.getState().setMatchRules(res.matchRules);
  }
  if (res.roster && res.roster.length > 0) {
    useNetworkStore.getState().setRoster(res.roster);
    voiceManager.syncWithRoster(res.roster);
  }
  if (useVoiceStore.getState().micEnabled) {
    ctx.sendToNetwork({
      kind: 'voice_state',
      senderId: ctx.selfPeerId || useAvatarStore.getState().playerId,
      payload: {
        playerId: useAvatarStore.getState().playerId,
        peerId: ctx.selfPeerId || useAvatarStore.getState().playerId,
        micEnabled: true,
      },
    });
  }
  if (res.team) {
    usePlayerStore.getState().setTeam(res.team);
  }
  if (res.gamePhase) {
    useNetworkStore.getState().setGamePhase(res.gamePhase);
  }

  if (res.gamePhase === 'in_game') {
    console.log('[PeerJS] Rejoining live match on map:', res.mapId);
    clearOptimisticClaims();
    ctx.enterActiveBattleFromAuth();
    ctx.onRejoinMatch?.(res.mapId || 'ctf-canyon-arena', res.team);
    if (res.pickupCooldowns) {
      engineWorld.applyPickupCooldowns(res.pickupCooldowns);
    }
    if (res.stationCooldowns) {
      engineWorld.applyStationCooldowns(res.stationCooldowns);
    }
    if (res.matchState) {
      useCTFStore.getState().applyAuthoritativeState(res.matchState, true);
      syncLocalCarrierFlagFromCTF(res.matchState);
    }
  }
}

function handleRosterSync(roster: RosterMember[]) {
  if (!roster || roster.length === 0) return;
  useNetworkStore.getState().setRoster(roster);
  voiceManager.syncWithRoster(roster);
  if (useNetworkStore.getState().gamePhase === 'in_game') {
    const stats = useMatchStatsStore.getState();
    for (const member of roster) {
      stats.registerParticipant(member.playerId, member.callsign, member.team);
    }
  }
}

function handleHostBeacon(beacon: HostBeaconEvent, ctx: RoomAuthContext) {
  useNetworkStore.getState().setHostPeerId(beacon.hostPeerId);
  if (beacon.mapId) {
    useNetworkStore.getState().setCurrentMapId(beacon.mapId);
    if (!ctx.isHostRole) {
      useMapStore.getState().selectMap(beacon.mapId);
    }
  }
  if (beacon.roster && beacon.roster.length > 0) {
    useNetworkStore.getState().setRoster(beacon.roster);
  }
  const currentPhase = useNetworkStore.getState().gamePhase;
  const isAuthApproved = useNetworkStore.getState().isAuthApproved;
  if (beacon.gamePhase) {
    useNetworkStore.getState().setGamePhase(beacon.gamePhase);
  }

  if (!ctx.isHostRole && beacon.matchRules) {
    useCTFStore
      .getState()
      .syncClockFromHost(
        beacon.matchRules,
        beacon.gamePhase === 'in_game' ? beacon.timeRemainingSec : undefined,
        beacon.isOvertime,
      );
  }

  if (beacon.gamePhase === 'in_game' && currentPhase !== 'in_game' && isAuthApproved) {
    console.log('[PeerJS] Host beacon signaled match started on:', beacon.mapId);
    clearOptimisticClaims();
    ctx.enterActiveBattleFromAuth();
    useNetworkStore.getState().clearRemotePlayers();
    useCTFStore.getState().resetSequence();
    ctx.onStartMatch?.(beacon.mapId || 'ctf-canyon-arena');
    if (!ctx.isHostRole && typeof beacon.timeRemainingSec === 'number') {
      useCTFStore
        .getState()
        .syncClockFromHost(beacon.matchRules, beacon.timeRemainingSec, beacon.isOvertime);
    }
  }
}

export function handleRoomAuthMessage(
  payload: RoomAuthPayload,
  senderPeerId: string,
  conn: DataConnection | undefined,
  ctx: RoomAuthContext,
) {
  switch (payload.type) {
    case 'join_request':
      handleJoinRequest(payload, senderPeerId, conn, ctx);
      break;
    case 'rejoin_sync':
      handleRejoinSync(senderPeerId, conn, ctx);
      break;
    case 'rejoin_state':
      handleRejoinState(payload, ctx);
      break;
    case 'join_response':
      handleJoinResponse(payload, ctx);
      break;
    case 'roster_sync':
      handleRosterSync(payload.roster);
      break;
    case 'host_beacon':
      handleHostBeacon(payload, ctx);
      break;
  }
}
