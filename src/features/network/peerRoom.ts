import Peer, { type DataConnection } from 'peerjs';
import type {
  DamageEvent,
  FlagSyncEvent,
  KillFeedEvent,
  MatchSyncStatePayload,
  PeerInfo,
  PickupSyncEvent,
  RosterMember,
  ShootEvent,
  StationSyncEvent,
} from './types';
import type { MatchRulesConfig, Team } from '../ctf/types';
import { useNetworkStore } from './networkStore';
import { usePlayerStore } from '../player/playerStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { clearOptimisticClaims } from '../combat/optimisticClaims';
import { engineWorld } from '../game/engineWorld';
import {
  FAST_TICK_MS,
  buildIceServers,
  toHostPeerId,
  type WireMessage,
} from './wireTypes';
import { DamageRateTracker } from './hostSecurity';
import { FastSyncController, type FastSyncTransportCallbacks } from './fastSyncController';
import {
  sendDamageEvent,
  sendFlagSyncEvent,
  sendKillFeedEvent,
  sendMapChangeBroadcast,
  sendPeerMetaUpdate,
  sendPickupCollectedEvent,
  sendReadyChangeBroadcast,
  sendRulesChangeBroadcast,
  sendShootEvent,
  sendStationCollectedEvent,
  sendTeamChangeBroadcast,
} from './peerBroadcasts';
import {
  dialHostPeer,
  dropFlagHeldByPlayer,
  evaluateCadetWatchdog,
  findMemberByIdOrPeer,
  findMemberByPeerId,
  findMemberBySlot,
  publishHostBeacon,
  safeSendWireMessage,
  setupIncomingCadetConnection,
  type PeerTransportSession,
} from './peerTransport';
import { routeIncomingWireMessage } from './wireMessageRouter';

export class PeerNetworkManager {
  private readonly session: PeerTransportSession = {
    peer: null,
    selfPeerId: null,
    targetHostPeerId: null,
    isHostRole: false,
    isConnectingOrDestroyed: false,
    isInActiveBattle: false,
    clientConnections: new Map<string, DataConnection>(),
    verifiedPeerIds: new Set<string>(),
    hostConn: null,
    isDialingHost: false,
    hasEverConnectedToHost: false,
    hostReconnectAttempts: 0,
    lastHostTrafficMs: 0,
    lastCadetWatchdogTickMs: 0,
    lastBeaconInGamePingMs: 0,
  };

  private readonly damageRateTracker = new DamageRateTracker();
  private readonly fastSync = new FastSyncController();

  private remoteBulletCounter = 0;
  private lastHandledLaunchId: string | null = null;
  private currentLaunchId: string | null = null;

  private ctfUnsubscribe: (() => void) | null = null;
  private lastSyncedCtfSeq = -1;

  private onStartMatchCallback: ((mapId: string) => void) | null = null;
  private onReturnToStagingCallback: (() => void) | null = null;
  private onRejoinMatchCallback: ((mapId: string, team?: Team) => void) | null = null;
  private onRematchCallback: ((mapId: string) => void) | null = null;

  private fastTickInterval: ReturnType<typeof setInterval> | null = null;
  private beaconInterval: ReturnType<typeof setInterval> | null = null;
  private joinHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private retryHostDialTimer: ReturnType<typeof setTimeout> | null = null;
  private startMatchRetryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly fastTransportCallbacks: FastSyncTransportCallbacks = {
    isDestroyed: () => this.session.isConnectingOrDestroyed,
    isHostRole: () => this.session.isHostRole,
    isInActiveBattle: () => this.session.isInActiveBattle,
    isVerifiedPeer: (peerId) => this.session.verifiedPeerIds.has(peerId),
    findMemberByPeerId: (peerId) => findMemberByPeerId(peerId),
    findMemberBySlot: (slot) => findMemberBySlot(slot),
    onHostPacketReceived: (nowMs) => {
      this.session.lastHostTrafficMs = nowMs;
      if (useNetworkStore.getState().hostSignalLost) {
        useNetworkStore.getState().resetHostSignal();
      }
    },
    sendFallbackToHost: (msg) => this.sendToHost(msg),
    sendFallbackToClient: (peerId, msg) => {
      const conn = this.session.clientConnections.get(peerId);
      if (conn?.open) safeSendWireMessage(conn, msg);
    },
    getClientPeerIds: () => Array.from(this.session.clientConnections.keys()),
    getSelfPeerId: () => this.session.selfPeerId,
  };

  public setOnStartMatch(cb: (mapId: string) => void) {
    this.onStartMatchCallback = cb;
  }

  public setOnReturnToStaging(cb: () => void) {
    this.onReturnToStagingCallback = cb;
  }

  public setOnRejoinMatch(cb: (mapId: string, team?: Team) => void) {
    this.onRejoinMatchCallback = cb;
  }

  public setOnRematch(cb: (mapId: string) => void) {
    this.onRematchCallback = cb;
  }

  private resetProtocolBuffers() {
    this.fastSync.reset();
    this.session.verifiedPeerIds.clear();
    this.session.lastBeaconInGamePingMs = 0;
    this.lastSyncedCtfSeq = -1;
    this.lastHandledLaunchId = null;
    this.currentLaunchId = null;
    this.session.hasEverConnectedToHost = false;
    this.session.hostReconnectAttempts = 0;
    this.session.lastHostTrafficMs = 0;
    this.session.lastCadetWatchdogTickMs = 0;
    this.damageRateTracker.clear();
    clearOptimisticClaims();
  }

  private closeHostTransport() {
    this.session.isDialingHost = false;
    this.fastSync.closeHostFastChannel();
    if (this.session.hostConn) {
      const staleConn = this.session.hostConn;
      this.session.hostConn = null;
      try {
        staleConn.close();
      } catch {
        // ignore
      }
    }
  }

  private sendToHost(msg: WireMessage) {
    safeSendWireMessage(this.session.hostConn, msg);
  }

  private sendToNetwork(msg: WireMessage, excludePeerId?: string) {
    if (this.session.isHostRole) {
      for (const [peerId, conn] of this.session.clientConnections.entries()) {
        if (peerId === excludePeerId) continue;
        safeSendWireMessage(conn, msg);
      }
    } else {
      this.sendToHost(msg);
    }
  }

  private dialHost() {
    dialHostPeer(this.session, this.fastSync, this.fastTransportCallbacks, {
      closeHostTransport: () => this.closeHostTransport(),
      scheduleHostRetry: (delayMs) => this.scheduleHostRetry(delayMs),
      onWireMessage: (msg, senderPeerId, conn) => this.handleWireMessage(msg, senderPeerId, conn),
    });
  }

  private handleWireMessage(msg: WireMessage, senderPeerId: string, conn?: DataConnection) {
    routeIncomingWireMessage(msg, senderPeerId, conn, {
      isHostRole: this.session.isHostRole,
      selfPeerId: this.session.selfPeerId,
      targetHostPeerId: this.session.targetHostPeerId,
      verifiedPeerIds: this.session.verifiedPeerIds,
      isInActiveBattle: this.session.isInActiveBattle,
      fastSync: this.fastSync,
      fastTransportCallbacks: this.fastTransportCallbacks,
      damageRateTracker: this.damageRateTracker,
      findMemberByPeerId,
      findMemberByIdOrPeer,
      getClientConnections: () => this.session.clientConnections.entries(),
      safeSend: safeSendWireMessage,
      sendToNetwork: (m, exclude) => this.sendToNetwork(m, exclude),
      onHostPacketReceived: () => {
        this.session.hasEverConnectedToHost = true;
        this.session.hostReconnectAttempts = 0;
        this.session.lastHostTrafficMs = performance.now();
        if (useNetworkStore.getState().hostSignalLost) {
          useNetworkStore.getState().resetHostSignal();
        }
      },
      nextRemoteBulletId: () => this.remoteBulletCounter++,
      getLastHandledLaunchId: () => this.lastHandledLaunchId,
      setLastHandledLaunchId: (id) => {
        this.lastHandledLaunchId = id;
      },
      enterActiveBattleFromMatchControl: () => {
        this.session.isInActiveBattle = true;
        this.fastSync.resetMatchCursors();
      },
      exitActiveBattleToStaging: () => {
        this.session.isInActiveBattle = false;
        this.fastSync.resetMatchCursors();
      },
      broadcastKillFeed: (evt) => this.broadcastKillFeed(evt),
      broadcastFlagEvent: (evt) => this.broadcastFlagEvent(evt),
      dropFlagHeldByPlayer: (playerId) =>
        dropFlagHeldByPlayer(playerId, this.session, this.fastSync),
      onStartMatch: this.onStartMatchCallback,
      onRematch: this.onRematchCallback,
      onReturnToStaging: this.onReturnToStagingCallback,
      onRejoinMatch: this.onRejoinMatchCallback,
    });
  }

  public connect(roomCode: string, isCreator: boolean = false) {
    const cleanRoomCode = roomCode.trim().toUpperCase();
    if (!cleanRoomCode) return;

    this.disconnect();
    this.resetProtocolBuffers();
    this.session.isConnectingOrDestroyed = false;
    this.session.isHostRole = isCreator;

    const hostPeerId = toHostPeerId(cleanRoomCode);
    this.session.targetHostPeerId = hostPeerId;

    const avatarStore = useAvatarStore.getState();
    const playerStore = usePlayerStore.getState();

    useNetworkStore.getState().setRoomCode(cleanRoomCode);
    useNetworkStore.getState().setConnected(false, null, isCreator);
    useNetworkStore.getState().setHostPeerId(hostPeerId);
    useNetworkStore.getState().setJoinRejected(false);
    useNetworkStore.getState().setGamePhase('staging');

    const selfMember: RosterMember = {
      playerId: avatarStore.playerId,
      peerId: isCreator ? hostPeerId : 'pending',
      slot: isCreator ? 0 : undefined,
      callsign: avatarStore.avatar.callsign,
      team: playerStore.player.team,
      avatar: avatarStore.avatar,
      isReady: true,
      isHost: isCreator,
      isOnline: true,
    };
    useNetworkStore.getState().upsertRosterMember(selfMember);

    engineWorld.setOnUrgentStateChange(() => {
      this.fastSync.handleUrgentLocalState(this.fastTransportCallbacks);
    });

    if (isCreator) {
      this.ctfUnsubscribe = useCTFStore.subscribe((state) => {
        if (!this.session.isHostRole || !this.session.isInActiveBattle) return;
        if (state.stateSeq > this.lastSyncedCtfSeq) {
          this.lastSyncedCtfSeq = state.stateSeq;
          this.broadcastMatchState(state.exportMatchState());
        }
      });
    }

    const peerConfig = {
      config: {
        iceServers: buildIceServers(),
        sdpSemantics: 'unified-plan',
      },
      debug: 1,
    };

    try {
      console.log(
        `[PeerJS] Initializing ${isCreator ? 'HOST' : 'CADET'} for room "${cleanRoomCode}" (hostId="${hostPeerId}")...`,
      );

      this.session.peer = isCreator ? new Peer(hostPeerId, peerConfig) : new Peer(peerConfig);

      this.session.peer.on('open', (assignedId: string) => {
        if (this.session.isConnectingOrDestroyed) return;
        console.log(`[PeerJS] Signaling open. Self Peer ID: "${assignedId}"`);
        this.session.selfPeerId = assignedId;

        useNetworkStore.getState().setConnected(true, assignedId, isCreator);
        useNetworkStore.getState().updateRosterMember(avatarStore.playerId, {
          peerId: assignedId,
          isOnline: true,
        });

        if (!isCreator) {
          this.dialHost();
        }
      });

      if (isCreator) {
        this.session.peer.on('connection', (conn: DataConnection) => {
          setupIncomingCadetConnection(
            conn,
            this.session,
            this.fastSync,
            this.fastTransportCallbacks,
            {
              sendToNetwork: (msg, exclude) => this.sendToNetwork(msg, exclude),
              onWireMessage: (msg, senderPeerId, c) => this.handleWireMessage(msg, senderPeerId, c),
            },
          );
        });
      }

      this.session.peer.on('disconnected', () => {
        console.warn('[PeerJS] Disconnected from signaling server. Attempting reconnect...');
        if (
          this.session.peer &&
          !this.session.peer.destroyed &&
          !this.session.isConnectingOrDestroyed
        ) {
          try {
            this.session.peer.reconnect();
          } catch {
            // ignore
          }
        }
      });

      this.session.peer.on('error', (err) => {
        console.warn(`[PeerJS] Peer error (${err.type}):`, err.message);
        if (!isCreator && err.type === 'peer-unavailable') {
          this.session.isDialingHost = false;
          this.session.hostReconnectAttempts += 1;
          useNetworkStore.getState().incrementHostReconnectAttempt();
          if (
            this.session.hasEverConnectedToHost ||
            this.session.hostReconnectAttempts >= 2 ||
            useNetworkStore.getState().isAuthApproved
          ) {
            useNetworkStore
              .getState()
              .setHostSignalLost(true, 'Room host is offline or session ended.');
          }
          this.scheduleHostRetry(1200);
        } else if (
          !isCreator &&
          (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')
        ) {
          if (
            !this.session.hostConn?.open &&
            (this.session.hasEverConnectedToHost || this.session.hostReconnectAttempts >= 2)
          ) {
            useNetworkStore
              .getState()
              .setHostSignalLost(true, 'Signaling relay interrupted while reaching host.');
          }
        } else if (isCreator && err.type === 'unavailable-id') {
          console.warn('[PeerJS] Room ID temporarily busy on server, retrying host bind...');
          this.retryHostDialTimer = globalThis.setTimeout(() => {
            if (
              !this.session.isConnectingOrDestroyed &&
              (!this.session.peer || this.session.peer.destroyed)
            ) {
              this.connect(cleanRoomCode, true);
            }
          }, 1500);
        }
      });

      this.fastTickInterval = globalThis.setInterval(() => {
        if (this.session.isInActiveBattle && useNetworkStore.getState().gamePhase === 'in_game') {
          this.fastSync.pumpNetworkTick(false, this.fastTransportCallbacks);
        }
      }, FAST_TICK_MS);

      this.beaconInterval = globalThis.setInterval(() => {
        publishHostBeacon(this.session);
      }, 1200);

      this.joinHeartbeatInterval = globalThis.setInterval(() => {
        evaluateCadetWatchdog(this.session, {
          closeHostTransport: () => this.closeHostTransport(),
          dialHost: () => this.dialHost(),
          scheduleHostRetry: (delayMs) => this.scheduleHostRetry(delayMs),
        });
      }, 1000);
    } catch (err) {
      console.error('[PeerJS] Failed to initialize PeerJS session:', err);
    }
  }

  public retryHostConnection() {
    if (this.session.isHostRole || this.session.isConnectingOrDestroyed) return;
    if (this.retryHostDialTimer) {
      clearTimeout(this.retryHostDialTimer);
      this.retryHostDialTimer = null;
    }
    if (this.session.peer && this.session.peer.disconnected && !this.session.peer.destroyed) {
      try {
        this.session.peer.reconnect();
      } catch {
        // ignore
      }
    }
    if (this.session.peer?.open && !this.session.hostConn?.open && !this.session.isDialingHost) {
      this.session.hostReconnectAttempts += 1;
      useNetworkStore.getState().incrementHostReconnectAttempt();
      this.dialHost();
    }
  }

  private scheduleHostRetry(delayMs: number) {
    if (this.session.isHostRole || this.session.isConnectingOrDestroyed) return;
    if (this.retryHostDialTimer) {
      clearTimeout(this.retryHostDialTimer);
    }
    this.retryHostDialTimer = globalThis.setTimeout(() => {
      this.retryHostDialTimer = null;
      if (
        !this.session.hostConn?.open &&
        this.session.peer?.open &&
        !this.session.isConnectingOrDestroyed
      ) {
        this.dialHost();
      }
    }, delayMs);
  }

  public notifyLocalStateChanged() {
    this.fastSync.handleUrgentLocalState(this.fastTransportCallbacks);
  }

  public broadcastShoot(event: ShootEvent) {
    sendShootEvent(
      this.session,
      (msg, exclude) => this.sendToNetwork(msg, exclude),
      () => this.fastSync.handleUrgentLocalState(this.fastTransportCallbacks),
      event,
    );
  }

  public broadcastDamage(event: DamageEvent) {
    sendDamageEvent(this.session, (msg, exclude) => this.sendToNetwork(msg, exclude), event);
  }

  public broadcastKillFeed(event: KillFeedEvent) {
    sendKillFeedEvent(this.session, (msg, exclude) => this.sendToNetwork(msg, exclude), event);
  }

  public broadcastFlagEvent(event: FlagSyncEvent) {
    sendFlagSyncEvent(this.session, (msg) => this.sendToHost(msg), event);
  }

  public broadcastMatchState(state: MatchSyncStatePayload) {
    if (!this.session.isHostRole) return;
    this.sendToNetwork({
      kind: 'match_state',
      senderId: this.session.selfPeerId || 'host',
      payload: state,
    });
  }

  public broadcastPickupCollected(pickupId: string, weaponType: PickupSyncEvent['weaponType']) {
    sendPickupCollectedEvent(
      this.session,
      (msg) => this.sendToHost(msg),
      (msg, exclude) => this.sendToNetwork(msg, exclude),
      pickupId,
      weaponType,
    );
  }

  public broadcastStationCollected(stationId: string, stationType: StationSyncEvent['stationType']) {
    sendStationCollectedEvent(
      this.session,
      (msg) => this.sendToHost(msg),
      (msg, exclude) => this.sendToNetwork(msg, exclude),
      stationId,
      stationType,
    );
  }

  public broadcastPeerMeta(meta: Partial<PeerInfo>) {
    sendPeerMetaUpdate(this.session, (msg, exclude) => this.sendToNetwork(msg, exclude), meta);
  }

  public broadcastTeamChange(newTeam: Team) {
    sendTeamChangeBroadcast(this.session, (msg, exclude) => this.sendToNetwork(msg, exclude), newTeam);
  }

  public broadcastReadyChange(isReady: boolean) {
    sendReadyChangeBroadcast(
      this.session,
      (msg, exclude) => this.sendToNetwork(msg, exclude),
      isReady,
    );
  }

  public broadcastMapChange(mapId: string) {
    sendMapChangeBroadcast(this.session, (msg, exclude) => this.sendToNetwork(msg, exclude), mapId);
  }

  public broadcastRulesChange(rules: MatchRulesConfig) {
    sendRulesChangeBroadcast(this.session, (msg, exclude) => this.sendToNetwork(msg, exclude), rules);
  }

  public requestRejoinSync() {
    if (this.session.isHostRole || !this.session.hostConn?.open) return;
    const myPlayerId = useAvatarStore.getState().playerId;
    this.sendToHost({
      kind: 'room_auth',
      senderId: this.session.selfPeerId || myPlayerId,
      payload: { type: 'rejoin_sync' },
    });
  }

  public setInActiveBattle(active: boolean) {
    this.session.isInActiveBattle = active;
    if (active) {
      this.lastSyncedCtfSeq = useCTFStore.getState().stateSeq;
      this.fastSync.resetMatchCursors();
      this.fastSync.clearHostSlots();
      this.damageRateTracker.clear();
    }
  }

  public notifyLeaveBattle() {
    this.session.isInActiveBattle = false;
    const myPlayerId = useAvatarStore.getState().playerId;
    this.sendToNetwork({
      kind: 'match_control',
      senderId: this.session.selfPeerId || myPlayerId,
      payload: {
        type: 'leave_battle',
        playerId: myPlayerId,
      },
    });
  }

  public broadcastStartMatch(mapId: string) {
    if (!this.session.isHostRole) {
      console.warn('[PeerJS] Only the room host has the ability to start the match');
      return;
    }
    if (this.startMatchRetryTimer) {
      clearTimeout(this.startMatchRetryTimer);
      this.startMatchRetryTimer = null;
    }

    const launchId = `launch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.currentLaunchId = launchId;
    this.session.isInActiveBattle = true;
    this.fastSync.clearHostSlots();
    this.fastSync.resetMatchCursors();
    this.damageRateTracker.clear();
    clearOptimisticClaims();
    useNetworkStore.getState().clearRemotePlayers();
    useNetworkStore.getState().setGamePhase('in_game');
    useNetworkStore.getState().setCurrentMapId(mapId);

    const rosterList = Object.values(useNetworkStore.getState().roster);
    const matchRules = useCTFStore.getState().matchRules;
    const msg: WireMessage = {
      kind: 'match_control',
      senderId: this.session.selfPeerId || 'host',
      payload: {
        type: 'start_match',
        launchId,
        mapId,
        matchRules,
        hostPeerId: this.session.selfPeerId || 'host',
        roster: rosterList,
      },
    };
    this.sendToNetwork(msg);
    this.startMatchRetryTimer = globalThis.setTimeout(() => {
      this.startMatchRetryTimer = null;
      if (
        !this.session.isHostRole ||
        !this.session.isInActiveBattle ||
        this.session.isConnectingOrDestroyed ||
        this.currentLaunchId !== launchId
      ) {
        return;
      }
      this.sendToNetwork(msg);
    }, 120);
  }

  public broadcastRematch(mapId: string) {
    if (!this.session.isHostRole) return;
    if (this.startMatchRetryTimer) {
      clearTimeout(this.startMatchRetryTimer);
      this.startMatchRetryTimer = null;
    }

    const launchId = `rematch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.currentLaunchId = launchId;
    this.session.isInActiveBattle = true;
    this.fastSync.resetMatchCursors();
    this.fastSync.clearHostSlots();
    this.damageRateTracker.clear();
    clearOptimisticClaims();
    useNetworkStore.getState().clearRemotePlayers();
    useNetworkStore.getState().setGamePhase('in_game');
    useNetworkStore.getState().setCurrentMapId(mapId);

    const matchRules = useCTFStore.getState().matchRules;
    this.sendToNetwork({
      kind: 'match_control',
      senderId: this.session.selfPeerId || 'host',
      payload: {
        type: 'rematch',
        launchId,
        mapId,
        matchRules,
        hostPeerId: this.session.selfPeerId || 'host',
      },
    });
  }

  public broadcastReturnToStaging() {
    if (!this.session.isHostRole) return;
    if (this.startMatchRetryTimer) {
      clearTimeout(this.startMatchRetryTimer);
      this.startMatchRetryTimer = null;
    }
    this.currentLaunchId = null;
    this.session.isInActiveBattle = false;
    this.fastSync.clearHostSlots();
    clearOptimisticClaims();
    useNetworkStore.getState().clearRemotePlayers();
    useNetworkStore.getState().setGamePhase('staging');
    this.sendToNetwork({
      kind: 'match_control',
      senderId: this.session.selfPeerId || 'host',
      payload: {
        type: 'return_to_staging',
        hostPeerId: this.session.selfPeerId || 'host',
      },
    });
  }

  public disconnect() {
    this.session.isConnectingOrDestroyed = true;
    this.session.isInActiveBattle = false;

    engineWorld.setOnUrgentStateChange(null);

    if (this.ctfUnsubscribe) {
      this.ctfUnsubscribe();
      this.ctfUnsubscribe = null;
    }

    if (this.fastTickInterval) {
      clearInterval(this.fastTickInterval);
      this.fastTickInterval = null;
    }
    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = null;
    }
    if (this.joinHeartbeatInterval) {
      clearInterval(this.joinHeartbeatInterval);
      this.joinHeartbeatInterval = null;
    }
    if (this.retryHostDialTimer) {
      clearTimeout(this.retryHostDialTimer);
      this.retryHostDialTimer = null;
    }
    if (this.startMatchRetryTimer) {
      clearTimeout(this.startMatchRetryTimer);
      this.startMatchRetryTimer = null;
    }

    this.fastSync.closeAllChannels();

    for (const conn of this.session.clientConnections.values()) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    this.session.clientConnections.clear();

    this.closeHostTransport();

    if (this.session.peer) {
      try {
        this.session.peer.destroy();
      } catch {
        // ignore
      }
      this.session.peer = null;
    }

    this.resetProtocolBuffers();
    this.session.selfPeerId = null;
    this.session.targetHostPeerId = null;
    this.session.isHostRole = false;
    useCTFStore.getState().resetMatchRules();
    useNetworkStore.getState().clearNetwork();
  }
}

export const networkManager = new PeerNetworkManager();
