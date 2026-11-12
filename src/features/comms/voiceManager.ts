import type Peer from 'peerjs';
import type { MediaConnection } from 'peerjs';
import type { RosterMember } from '../network/types';
import { useNetworkStore } from '../network/networkStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { useVoiceStore } from './voiceStore';

export interface VoiceTransportBridge {
  getPeer: () => Peer | null;
  getSelfPeerId: () => string | null;
  isRoomConnected: () => boolean;
  broadcastVoiceState: (micEnabled: boolean) => void;
}

interface RemoteAudioEntry {
  playerId: string;
  peerId: string;
  call: MediaConnection;
  stream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  fftBins: Uint8Array<ArrayBuffer> | null;
}

const VAD_POLL_MS = 110;
const VAD_SPEAKING_THRESHOLD = 14;
const VAD_HOLD_FRAMES = 3;

export class VoiceManager {
  private bridge: VoiceTransportBridge | null = null;

  private localStream: MediaStream | null = null;
  private localAudioCtx: AudioContext | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localFftBins: Uint8Array<ArrayBuffer> | null = null;
  private localHoldCounter = 0;

  // Outgoing calls: targetPeerId -> MediaConnection
  private outgoingCalls = new Map<string, MediaConnection>();
  // Incoming calls: senderPlayerId -> RemoteAudioEntry
  private incomingByPlayerId = new Map<string, RemoteAudioEntry>();
  private remoteHoldCounters = new Map<string, number>();

  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private voiceVolume = 90;
  private voiceMuted = false;

  public attachBridge(bridge: VoiceTransportBridge) {
    this.bridge = bridge;
  }

  public applyVoiceSettings(opts: { voiceVolume?: number; voiceMuted?: boolean }) {
    if (typeof opts.voiceVolume === 'number') {
      this.voiceVolume = Math.max(0, Math.min(100, opts.voiceVolume));
    }
    if (typeof opts.voiceMuted === 'boolean') {
      this.voiceMuted = opts.voiceMuted;
    }
    this.refreshRemoteAudioVolumes();
  }

  public refreshRemoteAudioVolumes() {
    const mutedMap = useVoiceStore.getState().mutedPlayerIds;
    const baseVolume = this.voiceMuted ? 0 : this.voiceVolume / 100;

    for (const entry of this.incomingByPlayerId.values()) {
      if (!entry.audioEl) continue;
      const peerMuted = Boolean(mutedMap[entry.playerId]);
      entry.audioEl.muted = this.voiceMuted || peerMuted;
      entry.audioEl.volume = peerMuted ? 0 : baseVolume;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.localAudioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.localAudioCtx = new Ctx();
    }
    if (this.localAudioCtx.state === 'suspended') {
      void this.localAudioCtx.resume().catch(() => {});
    }
    return this.localAudioCtx;
  }

  private ensureVadTimer() {
    if (this.vadInterval) return;
    this.vadInterval = globalThis.setInterval(() => this.sampleVoiceActivity(), VAD_POLL_MS);
  }

  private stopVadTimerIfIdle() {
    if (!this.localAnalyser && this.incomingByPlayerId.size === 0 && this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
  }

  private computeAverageLevel(analyser: AnalyserNode, bins: Uint8Array<ArrayBuffer>): number {
    analyser.getByteFrequencyData(bins);
    let sum = 0;
    const count = Math.min(bins.length, 32);
    for (let i = 0; i < count; i++) {
      sum += bins[i];
    }
    return count > 0 ? sum / count : 0;
  }

  private sampleVoiceActivity() {
    const store = useVoiceStore.getState();

    if (this.localAnalyser && this.localFftBins && store.micEnabled) {
      const level = this.computeAverageLevel(this.localAnalyser, this.localFftBins);
      if (level >= VAD_SPEAKING_THRESHOLD) {
        this.localHoldCounter = VAD_HOLD_FRAMES;
        store.setLocalSpeaking(true);
      } else if (this.localHoldCounter > 0) {
        this.localHoldCounter -= 1;
        if (this.localHoldCounter === 0) {
          store.setLocalSpeaking(false);
        }
      } else {
        store.setLocalSpeaking(false);
      }
    } else if (store.isLocalSpeaking) {
      this.localHoldCounter = 0;
      store.setLocalSpeaking(false);
    }

    for (const [playerId, entry] of this.incomingByPlayerId.entries()) {
      if (!entry.analyser || !entry.fftBins) continue;
      if (this.voiceMuted || store.mutedPlayerIds[playerId]) {
        store.setRemoteSpeaking(playerId, false);
        continue;
      }
      const level = this.computeAverageLevel(entry.analyser, entry.fftBins);
      if (level >= VAD_SPEAKING_THRESHOLD) {
        this.remoteHoldCounters.set(playerId, VAD_HOLD_FRAMES);
        store.setRemoteSpeaking(playerId, true);
      } else {
        const prevHold = this.remoteHoldCounters.get(playerId) ?? 0;
        if (prevHold > 0) {
          const nextHold = prevHold - 1;
          this.remoteHoldCounters.set(playerId, nextHold);
          if (nextHold === 0) {
            store.setRemoteSpeaking(playerId, false);
          }
        } else {
          store.setRemoteSpeaking(playerId, false);
        }
      }
    }
  }

  public async toggleMic(): Promise<boolean> {
    if (useVoiceStore.getState().micEnabled) {
      this.disableMic();
      return false;
    }
    return this.enableMic();
  }

  public async enableMic(): Promise<boolean> {
    const store = useVoiceStore.getState();
    if (store.micEnabled && this.localStream) {
      return true;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      store.setMicPermission(
        'unsupported',
        'Voice mic requires HTTPS (or localhost) with microphone support.',
      );
      store.setMicEnabled(false);
      return false;
    }

    store.setMicPermission('requesting', null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Guard if user disconnected while permission prompt was open
      if (!this.bridge?.isRoomConnected() && useNetworkStore.getState().roomCode) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        store.setMicEnabled(false);
        return false;
      }

      this.stopLocalStreamOnly();
      this.localStream = stream;

      const ctx = this.ensureAudioContext();
      if (ctx) {
        try {
          this.localSource = ctx.createMediaStreamSource(stream);
          this.localAnalyser = ctx.createAnalyser();
          this.localAnalyser.fftSize = 128;
          this.localAnalyser.smoothingTimeConstant = 0.5;
          this.localSource.connect(this.localAnalyser);
          this.localFftBins = new Uint8Array(new ArrayBuffer(this.localAnalyser.frequencyBinCount));
          this.ensureVadTimer();
        } catch {
          // VAD is purely visual enhancement; audio call still works without it
        }
      }

      store.setMicPermission('granted', null);
      store.setMicEnabled(true);
      this.bridge?.broadcastVoiceState(true);
      this.reconcileOutgoingCalls();
      void this.unlockRemoteAudio();
      return true;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg =
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Microphone permission denied. Allow mic access in browser settings.'
          : name === 'NotFoundError'
            ? 'No microphone device found.'
            : 'Unable to access microphone.';
      store.setMicPermission('denied', msg);
      store.setMicEnabled(false);
      return false;
    }
  }

  public disableMic() {
    this.stopLocalStreamOnly();
    this.closeAllOutgoingCalls();
    const store = useVoiceStore.getState();
    store.setMicEnabled(false);
    store.setLocalSpeaking(false);
    this.bridge?.broadcastVoiceState(false);
    this.stopVadTimerIfIdle();
  }

  private stopLocalStreamOnly() {
    if (this.localSource) {
      try {
        this.localSource.disconnect();
      } catch {
        // ignore
      }
      this.localSource = null;
    }
    this.localAnalyser = null;
    this.localFftBins = null;
    this.localHoldCounter = 0;

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      this.localStream = null;
    }
  }

  private closeAllOutgoingCalls() {
    for (const call of this.outgoingCalls.values()) {
      try {
        call.close();
      } catch {
        // ignore
      }
    }
    this.outgoingCalls.clear();
  }

  private closeIncomingEntry(playerId: string) {
    const entry = this.incomingByPlayerId.get(playerId);
    if (!entry) return;
    this.incomingByPlayerId.delete(playerId);
    this.remoteHoldCounters.delete(playerId);

    if (entry.sourceNode) {
      try {
        entry.sourceNode.disconnect();
      } catch {
        // ignore
      }
    }
    if (entry.audioEl) {
      try {
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
      } catch {
        // ignore
      }
    }
    try {
      entry.call.close();
    } catch {
      // ignore
    }

    useVoiceStore.getState().setRemoteSpeaking(playerId, false);
    this.stopVadTimerIfIdle();
  }

  public reconcileOutgoingCalls() {
    const micEnabled = useVoiceStore.getState().micEnabled;
    const peer = this.bridge?.getPeer() ?? null;
    const selfPeerId = this.bridge?.getSelfPeerId() ?? null;
    const myPlayerId = useAvatarStore.getState().playerId;
    const roster = useNetworkStore.getState().roster;

    // Close outgoing calls to peers no longer online in roster
    const activeTargetPeerIds = new Set<string>();
    for (const member of Object.values(roster)) {
      if (
        member.isOnline &&
        member.peerId &&
        member.peerId !== 'pending' &&
        member.peerId !== selfPeerId &&
        member.playerId !== myPlayerId
      ) {
        activeTargetPeerIds.add(member.peerId);
      }
    }

    for (const [targetPeerId, call] of this.outgoingCalls.entries()) {
      if (!micEnabled || !this.localStream || !activeTargetPeerIds.has(targetPeerId)) {
        try {
          call.close();
        } catch {
          // ignore
        }
        this.outgoingCalls.delete(targetPeerId);
      }
    }

    // Close incoming audio streams from peers that went offline
    for (const [playerId, entry] of this.incomingByPlayerId.entries()) {
      const member = roster[playerId];
      if (!member || !member.isOnline || member.peerId !== entry.peerId) {
        this.closeIncomingEntry(playerId);
      }
    }

    if (!micEnabled || !this.localStream || !peer || peer.destroyed || !selfPeerId) {
      return;
    }

    if (typeof peer.call !== 'function') {
      return;
    }

    for (const targetPeerId of activeTargetPeerIds) {
      if (this.outgoingCalls.has(targetPeerId)) continue;
      try {
        const call = peer.call(targetPeerId, this.localStream, {
          metadata: {
            kind: 'voice',
            playerId: myPlayerId,
          },
        });
        if (!call) continue;
        this.outgoingCalls.set(targetPeerId, call);
        call.on('close', () => {
          if (this.outgoingCalls.get(targetPeerId) === call) {
            this.outgoingCalls.delete(targetPeerId);
          }
        });
        call.on('error', () => {
          if (this.outgoingCalls.get(targetPeerId) === call) {
            this.outgoingCalls.delete(targetPeerId);
          }
        });
      } catch (err) {
        console.warn(`[VoiceMesh] Failed to dial peer "${targetPeerId}":`, err);
      }
    }
  }

  public syncWithRoster(rosterInput: Record<string, RosterMember> | RosterMember[]) {
    const list = Array.isArray(rosterInput) ? rosterInput : Object.values(rosterInput);
    const onlineIds = new Set<string>();
    for (const m of list) {
      if (m.isOnline) onlineIds.add(m.playerId);
    }

    const store = useVoiceStore.getState();
    for (const playerId of Object.keys(store.remoteMicByPlayerId)) {
      if (!onlineIds.has(playerId)) {
        store.removeRemoteVoice(playerId);
      }
    }

    this.reconcileOutgoingCalls();
  }

  public handleIncomingCall(call: MediaConnection) {
    const remotePeerId = call.peer;
    const myPlayerId = useAvatarStore.getState().playerId;
    const roster = useNetworkStore.getState().roster;

    let senderMember: RosterMember | undefined;
    for (const member of Object.values(roster)) {
      if (member.peerId === remotePeerId && member.isOnline) {
        senderMember = member;
        break;
      }
    }

    if (!senderMember || senderMember.playerId === myPlayerId) {
      try {
        call.close();
      } catch {
        // ignore
      }
      return;
    }

    const senderPlayerId = senderMember.playerId;
    if (this.incomingByPlayerId.has(senderPlayerId)) {
      this.closeIncomingEntry(senderPlayerId);
    }

    const entry: RemoteAudioEntry = {
      playerId: senderPlayerId,
      peerId: remotePeerId,
      call,
      stream: null,
      audioEl: null,
      sourceNode: null,
      analyser: null,
      fftBins: null,
    };
    this.incomingByPlayerId.set(senderPlayerId, entry);

    // Answer receive-only; outgoing audio is sent over unidirectional speaker->listener calls
    try {
      call.answer();
    } catch (err) {
      console.warn(`[VoiceMesh] Failed to answer call from "${remotePeerId}":`, err);
      this.closeIncomingEntry(senderPlayerId);
      return;
    }

    call.on('stream', (remoteStream: MediaStream) => {
      if (this.incomingByPlayerId.get(senderPlayerId) !== entry) return;
      entry.stream = remoteStream;
      useVoiceStore.getState().setRemoteMicState(senderPlayerId, true);

      if (typeof Audio !== 'undefined') {
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.srcObject = remoteStream;

        const mutedMap = useVoiceStore.getState().mutedPlayerIds;
        const peerMuted = Boolean(mutedMap[senderPlayerId]);
        audioEl.muted = this.voiceMuted || peerMuted;
        audioEl.volume = this.voiceMuted || peerMuted ? 0 : this.voiceVolume / 100;
        entry.audioEl = audioEl;

        void audioEl.play().catch((err) => {
          if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
            useVoiceStore.getState().setAutoplayBlocked(true);
          }
        });
      }

      const ctx = this.ensureAudioContext();
      if (ctx) {
        try {
          const src = ctx.createMediaStreamSource(remoteStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.5;
          src.connect(analyser);
          entry.sourceNode = src;
          entry.analyser = analyser;
          entry.fftBins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
          this.ensureVadTimer();
        } catch {
          // VAD optional
        }
      }
    });

    call.on('close', () => {
      if (this.incomingByPlayerId.get(senderPlayerId) === entry) {
        this.closeIncomingEntry(senderPlayerId);
        useVoiceStore.getState().setRemoteMicState(senderPlayerId, false);
      }
    });

    call.on('error', () => {
      if (this.incomingByPlayerId.get(senderPlayerId) === entry) {
        this.closeIncomingEntry(senderPlayerId);
        useVoiceStore.getState().setRemoteMicState(senderPlayerId, false);
      }
    });
  }

  public async unlockRemoteAudio(): Promise<void> {
    this.ensureAudioContext();
    let anyBlocked = false;
    for (const entry of this.incomingByPlayerId.values()) {
      if (!entry.audioEl) continue;
      try {
        await entry.audioEl.play();
      } catch {
        anyBlocked = true;
      }
    }
    useVoiceStore.getState().setAutoplayBlocked(anyBlocked);
  }

  public shutdown() {
    this.stopLocalStreamOnly();
    this.closeAllOutgoingCalls();
    for (const playerId of Array.from(this.incomingByPlayerId.keys())) {
      this.closeIncomingEntry(playerId);
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    useVoiceStore.getState().resetVoiceState();
  }
}

export const voiceManager = new VoiceManager();
