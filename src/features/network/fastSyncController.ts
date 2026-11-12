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
import {
  FAST_BUFFER_HIGH_WATER,
  IDLE_HEARTBEAT_MS,
  KEYFRAME_INTERVAL_TICKS,
  URGENT_MIN_GAP_MS,
  type AuthoritativeActorPosition,
  type HostSlotState,
  type WireMessage,
} from './wireTypes';
import type { RosterMember } from './types';
import { useAvatarStore } from '../avatar/avatarStore';
import { useCombatStore } from '../combat/combatStore';
import { engineWorld } from '../game/engineWorld';
import { usePlayerStore } from '../player/playerStore';
import { useNetworkStore } from './networkStore';

export interface FastSyncTransportCallbacks {
  isDestroyed: () => boolean;
  isHostRole: () => boolean;
  isInActiveBattle: () => boolean;
  isVerifiedPeer: (peerId: string) => boolean;
  findMemberByPeerId: (peerId: string) => RosterMember | undefined;
  findMemberBySlot: (slot: number) => RosterMember | undefined;
  onHostPacketReceived: (nowMs: number) => void;
  sendFallbackToHost: (msg: WireMessage) => void;
  sendFallbackToClient: (peerId: string, msg: WireMessage) => void;
  getClientPeerIds: () => string[];
  getSelfPeerId: () => string | null;
}

export class FastSyncController {
  private clientFastChannels = new Map<string, RTCDataChannel>();
  private hostFastChannel: RTCDataChannel | null = null;

  private localSeq = 0;
  private hostTickSeq = 0;
  private hostTickCounter = 0;
  private lastClientSendMs = 0;
  private lastSentQuantized: QuantizedPlayerState | null = null;
  private lastFallbackRelayMs = 0;
  private hostWorldSlots = new Map<number, HostSlotState>();
  private dirtySlots = new Set<number>();
  private lastReceivedBatchSeq = 0;
  private lastReceivedBatchAtMs = 0;

  public reset() {
    this.localSeq = 0;
    this.hostTickSeq = 0;
    this.hostTickCounter = 0;
    this.lastClientSendMs = 0;
    this.lastSentQuantized = null;
    this.lastFallbackRelayMs = 0;
    this.hostWorldSlots.clear();
    this.dirtySlots.clear();
    this.lastReceivedBatchSeq = 0;
    this.lastReceivedBatchAtMs = 0;
  }

  public resetMatchCursors() {
    this.lastReceivedBatchAtMs = 0;
    this.lastReceivedBatchSeq = 0;
    this.lastSentQuantized = null;
  }

  public clearHostSlots() {
    this.hostWorldSlots.clear();
    this.dirtySlots.clear();
  }

  public clearDirtySlots() {
    this.dirtySlots.clear();
  }

  public removeSlot(slot: number) {
    this.hostWorldSlots.delete(slot);
    this.dirtySlots.delete(slot);
  }

  public closeHostFastChannel() {
    if (!this.hostFastChannel) return;
    try {
      this.hostFastChannel.close();
    } catch {
      // ignore
    }
    this.hostFastChannel = null;
  }

  public closeClientFastChannel(peerId: string) {
    const fastDc = this.clientFastChannels.get(peerId);
    if (!fastDc) return;
    try {
      fastDc.close();
    } catch {
      // ignore
    }
    this.clientFastChannels.delete(peerId);
  }

  public closeAllChannels() {
    for (const fastDc of this.clientFastChannels.values()) {
      try {
        fastDc.close();
      } catch {
        // ignore
      }
    }
    this.clientFastChannels.clear();
    this.closeHostFastChannel();
  }

  public getAuthoritativePosition(playerId: string): AuthoritativeActorPosition | undefined {
    for (const slot of this.hostWorldSlots.values()) {
      if (slot.playerId === playerId) {
        const unpacked = unpackQuantizedPlayerState(slot.quantized);
        return { x: unpacked.x, y: unpacked.y, isDead: unpacked.isDead };
      }
    }
    const rp = engineWorld.remotePlayers.get(playerId);
    if (rp) {
      return { x: rp.targetX, y: rp.targetY, isDead: rp.isDead };
    }
    return undefined;
  }

  public attachFastDataChannel(
    peerConnection: RTCPeerConnection | undefined,
    remotePeerId: string,
    isHostSide: boolean,
    cb: FastSyncTransportCallbacks,
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
        if (cb.isDestroyed()) {
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
        this.lastSentQuantized = null;
      };

      fastDc.onmessage = (evt: MessageEvent) => {
        if (cb.isDestroyed()) return;
        if (evt.data instanceof ArrayBuffer) {
          this.handleFastBinaryMessage(evt.data, remotePeerId, cb);
        } else if (evt.data instanceof Blob) {
          evt.data
            .arrayBuffer()
            .then((buf) => this.handleFastBinaryMessage(buf, remotePeerId, cb))
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

  public handleFastBinaryMessage(
    buf: ArrayBuffer,
    senderPeerId: string,
    cb: FastSyncTransportCallbacks,
  ) {
    if (!cb.isInActiveBattle()) return;

    if (cb.isHostRole()) {
      if (senderPeerId && !cb.isVerifiedPeer(senderPeerId)) return;
      const decoded = decodeClientState(buf);
      if (!decoded) return;
      this.ingestCadetFastState(senderPeerId, decoded.seq, decoded.quantized, cb);
      return;
    }

    cb.onHostPacketReceived(performance.now());
    const batch = decodeWorldBatch(buf);
    if (!batch) return;
    this.ingestWorldBatch(batch.tickSeq, batch.entries, cb);
  }

  public ingestCadetFastState(
    senderPeerId: string,
    seq: number,
    q: QuantizedPlayerState,
    cb: FastSyncTransportCallbacks,
  ) {
    const member = cb.findMemberByPeerId(senderPeerId);
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

  public ingestWorldBatch(
    tickSeq: number,
    entries: readonly WorldBatchEntry[],
    cb: FastSyncTransportCallbacks,
  ) {
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
      const member = cb.findMemberBySlot(entry.slot);
      if (!member || member.playerId === myPlayerId || !member.isOnline) continue;

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

  public handleUrgentLocalState(cb: FastSyncTransportCallbacks) {
    if (!cb.isInActiveBattle() || useNetworkStore.getState().gamePhase !== 'in_game') {
      return;
    }
    const now = performance.now();
    if (now - this.lastClientSendMs < URGENT_MIN_GAP_MS) {
      return;
    }
    this.pumpNetworkTick(true, cb);
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

  public pumpNetworkTick(forceEdge: boolean, cb: FastSyncTransportCallbacks) {
    const now = performance.now();
    const myPlayerId = useAvatarStore.getState().playerId;
    const q = this.sampleLocalQuantized();
    const { dirty } = hasSignificantQuantizedDelta(this.lastSentQuantized, q);
    const heartbeatDue = !forceEdge && now - this.lastClientSendMs >= IDLE_HEARTBEAT_MS;

    if (!cb.isHostRole()) {
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

      if (now - this.lastFallbackRelayMs >= 60) {
        this.lastFallbackRelayMs = now;
        cb.sendFallbackToHost({
          kind: 'fast_client_fb',
          senderId: cb.getSelfPeerId() || myPlayerId,
          payload: { seq: this.localSeq, q },
        });
      }
      return;
    }

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

    for (const peerId of cb.getClientPeerIds()) {
      const fastDc = this.clientFastChannels.get(peerId);
      if (fastDc && fastDc.readyState === 'open') {
        if (fastDc.bufferedAmount < FAST_BUFFER_HIGH_WATER) {
          try {
            fastDc.send(batchBuf);
          } catch {
            // ignore transient send error
          }
        }
      } else if (allowFallbackThisTick) {
        if (!fbMsg) {
          fbMsg = {
            kind: 'fast_batch_fb',
            senderId: cb.getSelfPeerId() || 'host',
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
        cb.sendFallbackToClient(peerId, fbMsg);
      }
    }
  }
}
