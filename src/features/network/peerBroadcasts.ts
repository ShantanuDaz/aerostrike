import type {
  DamageEvent,
  FlagSyncEvent,
  HostBeaconEvent,
  KillFeedEvent,
  PeerInfo,
  PickupSyncEvent,
  ShootEvent,
  StationSyncEvent,
} from './types';
import type { MatchRulesConfig, Team } from '../ctf/types';
import type { WireMessage } from './wireTypes';
import type { PeerTransportSession } from './peerTransport';
import { useAvatarStore } from '../avatar/avatarStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useMapStore } from '../map/mapStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { useNetworkStore } from './networkStore';
import { usePlayerStore } from '../player/playerStore';
import { sanitizeLocalChatInput, useChatStore } from '../comms/chatStore';
import type { ChatKind, ChatMessage } from '../comms/types';

export type SendToNetworkFn = (msg: WireMessage, excludePeerId?: string) => void;
export type SendToHostFn = (msg: WireMessage) => void;

export function sendShootEvent(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  notifyUrgent: () => void,
  event: ShootEvent,
) {
  const myPlayerId = useAvatarStore.getState().playerId;
  sendToNetwork({
    kind: 'shoot',
    senderId: session.selfPeerId || myPlayerId,
    payload: {
      ...event,
      shooterId: myPlayerId,
    },
  });
  notifyUrgent();
}

export function sendDamageEvent(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  event: DamageEvent,
) {
  const myPlayerId = useAvatarStore.getState().playerId;
  sendToNetwork({
    kind: 'damage',
    senderId: session.selfPeerId || myPlayerId,
    payload: {
      ...event,
      dealerId: myPlayerId,
    },
  });
}

export function sendKillFeedEvent(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  event: KillFeedEvent,
) {
  useMatchStatsStore.getState().recordKill(event);
  if (!session.peer || session.peer.destroyed) return;
  const myPlayerId = useAvatarStore.getState().playerId;
  sendToNetwork({
    kind: 'kill_feed',
    senderId: session.selfPeerId || myPlayerId,
    payload: event,
  });
}

export function sendFlagSyncEvent(
  session: PeerTransportSession,
  sendToHost: SendToHostFn,
  event: FlagSyncEvent,
) {
  if (session.isHostRole) return;
  const myPlayerId = useAvatarStore.getState().playerId;
  const resolvedCarrierId = event.carrierId ? myPlayerId : undefined;
  sendToHost({
    kind: 'flag',
    senderId: session.selfPeerId || myPlayerId,
    payload: resolvedCarrierId ? { ...event, carrierId: resolvedCarrierId } : event,
  });
}

export function sendPickupCollectedEvent(
  session: PeerTransportSession,
  sendToHost: SendToHostFn,
  sendToNetwork: SendToNetworkFn,
  pickupId: string,
  weaponType: PickupSyncEvent['weaponType'],
) {
  const myPlayerId = useAvatarStore.getState().playerId;
  if (session.isHostRole) {
    sendToNetwork({
      kind: 'pickup_sync',
      senderId: session.selfPeerId || 'host',
      payload: {
        action: 'taken',
        pickupId,
        playerId: myPlayerId,
        weaponType,
      },
    });
  } else {
    sendToHost({
      kind: 'pickup_sync',
      senderId: session.selfPeerId || myPlayerId,
      payload: {
        action: 'claim',
        pickupId,
        playerId: myPlayerId,
        weaponType,
      },
    });
  }
}

export function sendStationCollectedEvent(
  session: PeerTransportSession,
  sendToHost: SendToHostFn,
  sendToNetwork: SendToNetworkFn,
  stationId: string,
  stationType: StationSyncEvent['stationType'],
) {
  const myPlayerId = useAvatarStore.getState().playerId;
  if (session.isHostRole) {
    sendToNetwork({
      kind: 'station_sync',
      senderId: session.selfPeerId || 'host',
      payload: {
        action: 'taken',
        stationId,
        playerId: myPlayerId,
        stationType,
      },
    });
  } else {
    sendToHost({
      kind: 'station_sync',
      senderId: session.selfPeerId || myPlayerId,
      payload: {
        action: 'claim',
        stationId,
        playerId: myPlayerId,
        stationType,
      },
    });
  }
}

export function sendPeerMetaUpdate(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  meta: Partial<PeerInfo>,
) {
  sendToNetwork({
    kind: 'peer_meta',
    senderId: session.selfPeerId || 'local',
    payload: {
      ...meta,
      isHost: session.isHostRole,
    },
  });
}

export function sendTeamChangeBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  newTeam: Team,
) {
  const avatarStore = useAvatarStore.getState();
  const currentReady =
    useNetworkStore.getState().roster[avatarStore.playerId]?.isReady ?? true;
  useNetworkStore.getState().updateRosterMember(avatarStore.playerId, {
    team: newTeam,
    isReady: currentReady,
  });

  const meta = {
    callsign: avatarStore.avatar.callsign,
    team: newTeam,
    isReady: currentReady,
    isHost: session.isHostRole,
  };
  sendToNetwork({
    kind: 'peer_meta',
    senderId: session.selfPeerId || avatarStore.playerId,
    payload: meta,
  });

  if (session.isHostRole) {
    sendToNetwork({
      kind: 'room_auth',
      senderId: session.selfPeerId || 'host',
      payload: {
        type: 'roster_sync',
        roster: Object.values(useNetworkStore.getState().roster),
      },
    });
  }
}

export function sendReadyChangeBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  isReady: boolean,
) {
  const avatarStore = useAvatarStore.getState();
  const playerStore = usePlayerStore.getState();
  useNetworkStore.getState().updateRosterMember(avatarStore.playerId, { isReady });

  const meta = {
    callsign: avatarStore.avatar.callsign,
    team: playerStore.player.team,
    isReady,
    isHost: session.isHostRole,
  };
  sendToNetwork({
    kind: 'peer_meta',
    senderId: session.selfPeerId || avatarStore.playerId,
    payload: meta,
  });

  if (session.isHostRole) {
    sendToNetwork({
      kind: 'room_auth',
      senderId: session.selfPeerId || 'host',
      payload: {
        type: 'roster_sync',
        roster: Object.values(useNetworkStore.getState().roster),
      },
    });
  }
}

export function sendAvatarChangeBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
) {
  const avatarStore = useAvatarStore.getState();
  const playerStore = usePlayerStore.getState();
  const currentReady =
    useNetworkStore.getState().roster[avatarStore.playerId]?.isReady ?? true;

  useNetworkStore.getState().updateRosterMember(avatarStore.playerId, {
    callsign: avatarStore.avatar.callsign,
    avatar: avatarStore.avatar,
  });

  if (!session.peer || session.peer.destroyed) return;

  const meta = {
    callsign: avatarStore.avatar.callsign,
    team: playerStore.player.team,
    avatar: avatarStore.avatar,
    isReady: currentReady,
    isHost: session.isHostRole,
  };
  sendToNetwork({
    kind: 'peer_meta',
    senderId: session.selfPeerId || avatarStore.playerId,
    payload: meta,
  });

  if (session.isHostRole) {
    sendToNetwork({
      kind: 'room_auth',
      senderId: session.selfPeerId || 'host',
      payload: {
        type: 'roster_sync',
        roster: Object.values(useNetworkStore.getState().roster),
      },
    });
  }
}

export function sendMapChangeBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  mapId: string,
) {
  if (!session.isHostRole) return;
  useNetworkStore.getState().setCurrentMapId(mapId);
  if (!session.peer || session.peer.destroyed) return;

  const currentPhase = useNetworkStore.getState().gamePhase;
  const currentRoster = Object.values(useNetworkStore.getState().roster);
  const beacon: HostBeaconEvent = {
    type: 'host_beacon',
    hostPeerId: session.selfPeerId || 'host',
    gamePhase: currentPhase,
    mapId,
    matchRules: useCTFStore.getState().matchRules,
    totalPlayers: currentRoster.length,
    roster: currentRoster,
  };
  sendToNetwork({
    kind: 'room_auth',
    senderId: session.selfPeerId || 'host',
    payload: beacon,
  });
}

export function sendRulesChangeBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  rules: MatchRulesConfig,
) {
  if (!session.isHostRole) return;
  if (!session.peer || session.peer.destroyed) return;

  const currentPhase = useNetworkStore.getState().gamePhase;
  const currentMap = useMapStore.getState().selectedMap;
  const currentRoster = Object.values(useNetworkStore.getState().roster);
  const beacon: HostBeaconEvent = {
    type: 'host_beacon',
    hostPeerId: session.selfPeerId || 'host',
    gamePhase: currentPhase,
    mapId: currentMap.id,
    matchRules: rules,
    totalPlayers: currentRoster.length,
    roster: currentRoster,
  };
  sendToNetwork({
    kind: 'room_auth',
    senderId: session.selfPeerId || 'host',
    payload: beacon,
  });
}

export function sendChatBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  kind: ChatKind,
  rawText: string,
): ChatMessage | null {
  const cleaned = sanitizeLocalChatInput(rawText, kind);
  if (!cleaned) return null;

  const avatarStore = useAvatarStore.getState();
  const playerStore = usePlayerStore.getState();
  const nowMs = Date.now();
  const msg: ChatMessage = {
    id: `chat_${avatarStore.playerId}_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: avatarStore.playerId,
    senderCallsign: avatarStore.avatar.callsign,
    senderTeam: playerStore.player.team,
    kind,
    text: cleaned,
    createdAtMs: nowMs,
  };

  useChatStore.getState().appendMessage(msg, false);

  if (session.peer && !session.peer.destroyed) {
    sendToNetwork({
      kind: 'chat',
      senderId: session.selfPeerId || avatarStore.playerId,
      payload: msg,
    });
  }
  return msg;
}

export function sendVoiceStateBroadcast(
  session: PeerTransportSession,
  sendToNetwork: SendToNetworkFn,
  micEnabled: boolean,
) {
  if (!session.peer || session.peer.destroyed) return;
  const myPlayerId = useAvatarStore.getState().playerId;
  sendToNetwork({
    kind: 'voice_state',
    senderId: session.selfPeerId || myPlayerId,
    payload: {
      playerId: myPlayerId,
      peerId: session.selfPeerId || myPlayerId,
      micEnabled,
    },
  });
}
