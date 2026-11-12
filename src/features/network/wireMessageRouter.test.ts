import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataConnection } from 'peerjs';
import type { AvatarConfig } from '../avatar/types';
import { useAvatarStore } from '../avatar/avatarStore';
import { usePlayerStore } from '../player/playerStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useMapStore } from '../map/mapStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { buildActiveStations, engineWorld } from '../game/engineWorld';
import { useNetworkStore } from './networkStore';
import { DamageRateTracker } from './hostSecurity';
import { FastSyncController } from './fastSyncController';
import {
  dropFlagHeldByPlayer,
  evaluateCadetWatchdog,
  type PeerTransportSession,
} from './peerTransport';
import { routeIncomingWireMessage, type WireMessageContext } from './wireMessageRouter';
import { handleRoomAuthMessage, syncLocalCarrierFlagFromCTF } from './roomAuthHandlers';
import { CADET_HOST_SILENCE_MS, type WireMessage } from './wireTypes';

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

function makeFakeConn(peerId: string): DataConnection & { sent: WireMessage[] } {
  const sent: WireMessage[] = [];
  return {
    peer: peerId,
    open: true,
    sent,
    send: (msg: WireMessage) => sent.push(msg),
    close: vi.fn(),
  } as unknown as DataConnection & { sent: WireMessage[] };
}

describe('wireMessageRouter, roomAuthHandlers, and peerTransport unit suite', () => {
  let fastSync: FastSyncController;
  let rateTracker: DamageRateTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    engineWorld.resetWorldForMatch([], true, []);
    useMatchStatsStore.getState().resetStats();
    useCTFStore.getState().resetSequence();
    useCTFStore.getState().resetMatchRules();
    useNetworkStore.getState().clearNetwork();
    useAvatarStore.setState({
      playerId: 'pilot_local',
      avatar: makeAvatar('LocalPilot'),
      isEnlisted: true,
    });
    usePlayerStore.getState().resetPlayer();
    usePlayerStore.getState().setTeam('blue');
    fastSync = new FastSyncController();
    rateTracker = new DamageRateTracker();
  });

  afterEach(() => {
    fastSync.reset();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('drops carried flag on leave_battle when host processes cadet exit', () => {
    const selectedMap = useMapStore.getState().selectedMap;
    useCTFStore.getState().initMatch(selectedMap);
    useNetworkStore.getState().setGamePhase('in_game');
    useNetworkStore.getState().setRoster([
      {
        playerId: 'pilot_local',
        peerId: 'host_peer',
        slot: 0,
        callsign: 'Host',
        team: 'blue',
        avatar: makeAvatar('Host'),
        isReady: true,
        isHost: true,
        isOnline: true,
      },
      {
        playerId: 'pilot_cadet',
        peerId: 'peer_cadet',
        slot: 1,
        callsign: 'Cadet',
        team: 'blue',
        avatar: makeAvatar('Cadet'),
        isReady: true,
        isHost: false,
        isOnline: true,
      },
    ]);

    // Cadet picks up red flag
    useCTFStore.getState().pickupFlag('red', 'pilot_cadet');
    expect(useCTFStore.getState().flags.red.status).toBe('carried');

    const sentRelays: { msg: WireMessage; exclude?: string }[] = [];
    const verified = new Set(['peer_cadet']);
    const session: PeerTransportSession = {
      peer: null,
      selfPeerId: 'host_peer',
      targetHostPeerId: 'host_peer',
      isHostRole: true,
      isConnectingOrDestroyed: false,
      isInActiveBattle: true,
      clientConnections: new Map(),
      verifiedPeerIds: verified,
      hostConn: null,
      isDialingHost: false,
      hasEverConnectedToHost: false,
      hostReconnectAttempts: 0,
      lastHostTrafficMs: 0,
      lastCadetWatchdogTickMs: 0,
      lastBeaconInGamePingMs: 0,
    };

    const ctx: WireMessageContext = {
      isHostRole: true,
      selfPeerId: 'host_peer',
      targetHostPeerId: 'host_peer',
      verifiedPeerIds: verified,
      isInActiveBattle: true,
      fastSync,
      fastTransportCallbacks: {
        isDestroyed: () => false,
        isHostRole: () => true,
        isInActiveBattle: () => true,
        isVerifiedPeer: (id) => verified.has(id),
        findMemberByPeerId: () => undefined,
        findMemberBySlot: () => undefined,
        onHostPacketReceived: () => {},
        sendFallbackToHost: () => {},
        sendFallbackToClient: () => {},
        getClientPeerIds: () => [],
        getSelfPeerId: () => 'host_peer',
      },
      damageRateTracker: rateTracker,
      findMemberByPeerId: (pid) =>
        Object.values(useNetworkStore.getState().roster).find((m) => m.peerId === pid),
      findMemberByIdOrPeer: (id) => useNetworkStore.getState().roster[id],
      getClientConnections: () => session.clientConnections.entries(),
      safeSend: () => {},
      sendToNetwork: (msg, exclude) => sentRelays.push({ msg, exclude }),
      onHostPacketReceived: () => {},
      nextRemoteBulletId: () => 1,
      getLastHandledLaunchId: () => null,
      setLastHandledLaunchId: () => {},
      enterActiveBattleFromMatchControl: () => {},
      exitActiveBattleToStaging: () => {},
      broadcastKillFeed: () => {},
      broadcastFlagEvent: () => {},
      dropFlagHeldByPlayer: (pid) => dropFlagHeldByPlayer(pid, session, fastSync),
      onStartMatch: null,
      onRematch: null,
      onReturnToStaging: null,
      onRejoinMatch: null,
    };

    routeIncomingWireMessage(
      {
        kind: 'match_control',
        senderId: 'peer_cadet',
        payload: { type: 'leave_battle', playerId: 'pilot_cadet' },
      },
      'peer_cadet',
      undefined,
      ctx,
    );

    expect(useCTFStore.getState().flags.red.status).toBe('dropped');
    expect(sentRelays).toHaveLength(1);
    expect(sentRelays[0].msg.kind).toBe('match_control');
    expect(sentRelays[0].exclude).toBe('peer_cadet');
  });

  it('responds to verified rejoin_sync with cooldowns and restores cadet state via rejoin_state', () => {
    const selectedMap = useMapStore.getState().selectedMap;
    useCTFStore.getState().initMatch(selectedMap);
    engineWorld.resetWorldForMatch(
      selectedMap.weaponSpawns.map((ws) => ({
        id: ws.id,
        x: ws.x,
        y: ws.y,
        weaponType: ws.weaponType,
        respawnTimer: 0,
      })),
      true,
      buildActiveStations(selectedMap),
    );
    const pickupId = engineWorld.pickups[0].id;
    engineWorld.markPickupTaken(pickupId, 14);

    useNetworkStore.getState().setRoster([
      {
        playerId: 'pilot_cadet',
        peerId: 'peer_cadet',
        slot: 1,
        callsign: 'Cadet',
        team: 'red',
        avatar: makeAvatar('Cadet'),
        isReady: true,
        isHost: false,
        isOnline: true,
      },
    ]);

    const cadetConn = makeFakeConn('peer_cadet');
    const verified = new Set(['peer_cadet']);

    handleRoomAuthMessage({ type: 'rejoin_sync' }, 'peer_cadet', cadetConn, {
      isHostRole: true,
      selfPeerId: 'host_peer',
      targetHostPeerId: 'host_peer',
      verifiedPeerIds: verified,
      findMemberByPeerId: (pid) =>
        Object.values(useNetworkStore.getState().roster).find((m) => m.peerId === pid),
      getClientConnections: () => new Map<string, DataConnection>().entries(),
      safeSend: (c, msg) => c?.send(msg),
      sendToNetwork: () => {},
      enterActiveBattleFromAuth: () => {},
      onStartMatch: null,
      onRejoinMatch: null,
    });

    expect(cadetConn.sent).toHaveLength(1);
    const rejoinStateMsg = cadetConn.sent[0];
    expect(rejoinStateMsg.kind).toBe('room_auth');
    if (rejoinStateMsg.kind === 'room_auth' && rejoinStateMsg.payload.type === 'rejoin_state') {
      expect(rejoinStateMsg.payload.pickupCooldowns).toEqual([{ id: pickupId, remainingSec: 14 }]);

      // Reset local engineWorld pickups cleanly and verify cadet rejoin_state re-applies cooldowns & team
      engineWorld.resetWorldForMatch(
        selectedMap.weaponSpawns.map((ws) => ({
          id: ws.id,
          x: ws.x,
          y: ws.y,
          weaponType: ws.weaponType,
          respawnTimer: 0,
        })),
        true,
        buildActiveStations(selectedMap),
      );
      expect(engineWorld.isPickupAvailable(pickupId)).toBe(true);

      useAvatarStore.setState({ playerId: 'pilot_cadet' });
      handleRoomAuthMessage(rejoinStateMsg.payload, 'host_peer', undefined, {
        isHostRole: false,
        selfPeerId: 'peer_cadet',
        targetHostPeerId: 'host_peer',
        verifiedPeerIds: new Set(),
        findMemberByPeerId: () => undefined,
        getClientConnections: () => new Map<string, DataConnection>().entries(),
        safeSend: () => {},
        sendToNetwork: () => {},
        enterActiveBattleFromAuth: () => {},
        onStartMatch: null,
        onRejoinMatch: null,
      });

      expect(usePlayerStore.getState().player.team).toBe('red');
      expect(engineWorld.isPickupAvailable(pickupId)).toBe(false);
    }
  });

  it('syncLocalCarrierFlagFromCTF clears stale carryingFlag when CTF drops flag', () => {
    const selectedMap = useMapStore.getState().selectedMap;
    useCTFStore.getState().initMatch(selectedMap);
    usePlayerStore.getState().setTeam('blue');
    usePlayerStore.getState().setPlayer({
      ...usePlayerStore.getState().player,
      id: 'pilot_local',
      carryingFlag: true,
    });

    syncLocalCarrierFlagFromCTF(useCTFStore.getState().exportMatchState());
    expect(usePlayerStore.getState().player.carryingFlag).toBe(false);
  });

  it('detects Host silence in evaluateCadetWatchdog while ignoring OS sleep jumps', () => {
    const hostConn = makeFakeConn('host_peer');
    const closeHostTransport = vi.fn();
    const dialHost = vi.fn();
    const scheduleHostRetry = vi.fn();

    useNetworkStore.getState().setIsAuthApproved(true);

    const session: PeerTransportSession = {
      peer: null,
      selfPeerId: 'cadet_peer',
      targetHostPeerId: 'host_peer',
      isHostRole: false,
      isConnectingOrDestroyed: false,
      isInActiveBattle: true,
      clientConnections: new Map(),
      verifiedPeerIds: new Set(),
      hostConn,
      isDialingHost: false,
      hasEverConnectedToHost: true,
      hostReconnectAttempts: 0,
      lastHostTrafficMs: 1000,
      lastCadetWatchdogTickMs: 1000,
      lastBeaconInGamePingMs: 0,
    };

    // Advance clock by 6s at once -> simulated OS sleep/wake jump (>4.5s watchdog gap) should NOT timeout immediately
    vi.setSystemTime(Date.now() + 6000);
    // performance.now uses fake timers in Vitest
    vi.advanceTimersByTime(6000);
    evaluateCadetWatchdog(session, { closeHostTransport, dialHost, scheduleHostRetry });
    expect(closeHostTransport).not.toHaveBeenCalled();

    // Advance normally in 1s watchdog ticks past CADET_HOST_SILENCE_MS -> triggers Host silence reconnect
    const startTraffic = session.lastHostTrafficMs;
    while (performance.now() - startTraffic <= CADET_HOST_SILENCE_MS) {
      vi.advanceTimersByTime(1000);
      evaluateCadetWatchdog(session, { closeHostTransport, dialHost, scheduleHostRetry });
    }
    expect(closeHostTransport).toHaveBeenCalledTimes(1);
    expect(scheduleHostRetry).toHaveBeenCalledWith(500);
    expect(useNetworkStore.getState().hostSignalLost).toBe(true);
  });
});
