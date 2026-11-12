import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type {
  AuthJoinRequest,
  HostBeaconEvent,
  RosterMember,
} from './types';
import type { Team } from '../ctf/types';
import {
  CADET_HOST_SILENCE_MS,
  type WireMessage,
} from './wireTypes';
import type { FastSyncController, FastSyncTransportCallbacks } from './fastSyncController';
import { useNetworkStore } from './networkStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { usePlayerStore } from '../player/playerStore';
import { useMapStore } from '../map/mapStore';
import { useCTFStore } from '../ctf/ctfStore';

export interface PeerTransportSession {
  peer: Peer | null;
  selfPeerId: string | null;
  targetHostPeerId: string | null;
  isHostRole: boolean;
  isConnectingOrDestroyed: boolean;
  isInActiveBattle: boolean;
  clientConnections: Map<string, DataConnection>;
  verifiedPeerIds: Set<string>;
  hostConn: DataConnection | null;
  isDialingHost: boolean;
  hasEverConnectedToHost: boolean;
  hostReconnectAttempts: number;
  lastHostTrafficMs: number;
  lastCadetWatchdogTickMs: number;
  lastBeaconInGamePingMs: number;
}

export function findMemberByPeerId(peerId: string): RosterMember | undefined {
  const roster = useNetworkStore.getState().roster;
  for (const member of Object.values(roster)) {
    if (member.peerId === peerId) return member;
  }
  return undefined;
}

export function findMemberBySlot(slot: number): RosterMember | undefined {
  const roster = useNetworkStore.getState().roster;
  for (const member of Object.values(roster)) {
    if (member.slot === slot) return member;
  }
  return undefined;
}

export function findMemberByIdOrPeer(id: string): RosterMember | undefined {
  const roster = useNetworkStore.getState().roster;
  if (roster[id]) return roster[id];
  for (const member of Object.values(roster)) {
    if (member.peerId === id || member.playerId === id) return member;
  }
  return undefined;
}

export function safeSendWireMessage(conn: DataConnection | null, msg: WireMessage) {
  if (!conn || !conn.open) return;
  try {
    conn.send(msg);
  } catch (err) {
    console.warn('[PeerJS] Send failed:', err);
  }
}

export function sendCadetJoinRequest(session: PeerTransportSession) {
  const currentAvatar = useAvatarStore.getState();
  const localPlayer = usePlayerStore.getState().player;
  const joinReq: AuthJoinRequest = {
    type: 'join_request',
    playerId: currentAvatar.playerId,
    callsign: currentAvatar.avatar.callsign,
    team: localPlayer.team,
    avatar: currentAvatar.avatar,
  };
  safeSendWireMessage(session.hostConn, {
    kind: 'room_auth',
    senderId: session.selfPeerId || currentAvatar.playerId,
    payload: joinReq,
  });
}

export function dropFlagHeldByPlayer(
  playerId: string,
  session: PeerTransportSession,
  fastSync: FastSyncController,
) {
  if (!session.isHostRole || !session.isInActiveBattle) return;
  const ctf = useCTFStore.getState();
  for (const team of ['blue', 'red'] as Team[]) {
    const flag = ctf.flags[team];
    if (flag.status === 'carried' && flag.carrierId === playerId) {
      const pos = fastSync.getAuthoritativePosition(playerId);
      const dropX = pos ? pos.x : flag.baseX;
      const dropY = pos ? pos.y : flag.baseY;
      ctf.dropFlag(team, dropX, dropY);
    }
  }
}

export function publishHostBeacon(session: PeerTransportSession) {
  if (!session.isHostRole || !session.peer || session.peer.destroyed) return;
  const currentPhase = useNetworkStore.getState().gamePhase;
  const now = performance.now();

  if (currentPhase === 'in_game') {
    if (now - session.lastBeaconInGamePingMs < 3200) return;
    session.lastBeaconInGamePingMs = now;
  }

  const currentMap = useMapStore.getState().selectedMap;
  const currentRoster = Object.values(useNetworkStore.getState().roster);
  const ctfState = useCTFStore.getState();
  const exportedCtf = currentPhase === 'in_game' ? ctfState.exportMatchState() : null;

  const beacon: HostBeaconEvent = {
    type: 'host_beacon',
    hostPeerId: session.selfPeerId || session.targetHostPeerId || 'host',
    gamePhase: currentPhase,
    mapId: currentMap.id,
    matchRules: ctfState.matchRules,
    timeRemainingSec: exportedCtf?.timeRemainingSec,
    isOvertime: exportedCtf?.isOvertime,
    totalPlayers: currentRoster.length,
    roster: currentPhase === 'staging' ? currentRoster : undefined,
  };
  const beaconMsg: WireMessage = {
    kind: 'room_auth',
    senderId: session.selfPeerId || 'host',
    payload: beacon,
  };
  for (const [peerId, conn] of session.clientConnections.entries()) {
    if (currentPhase !== 'staging' && !session.verifiedPeerIds.has(peerId)) {
      continue;
    }
    safeSendWireMessage(conn, beaconMsg);
  }
}

export interface CadetDialCallbacks {
  closeHostTransport: () => void;
  scheduleHostRetry: (delayMs: number) => void;
  onWireMessage: (msg: WireMessage, senderPeerId: string, conn: DataConnection) => void;
}

export function dialHostPeer(
  session: PeerTransportSession,
  fastSync: FastSyncController,
  fastTransportCallbacks: FastSyncTransportCallbacks,
  callbacks: CadetDialCallbacks,
) {
  if (!session.peer || session.peer.destroyed || !session.targetHostPeerId || session.isHostRole) {
    return;
  }
  if (session.hostConn?.open || session.isDialingHost) return;

  session.isDialingHost = true;
  console.log(`[PeerJS] Cadet dialing Host "${session.targetHostPeerId}"...`);

  const conn = session.peer.connect(session.targetHostPeerId, {
    reliable: true,
    serialization: 'json',
  });
  if (!conn) {
    session.isDialingHost = false;
    session.hostReconnectAttempts += 1;
    useNetworkStore.getState().incrementHostReconnectAttempt();
    if (session.hasEverConnectedToHost || session.hostReconnectAttempts >= 2) {
      useNetworkStore
        .getState()
        .setHostSignalLost(true, 'Unable to open P2P channel to squad host.');
    }
    callbacks.scheduleHostRetry(1000);
    return;
  }
  session.hostConn = conn;

  let openTimeout: ReturnType<typeof setTimeout> | null = globalThis.setTimeout(() => {
    if (session.hostConn !== conn) return;
    if (!conn.open) {
      console.warn('[PeerJS] DataConnection open timed out, retrying dial...');
      session.hostReconnectAttempts += 1;
      useNetworkStore.getState().incrementHostReconnectAttempt();
      if (
        session.hasEverConnectedToHost ||
        session.hostReconnectAttempts >= 2 ||
        useNetworkStore.getState().isAuthApproved
      ) {
        useNetworkStore
          .getState()
          .setHostSignalLost(true, 'Host connection timed out. Retrying P2P uplink...');
      }
      callbacks.closeHostTransport();
      callbacks.scheduleHostRetry(800);
    }
  }, 5000);

  const onOpen = () => {
    if (session.hostConn !== conn) return;
    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = null;
    }
    session.isDialingHost = false;
    session.hasEverConnectedToHost = true;
    session.hostReconnectAttempts = 0;
    session.lastHostTrafficMs = performance.now();
    useNetworkStore.getState().resetHostSignal();
    console.log(`[PeerJS] Connected directly to Host "${session.targetHostPeerId}"!`);

    const hostId = session.targetHostPeerId!;
    fastSync.attachFastDataChannel(
      conn.peerConnection,
      hostId,
      false,
      fastTransportCallbacks,
    );
    sendCadetJoinRequest(session);
  };

  if (conn.open) {
    onOpen();
  } else {
    conn.on('open', onOpen);
  }

  conn.on('data', (raw: unknown) => {
    if (session.hostConn !== conn) return;
    callbacks.onWireMessage(raw as WireMessage, conn.peer, conn);
  });

  conn.on('close', () => {
    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = null;
    }
    if (session.hostConn !== conn) return;
    callbacks.closeHostTransport();
    console.warn('[PeerJS] Host DataConnection closed.');
    if (session.targetHostPeerId) {
      useNetworkStore.getState().removePeer(session.targetHostPeerId);
    }
    if (!session.isConnectingOrDestroyed) {
      if (session.hasEverConnectedToHost || useNetworkStore.getState().isAuthApproved) {
        useNetworkStore
          .getState()
          .setHostSignalLost(true, 'Connection to squad host dropped.');
      }
      callbacks.scheduleHostRetry(1000);
    }
  });

  conn.on('error', (err) => {
    if (session.hostConn !== conn) return;
    console.warn('[PeerJS] Host DataConnection error:', err);
    session.isDialingHost = false;
  });
}

export function evaluateCadetWatchdog(
  session: PeerTransportSession,
  dialCallbacks: {
    closeHostTransport: () => void;
    dialHost: () => void;
    scheduleHostRetry: (delayMs: number) => void;
  },
) {
  if (session.isHostRole || session.isConnectingOrDestroyed) return;
  const netState = useNetworkStore.getState();
  const now = performance.now();

  if (
    session.lastCadetWatchdogTickMs > 0 &&
    now - session.lastCadetWatchdogTickMs > 4500 &&
    session.lastHostTrafficMs > 0
  ) {
    session.lastHostTrafficMs = now;
  }
  session.lastCadetWatchdogTickMs = now;

  const iceState = session.hostConn?.peerConnection?.iceConnectionState;
  const connState = session.hostConn?.peerConnection?.connectionState;
  const webrtcDead =
    iceState === 'failed' ||
    iceState === 'closed' ||
    connState === 'failed' ||
    connState === 'closed';

  if (!session.hostConn || !session.hostConn.open || webrtcDead) {
    if (webrtcDead && session.hostConn) {
      dialCallbacks.closeHostTransport();
    }
    if (session.hasEverConnectedToHost || netState.isAuthApproved) {
      netState.setHostSignalLost(true, 'Host signal lost. Attempting P2P reconnect...');
    }
    if (session.peer?.open && !session.isDialingHost) {
      session.hostReconnectAttempts += 1;
      netState.incrementHostReconnectAttempt();
      dialCallbacks.dialHost();
    }
    return;
  }

  if (
    session.hasEverConnectedToHost &&
    session.lastHostTrafficMs > 0 &&
    now - session.lastHostTrafficMs > CADET_HOST_SILENCE_MS
  ) {
    console.warn('[PeerJS] Host watchdog timed out (>10s without host packets). Retrying...');
    netState.setHostSignalLost(true, 'Host stopped responding. Attempting P2P reconnect...');
    dialCallbacks.closeHostTransport();
    if (session.targetHostPeerId) {
      netState.removePeer(session.targetHostPeerId);
    }
    session.hostReconnectAttempts += 1;
    netState.incrementHostReconnectAttempt();
    dialCallbacks.scheduleHostRetry(500);
    return;
  }

  if (!netState.isAuthApproved && !netState.isJoinRejected) {
    sendCadetJoinRequest(session);
  }
}

export interface HostCadetConnectionCallbacks {
  sendToNetwork: (msg: WireMessage, excludePeerId?: string) => void;
  onWireMessage: (msg: WireMessage, senderPeerId: string, conn: DataConnection) => void;
}

export function setupIncomingCadetConnection(
  conn: DataConnection,
  session: PeerTransportSession,
  fastSync: FastSyncController,
  fastTransportCallbacks: FastSyncTransportCallbacks,
  callbacks: HostCadetConnectionCallbacks,
) {
  const remotePeerId = conn.peer;
  console.log(`[PeerJS] Host received incoming connection from Cadet "${remotePeerId}"`);

  const onOpen = () => {
    console.log(`[PeerJS] DataChannel OPEN with Cadet "${remotePeerId}"`);
    session.clientConnections.set(remotePeerId, conn);
    fastSync.attachFastDataChannel(
      conn.peerConnection,
      remotePeerId,
      true,
      fastTransportCallbacks,
    );

    const currentPhase = useNetworkStore.getState().gamePhase;
    if (currentPhase !== 'staging') {
      return;
    }

    useNetworkStore.getState().addPeer(remotePeerId, {});

    const currentAvatar = useAvatarStore.getState();
    const localPlayer = usePlayerStore.getState().player;
    const currentRoster = Object.values(useNetworkStore.getState().roster);
    const currentMap = useMapStore.getState().selectedMap;

    safeSendWireMessage(conn, {
      kind: 'peer_meta',
      senderId: session.selfPeerId || 'host',
      payload: {
        callsign: currentAvatar.avatar.callsign,
        team: localPlayer.team,
        isReady: true,
        isHost: true,
      },
    });

    safeSendWireMessage(conn, {
      kind: 'room_auth',
      senderId: session.selfPeerId || 'host',
      payload: {
        type: 'roster_sync',
        roster: currentRoster,
      },
    });

    safeSendWireMessage(conn, {
      kind: 'room_auth',
      senderId: session.selfPeerId || 'host',
      payload: {
        type: 'host_beacon',
        hostPeerId: session.selfPeerId || 'host',
        gamePhase: currentPhase,
        mapId: currentMap.id,
        matchRules: useCTFStore.getState().matchRules,
        totalPlayers: currentRoster.length,
        roster: currentRoster,
      },
    });
  };

  if (conn.open) {
    onOpen();
  } else {
    conn.on('open', onOpen);
  }

  conn.on('data', (raw: unknown) => {
    callbacks.onWireMessage(raw as WireMessage, remotePeerId, conn);
  });

  conn.on('close', () => {
    console.log(`[PeerJS] Cadet "${remotePeerId}" disconnected.`);
    session.clientConnections.delete(remotePeerId);
    session.verifiedPeerIds.delete(remotePeerId);
    fastSync.closeClientFastChannel(remotePeerId);

    const disconnectedMember = findMemberByPeerId(remotePeerId);
    if (disconnectedMember) {
      if (typeof disconnectedMember.slot === 'number') {
        fastSync.removeSlot(disconnectedMember.slot);
      }
      dropFlagHeldByPlayer(disconnectedMember.playerId, session, fastSync);
    }

    useNetworkStore.getState().removePeer(remotePeerId);
    useNetworkStore.getState().updateRosterMember(remotePeerId, { isOnline: false });

    if (session.isHostRole) {
      const updatedRoster = Object.values(useNetworkStore.getState().roster);
      callbacks.sendToNetwork({
        kind: 'room_auth',
        senderId: session.selfPeerId || 'host',
        payload: { type: 'roster_sync', roster: updatedRoster },
      });
    }
  });

  conn.on('error', (err) => {
    console.warn(`[PeerJS] Cadet connection error (${remotePeerId}):`, err);
  });
}
