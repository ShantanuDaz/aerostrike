import Peer, { type DataConnection, util } from 'peerjs';
import type {
  DamageEvent,
  FlagSyncEvent,
  KillFeedEvent,
  PeerInfo,
  PlayerSnapshot,
  ShootEvent,
  RosterMember,
  AuthJoinRequest,
  AuthJoinResponse,
  HostBeaconEvent,
  MatchSyncStatePayload,
  PickupSyncEvent,
  StationSyncEvent,
} from './types';
import type { MatchRulesConfig, Team } from '../ctf/types';
import { useNetworkStore } from './networkStore';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { useMapStore } from '../map/mapStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { getSafeMuzzlePoint } from '../combat/updateBullets';
import { engineWorld } from '../game/engineWorld';
import {
  FAST_CHANNEL_ID,
  FAST_CHANNEL_LABEL,
  decodeClientState,
  decodeWorldBatch,
  encodeClientState,
  encodeWorldBatch,
  hasSignificantQuantizedDelta,
  isNewerSeq16,
  isNewerSeq8,
  quantizePlayerState,
  unpackQuantizedPlayerState,
  type HostBatchSourceEntry,
  type QuantizedPlayerState,
  type WorldBatchEntry,
} from './fastProtocol';

const HOST_PEER_PREFIX = 'aerostrikeomegav2';

const FAST_TICK_MS = 33; // ~30 Hz network update cadence
const KEYFRAME_INTERVAL_TICKS = 15; // Full dirty+clean keyframe ~every 500ms
const IDLE_HEARTBEAT_MS = 420; // ~2.4 Hz keepalive when completely stationary
const URGENT_MIN_GAP_MS = 14;
const FAST_BUFFER_HIGH_WATER = 65536;
const CADET_HOST_SILENCE_MS = 10000;
const DAMAGE_RATE_WINDOW_MS = 1000;
const MAX_DAMAGE_PACKETS_PER_SEC = 25;
const MAX_DAMAGE_PER_TARGET_PAIR_SEC = 220;

function toHostPeerId(roomCode: string): string {
  const alphanumeric = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${HOST_PEER_PREFIX}${alphanumeric}`;
}

function buildIceServers(): RTCIceServer[] {
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

type MatchControlPayload = {
  type: 'start_match' | 'return_to_staging' | 'leave_battle' | 'rematch';
  mapId?: string;
  matchRules?: MatchRulesConfig;
  hostPeerId?: string;
  playerId?: string;
  roster?: RosterMember[];
};

type RoomAuthPayload =
  | AuthJoinRequest
  | AuthJoinResponse
  | { type: 'roster_sync'; roster: RosterMember[] }
  | HostBeaconEvent;

type CompactFallbackBatchPayload = {
  tickSeq: number;
  entries: {
    slot: number;
    seq: number;
    q: QuantizedPlayerState;
  }[];
};

type CompactFallbackClientPayload = {
  seq: number;
  q: QuantizedPlayerState;
};

type WireMessage =
  | { kind: 'fast_client_fb'; senderId: string; payload: CompactFallbackClientPayload }
  | { kind: 'fast_batch_fb'; senderId: string; payload: CompactFallbackBatchPayload }
  | { kind: 'snapshot'; senderId: string; payload: PlayerSnapshot }
  | { kind: 'shoot'; senderId: string; payload: ShootEvent }
  | { kind: 'damage'; senderId: string; payload: DamageEvent }
  | { kind: 'kill_feed'; senderId: string; payload: KillFeedEvent }
  | { kind: 'flag'; senderId: string; payload: FlagSyncEvent }
  | { kind: 'match_state'; senderId: string; payload: MatchSyncStatePayload }
  | { kind: 'pickup_sync'; senderId: string; payload: PickupSyncEvent }
  | { kind: 'station_sync'; senderId: string; payload: StationSyncEvent }
  | { kind: 'peer_meta'; senderId: string; payload: Partial<PeerInfo> }
  | { kind: 'match_control'; senderId: string; payload: MatchControlPayload }
  | { kind: 'room_auth'; senderId: string; payload: RoomAuthPayload };

interface HostSlotState extends HostBatchSourceEntry {
  playerId: string;
  lastUpdatedMs: number;
}

export class PeerNetworkManager {
  private peer: Peer | null = null;
  private selfPeerId: string | null = null;
  private targetHostPeerId: string | null = null;
  private isHostRole = false;
  private isConnectingOrDestroyed = false;
  private isInActiveBattle = false;

  // Star topology reliable event channels:
  private clientConnections: Map<string, DataConnection> = new Map();
  private verifiedPeerIds: Set<string> = new Set();
  private hostConn: DataConnection | null = null;

  // Star topology unreliable/unordered binary fast DataChannels:
  private clientFastChannels: Map<string, RTCDataChannel> = new Map();
  private hostFastChannel: RTCDataChannel | null = null;

  private isDialingHost = false;
  private hasEverConnectedToHost = false;
  private hostReconnectAttempts = 0;
  private lastHostTrafficMs = 0;
  private lastCadetWatchdogTickMs = 0;

  // Host damage sanity tracking (rolling per-second caps)
  private damageBudgetByDealer: Map<string, { windowStartMs: number; packetCount: number }> = new Map();
  private damageBudgetByPair: Map<string, { windowStartMs: number; damageSum: number }> = new Map();

  // Fast protocol delta & host batching state
  private localSeq = 0;
  private hostTickSeq = 0;
  private hostTickCounter = 0;
  private lastClientSendMs = 0;
  private lastSentQuantized: QuantizedPlayerState | null = null;
  private lastFallbackRelayMs = 0;
  private hostWorldSlots: Map<number, HostSlotState> = new Map();
  private dirtySlots: Set<number> = new Set();
  private lastReceivedBatchSeq = 0;
  private lastReceivedBatchAtMs = 0;
  private remoteBulletCounter = 0;
  private lastBeaconInGamePingMs = 0;

  private ctfUnsubscribe: (() => void) | null = null;
  private lastSyncedCtfSeq = -1;

  private onStartMatchCallback: ((mapId: string) => void) | null = null;
  private onReturnToStagingCallback: (() => void) | null = null;
  private onRejoinMatchCallback: ((mapId: string, team?: Team) => void) | null = null;
  private onRematchCallback: ((mapId: string) => void) | null = null;

  private fastTickInterval: number | null = null;
  private beaconInterval: number | null = null;
  private joinHeartbeatInterval: number | null = null;
  private retryHostDialTimer: number | null = null;

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
    this.localSeq = 0;
    this.hostTickSeq = 0;
    this.hostTickCounter = 0;
    this.lastClientSendMs = 0;
    this.lastSentQuantized = null;
    this.lastFallbackRelayMs = 0;
    this.hostWorldSlots.clear();
    this.dirtySlots.clear();
    this.verifiedPeerIds.clear();
    this.lastReceivedBatchSeq = 0;
    this.lastReceivedBatchAtMs = 0;
    this.lastBeaconInGamePingMs = 0;
    this.lastSyncedCtfSeq = -1;
    this.hasEverConnectedToHost = false;
    this.hostReconnectAttempts = 0;
    this.lastHostTrafficMs = 0;
    this.lastCadetWatchdogTickMs = 0;
    this.damageBudgetByDealer.clear();
    this.damageBudgetByPair.clear();
  }

  public connect(roomCode: string, isCreator: boolean = false) {
    const cleanRoomCode = roomCode.trim().toUpperCase();
    if (!cleanRoomCode) return;

    this.disconnect();
    this.resetProtocolBuffers();
    this.isConnectingOrDestroyed = false;
    this.isHostRole = isCreator;

    const hostPeerId = toHostPeerId(cleanRoomCode);
    this.targetHostPeerId = hostPeerId;

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
      this.handleUrgentLocalState();
    });

    if (isCreator) {
      this.ctfUnsubscribe = useCTFStore.subscribe((state) => {
        if (!this.isHostRole || !this.isInActiveBattle) return;
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

      this.peer = isCreator ? new Peer(hostPeerId, peerConfig) : new Peer(peerConfig);

      this.peer.on('open', (assignedId: string) => {
        if (this.isConnectingOrDestroyed) return;
        console.log(`[PeerJS] Signaling open. Self Peer ID: "${assignedId}"`);
        this.selfPeerId = assignedId;

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
        this.peer.on('connection', (conn: DataConnection) => {
          this.handleIncomingCadetConnection(conn);
        });
      }

      this.peer.on('disconnected', () => {
        console.warn('[PeerJS] Disconnected from signaling server. Attempting reconnect...');
        if (this.peer && !this.peer.destroyed && !this.isConnectingOrDestroyed) {
          try {
            this.peer.reconnect();
          } catch {
            // ignore
          }
        }
      });

      this.peer.on('error', (err) => {
        console.warn(`[PeerJS] Peer error (${err.type}):`, err.message);
        if (!isCreator && err.type === 'peer-unavailable') {
          this.isDialingHost = false;
          this.hostReconnectAttempts += 1;
          useNetworkStore.getState().incrementHostReconnectAttempt();
          if (
            this.hasEverConnectedToHost ||
            this.hostReconnectAttempts >= 2 ||
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
          if (!this.hostConn?.open && (this.hasEverConnectedToHost || this.hostReconnectAttempts >= 2)) {
            useNetworkStore
              .getState()
              .setHostSignalLost(true, 'Signaling relay interrupted while reaching host.');
          }
        } else if (isCreator && err.type === 'unavailable-id') {
          console.warn('[PeerJS] Room ID temporarily busy on server, retrying host bind...');
          this.retryHostDialTimer = window.setTimeout(() => {
            if (!this.isConnectingOrDestroyed && (!this.peer || this.peer.destroyed)) {
              this.connect(cleanRoomCode, true);
            }
          }, 1500);
        }
      });

      // 30 Hz low-latency delta + host batch sync loop
      this.fastTickInterval = window.setInterval(() => {
        if (this.isInActiveBattle && useNetworkStore.getState().gamePhase === 'in_game') {
          this.pumpNetworkTick(false);
        }
      }, FAST_TICK_MS);

      // Staging lobby beacon (1.2s in staging; lightweight ~3.6s keepalive in-game)
      this.beaconInterval = window.setInterval(() => {
        if (!this.isHostRole || !this.peer || this.peer.destroyed) return;
        const currentPhase = useNetworkStore.getState().gamePhase;
        const now = performance.now();

        if (currentPhase === 'in_game') {
          if (now - this.lastBeaconInGamePingMs < 3200) return;
          this.lastBeaconInGamePingMs = now;
        }

        const currentMap = useMapStore.getState().selectedMap;
        const currentRoster = Object.values(useNetworkStore.getState().roster);
        const ctfState = useCTFStore.getState();
        const exportedCtf = currentPhase === 'in_game' ? ctfState.exportMatchState() : null;

        const beacon: HostBeaconEvent = {
          type: 'host_beacon',
          hostPeerId: this.selfPeerId || hostPeerId,
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
          senderId: this.selfPeerId || 'host',
          payload: beacon,
        };
        for (const [peerId, conn] of this.clientConnections.entries()) {
          if (currentPhase !== 'staging' && !this.verifiedPeerIds.has(peerId)) {
            continue;
          }
          this.safeSend(conn, beaconMsg);
        }
      }, 1200);

      // Cadet join, reconnect & host-liveness watchdog
      this.joinHeartbeatInterval = window.setInterval(() => {
        if (this.isHostRole || this.isConnectingOrDestroyed) return;
        const netState = useNetworkStore.getState();
        const now = performance.now();

        // Guard against browser background throttling triggering false silence alarms
        if (
          this.lastCadetWatchdogTickMs > 0 &&
          now - this.lastCadetWatchdogTickMs > 4500 &&
          this.lastHostTrafficMs > 0
        ) {
          this.lastHostTrafficMs = now;
        }
        this.lastCadetWatchdogTickMs = now;

        const iceState = this.hostConn?.peerConnection?.iceConnectionState;
        const connState = this.hostConn?.peerConnection?.connectionState;
        const webrtcDead =
          iceState === 'failed' ||
          iceState === 'closed' ||
          connState === 'failed' ||
          connState === 'closed';

        if (!this.hostConn || !this.hostConn.open || webrtcDead) {
          if (webrtcDead && this.hostConn) {
            try {
              this.hostConn.close();
            } catch {
              // ignore
            }
            this.hostConn = null;
            this.isDialingHost = false;
          }
          if (this.hasEverConnectedToHost || netState.isAuthApproved) {
            netState.setHostSignalLost(true, 'Host signal lost. Attempting P2P reconnect...');
          }
          if (this.peer?.open && !this.isDialingHost) {
            this.hostReconnectAttempts += 1;
            netState.incrementHostReconnectAttempt();
            this.dialHost();
          }
          return;
        }

        if (
          this.hasEverConnectedToHost &&
          this.lastHostTrafficMs > 0 &&
          now - this.lastHostTrafficMs > CADET_HOST_SILENCE_MS
        ) {
          console.warn('[PeerJS] Host watchdog timed out (>10s without host packets). Retrying...');
          netState.setHostSignalLost(true, 'Host stopped responding. Attempting P2P reconnect...');
          const staleConn = this.hostConn;
          this.hostConn = null;
          this.isDialingHost = false;
          try {
            staleConn.close();
          } catch {
            // ignore
          }
          if (this.targetHostPeerId) {
            netState.removePeer(this.targetHostPeerId);
          }
          this.hostReconnectAttempts += 1;
          netState.incrementHostReconnectAttempt();
          this.scheduleHostRetry(500);
          return;
        }

        if (!netState.isAuthApproved && !netState.isJoinRejected) {
          this.sendJoinRequest();
        }
      }, 1000);
    } catch (err) {
      console.error('[PeerJS] Failed to initialize PeerJS session:', err);
    }
  }

  private attachFastDataChannel(
    peerConnection: RTCPeerConnection | undefined,
    remotePeerId: string,
    isHostSide: boolean,
  ) {
    if (!peerConnection || typeof peerConnection.createDataChannel !== 'function') {
      return;
    }

    try {
      const existing = isHostSide
        ? this.clientFastChannels.get(remotePeerId)
        : this.hostFastChannel;
      if (existing && existing.readyState !== 'closed') {
        try {
          existing.close();
        } catch {
          // ignore
        }
      }

      const fastDc = peerConnection.createDataChannel(FAST_CHANNEL_LABEL, {
        ordered: false,
        maxRetransmits: 0,
        negotiated: true,
        id: FAST_CHANNEL_ID,
      });
      fastDc.binaryType = 'arraybuffer';

      fastDc.onopen = () => {
        if (this.isConnectingOrDestroyed) {
          try {
            fastDc.close();
          } catch {
            // ignore
          }
          return;
        }
        if (isHostSide) {
          this.clientFastChannels.set(remotePeerId, fastDc);
        } else {
          this.hostFastChannel = fastDc;
        }
        // Reset delta cursor so first packet over newly opened fast DC always transmits immediately
        this.lastSentQuantized = null;
      };

      fastDc.onmessage = (evt: MessageEvent) => {
        if (this.isConnectingOrDestroyed) return;
        if (evt.data instanceof ArrayBuffer) {
          this.handleFastBinaryMessage(evt.data, remotePeerId);
        } else if (evt.data instanceof Blob) {
          evt.data
            .arrayBuffer()
            .then((buf) => this.handleFastBinaryMessage(buf, remotePeerId))
            .catch(() => {});
        }
      };

      fastDc.onclose = () => {
        if (isHostSide) {
          if (this.clientFastChannels.get(remotePeerId) === fastDc) {
            this.clientFastChannels.delete(remotePeerId);
          }
        } else if (this.hostFastChannel === fastDc) {
          this.hostFastChannel = null;
        }
      };

      fastDc.onerror = () => {
        // Fallback path handles closed fast channels seamlessly
      };

      if (isHostSide) {
        this.clientFastChannels.set(remotePeerId, fastDc);
      } else {
        this.hostFastChannel = fastDc;
      }
    } catch (err) {
      console.warn('[FastDC] Could not open unreliable binary channel, using fallback:', err);
    }
  }

  private handleFastBinaryMessage(buf: ArrayBuffer, senderPeerId: string) {
    if (!this.isInActiveBattle) return;

    if (this.isHostRole) {
      if (senderPeerId && !this.verifiedPeerIds.has(senderPeerId)) return;
      const decoded = decodeClientState(buf);
      if (!decoded) return;
      this.ingestCadetFastState(senderPeerId, decoded.seq, decoded.quantized);
      return;
    }

    this.lastHostTrafficMs = performance.now();
    if (useNetworkStore.getState().hostSignalLost) {
      useNetworkStore.getState().resetHostSignal();
    }

    const batch = decodeWorldBatch(buf);
    if (!batch) return;
    this.ingestWorldBatch(batch.tickSeq, batch.entries);
  }

  private findMemberByPeerId(peerId: string): RosterMember | undefined {
    const roster = useNetworkStore.getState().roster;
    for (const member of Object.values(roster)) {
      if (member.peerId === peerId) return member;
    }
    return undefined;
  }

  private findMemberBySlot(slot: number): RosterMember | undefined {
    const roster = useNetworkStore.getState().roster;
    for (const member of Object.values(roster)) {
      if (member.slot === slot) return member;
    }
    return undefined;
  }

  private findMemberByIdOrPeer(id: string): RosterMember | undefined {
    const roster = useNetworkStore.getState().roster;
    if (roster[id]) return roster[id];
    for (const member of Object.values(roster)) {
      if (member.peerId === id || member.playerId === id) return member;
    }
    return undefined;
  }

  private ingestCadetFastState(
    senderPeerId: string,
    seq: number,
    q: QuantizedPlayerState,
  ) {
    const member = this.findMemberByPeerId(senderPeerId);
    if (!member) return;

    const slot = typeof member.slot === 'number' ? member.slot : 1;
    const nowMs = performance.now();
    const prev = this.hostWorldSlots.get(slot);

    if (
      prev &&
      nowMs - prev.lastUpdatedMs < 550 &&
      seq !== prev.seq &&
      !isNewerSeq8(seq, prev.seq)
    ) {
      return;
    }

    this.hostWorldSlots.set(slot, {
      slot,
      playerId: member.playerId,
      seq,
      quantized: q,
      lastUpdatedMs: nowMs,
    });
    this.dirtySlots.add(slot);

    // Update Host's local engineWorld immediately so Host renders this cadet smoothly
    const unpacked = unpackQuantizedPlayerState(q);
    engineWorld.upsertRemoteTransform(
      {
        id: member.playerId,
        slot,
        avatar: member.avatar,
        ...unpacked,
        seq,
      },
      nowMs,
    );
  }

  private ingestWorldBatch(tickSeq: number, entries: readonly WorldBatchEntry[]) {
    const nowMs = performance.now();
    if (
      nowMs - this.lastReceivedBatchAtMs < 600 &&
      this.lastReceivedBatchAtMs > 0 &&
      tickSeq !== this.lastReceivedBatchSeq &&
      !isNewerSeq16(tickSeq, this.lastReceivedBatchSeq)
    ) {
      return;
    }
    this.lastReceivedBatchSeq = tickSeq;
    this.lastReceivedBatchAtMs = nowMs;

    const myPlayerId = useAvatarStore.getState().playerId;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const member = this.findMemberBySlot(entry.slot);
      if (!member) continue;
      if (member.playerId === myPlayerId) continue;

      engineWorld.upsertRemoteTransform(
        {
          id: member.playerId,
          slot: entry.slot,
          avatar: member.avatar,
          ...entry.state,
          seq: entry.seq,
        },
        nowMs,
      );
    }
  }

  private handleUrgentLocalState() {
    if (!this.isInActiveBattle || useNetworkStore.getState().gamePhase !== 'in_game') {
      return;
    }
    const now = performance.now();
    if (now - this.lastClientSendMs < URGENT_MIN_GAP_MS) {
      return;
    }
    this.pumpNetworkTick(true);
  }

  private sampleLocalQuantized(): QuantizedPlayerState {
    const player = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    const input = usePlayerStore.getState().input;
    const equippedWeapon = useCombatStore.getState().equippedWeapon;

    return quantizePlayerState({
      team: player.team,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      aimAngle: player.aimAngle,
      health: player.health,
      isInvulnerable: player.invulnerableTimer > 0,
      isBoosting:
        input.boosting &&
        !player.fuelOverheated &&
        player.boostFuel > 0 &&
        !player.isDead,
      isDead: player.isDead,
      carryingFlag: player.carryingFlag,
      isGrounded: Boolean(player.isGrounded),
      weaponType: equippedWeapon,
    });
  }

  private pumpNetworkTick(forceEdge: boolean) {
    const now = performance.now();
    const myPlayerId = useAvatarStore.getState().playerId;
    const q = this.sampleLocalQuantized();
    const { dirty } = hasSignificantQuantizedDelta(this.lastSentQuantized, q);
    const heartbeatDue = !forceEdge && now - this.lastClientSendMs >= IDLE_HEARTBEAT_MS;

    if (!this.isHostRole) {
      if (!dirty && !heartbeatDue) return;

      this.localSeq = (this.localSeq + 1) & 0xff;
      this.lastSentQuantized = q;
      this.lastClientSendMs = now;

      const fastDc = this.hostFastChannel;
      if (fastDc && fastDc.readyState === 'open') {
        if (fastDc.bufferedAmount < FAST_BUFFER_HIGH_WATER) {
          try {
            fastDc.send(encodeClientState(this.localSeq, q));
          } catch {
            // ignore transient WebRTC send errors
          }
        }
        return;
      }

      // Fallback ONLY when unreliable native DC isn't open yet
      if (now - this.lastFallbackRelayMs >= 60) {
        this.lastFallbackRelayMs = now;
        this.sendToHost({
          kind: 'fast_client_fb',
          senderId: this.selfPeerId || myPlayerId,
          payload: { seq: this.localSeq, q },
        });
      }
      return;
    }

    // --- HOST STAR-AGGREGATION ---
    const selfMember = useNetworkStore.getState().roster[myPlayerId];
    const hostSlot = typeof selfMember?.slot === 'number' ? selfMember.slot : 0;

    if (dirty || heartbeatDue || !this.hostWorldSlots.has(hostSlot)) {
      this.localSeq = (this.localSeq + 1) & 0xff;
      this.lastSentQuantized = q;
      this.lastClientSendMs = now;
      this.hostWorldSlots.set(hostSlot, {
        slot: hostSlot,
        playerId: myPlayerId,
        seq: this.localSeq,
        quantized: q,
        lastUpdatedMs: now,
      });
      this.dirtySlots.add(hostSlot);
    }

    if (forceEdge && !dirty) return;

    this.hostTickCounter++;
    const sendKeyframe = this.hostTickCounter % KEYFRAME_INTERVAL_TICKS === 0;

    let batchEntries: HostBatchSourceEntry[];
    if (sendKeyframe) {
      batchEntries = Array.from(this.hostWorldSlots.values());
    } else if (this.dirtySlots.size > 0) {
      batchEntries = [];
      for (const slot of this.dirtySlots) {
        const entry = this.hostWorldSlots.get(slot);
        if (entry) batchEntries.push(entry);
      }
    } else {
      return;
    }

    this.dirtySlots.clear();
    if (batchEntries.length === 0) return;

    this.hostTickSeq = (this.hostTickSeq + 1) & 0xffff;
    const batchBuf = encodeWorldBatch(this.hostTickSeq, batchEntries);

    const allowFallbackThisTick = now - this.lastFallbackRelayMs >= 65;
    if (allowFallbackThisTick) {
      this.lastFallbackRelayMs = now;
    }

    let fbMsg: WireMessage | null = null;

    for (const [peerId, conn] of this.clientConnections.entries()) {
      const fastDc = this.clientFastChannels.get(peerId);
      if (fastDc && fastDc.readyState === 'open') {
        if (fastDc.bufferedAmount < FAST_BUFFER_HIGH_WATER) {
          try {
            fastDc.send(batchBuf);
          } catch {
            // ignore transient send error
          }
        }
      } else if (allowFallbackThisTick && conn.open) {
        if (!fbMsg) {
          fbMsg = {
            kind: 'fast_batch_fb',
            senderId: this.selfPeerId || 'host',
            payload: {
              tickSeq: this.hostTickSeq,
              entries: batchEntries.map((e) => ({
                slot: e.slot,
                seq: e.seq,
                q: e.quantized,
              })),
            },
          };
        }
        this.safeSend(conn, fbMsg);
      }
    }
  }

  public retryHostConnection() {
    if (this.isHostRole || this.isConnectingOrDestroyed) return;
    if (this.retryHostDialTimer) {
      clearTimeout(this.retryHostDialTimer);
      this.retryHostDialTimer = null;
    }
    if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
      try {
        this.peer.reconnect();
      } catch {
        // ignore
      }
    }
    if (this.peer?.open && !this.hostConn?.open && !this.isDialingHost) {
      this.hostReconnectAttempts += 1;
      useNetworkStore.getState().incrementHostReconnectAttempt();
      this.dialHost();
    }
  }

  private scheduleHostRetry(delayMs: number) {
    if (this.isHostRole || this.isConnectingOrDestroyed) return;
    if (this.retryHostDialTimer) {
      clearTimeout(this.retryHostDialTimer);
    }
    this.retryHostDialTimer = window.setTimeout(() => {
      this.retryHostDialTimer = null;
      if (!this.hostConn?.open && this.peer?.open && !this.isConnectingOrDestroyed) {
        this.dialHost();
      }
    }, delayMs);
  }

  private dialHost() {
    if (!this.peer || this.peer.destroyed || !this.targetHostPeerId || this.isHostRole) return;
    if (this.hostConn?.open || this.isDialingHost) return;

    this.isDialingHost = true;
    console.log(`[PeerJS] Cadet dialing Host "${this.targetHostPeerId}"...`);

    const conn = this.peer.connect(this.targetHostPeerId, {
      reliable: true,
      serialization: 'json',
    });
    if (!conn) {
      this.isDialingHost = false;
      this.hostReconnectAttempts += 1;
      useNetworkStore.getState().incrementHostReconnectAttempt();
      if (this.hasEverConnectedToHost || this.hostReconnectAttempts >= 2) {
        useNetworkStore
          .getState()
          .setHostSignalLost(true, 'Unable to open P2P channel to squad host.');
      }
      this.scheduleHostRetry(1000);
      return;
    }
    this.hostConn = conn;

    let openTimeout: number | null = window.setTimeout(() => {
      if (this.hostConn !== conn) return;
      if (!conn.open) {
        console.warn('[PeerJS] DataConnection open timed out, retrying dial...');
        this.isDialingHost = false;
        this.hostConn = null;
        this.hostReconnectAttempts += 1;
        useNetworkStore.getState().incrementHostReconnectAttempt();
        if (
          this.hasEverConnectedToHost ||
          this.hostReconnectAttempts >= 2 ||
          useNetworkStore.getState().isAuthApproved
        ) {
          useNetworkStore
            .getState()
            .setHostSignalLost(true, 'Host connection timed out. Retrying P2P uplink...');
        }
        try {
          conn.close();
        } catch {
          // ignore
        }
        this.scheduleHostRetry(800);
      }
    }, 5000);

    const onOpen = () => {
      if (this.hostConn !== conn) return;
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      this.isDialingHost = false;
      this.hasEverConnectedToHost = true;
      this.hostReconnectAttempts = 0;
      this.lastHostTrafficMs = performance.now();
      useNetworkStore.getState().resetHostSignal();
      console.log(`[PeerJS] Connected directly to Host "${this.targetHostPeerId}"!`);

      const hostId = this.targetHostPeerId!;
      this.attachFastDataChannel(conn.peerConnection, hostId, false);
      useNetworkStore.getState().addPeer(hostId, { isHost: true });

      const currentAvatar = useAvatarStore.getState();
      const localPlayer = usePlayerStore.getState().player;

      this.sendToHost({
        kind: 'peer_meta',
        senderId: this.selfPeerId || currentAvatar.playerId,
        payload: {
          callsign: currentAvatar.avatar.callsign,
          team: localPlayer.team,
          isReady: true,
          isHost: false,
        },
      });

      this.sendJoinRequest();
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (raw: unknown) => {
      if (this.hostConn !== conn) return;
      this.handleWireMessage(raw as WireMessage, conn.peer, conn);
    });

    conn.on('close', () => {
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      if (this.hostConn !== conn) return;
      this.isDialingHost = false;
      this.hostConn = null;
      if (this.hostFastChannel) {
        try {
          this.hostFastChannel.close();
        } catch {
          // ignore
        }
        this.hostFastChannel = null;
      }
      console.warn('[PeerJS] Host DataConnection closed.');
      if (this.targetHostPeerId) {
        useNetworkStore.getState().removePeer(this.targetHostPeerId);
      }
      if (!this.isConnectingOrDestroyed) {
        if (this.hasEverConnectedToHost || useNetworkStore.getState().isAuthApproved) {
          useNetworkStore
            .getState()
            .setHostSignalLost(true, 'Connection to squad host dropped.');
        }
        this.scheduleHostRetry(1000);
      }
    });

    conn.on('error', (err) => {
      if (this.hostConn !== conn) return;
      console.warn('[PeerJS] Host DataConnection error:', err);
      this.isDialingHost = false;
    });
  }

  private handleIncomingCadetConnection(conn: DataConnection) {
    const remotePeerId = conn.peer;
    console.log(`[PeerJS] Host received incoming connection from Cadet "${remotePeerId}"`);

    const onOpen = () => {
      console.log(`[PeerJS] DataChannel OPEN with Cadet "${remotePeerId}"`);
      this.clientConnections.set(remotePeerId, conn);
      this.attachFastDataChannel(conn.peerConnection, remotePeerId, true);
      useNetworkStore.getState().addPeer(remotePeerId, {});

      const currentAvatar = useAvatarStore.getState();
      const localPlayer = usePlayerStore.getState().player;
      const currentRoster = Object.values(useNetworkStore.getState().roster);
      const currentPhase = useNetworkStore.getState().gamePhase;
      const currentMap = useMapStore.getState().selectedMap;

      if (currentPhase !== 'staging') {
        // Wait for join_request verification before exposing roster/state during a live match
        return;
      }

      this.safeSend(conn, {
        kind: 'peer_meta',
        senderId: this.selfPeerId || 'host',
        payload: {
          callsign: currentAvatar.avatar.callsign,
          team: localPlayer.team,
          isReady: true,
          isHost: true,
        },
      });

      this.safeSend(conn, {
        kind: 'room_auth',
        senderId: this.selfPeerId || 'host',
        payload: {
          type: 'roster_sync',
          roster: currentRoster,
        },
      });

      this.safeSend(conn, {
        kind: 'room_auth',
        senderId: this.selfPeerId || 'host',
        payload: {
          type: 'host_beacon',
          hostPeerId: this.selfPeerId || 'host',
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
      this.handleWireMessage(raw as WireMessage, remotePeerId, conn);
    });

    conn.on('close', () => {
      console.log(`[PeerJS] Cadet "${remotePeerId}" disconnected.`);
      this.clientConnections.delete(remotePeerId);
      this.verifiedPeerIds.delete(remotePeerId);

      const fastDc = this.clientFastChannels.get(remotePeerId);
      if (fastDc) {
        try {
          fastDc.close();
        } catch {
          // ignore
        }
        this.clientFastChannels.delete(remotePeerId);
      }

      const disconnectedMember = this.findMemberByPeerId(remotePeerId);
      if (disconnectedMember) {
        if (typeof disconnectedMember.slot === 'number') {
          this.hostWorldSlots.delete(disconnectedMember.slot);
          this.dirtySlots.delete(disconnectedMember.slot);
        }
        this.dropFlagHeldByPlayer(disconnectedMember.playerId);
      }

      useNetworkStore.getState().removePeer(remotePeerId);
      useNetworkStore.getState().updateRosterMember(remotePeerId, { isOnline: false });

      if (this.isHostRole) {
        const updatedRoster = Object.values(useNetworkStore.getState().roster);
        this.sendToNetwork({
          kind: 'room_auth',
          senderId: this.selfPeerId || 'host',
          payload: { type: 'roster_sync', roster: updatedRoster },
        });
      }
    });

    conn.on('error', (err) => {
      console.warn(`[PeerJS] Cadet connection error (${remotePeerId}):`, err);
    });
  }

  private dropFlagHeldByPlayer(playerId: string) {
    if (!this.isHostRole || !this.isInActiveBattle) return;
    const ctf = useCTFStore.getState();
    for (const team of ['blue', 'red'] as Team[]) {
      const flag = ctf.flags[team];
      if (flag.status === 'carried' && flag.carrierId === playerId) {
        const lastRemote = engineWorld.remotePlayers.get(playerId);
        const dropX = lastRemote ? lastRemote.targetX : flag.baseX;
        const dropY = lastRemote ? lastRemote.targetY : flag.baseY;
        ctf.dropFlag(team, dropX, dropY);
      }
    }
  }

  private safeSend(conn: DataConnection | null, msg: WireMessage) {
    if (!conn || !conn.open) return;
    try {
      conn.send(msg);
    } catch (err) {
      console.warn('[PeerJS] Send failed:', err);
    }
  }

  private sendToHost(msg: WireMessage) {
    this.safeSend(this.hostConn, msg);
  }

  private sendToNetwork(msg: WireMessage, excludePeerId?: string) {
    if (this.isHostRole) {
      for (const [peerId, conn] of this.clientConnections.entries()) {
        if (peerId === excludePeerId) continue;
        this.safeSend(conn, msg);
      }
    } else {
      this.sendToHost(msg);
    }
  }

  private sendJoinRequest() {
    const currentAvatar = useAvatarStore.getState();
    const localPlayer = usePlayerStore.getState().player;
    const joinReq: AuthJoinRequest = {
      type: 'join_request',
      playerId: currentAvatar.playerId,
      callsign: currentAvatar.avatar.callsign,
      team: localPlayer.team,
      avatar: currentAvatar.avatar,
    };
    this.sendToHost({
      kind: 'room_auth',
      senderId: this.selfPeerId || currentAvatar.playerId,
      payload: joinReq,
    });
  }

  private isValidIncomingDamage(payload: unknown, senderPeerId: string): payload is DamageEvent {
    if (!this.isInActiveBattle || useNetworkStore.getState().gamePhase !== 'in_game') {
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

    const senderMember = senderPeerId ? this.findMemberByPeerId(senderPeerId) : undefined;
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

    let maxSingleHit = 100;
    if (evt.weaponType !== undefined) {
      const weaponCfg = WEAPONS[evt.weaponType];
      if (!weaponCfg) {
        console.warn(
          `[Host Security] Dropped damage with unknown weaponType="${String(evt.weaponType)}"`,
        );
        return false;
      }
      maxSingleHit =
        evt.weaponType === 'rocket'
          ? Math.round(weaponCfg.damage) + 2
          : Math.round(weaponCfg.damage * 1.3) + 2;
    }

    if (evt.damage > maxSingleHit) {
      console.warn(
        `[Host Security] Dropped excessive damage=${evt.damage} (cap=${maxSingleHit}) from ${canonicalDealerId}`,
      );
      return false;
    }

    const targetMember = this.findMemberByIdOrPeer(evt.targetId);
    const canonicalTargetId = targetMember?.playerId || evt.targetId;
    if (
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

    const localPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    const myPlayerId = useAvatarStore.getState().playerId;
    const targetIsHost =
      evt.targetId === myPlayerId ||
      evt.targetId === this.selfPeerId ||
      evt.targetId === localPlayer.id ||
      canonicalTargetId === myPlayerId;

    if (targetIsHost) {
      if (localPlayer.isDead || localPlayer.invulnerableTimer > 0) {
        return false;
      }
    } else {
      const remoteTarget =
        engineWorld.remotePlayers.get(evt.targetId) ??
        engineWorld.remotePlayers.get(canonicalTargetId);
      if (remoteTarget && (remoteTarget.isDead || remoteTarget.isInvulnerable)) {
        return false;
      }
    }

    const nowMs = performance.now();
    const dealerBudget = this.damageBudgetByDealer.get(canonicalDealerId);
    if (!dealerBudget || nowMs - dealerBudget.windowStartMs >= DAMAGE_RATE_WINDOW_MS) {
      this.damageBudgetByDealer.set(canonicalDealerId, {
        windowStartMs: nowMs,
        packetCount: 1,
      });
    } else {
      if (dealerBudget.packetCount + 1 > MAX_DAMAGE_PACKETS_PER_SEC) {
        console.warn(`[Host Security] Rate-limited damage flood from ${canonicalDealerId}`);
        return false;
      }
      dealerBudget.packetCount += 1;
    }

    const pairKey = `${canonicalDealerId}->${canonicalTargetId}`;
    const pairBudget = this.damageBudgetByPair.get(pairKey);
    if (!pairBudget || nowMs - pairBudget.windowStartMs >= DAMAGE_RATE_WINDOW_MS) {
      this.damageBudgetByPair.set(pairKey, {
        windowStartMs: nowMs,
        damageSum: evt.damage,
      });
    } else {
      if (pairBudget.damageSum + evt.damage > MAX_DAMAGE_PER_TARGET_PAIR_SEC) {
        console.warn(
          `[Host Security] Throttled excessive DPS (${pairBudget.damageSum + evt.damage} HP/s) for ${pairKey}`,
        );
        return false;
      }
      pairBudget.damageSum += evt.damage;
    }

    return true;
  }

  private handleWireMessage(msg: WireMessage, senderPeerId: string, conn?: DataConnection) {
    if (!msg || typeof msg !== 'object' || !msg.kind) return;

    if (!this.isHostRole) {
      this.hasEverConnectedToHost = true;
      this.hostReconnectAttempts = 0;
      this.lastHostTrafficMs = performance.now();
      if (useNetworkStore.getState().hostSignalLost) {
        useNetworkStore.getState().resetHostSignal();
      }
    }

    if (
      this.isHostRole &&
      senderPeerId &&
      !this.verifiedPeerIds.has(senderPeerId) &&
      msg.kind !== 'room_auth' &&
      msg.kind !== 'peer_meta'
    ) {
      return;
    }

    // Validate incoming damage on Host BEFORE relaying or applying
    if (msg.kind === 'damage') {
      if (this.isHostRole) {
        if (!this.isValidIncomingDamage(msg.payload, senderPeerId)) {
          return;
        }
        this.sendToNetwork(msg, senderPeerId);
      }
    } else if (
      this.isHostRole &&
      (msg.kind === 'shoot' ||
        msg.kind === 'kill_feed' ||
        (msg.kind === 'match_control' && msg.payload.type === 'leave_battle'))
    ) {
      // Host relays shoot, kill_feed & leave_battle events (flags/pickups handled authoritatively below)
      this.sendToNetwork(msg, senderPeerId);
    }

    switch (msg.kind) {
      case 'fast_client_fb': {
        if (!this.isHostRole || !this.isInActiveBattle) return;
        this.ingestCadetFastState(senderPeerId, msg.payload.seq, msg.payload.q);
        break;
      }

      case 'fast_batch_fb': {
        if (this.isHostRole || !this.isInActiveBattle) return;
        const unpackedEntries: WorldBatchEntry[] = msg.payload.entries.map((e) => ({
          slot: e.slot,
          seq: e.seq,
          quantized: e.q,
          state: unpackQuantizedPlayerState(e.q),
        }));
        this.ingestWorldBatch(msg.payload.tickSeq, unpackedEntries);
        break;
      }

      case 'snapshot': {
        const snap = msg.payload;
        if (this.isHostRole) {
          this.sendToNetwork(msg, senderPeerId);
        }
        engineWorld.upsertRemoteTransform({
          id: snap.id,
          team: snap.team,
          avatar: snap.avatar,
          x: snap.x,
          y: snap.y,
          vx: snap.vx,
          vy: snap.vy,
          aimAngle: snap.aimAngle,
          health: snap.health,
          isInvulnerable: Boolean(snap.isInvulnerable),
          isBoosting: snap.isBoosting,
          isDead: snap.isDead,
          carryingFlag: snap.carryingFlag,
          isGrounded: Boolean(snap.isGrounded),
          weaponType: snap.weaponType ?? 'rifle',
        });
        break;
      }

      case 'shoot': {
        const shoot = msg.payload;
        const config = WEAPONS[shoot.weaponType];
        if (!config) return;

        const muzzle = getSafeMuzzlePoint(
          shoot.originX,
          shoot.originY,
          shoot.aimAngle,
          18,
          useMapStore.getState().selectedMap,
        );

        const newBullets = [];
        const spreadHalf = config.spread / 2;

        for (let i = 0; i < config.pellets; i++) {
          const angleOffset =
            config.pellets > 1
              ? -spreadHalf + (config.spread * i) / (config.pellets - 1)
              : 0;

          const bulletAngle = shoot.aimAngle + angleOffset;
          const speed = config.speed;

          newBullets.push({
            id: `rb_${shoot.shooterId}_${this.remoteBulletCounter++}_${i}`,
            shooterId: shoot.shooterId,
            team: shoot.team,
            weaponType: shoot.weaponType,
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(bulletAngle) * speed,
            vy: Math.sin(bulletAngle) * speed,
            damage: config.damage,
            blastRadius: config.blastRadius,
            lifespan: config.blastRadius > 0 ? 80 : 50,
            maxLifespan: config.blastRadius > 0 ? 80 : 50,
          });
        }
        engineWorld.addBullets(newBullets);
        break;
      }

      case 'damage': {
        const damageEvt = msg.payload;
        if (
          !damageEvt ||
          !Number.isFinite(damageEvt.damage) ||
          damageEvt.damage <= 0 ||
          damageEvt.damage > 130
        ) {
          break;
        }
        const localPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
        const myPlayerId = useAvatarStore.getState().playerId;

        if (
          damageEvt.targetId === myPlayerId ||
          damageEvt.targetId === this.selfPeerId ||
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
            const killerMember = this.findMemberByIdOrPeer(damageEvt.dealerId);
            const killerRemote = engineWorld.remotePlayers.get(damageEvt.dealerId);
            const isSelf =
              damageEvt.dealerId === myPlayerId ||
              damageEvt.dealerId === this.selfPeerId ||
              damageEvt.dealerId === localPlayer.id;
            const killerTeam: Team =
              killerMember?.team ??
              killerRemote?.team ??
              (localPlayer.team === 'blue' ? 'red' : 'blue');

            this.broadcastKillFeed({
              id: `kill_${myPlayerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              killerId: isSelf ? myPlayerId : killerMember?.playerId || damageEvt.dealerId,
              killerCallsign: isSelf
                ? localPlayer.avatar.callsign
                : killerMember?.callsign || killerRemote?.avatar.callsign || 'PILOT',
              killerTeam: isSelf ? localPlayer.team : killerTeam,
              victimId: myPlayerId,
              victimCallsign: localPlayer.avatar.callsign,
              victimTeam: localPlayer.team,
              weaponType: isSelf ? 'self' : damageEvt.weaponType ?? 'rifle',
            });
          }

          if (wasKilled && carryingBefore) {
            const enemyTeam = localPlayer.team === 'blue' ? 'red' : 'blue';
            const updatedLocal = engineWorld.localPlayer ?? localPlayer;
            if (!this.isHostRole) {
              this.broadcastFlagEvent({
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
        break;
      }

      case 'kill_feed': {
        useMatchStatsStore.getState().recordKill(msg.payload);
        break;
      }

      case 'flag': {
        if (!this.isHostRole) break;
        const flagEvt = msg.payload;
        const senderMember = this.findMemberByPeerId(senderPeerId);
        const actorId = flagEvt.carrierId || senderMember?.playerId || senderPeerId;
        const ctf = useCTFStore.getState();

        switch (flagEvt.action) {
          case 'pickup': {
            ctf.pickupFlag(flagEvt.team, actorId);
            break;
          }
          case 'drop': {
            if (flagEvt.x !== undefined && flagEvt.y !== undefined) {
              const currentFlag = ctf.flags[flagEvt.team];
              if (
                currentFlag.status === 'carried' &&
                (!currentFlag.carrierId || currentFlag.carrierId === actorId)
              ) {
                ctf.dropFlag(flagEvt.team, flagEvt.x, flagEvt.y);
              }
            }
            break;
          }
          case 'return': {
            ctf.returnFlag(flagEvt.team);
            break;
          }
          case 'capture': {
            const enemyTeam = flagEvt.team === 'blue' ? 'red' : 'blue';
            const enemyFlag = ctf.flags[enemyTeam];
            if (
              enemyFlag.status === 'carried' &&
              enemyFlag.carrierId === actorId &&
              ctf.flags[flagEvt.team].status === 'at_base'
            ) {
              ctf.captureFlag(flagEvt.team, senderMember?.callsign || 'Pilot', actorId);
            }
            break;
          }
        }
        break;
      }

      case 'match_state': {
        if (this.isHostRole) break;
        useCTFStore.getState().applyAuthoritativeState(msg.payload);
        this.syncLocalCarrierFlagFromCTF(msg.payload);
        break;
      }

      case 'pickup_sync': {
        const evt = msg.payload;
        if (this.isHostRole && evt.action === 'claim') {
          if (!engineWorld.isPickupAvailable(evt.pickupId)) {
            break;
          }
          engineWorld.markPickupTaken(evt.pickupId, 20);
          this.sendToNetwork(
            {
              kind: 'pickup_sync',
              senderId: this.selfPeerId || 'host',
              payload: {
                action: 'taken',
                pickupId: evt.pickupId,
                playerId: evt.playerId,
                weaponType: evt.weaponType,
              },
            },
            senderPeerId,
          );
        } else if (!this.isHostRole && evt.action === 'taken') {
          engineWorld.markPickupTaken(evt.pickupId, 20);
        }
        break;
      }

      case 'station_sync': {
        const evt = msg.payload;
        if (this.isHostRole && evt.action === 'claim') {
          if (!engineWorld.isStationAvailable(evt.stationId)) {
            break;
          }
          engineWorld.markStationTaken(evt.stationId);
          this.sendToNetwork(
            {
              kind: 'station_sync',
              senderId: this.selfPeerId || 'host',
              payload: {
                action: 'taken',
                stationId: evt.stationId,
                playerId: evt.playerId,
                stationType: evt.stationType,
              },
            },
            senderPeerId,
          );
        } else if (!this.isHostRole && evt.action === 'taken') {
          engineWorld.markStationTaken(evt.stationId);
        }
        break;
      }

      case 'peer_meta': {
        const meta = msg.payload;
        if (senderPeerId) {
          useNetworkStore.getState().updatePeer(senderPeerId, meta);
        }
        if (senderPeerId || meta.callsign) {
          useNetworkStore.getState().updateRosterMember(senderPeerId || meta.callsign!, {
            team: meta.team,
            isReady: meta.isReady,
            isHost: meta.isHost,
            isOnline: true,
          });
        }
        if (
          this.isHostRole &&
          (useNetworkStore.getState().gamePhase === 'staging' ||
            this.verifiedPeerIds.has(senderPeerId))
        ) {
          const updatedRoster = Object.values(useNetworkStore.getState().roster);
          this.sendToNetwork({
            kind: 'room_auth',
            senderId: this.selfPeerId || 'host',
            payload: { type: 'roster_sync', roster: updatedRoster },
          });
        }
        break;
      }

      case 'match_control': {
        const evt = msg.payload;
        if (evt.type === 'start_match' && evt.mapId) {
          console.log('[PeerJS] Received start_match from host:', evt);
          const wasInGame = useNetworkStore.getState().gamePhase === 'in_game';
          if (!wasInGame) {
            useNetworkStore.getState().clearRemotePlayers();
            useCTFStore.getState().resetSequence();
          }
          if (evt.matchRules) {
            useCTFStore.getState().setMatchRules(evt.matchRules);
          }
          useMapStore.getState().selectMap(evt.mapId);
          useNetworkStore.getState().setCurrentMapId(evt.mapId);
          useNetworkStore.getState().setGamePhase('in_game');
          if (evt.roster) {
            useNetworkStore.getState().setRoster(evt.roster);
          }
          this.isInActiveBattle = true;
          this.lastReceivedBatchAtMs = 0;
          this.lastReceivedBatchSeq = 0;
          this.lastSentQuantized = null;
          this.onStartMatchCallback?.(evt.mapId);
        } else if (evt.type === 'rematch' && evt.mapId) {
          if (evt.matchRules) {
            useCTFStore.getState().setMatchRules(evt.matchRules);
          }
          useMapStore.getState().selectMap(evt.mapId);
          useNetworkStore.getState().setCurrentMapId(evt.mapId);
          this.lastSentQuantized = null;
          this.onRematchCallback?.(evt.mapId);
        } else if (evt.type === 'return_to_staging') {
          console.log('[PeerJS] Host signaled return_to_staging');
          this.isInActiveBattle = false;
          useNetworkStore.getState().clearRemotePlayers();
          useNetworkStore.getState().setGamePhase('staging');
          this.onReturnToStagingCallback?.();
        } else if (evt.type === 'leave_battle' && evt.playerId) {
          if (this.isHostRole) {
            const member = this.findMemberByIdOrPeer(evt.playerId);
            if (member && typeof member.slot === 'number') {
              this.hostWorldSlots.delete(member.slot);
              this.dirtySlots.delete(member.slot);
            }
            this.dropFlagHeldByPlayer(evt.playerId);
          }
          useNetworkStore.getState().removeRemotePlayer(evt.playerId);
        }
        break;
      }

      case 'room_auth': {
        this.handleRoomAuthMessage(msg.payload, senderPeerId, conn);
        break;
      }
    }
  }

  private syncLocalCarrierFlagFromCTF(payload: MatchSyncStatePayload) {
    const myPlayerId = useAvatarStore.getState().playerId;
    const localPlayer = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    const enemyTeam: Team = localPlayer.team === 'blue' ? 'red' : 'blue';
    const enemyFlag = payload.flags[enemyTeam];
    const shouldCarry =
      enemyFlag.status === 'carried' &&
      (enemyFlag.carrierId === myPlayerId || enemyFlag.carrierId === localPlayer.id);

    if (localPlayer.carryingFlag !== shouldCarry && !localPlayer.isDead) {
      const updated = { ...localPlayer, carryingFlag: shouldCarry };
      usePlayerStore.getState().setPlayer(updated);
      engineWorld.notifyUrgentLocalStateChange();
    }
  }

  private handleRoomAuthMessage(
    payload: RoomAuthPayload,
    senderPeerId: string,
    conn?: DataConnection,
  ) {
    if (payload.type === 'join_request') {
      if (!this.isHostRole) return;
      const req = payload;

      const currentPhase = useNetworkStore.getState().gamePhase;
      const currentRoster = useNetworkStore.getState().roster;
      const selectedMap = useMapStore.getState().selectedMap;

      if (currentPhase === 'staging') {
        console.log(`[Host Authority] Approving cadet ${req.callsign} (${req.playerId}) for Staging`);
        if (senderPeerId) {
          this.verifiedPeerIds.add(senderPeerId);
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
          hostPeerId: this.selfPeerId || 'host',
        };

        if (conn) {
          this.safeSend(conn, {
            kind: 'room_auth',
            senderId: this.selfPeerId || 'host',
            payload: response,
          });
        }
        this.sendToNetwork({
          kind: 'room_auth',
          senderId: this.selfPeerId || 'host',
          payload: { type: 'roster_sync', roster: allMembers },
        });
      } else {
        const existingMember = currentRoster[req.playerId];

        if (existingMember) {
          console.log(`[Host Authority] Re-admitting verified cadet ${req.callsign} into live match`);
          if (senderPeerId) {
            this.verifiedPeerIds.add(senderPeerId);
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
            hostPeerId: this.selfPeerId || 'host',
            matchState: useCTFStore.getState().exportMatchState(),
            pickupCooldowns: engineWorld.exportPickupCooldowns(),
            stationCooldowns: engineWorld.exportStationCooldowns(),
          };
          if (conn) {
            this.safeSend(conn, {
              kind: 'room_auth',
              senderId: this.selfPeerId || 'host',
              payload: response,
            });
          }
          const rosterMsg: WireMessage = {
            kind: 'room_auth',
            senderId: this.selfPeerId || 'host',
            payload: { type: 'roster_sync', roster: allMembers },
          };
          for (const [peerId, clientConn] of this.clientConnections.entries()) {
            if (this.verifiedPeerIds.has(peerId)) {
              this.safeSend(clientConn, rosterMsg);
            }
          }
        } else {
          if (senderPeerId) {
            this.verifiedPeerIds.delete(senderPeerId);
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
            this.safeSend(conn, {
              kind: 'room_auth',
              senderId: this.selfPeerId || 'host',
              payload: response,
            });
          }
        }
      }
    } else if (payload.type === 'join_response') {
      const res = payload;
      console.log('[PeerJS] Received join_response from host:', res);

      if (!res.accepted) {
        useNetworkStore.getState().setJoinRejected(true, res.reason);
        return;
      }

      useNetworkStore.getState().setJoinRejected(false);
      useNetworkStore.getState().setIsAuthApproved(true);
      if (res.hostPeerId) {
        useNetworkStore.getState().setHostPeerId(res.hostPeerId);
      }
      if (res.mapId) {
        useNetworkStore.getState().setCurrentMapId(res.mapId);
        useMapStore.getState().selectMap(res.mapId);
      }
      if (res.matchRules && !this.isHostRole) {
        useCTFStore.getState().setMatchRules(res.matchRules);
      }
      if (res.roster && res.roster.length > 0) {
        useNetworkStore.getState().setRoster(res.roster);
      }
      if (res.team) {
        usePlayerStore.getState().setTeam(res.team);
      }
      if (res.gamePhase) {
        useNetworkStore.getState().setGamePhase(res.gamePhase);
      }

      if (res.gamePhase === 'in_game') {
        console.log('[PeerJS] Rejoining live match on map:', res.mapId);
        this.isInActiveBattle = true;
        this.lastReceivedBatchAtMs = 0;
        this.lastReceivedBatchSeq = 0;
        this.lastSentQuantized = null;
        this.onRejoinMatchCallback?.(res.mapId || 'ctf-canyon-arena', res.team);
        if (res.pickupCooldowns) {
          engineWorld.applyPickupCooldowns(res.pickupCooldowns);
        }
        if (res.stationCooldowns) {
          engineWorld.applyStationCooldowns(res.stationCooldowns);
        }
        if (res.matchState) {
          useCTFStore.getState().applyAuthoritativeState(res.matchState, true);
          this.syncLocalCarrierFlagFromCTF(res.matchState);
        }
      }
    } else if (payload.type === 'roster_sync') {
      if (payload.roster && payload.roster.length > 0) {
        useNetworkStore.getState().setRoster(payload.roster);
        if (useNetworkStore.getState().gamePhase === 'in_game') {
          const stats = useMatchStatsStore.getState();
          for (const member of payload.roster) {
            stats.registerParticipant(member.playerId, member.callsign, member.team);
          }
        }
      }
    } else if (payload.type === 'host_beacon') {
      const beacon = payload;
      useNetworkStore.getState().setHostPeerId(beacon.hostPeerId);
      if (beacon.mapId) {
        useNetworkStore.getState().setCurrentMapId(beacon.mapId);
        if (!this.isHostRole) {
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

      if (!this.isHostRole && beacon.matchRules) {
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
        this.isInActiveBattle = true;
        this.lastReceivedBatchAtMs = 0;
        this.lastReceivedBatchSeq = 0;
        this.lastSentQuantized = null;
        useNetworkStore.getState().clearRemotePlayers();
        useCTFStore.getState().resetSequence();
        this.onStartMatchCallback?.(beacon.mapId || 'ctf-canyon-arena');
        if (!this.isHostRole && typeof beacon.timeRemainingSec === 'number') {
          useCTFStore
            .getState()
            .syncClockFromHost(beacon.matchRules, beacon.timeRemainingSec, beacon.isOvertime);
        }
      }
    }
  }

  public notifyLocalStateChanged() {
    this.handleUrgentLocalState();
  }

  public broadcastShoot(event: ShootEvent) {
    const myPlayerId = useAvatarStore.getState().playerId;
    this.sendToNetwork({
      kind: 'shoot',
      senderId: this.selfPeerId || myPlayerId,
      payload: {
        ...event,
        shooterId: myPlayerId,
      },
    });
    this.handleUrgentLocalState();
  }

  public broadcastDamage(event: DamageEvent) {
    const myPlayerId = useAvatarStore.getState().playerId;
    this.sendToNetwork({
      kind: 'damage',
      senderId: this.selfPeerId || myPlayerId,
      payload: {
        ...event,
        dealerId: myPlayerId,
      },
    });
  }

  public broadcastKillFeed(event: KillFeedEvent) {
    useMatchStatsStore.getState().recordKill(event);
    if (!this.peer || this.peer.destroyed) return;
    const myPlayerId = useAvatarStore.getState().playerId;
    this.sendToNetwork({
      kind: 'kill_feed',
      senderId: this.selfPeerId || myPlayerId,
      payload: event,
    });
  }

  public broadcastFlagEvent(event: FlagSyncEvent) {
    const myPlayerId = useAvatarStore.getState().playerId;
    const resolvedCarrierId = event.carrierId ? myPlayerId : undefined;
    if (this.isHostRole) {
      // Host is canonical; subscription handles broadcasting authoritative match_state
      return;
    }
    this.sendToHost({
      kind: 'flag',
      senderId: this.selfPeerId || myPlayerId,
      payload: resolvedCarrierId ? { ...event, carrierId: resolvedCarrierId } : event,
    });
  }

  public broadcastMatchState(state: MatchSyncStatePayload) {
    if (!this.isHostRole) return;
    this.sendToNetwork({
      kind: 'match_state',
      senderId: this.selfPeerId || 'host',
      payload: state,
    });
  }

  public broadcastPickupCollected(pickupId: string, weaponType: PickupSyncEvent['weaponType']) {
    const myPlayerId = useAvatarStore.getState().playerId;
    if (this.isHostRole) {
      this.sendToNetwork({
        kind: 'pickup_sync',
        senderId: this.selfPeerId || 'host',
        payload: {
          action: 'taken',
          pickupId,
          playerId: myPlayerId,
          weaponType,
        },
      });
    } else {
      this.sendToHost({
        kind: 'pickup_sync',
        senderId: this.selfPeerId || myPlayerId,
        payload: {
          action: 'claim',
          pickupId,
          playerId: myPlayerId,
          weaponType,
        },
      });
    }
  }

  public broadcastStationCollected(stationId: string, stationType: StationSyncEvent['stationType']) {
    const myPlayerId = useAvatarStore.getState().playerId;
    if (this.isHostRole) {
      this.sendToNetwork({
        kind: 'station_sync',
        senderId: this.selfPeerId || 'host',
        payload: {
          action: 'taken',
          stationId,
          playerId: myPlayerId,
          stationType,
        },
      });
    } else {
      this.sendToHost({
        kind: 'station_sync',
        senderId: this.selfPeerId || myPlayerId,
        payload: {
          action: 'claim',
          stationId,
          playerId: myPlayerId,
          stationType,
        },
      });
    }
  }

  public broadcastPeerMeta(meta: Partial<PeerInfo>) {
    this.sendToNetwork({
      kind: 'peer_meta',
      senderId: this.selfPeerId || 'local',
      payload: {
        ...meta,
        isHost: this.isHostRole,
      },
    });
  }

  public broadcastTeamChange(newTeam: Team) {
    const avatarStore = useAvatarStore.getState();
    useNetworkStore.getState().updateRosterMember(avatarStore.playerId, { team: newTeam });

    const meta = {
      callsign: avatarStore.avatar.callsign,
      team: newTeam,
      isReady: true,
      isHost: this.isHostRole,
    };
    this.sendToNetwork({
      kind: 'peer_meta',
      senderId: this.selfPeerId || avatarStore.playerId,
      payload: meta,
    });

    if (this.isHostRole) {
      this.sendToNetwork({
        kind: 'room_auth',
        senderId: this.selfPeerId || 'host',
        payload: {
          type: 'roster_sync',
          roster: Object.values(useNetworkStore.getState().roster),
        },
      });
    }
  }

  public broadcastReadyChange(isReady: boolean) {
    const avatarStore = useAvatarStore.getState();
    const playerStore = usePlayerStore.getState();
    useNetworkStore.getState().updateRosterMember(avatarStore.playerId, { isReady });

    const meta = {
      callsign: avatarStore.avatar.callsign,
      team: playerStore.player.team,
      isReady,
      isHost: this.isHostRole,
    };
    this.sendToNetwork({
      kind: 'peer_meta',
      senderId: this.selfPeerId || avatarStore.playerId,
      payload: meta,
    });

    if (this.isHostRole) {
      this.sendToNetwork({
        kind: 'room_auth',
        senderId: this.selfPeerId || 'host',
        payload: {
          type: 'roster_sync',
          roster: Object.values(useNetworkStore.getState().roster),
        },
      });
    }
  }

  public broadcastMapChange(mapId: string) {
    if (!this.isHostRole) return;
    useNetworkStore.getState().setCurrentMapId(mapId);
    if (!this.peer || this.peer.destroyed) return;

    const currentPhase = useNetworkStore.getState().gamePhase;
    const currentRoster = Object.values(useNetworkStore.getState().roster);
    const beacon: HostBeaconEvent = {
      type: 'host_beacon',
      hostPeerId: this.selfPeerId || 'host',
      gamePhase: currentPhase,
      mapId,
      matchRules: useCTFStore.getState().matchRules,
      totalPlayers: currentRoster.length,
      roster: currentRoster,
    };
    this.sendToNetwork({
      kind: 'room_auth',
      senderId: this.selfPeerId || 'host',
      payload: beacon,
    });
  }

  public broadcastRulesChange(rules: MatchRulesConfig) {
    if (!this.isHostRole) return;
    if (!this.peer || this.peer.destroyed) return;

    const currentPhase = useNetworkStore.getState().gamePhase;
    const currentMap = useMapStore.getState().selectedMap;
    const currentRoster = Object.values(useNetworkStore.getState().roster);
    const beacon: HostBeaconEvent = {
      type: 'host_beacon',
      hostPeerId: this.selfPeerId || 'host',
      gamePhase: currentPhase,
      mapId: currentMap.id,
      matchRules: rules,
      totalPlayers: currentRoster.length,
      roster: currentRoster,
    };
    this.sendToNetwork({
      kind: 'room_auth',
      senderId: this.selfPeerId || 'host',
      payload: beacon,
    });
  }

  public setInActiveBattle(active: boolean) {
    this.isInActiveBattle = active;
    if (active) {
      this.lastSyncedCtfSeq = useCTFStore.getState().stateSeq;
      this.lastSentQuantized = null;
      this.hostWorldSlots.clear();
      this.dirtySlots.clear();
      this.damageBudgetByDealer.clear();
      this.damageBudgetByPair.clear();
    }
  }

  public notifyLeaveBattle() {
    this.isInActiveBattle = false;
    const myPlayerId = useAvatarStore.getState().playerId;
    this.sendToNetwork({
      kind: 'match_control',
      senderId: this.selfPeerId || myPlayerId,
      payload: {
        type: 'leave_battle',
        playerId: myPlayerId,
      },
    });
  }

  public broadcastStartMatch(mapId: string) {
    if (!this.isHostRole) {
      console.warn('[PeerJS] Only the room host has the ability to start the match');
      return;
    }
    this.isInActiveBattle = true;
    this.hostWorldSlots.clear();
    this.dirtySlots.clear();
    this.damageBudgetByDealer.clear();
    this.damageBudgetByPair.clear();
    this.lastSentQuantized = null;
    useNetworkStore.getState().clearRemotePlayers();
    useNetworkStore.getState().setGamePhase('in_game');
    useNetworkStore.getState().setCurrentMapId(mapId);

    const rosterList = Object.values(useNetworkStore.getState().roster);
    const matchRules = useCTFStore.getState().matchRules;
    const msg: WireMessage = {
      kind: 'match_control',
      senderId: this.selfPeerId || 'host',
      payload: {
        type: 'start_match',
        mapId,
        matchRules,
        hostPeerId: this.selfPeerId || 'host',
        roster: rosterList,
      },
    };
    this.sendToNetwork(msg);
    setTimeout(() => this.sendToNetwork(msg), 120);
  }

  public broadcastRematch(mapId: string) {
    if (!this.isHostRole) return;
    this.lastSentQuantized = null;
    this.dirtySlots.clear();
    this.damageBudgetByDealer.clear();
    this.damageBudgetByPair.clear();
    const matchRules = useCTFStore.getState().matchRules;
    this.sendToNetwork({
      kind: 'match_control',
      senderId: this.selfPeerId || 'host',
      payload: {
        type: 'rematch',
        mapId,
        matchRules,
        hostPeerId: this.selfPeerId || 'host',
      },
    });
  }

  public broadcastReturnToStaging() {
    if (!this.isHostRole) return;
    this.isInActiveBattle = false;
    this.hostWorldSlots.clear();
    this.dirtySlots.clear();
    useNetworkStore.getState().setGamePhase('staging');
    this.sendToNetwork({
      kind: 'match_control',
      senderId: this.selfPeerId || 'host',
      payload: {
        type: 'return_to_staging',
        hostPeerId: this.selfPeerId || 'host',
      },
    });
  }

  public disconnect() {
    this.isConnectingOrDestroyed = true;
    this.isDialingHost = false;
    this.isInActiveBattle = false;

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

    for (const fastDc of this.clientFastChannels.values()) {
      try {
        fastDc.close();
      } catch {
        // ignore
      }
    }
    this.clientFastChannels.clear();

    if (this.hostFastChannel) {
      try {
        this.hostFastChannel.close();
      } catch {
        // ignore
      }
      this.hostFastChannel = null;
    }

    for (const conn of this.clientConnections.values()) {
      try {
        conn.close();
      } catch {
        // ignore
      }
    }
    this.clientConnections.clear();

    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {
        // ignore
      }
      this.hostConn = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }

    this.resetProtocolBuffers();
    this.selfPeerId = null;
    this.targetHostPeerId = null;
    this.isHostRole = false;
    useCTFStore.getState().resetMatchRules();
    useNetworkStore.getState().clearNetwork();
  }
}

export const networkManager = new PeerNetworkManager();
