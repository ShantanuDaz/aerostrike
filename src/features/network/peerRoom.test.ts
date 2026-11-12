import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvatarConfig } from '../avatar/types';
import { DEFAULT_MATCH_RULES, type MatchRulesConfig } from '../ctf/types';

const { MockDataConnection, MockPeer, mockRegistry } = vi.hoisted(() => {
  type EventHandler = (...args: unknown[]) => void;

  class LocalMockEmitter {
    private listeners = new Map<string, EventHandler[]>();

    public on(event: string, fn: EventHandler) {
      const list = this.listeners.get(event) ?? [];
      list.push(fn);
      this.listeners.set(event, list);
    }

    public emit(event: string, ...args: unknown[]) {
      const list = this.listeners.get(event) ?? [];
      for (const fn of list) {
        fn(...args);
      }
    }
  }

  class LocalMockDataConnection extends LocalMockEmitter {
    public peer: string;
    public open = true;
    public peerConnection: RTCPeerConnection | undefined = undefined;
    public sent: unknown[] = [];

    constructor(peerId: string) {
      super();
      this.peer = peerId;
    }

    public send(data: unknown) {
      this.sent.push(data);
    }

    public close() {
      if (!this.open) return;
      this.open = false;
      this.emit('close');
    }
  }

  const registry: { lastCreatedPeer: LocalMockPeer | null } = {
    lastCreatedPeer: null,
  };

  class LocalMockPeer extends LocalMockEmitter {
    public id: string;
    public destroyed = false;
    public disconnected = false;
    public outgoingConnections: LocalMockDataConnection[] = [];

    constructor(idOrOpts?: unknown) {
      super();
      this.id = typeof idOrOpts === 'string' ? idOrOpts : 'peer_cadet_mock';
      registry.lastCreatedPeer = this;
    }

    public connect(targetPeerId: string): LocalMockDataConnection {
      const conn = new LocalMockDataConnection(targetPeerId);
      this.outgoingConnections.push(conn);
      return conn;
    }

    public reconnect() {
      this.disconnected = false;
    }

    public destroy() {
      this.destroyed = true;
    }
  }

  return {
    MockDataConnection: LocalMockDataConnection,
    MockPeer: LocalMockPeer,
    mockRegistry: registry,
  };
});

type MockPeerInstance = InstanceType<typeof MockPeer>;
type MockDataConnectionInstance = InstanceType<typeof MockDataConnection>;

vi.mock('peerjs', () => ({
  default: MockPeer,
  util: { defaultConfig: { iceServers: [] } },
}));

import { PeerNetworkManager } from './peerRoom';
import { useNetworkStore } from './networkStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { usePlayerStore } from '../player/playerStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useMapStore } from '../map/mapStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { buildActiveStations, engineWorld } from '../game/engineWorld';
import type { AuthJoinResponse } from './types';

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

describe('PeerNetworkManager 2-peer protocol, security, and cooldown sync', () => {
  let manager: PeerNetworkManager;

  beforeEach(() => {
    vi.useFakeTimers();
    engineWorld.resetWorldForMatch([], true, []);
    useMatchStatsStore.getState().resetStats();
    useCTFStore.getState().resetSequence();
    useCTFStore.getState().resetMatchRules();
    useNetworkStore.getState().clearNetwork();
    useAvatarStore.setState({
      playerId: 'pilot_host_1',
      avatar: makeAvatar('Viper'),
      isEnlisted: true,
    });
    usePlayerStore.getState().resetPlayer();
    usePlayerStore.getState().setTeam('blue');
    manager = new PeerNetworkManager();
  });

  afterEach(() => {
    manager.disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setupHost(roomCode = 'TST999', rules: MatchRulesConfig = DEFAULT_MATCH_RULES): MockPeerInstance {
    manager.connect(roomCode, true);
    const peer = mockRegistry.lastCreatedPeer!;
    peer.emit('open', 'aerostrikeomegav2TST999');
    useCTFStore.getState().setMatchRules(rules);
    manager.broadcastRulesChange(rules);
    return peer;
  }

  function joinCadet(
    hostPeer: MockPeerInstance,
    opts: { peerId: string; playerId: string; callsign: string; team: 'blue' | 'red' },
  ): MockDataConnectionInstance {
    const conn = new MockDataConnection(opts.peerId);
    hostPeer.emit('connection', conn);
    conn.emit('data', {
      kind: 'room_auth',
      senderId: opts.peerId,
      payload: {
        type: 'join_request',
        playerId: opts.playerId,
        callsign: opts.callsign,
        team: opts.team,
        avatar: makeAvatar(opts.callsign),
      },
    });
    return conn;
  }

  it('isolates duplicate callsigns by playerId & slot and only marks disconnected peer offline', () => {
    const hostPeer = setupHost('DUP111', {
      targetCaptures: 5,
      timeLimitSec: 180,
      respawnDelaySec: 2.5,
    });

    const connA = joinCadet(hostPeer, {
      peerId: 'peer_a',
      playerId: 'pilot_alpha_a',
      callsign: 'Viper', // Exact duplicate of host callsign
      team: 'red',
    });
    const connB = joinCadet(hostPeer, {
      peerId: 'peer_b',
      playerId: 'pilot_alpha_b',
      callsign: 'Viper', // Exact duplicate again
      team: 'blue',
    });

    const roster = useNetworkStore.getState().roster;
    expect(Object.keys(roster)).toHaveLength(3);
    expect(roster.pilot_host_1.slot).toBe(0);
    expect(roster.pilot_alpha_a.slot).toBe(1);
    expect(roster.pilot_alpha_b.slot).toBe(2);

    // Join response forwards active War Room MatchRules to cadet
    const joinResMsg = connA.sent.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as { kind?: string; payload?: { type?: string } }).kind === 'room_auth' &&
        (m as { payload?: { type?: string } }).payload?.type === 'join_response',
    ) as { payload: AuthJoinResponse } | undefined;

    expect(joinResMsg?.payload.accepted).toBe(true);
    expect(joinResMsg?.payload.matchRules).toEqual({
      targetCaptures: 5,
      timeLimitSec: 180,
      respawnDelaySec: 2.5,
    });

    // Disconnect peer_a only -> host and peer_b remain online, only pilot_alpha_a goes offline
    connA.close();
    const afterDisconnect = useNetworkStore.getState().roster;
    expect(afterDisconnect.pilot_alpha_a.isOnline).toBe(false);
    expect(afterDisconnect.pilot_alpha_b.isOnline).toBe(true);
    expect(afterDisconnect.pilot_host_1.isOnline).toBe(true);
    expect(connB.sent.length).toBeGreaterThan(0);
  });

  it('blocks unauthorized mid-match joiners, re-admits verified cadets, and syncs crate & station cooldowns', () => {
    const selectedMap = useMapStore.getState().selectedMap;
    const hostPeer = setupHost('MID222');

    const cadetConn = joinCadet(hostPeer, {
      peerId: 'peer_cadet',
      playerId: 'pilot_cadet_1',
      callsign: 'Spectre',
      team: 'red',
    });

    // Launch live match & seed one pickup crate + one refill station cooldown
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
    manager.broadcastStartMatch(selectedMap.id);

    const firstPickupId = engineWorld.pickups[0].id;
    const firstStationId = engineWorld.stations[0].id;
    engineWorld.markPickupTaken(firstPickupId, 17);
    engineWorld.markStationTaken(firstStationId, 11);

    // 1. Unauthorized stranger tries joining mid-match -> rejected
    const strangerConn = joinCadet(hostPeer, {
      peerId: 'peer_intruder',
      playerId: 'pilot_intruder',
      callsign: 'Intruder',
      team: 'red',
    });
    const denyMsg = strangerConn.sent.find(
      (m) =>
        (m as { kind?: string; payload?: { type?: string } }).kind === 'room_auth' &&
        (m as { payload?: { type?: string } }).payload?.type === 'join_response',
    ) as { payload: AuthJoinResponse } | undefined;
    expect(denyMsg?.payload.accepted).toBe(false);
    expect(useNetworkStore.getState().roster.pilot_intruder).toBeUndefined();

    // 2. Verified cadet drops and reconnects under new peerId -> accepted + synced cooldowns & score
    cadetConn.close();
    const rejoinConn = joinCadet(hostPeer, {
      peerId: 'peer_cadet_rejoined',
      playerId: 'pilot_cadet_1',
      callsign: 'Spectre',
      team: 'blue', // Should restore original 'red' faction
    });

    const rejoinRes = rejoinConn.sent.find(
      (m) =>
        (m as { kind?: string; payload?: { type?: string } }).kind === 'room_auth' &&
        (m as { payload?: { type?: string } }).payload?.type === 'join_response',
    ) as { payload: AuthJoinResponse } | undefined;

    expect(rejoinRes?.payload.accepted).toBe(true);
    expect(rejoinRes?.payload.gamePhase).toBe('in_game');
    expect(rejoinRes?.payload.team).toBe('red');
    expect(rejoinRes?.payload.pickupCooldowns).toEqual([
      { id: firstPickupId, remainingSec: 17 },
    ]);
    expect(rejoinRes?.payload.stationCooldowns).toEqual([
      { id: firstStationId, remainingSec: 11 },
    ]);
  });

  it('deduplicates pickup_sync and station_sync claims across peers', () => {
    const selectedMap = useMapStore.getState().selectedMap;
    const hostPeer = setupHost('SYN333');
    const connA = joinCadet(hostPeer, {
      peerId: 'peer_a',
      playerId: 'pilot_a',
      callsign: 'Alpha',
      team: 'red',
    });
    const connB = joinCadet(hostPeer, {
      peerId: 'peer_b',
      playerId: 'pilot_b',
      callsign: 'Bravo',
      team: 'blue',
    });

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
    manager.broadcastStartMatch(selectedMap.id);

    const pickup = engineWorld.pickups[0];
    const station = engineWorld.stations[0];
    const baselineSentB = connB.sent.length;

    // Peer A claims crate + station -> Host marks both taken & notifies Peer B
    connA.emit('data', {
      kind: 'pickup_sync',
      senderId: 'peer_a',
      payload: {
        action: 'claim',
        pickupId: pickup.id,
        playerId: 'pilot_a',
        weaponType: pickup.weaponType,
      },
    });
    connA.emit('data', {
      kind: 'station_sync',
      senderId: 'peer_a',
      payload: {
        action: 'claim',
        stationId: station.id,
        playerId: 'pilot_a',
        stationType: station.stationType,
      },
    });

    expect(engineWorld.isPickupAvailable(pickup.id)).toBe(false);
    expect(engineWorld.isStationAvailable(station.id)).toBe(false);
    const afterFirstClaimB = connB.sent.length;
    expect(afterFirstClaimB).toBe(baselineSentB + 2);

    // Late duplicate claim by Peer B must be ignored with no second broadcast
    connB.emit('data', {
      kind: 'pickup_sync',
      senderId: 'peer_b',
      payload: {
        action: 'claim',
        pickupId: pickup.id,
        playerId: 'pilot_b',
        weaponType: pickup.weaponType,
      },
    });
    connB.emit('data', {
      kind: 'station_sync',
      senderId: 'peer_b',
      payload: {
        action: 'claim',
        stationId: station.id,
        playerId: 'pilot_b',
        stationType: station.stationType,
      },
    });
    expect(connB.sent.length).toBe(afterFirstClaimB);
  });

  it('enforces Host damage sanity validation (anti-spoof, friendly fire, weapon cap, shield, DPS limit)', () => {
    const selectedMap = useMapStore.getState().selectedMap;
    const hostPeer = setupHost('SEC444');
    const redConn = joinCadet(hostPeer, {
      peerId: 'peer_red',
      playerId: 'pilot_red',
      callsign: 'Spectre',
      team: 'red',
    });
    const relayConn = joinCadet(hostPeer, {
      peerId: 'peer_observer',
      playerId: 'pilot_observer',
      callsign: 'Observer',
      team: 'red',
    });

    useCTFStore.getState().initMatch(selectedMap);
    manager.broadcastStartMatch(selectedMap.id);

    // Ensure host target starts alive & unshielded
    const hostPlayer = {
      ...usePlayerStore.getState().player,
      id: 'pilot_host_1',
      team: 'blue' as const,
      health: 100,
      invulnerableTimer: 0,
      isDead: false,
    };
    usePlayerStore.getState().setPlayer(hostPlayer);

    const beforeRelay = relayConn.sent.length;

    // 1. Spoofed dealerId (peer_red pretending to be pilot_observer) -> dropped
    redConn.emit('data', {
      kind: 'damage',
      senderId: 'peer_red',
      payload: {
        targetId: 'pilot_host_1',
        dealerId: 'pilot_observer',
        weaponType: 'rifle',
        damage: 14,
        knockbackX: 2,
        knockbackY: -1,
      },
    });
    expect(usePlayerStore.getState().player.health).toBe(100);
    expect(relayConn.sent.length).toBe(beforeRelay);

    // 2. Friendly fire (red -> red) -> dropped
    redConn.emit('data', {
      kind: 'damage',
      senderId: 'peer_red',
      payload: {
        targetId: 'pilot_observer',
        dealerId: 'pilot_red',
        weaponType: 'rifle',
        damage: 14,
        knockbackX: 1,
        knockbackY: 0,
      },
    });
    expect(relayConn.sent.length).toBe(beforeRelay);

    // 3. Impossible single-hit damage for pistol (> round(18*1.3)+2 = 25) -> dropped
    redConn.emit('data', {
      kind: 'damage',
      senderId: 'peer_red',
      payload: {
        targetId: 'pilot_host_1',
        dealerId: 'pilot_red',
        weaponType: 'pistol',
        damage: 99,
        knockbackX: 1,
        knockbackY: 0,
      },
    });
    expect(usePlayerStore.getState().player.health).toBe(100);
    expect(relayConn.sent.length).toBe(beforeRelay);

    // 4. Spawn-invulnerable target rejects incoming damage -> dropped
    usePlayerStore.getState().setPlayer({ ...hostPlayer, invulnerableTimer: 1.5 });
    redConn.emit('data', {
      kind: 'damage',
      senderId: 'peer_red',
      payload: {
        targetId: 'pilot_host_1',
        dealerId: 'pilot_red',
        weaponType: 'sniper',
        damage: 75,
        knockbackX: 2,
        knockbackY: 0,
      },
    });
    expect(usePlayerStore.getState().player.health).toBe(100);
    expect(relayConn.sent.length).toBe(beforeRelay);

    // 5. Legitimate hits succeed up to DPS cap (220 HP/s), then excessive 3rd sniper shot is throttled
    usePlayerStore.getState().setPlayer({ ...hostPlayer, health: 100, invulnerableTimer: 0 });
    for (let i = 0; i < 3; i++) {
      // Top HP back up slightly so player stays alive to test per-second DPS throttling
      const curr = usePlayerStore.getState().player;
      usePlayerStore.getState().setPlayer({ ...curr, health: 100, isDead: false });
      redConn.emit('data', {
        kind: 'damage',
        senderId: 'peer_red',
        payload: {
          targetId: 'pilot_host_1',
          dealerId: 'pilot_red',
          weaponType: 'sniper',
          damage: 95, // sniper crit cap = round(75*1.3)+2 = 99
          knockbackX: 2,
          knockbackY: 0,
        },
      });
    }
    // 95 + 95 = 190 <= 220 allowed (2 relayed); 3rd hits 285 > 220 -> throttled!
    expect(relayConn.sent.length).toBe(beforeRelay + 2);
  });

  it('tracks Host connection drop and resets signal-lost banner upon reconnect', () => {
    useAvatarStore.setState({
      playerId: 'pilot_cadet_local',
      avatar: makeAvatar('Cadet'),
      isEnlisted: true,
    });

    manager.connect('DRP555', false);
    const peer = mockRegistry.lastCreatedPeer!;
    peer.emit('open', 'peer_cadet_local');

    const hostConn = peer.outgoingConnections[0];
    expect(hostConn).toBeDefined();

    // Opening Host connection triggers auth approval & clears signal lost
    hostConn.emit('data', {
      kind: 'room_auth',
      senderId: 'aerostrikeomegav2DRP555',
      payload: {
        type: 'join_response',
        accepted: true,
        gamePhase: 'staging',
        mapId: 'sky-citadel',
      },
    });

    expect(useNetworkStore.getState().hostSignalLost).toBe(false);
    expect(useMapStore.getState().selectedMap.id).toBe('sky-citadel');

    // Socket drops -> triggers Host Signal Lost banner cleanly
    hostConn.close();
    expect(useNetworkStore.getState().hostSignalLost).toBe(true);
    expect(useNetworkStore.getState().hostDisconnectReason).toContain('dropped');
  });

  it('clears disconnected players from engineWorld on Cadets, blocks unverified peer_meta, and dedups duplicate start_match', () => {
    const hostPeer = setupHost('GHOST6');
    const connA = joinCadet(hostPeer, {
      peerId: 'peer_a',
      playerId: 'pilot_a',
      callsign: 'Alpha',
      team: 'red',
    });

    // Unverified peer cannot mutate peers or roster with peer_meta before join_request approval
    const intruderConn = new MockDataConnection('peer_rogue');
    hostPeer.emit('connection', intruderConn);
    intruderConn.emit('data', {
      kind: 'peer_meta',
      senderId: 'peer_rogue',
      payload: { callsign: 'FakeHost', team: 'red', isHost: true },
    });
    expect(useNetworkStore.getState().roster.peer_rogue).toBeUndefined();

    // Verified peer cannot elevate itself to Host via peer_meta, but callsign updates cleanly
    connA.emit('data', {
      kind: 'peer_meta',
      senderId: 'peer_a',
      payload: { callsign: 'AlphaPrime', team: 'blue', isHost: true },
    });
    expect(useNetworkStore.getState().roster.pilot_a.isHost).toBe(false);
    expect(useNetworkStore.getState().roster.pilot_a.callsign).toBe('AlphaPrime');
    expect(useNetworkStore.getState().roster.pilot_a.team).toBe('blue');

    // Simulate cadet remote entity existing in engineWorld when host announces offline roster
    engineWorld.upsertRemoteTransform({
      id: 'pilot_a',
      team: 'blue',
      x: 500,
      y: 600,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      health: 100,
      isBoosting: false,
      isDead: false,
      carryingFlag: false,
      isGrounded: true,
      weaponType: 'rifle',
    });
    expect(engineWorld.remotePlayers.has('pilot_a')).toBe(true);

    connA.close();
    expect(engineWorld.remotePlayers.has('pilot_a')).toBe(false);

    // Cadet verifies duplicate start_match with matching launchId only invokes callback once
    manager.disconnect();
    useAvatarStore.setState({
      playerId: 'pilot_cadet_local',
      avatar: makeAvatar('Cadet'),
      isEnlisted: true,
    });
    let startCalls = 0;
    let rematchCalls = 0;
    manager.setOnStartMatch(() => {
      startCalls += 1;
    });
    manager.setOnRematch(() => {
      rematchCalls += 1;
    });
    manager.connect('DEDUP7', false);
    const cadetPeer = mockRegistry.lastCreatedPeer!;
    cadetPeer.emit('open', 'peer_cadet_dedup');
    const hostConn = cadetPeer.outgoingConnections[0];

    const startMsg = {
      kind: 'match_control',
      senderId: 'aerostrikeomegav2DEDUP7',
      payload: {
        type: 'start_match',
        launchId: 'launch_123',
        mapId: 'ctf-canyon-arena',
      },
    };
    hostConn.emit('data', startMsg);
    hostConn.emit('data', startMsg);
    expect(startCalls).toBe(1);

    // Rematch transitions Cadet cleanly back to active battle phase
    useNetworkStore.getState().setGamePhase('staging');
    hostConn.emit('data', {
      kind: 'match_control',
      senderId: 'aerostrikeomegav2DEDUP7',
      payload: {
        type: 'rematch',
        launchId: 'rematch_456',
        mapId: 'sky-citadel',
      },
    });
    expect(rematchCalls).toBe(1);
    expect(useNetworkStore.getState().gamePhase).toBe('in_game');
  });
});
