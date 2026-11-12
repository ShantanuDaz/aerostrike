import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataConnection, MediaConnection } from 'peerjs';
import type Peer from 'peerjs';
import type { AvatarConfig } from '../avatar/types';
import { useAvatarStore } from '../avatar/avatarStore';
import { useNetworkStore } from '../network/networkStore';
import { ChatRateTracker, DamageRateTracker, validateIncomingChat } from '../network/hostSecurity';
import { FastSyncController } from '../network/fastSyncController';
import { routeIncomingWireMessage, type WireMessageContext } from '../network/wireMessageRouter';
import type { WireMessage } from '../network/wireTypes';
import { CHAT_BUBBLE_DURATION_MS } from './types';
import { sanitizeLocalChatInput, useChatStore } from './chatStore';
import { useVoiceStore } from './voiceStore';
import { VoiceManager } from './voiceManager';

function makeAvatar(callsign: string): AvatarConfig {
  return {
    callsign,
    bodyColor: '#2563eb',
    skinTone: '#fed7aa',
    headgear: 'soldier_helmet',
    headgearColor: '#1e293b',
    visorStyle: 'classic',
    visorColor: '#00f0ff',
    jetpackStyle: 'dual_tank',
  };
}

class MockMediaConnection {
  public peer: string;
  public answeredWith: MediaStream | undefined | null = null;
  public answerCalled = false;
  public closed = false;
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  constructor(peerId: string) {
    this.peer = peerId;
  }

  public on(event: string, fn: (...args: unknown[]) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(fn);
    this.listeners.set(event, list);
  }

  public emit(event: string, ...args: unknown[]) {
    for (const fn of this.listeners.get(event) ?? []) {
      fn(...args);
    }
  }

  public answer(stream?: MediaStream) {
    this.answerCalled = true;
    this.answeredWith = stream ?? null;
  }

  public close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}

describe('Squad Comms: Star Chat, Quick Emojis & Direct Mesh Voice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChatStore.getState().clearChat();
    useVoiceStore.getState().resetVoiceState();
    useNetworkStore.getState().clearNetwork();
    useAvatarStore.setState({
      playerId: 'pilot_host',
      avatar: makeAvatar('HostPilot'),
      isEnlisted: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sanitizes input, deduplicates messages, tracks unread count, and expires bubbles', () => {
    expect(sanitizeLocalChatInput('  hello\u0007 world \n', 'text')).toBe('hello world');
    expect(sanitizeLocalChatInput('🔥'.repeat(20), 'emoji').length).toBeLessThanOrEqual(16);

    const store = useChatStore.getState();
    store.appendMessage(
      {
        id: 'm1',
        senderId: 'pilot_2',
        senderCallsign: 'Nova',
        senderTeam: 'red',
        kind: 'emoji',
        text: '🔥',
        createdAtMs: 1000,
      },
      true,
    );
    // Duplicate id ignored
    store.appendMessage(
      {
        id: 'm1',
        senderId: 'pilot_2',
        senderCallsign: 'Nova',
        senderTeam: 'red',
        kind: 'emoji',
        text: '🔥',
        createdAtMs: 1000,
      },
      true,
    );

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().unreadCount).toBe(1);
    expect(useChatStore.getState().bubblesByPlayerId['pilot_2']?.text).toBe('🔥');

    // Opening HUD chat clears unread count
    useChatStore.getState().setHudChatOpen(true);
    expect(useChatStore.getState().unreadCount).toBe(0);

    // Bubble expires after CHAT_BUBBLE_DURATION_MS
    vi.advanceTimersByTime(CHAT_BUBBLE_DURATION_MS + 50);
    useChatStore.getState().pruneExpiredBubbles();
    expect(useChatStore.getState().bubblesByPlayerId['pilot_2']).toBeUndefined();
  });

  it('enforces chat rate limits and canonicalizes sender identity on Host', () => {
    const tracker = new ChatRateTracker();
    const member = {
      playerId: 'pilot_cadet',
      peerId: 'peer_cadet',
      slot: 1,
      callsign: 'RealCadet',
      team: 'red' as const,
      avatar: makeAvatar('RealCadet'),
      isReady: true,
      isHost: false,
      isOnline: true,
    };

    const validated = validateIncomingChat(
      {
        id: 'chat_1',
        kind: 'text',
        text: 'Push mid!',
        senderId: 'spoofed_host',
        senderCallsign: 'FakeHost',
        senderTeam: 'blue',
      },
      'peer_cadet',
      member,
      tracker,
      1000,
    );

    expect(validated).not.toBeNull();
    expect(validated?.senderId).toBe('pilot_cadet');
    expect(validated?.senderCallsign).toBe('RealCadet');
    expect(validated?.senderTeam).toBe('red');

    // Exhaust rolling window (6 allowed, 7th rejected)
    for (let i = 0; i < 5; i++) {
      expect(
        validateIncomingChat(
          { id: `chat_${i + 2}`, kind: 'emoji', text: '👍' },
          'peer_cadet',
          member,
          tracker,
          1100 + i * 10,
        ),
      ).not.toBeNull();
    }
    expect(
      validateIncomingChat(
        { id: 'chat_spam', kind: 'emoji', text: '👍' },
        'peer_cadet',
        member,
        tracker,
        1200,
      ),
    ).toBeNull();
  });

  it('routes incoming chat and voice_state over Star DataConnection and relays to verified peers', () => {
    useNetworkStore.getState().setRoster([
      {
        playerId: 'pilot_host',
        peerId: 'peer_host',
        slot: 0,
        callsign: 'HostPilot',
        team: 'blue',
        avatar: makeAvatar('HostPilot'),
        isReady: true,
        isHost: true,
        isOnline: true,
      },
      {
        playerId: 'pilot_cadet',
        peerId: 'peer_cadet',
        slot: 1,
        callsign: 'Viper',
        team: 'red',
        avatar: makeAvatar('Viper'),
        isReady: true,
        isHost: false,
        isOnline: true,
      },
    ]);

    const relayed: { msg: WireMessage; exclude?: string }[] = [];
    const verified = new Set(['peer_cadet']);
    const fastSync = new FastSyncController();
    const ctx: WireMessageContext = {
      isHostRole: true,
      selfPeerId: 'peer_host',
      targetHostPeerId: 'peer_host',
      verifiedPeerIds: verified,
      isInActiveBattle: false,
      fastSync,
      fastTransportCallbacks: {
        isDestroyed: () => false,
        isHostRole: () => true,
        isInActiveBattle: () => false,
        isVerifiedPeer: (id) => verified.has(id),
        findMemberByPeerId: () => undefined,
        findMemberBySlot: () => undefined,
        onHostPacketReceived: () => {},
        sendFallbackToHost: () => {},
        sendFallbackToClient: () => {},
        getClientPeerIds: () => [],
        getSelfPeerId: () => 'peer_host',
      },
      damageRateTracker: new DamageRateTracker(),
      chatRateTracker: new ChatRateTracker(),
      findMemberByPeerId: (pid) =>
        Object.values(useNetworkStore.getState().roster).find((m) => m.peerId === pid),
      findMemberByIdOrPeer: (id) => useNetworkStore.getState().roster[id],
      getClientConnections: () => new Map<string, DataConnection>().entries(),
      safeSend: () => {},
      sendToNetwork: (msg, exclude) => relayed.push({ msg, exclude }),
      onHostPacketReceived: () => {},
      nextRemoteBulletId: () => 1,
      getLastHandledLaunchId: () => null,
      setLastHandledLaunchId: () => {},
      enterActiveBattleFromMatchControl: () => {},
      exitActiveBattleToStaging: () => {},
      broadcastKillFeed: () => {},
      broadcastFlagEvent: () => {},
      dropFlagHeldByPlayer: () => {},
      onStartMatch: null,
      onRematch: null,
      onReturnToStaging: null,
      onRejoinMatch: null,
    };

    routeIncomingWireMessage(
      {
        kind: 'chat',
        senderId: 'peer_cadet',
        payload: { id: 'c_1', kind: 'emoji', text: '🚩' },
      },
      'peer_cadet',
      undefined,
      ctx,
    );

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].senderCallsign).toBe('Viper');
    expect(relayed).toHaveLength(1);
    expect(relayed[0].exclude).toBe('peer_cadet');

    routeIncomingWireMessage(
      {
        kind: 'voice_state',
        senderId: 'peer_cadet',
        payload: { playerId: 'pilot_cadet', peerId: 'peer_cadet', micEnabled: true },
      },
      'peer_cadet',
      undefined,
      ctx,
    );

    expect(useVoiceStore.getState().remoteMicByPlayerId['pilot_cadet']).toBe(true);
    expect(relayed).toHaveLength(2);
  });

  it('manages direct P2P voice mesh dialing, receive-only answering, and mic cleanup', async () => {
    const stopTrack = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(fakeStream),
        },
      },
      configurable: true,
    });

    const dialedCalls: { target: string; call: MockMediaConnection }[] = [];
    const mockPeer = {
      destroyed: false,
      call: vi.fn((targetPeerId: string) => {
        const c = new MockMediaConnection(targetPeerId);
        dialedCalls.push({ target: targetPeerId, call: c });
        return c as unknown as MediaConnection;
      }),
    } as unknown as Peer;

    const broadcastVoiceState = vi.fn();
    const vm = new VoiceManager();
    vm.attachBridge({
      getPeer: () => mockPeer,
      getSelfPeerId: () => 'peer_host',
      isRoomConnected: () => true,
      broadcastVoiceState,
    });

    useNetworkStore.getState().setRoster([
      {
        playerId: 'pilot_host',
        peerId: 'peer_host',
        slot: 0,
        callsign: 'HostPilot',
        team: 'blue',
        avatar: makeAvatar('HostPilot'),
        isReady: true,
        isHost: true,
        isOnline: true,
      },
      {
        playerId: 'pilot_cadet_1',
        peerId: 'peer_cadet_1',
        slot: 1,
        callsign: 'Alpha',
        team: 'blue',
        avatar: makeAvatar('Alpha'),
        isReady: true,
        isHost: false,
        isOnline: true,
      },
    ]);

    // Incoming call from verified peer answers receive-only even while local mic is OFF
    const validIncoming = new MockMediaConnection('peer_cadet_1');
    vm.handleIncomingCall(validIncoming as unknown as MediaConnection);
    expect(validIncoming.answerCalled).toBe(true);
    expect(validIncoming.answeredWith).toBeNull();

    // Unknown caller not in roster is rejected
    const rogueIncoming = new MockMediaConnection('peer_intruder');
    vm.handleIncomingCall(rogueIncoming as unknown as MediaConnection);
    expect(rogueIncoming.answerCalled).toBe(false);
    expect(rogueIncoming.closed).toBe(true);

    // Enable local mic -> acquires stream, broadcasts voice_state, dials online roster peers
    const ok = await vm.enableMic();
    expect(ok).toBe(true);
    expect(useVoiceStore.getState().micEnabled).toBe(true);
    expect(broadcastVoiceState).toHaveBeenCalledWith(true);
    expect(dialedCalls.map((d) => d.target)).toEqual(['peer_cadet_1']);

    // New cadet joins later -> syncWithRoster dials them automatically
    useNetworkStore.getState().upsertRosterMember({
      playerId: 'pilot_cadet_2',
      peerId: 'peer_cadet_2',
      slot: 2,
      callsign: 'Bravo',
      team: 'red',
      avatar: makeAvatar('Bravo'),
      isReady: true,
      isHost: false,
      isOnline: true,
    });
    vm.syncWithRoster(useNetworkStore.getState().roster);
    expect(dialedCalls.map((d) => d.target)).toEqual(['peer_cadet_1', 'peer_cadet_2']);

    // Disable local mic -> stops tracks, closes outgoing calls, keeps incoming listener intact
    vm.disableMic();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().micEnabled).toBe(false);
    expect(broadcastVoiceState).toHaveBeenCalledWith(false);
    expect(dialedCalls.every((d) => d.call.closed)).toBe(true);
    expect(validIncoming.closed).toBe(false);

    vm.shutdown();
    expect(validIncoming.closed).toBe(true);
  });
});
