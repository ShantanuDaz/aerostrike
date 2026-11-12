import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameMap } from '../map/types';
import { useCTFStore } from './ctfStore';
import { DEFAULT_MATCH_RULES, sanitizeMatchRules } from './types';
import { useMatchStatsStore } from '../combat/statsStore';

const TEST_MAP: GameMap = {
  id: 'ctf-test-map',
  name: 'CTF Test Arena',
  width: 2000,
  height: 1200,
  backgroundColor: '#000',
  baseBlue: { x: 80, y: 900, width: 200, height: 150 },
  baseRed: { x: 1720, y: 900, width: 200, height: 150 },
  flagBlue: { x: 180, y: 980 },
  flagRed: { x: 1820, y: 980 },
  spawnPointsBlue: [{ x: 150, y: 960 }],
  spawnPointsRed: [{ x: 1850, y: 960 }],
  weaponSpawns: [],
  obstacles: [],
};

describe('useCTFStore rules, flag lifecycle, clock, and sudden-death overtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useMatchStatsStore.getState().resetStats();
    useCTFStore.getState().resetSequence();
    useCTFStore.getState().resetMatchRules();
    useCTFStore.getState().initMatch(TEST_MAP);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('sanitizes valid presets and rejects invalid rule mutations', () => {
    expect(sanitizeMatchRules({ targetCaptures: 5, timeLimitSec: 480, respawnDelaySec: 2.5 })).toEqual({
      mode: 'ctf',
      targetCaptures: 5,
      timeLimitSec: 480,
      respawnDelaySec: 2.5,
    });

    // Timed modes coerce untimed (0) back to 300s default
    expect(sanitizeMatchRules({ mode: 'tdm', timeLimitSec: 0 })).toEqual({
      ...DEFAULT_MATCH_RULES,
      mode: 'tdm',
      timeLimitSec: 300,
    });
    expect(sanitizeMatchRules({ mode: 'ffa', timeLimitSec: 0 })).toEqual({
      ...DEFAULT_MATCH_RULES,
      mode: 'ffa',
      timeLimitSec: 300,
    });

    const sanitized = sanitizeMatchRules({
      mode: 'invalid' as never,
      targetCaptures: 99 as never,
      timeLimitSec: -50 as never,
      respawnDelaySec: 0.1 as never,
    });
    expect(sanitized).toEqual(DEFAULT_MATCH_RULES);
  });

  it('handles flag pickup, drop, 20s auto-return, and manual return', () => {
    const store = useCTFStore.getState();

    expect(store.pickupFlag('red', 'pilot_blue')).toBe(true);
    expect(store.pickupFlag('red', 'pilot_other')).toBe(false);
    expect(useCTFStore.getState().flags.red.status).toBe('carried');

    expect(store.dropFlag('red', 750, 420)).toBe(true);
    const dropped = useCTFStore.getState().flags.red;
    expect(dropped.status).toBe('dropped');
    expect(dropped.x).toBe(750);
    expect(dropped.y).toBe(420);

    // Ticking 15s keeps flag dropped with 5s left
    expect(store.tickTimers(15, true, false)).toBeNull();
    expect(useCTFStore.getState().flags.red.status).toBe('dropped');

    // Ticking past 20s returns flag to base automatically
    expect(store.tickTimers(6, true, false)).toBe('red');
    const returned = useCTFStore.getState().flags.red;
    expect(returned.status).toBe('at_base');
    expect(returned.x).toBe(TEST_MAP.flagRed.x);
    expect(returned.y).toBe(TEST_MAP.flagRed.y);
  });

  it('tracks scores, intermediate scored phase, and targetCaptures victory', () => {
    useCTFStore.getState().initMatch(TEST_MAP, { targetCaptures: 3, timeLimitSec: 0 });

    expect(useCTFStore.getState().pickupFlag('red', 'pilot_blue_1')).toBe(true);
    expect(useCTFStore.getState().captureFlag('blue', 'Vanguard', 'pilot_blue_1')).toBe(true);

    let state = useCTFStore.getState();
    expect(state.score.blue).toBe(1);
    expect(state.matchStatus).toBe('scored');
    expect(state.flags.red.status).toBe('at_base');
    expect(useMatchStatsStore.getState().statsByPlayerId.pilot_blue_1?.captures).toBe(1);

    // Captures blocked while intermediate celebration banner is active
    expect(useCTFStore.getState().captureFlag('blue', 'Vanguard', 'pilot_blue_1')).toBe(false);

    vi.advanceTimersByTime(2900);
    expect(useCTFStore.getState().matchStatus).toBe('playing');

    // Score two more times to hit FT3 target
    for (let i = 0; i < 2; i++) {
      useCTFStore.getState().pickupFlag('red', 'pilot_blue_1');
      useCTFStore.getState().captureFlag('blue', 'Vanguard', 'pilot_blue_1');
      if (i === 0) vi.advanceTimersByTime(2900);
    }

    state = useCTFStore.getState();
    expect(state.score.blue).toBe(3);
    expect(state.matchStatus).toBe('game_over');
    expect(state.winner).toBe('blue');
  });

  it('awards victory to leading team when timed clock expires without tie', () => {
    useCTFStore.getState().initMatch(TEST_MAP, { targetCaptures: 5, timeLimitSec: 180 });
    useCTFStore.getState().pickupFlag('red', 'pilot_b');
    useCTFStore.getState().captureFlag('blue', 'Ace', 'pilot_b');
    vi.advanceTimersByTime(2900);

    // Run clock down to 1 second remaining
    useCTFStore.getState().tickTimers(179, true, true);
    expect(useCTFStore.getState().timeRemainingSec).toBe(1);
    expect(useCTFStore.getState().matchStatus).toBe('playing');

    // Expiring while leading 1-0 ends match for Blue
    useCTFStore.getState().tickTimers(1.5, true, true);
    const ended = useCTFStore.getState();
    expect(ended.timeRemainingSec).toBe(0);
    expect(ended.isOvertime).toBe(false);
    expect(ended.matchStatus).toBe('game_over');
    expect(ended.winner).toBe('blue');
  });

  it('enters Sudden-Death Overtime when tied at 0:00 and ends immediately on next capture', () => {
    useCTFStore.getState().initMatch(TEST_MAP, { targetCaptures: 5, timeLimitSec: 180 });
    useCTFStore.getState().pickupFlag('red', 'pilot_b');
    useCTFStore.getState().captureFlag('blue', 'Ace', 'pilot_b');
    vi.advanceTimersByTime(2900);
    useCTFStore.getState().pickupFlag('blue', 'pilot_r');
    useCTFStore.getState().captureFlag('red', 'Spectre', 'pilot_r');
    vi.advanceTimersByTime(2900);

    expect(useCTFStore.getState().score).toEqual({ blue: 1, red: 1 });

    // Time expires tied 1-1 -> enter Overtime instead of ending
    useCTFStore.getState().tickTimers(180, true, true);
    const otState = useCTFStore.getState();
    expect(otState.timeRemainingSec).toBe(0);
    expect(otState.isOvertime).toBe(true);
    expect(otState.matchStatus).toBe('playing');
    expect(otState.winner).toBeNull();

    // Next capture in OT wins immediately even though score is only 2 < targetCaptures(5)
    useCTFStore.getState().pickupFlag('blue', 'pilot_r');
    useCTFStore.getState().captureFlag('red', 'Spectre', 'pilot_r');

    const finalState = useCTFStore.getState();
    expect(finalState.score).toEqual({ blue: 1, red: 2 });
    expect(finalState.matchStatus).toBe('game_over');
    expect(finalState.winner).toBe('red');
  });

  it('exports and applies authoritative host snapshots while rejecting stale stateSeq', () => {
    useCTFStore.getState().initMatch(TEST_MAP, { targetCaptures: 7, timeLimitSec: 300 });
    useCTFStore.getState().pickupFlag('red', 'host_blue');
    useCTFStore.getState().captureFlag('blue', 'Host', 'host_blue');
    vi.advanceTimersByTime(2900);
    useCTFStore.getState().tickTimers(45, true, true);

    const snapshot = useCTFStore.getState().exportMatchState();
    expect(snapshot.score.blue).toBe(1);
    expect(snapshot.timeRemainingSec).toBe(255);
    expect(snapshot.matchRules?.targetCaptures).toBe(7);

    // Apply on clean client
    useCTFStore.getState().prepareClientArena(TEST_MAP);
    useCTFStore.getState().applyAuthoritativeState(snapshot);

    const clientState = useCTFStore.getState();
    expect(clientState.score.blue).toBe(1);
    expect(clientState.targetCaptures).toBe(7);
    expect(clientState.timeRemainingSec).toBe(255);

    // Stale lower seq is ignored unless force=true
    useCTFStore.getState().applyAuthoritativeState({
      ...snapshot,
      seq: snapshot.seq - 1,
      score: { blue: 0, red: 99 },
    });
    expect(useCTFStore.getState().score).toEqual({ blue: 1, red: 0 });
  });

  it('tracks TDM team kill tallies, timed victory, and Sudden-Death Overtime under Host authority', () => {
    useCTFStore.getState().initMatch(TEST_MAP, { mode: 'tdm', timeLimitSec: 180 });
    expect(useCTFStore.getState().matchRules.mode).toBe('tdm');

    // Flags cannot be picked up in TDM
    expect(useCTFStore.getState().pickupFlag('red', 'p1')).toBe(false);

    // Record kills -> increments team kill score and authoritative player stats
    useCTFStore.getState().recordAuthoritativeKill({
      id: 'tdm_k1',
      killerId: 'p_blue',
      killerCallsign: 'Ace',
      killerTeam: 'blue',
      victimId: 'p_red',
      victimCallsign: 'Spectre',
      victimTeam: 'red',
      weaponType: 'rifle',
    });
    expect(useCTFStore.getState().score).toEqual({ blue: 1, red: 0 });

    // Non-host kill feed helper updates feed ONLY, preserving Host stats authority
    useMatchStatsStore.getState().recordKillFeedOnly({
      id: 'tdm_client_feed_only',
      killerId: 'p_red',
      killerCallsign: 'Spectre',
      killerTeam: 'red',
      victimId: 'p_blue',
      victimCallsign: 'Ace',
      victimTeam: 'blue',
      weaponType: 'pistol',
    });
    expect(useMatchStatsStore.getState().statsByPlayerId.p_red?.kills ?? 0).toBe(0);
    expect(useMatchStatsStore.getState().killFeed.some((k) => k.id === 'tdm_client_feed_only')).toBe(true);

    // Tie it 1-1 via authoritative kill, then expire clock -> enters Overtime
    useCTFStore.getState().recordAuthoritativeKill({
      id: 'tdm_k2',
      killerId: 'p_red',
      killerCallsign: 'Spectre',
      killerTeam: 'red',
      victimId: 'p_blue',
      victimCallsign: 'Ace',
      victimTeam: 'blue',
      weaponType: 'sniper',
    });
    expect(useCTFStore.getState().score).toEqual({ blue: 1, red: 1 });

    useCTFStore.getState().tickTimers(180, true, true);
    expect(useCTFStore.getState().isOvertime).toBe(true);
    expect(useCTFStore.getState().matchStatus).toBe('playing');

    // Next kill in Overtime wins immediately
    useCTFStore.getState().recordAuthoritativeKill({
      id: 'tdm_k3',
      killerId: 'p_blue',
      killerCallsign: 'Ace',
      killerTeam: 'blue',
      victimId: 'p_red',
      victimCallsign: 'Spectre',
      victimTeam: 'red',
      weaponType: 'shotgun',
    });
    const finalState = useCTFStore.getState();
    expect(finalState.matchStatus).toBe('game_over');
    expect(finalState.winner).toBe('blue');
    expect(finalState.score).toEqual({ blue: 2, red: 1 });
  });

  it('decides FFA 1st/2nd/3rd place by kills when timed clock expires and syncs winnerId & playerStats', () => {
    useCTFStore.getState().initMatch(TEST_MAP, { mode: 'ffa', timeLimitSec: 180 });
    useMatchStatsStore.getState().registerParticipant('p1', 'Alpha', 'blue');
    useMatchStatsStore.getState().registerParticipant('p2', 'Bravo', 'red');
    useMatchStatsStore.getState().registerParticipant('p3', 'Charlie', 'blue');

    // Alpha: 3 kills, Bravo: 2 kills, Charlie: 1 kill
    for (let i = 0; i < 3; i++) {
      useCTFStore.getState().recordAuthoritativeKill({
        id: `ffa_a_${i}`,
        killerId: 'p1',
        killerCallsign: 'Alpha',
        killerTeam: 'blue',
        victimId: 'p3',
        victimCallsign: 'Charlie',
        victimTeam: 'blue',
        weaponType: 'rifle',
      });
    }
    for (let i = 0; i < 2; i++) {
      useCTFStore.getState().recordAuthoritativeKill({
        id: `ffa_b_${i}`,
        killerId: 'p2',
        killerCallsign: 'Bravo',
        killerTeam: 'red',
        victimId: 'p3',
        victimCallsign: 'Charlie',
        victimTeam: 'blue',
        weaponType: 'shotgun',
      });
    }
    useCTFStore.getState().recordAuthoritativeKill({
      id: 'ffa_c_0',
      killerId: 'p3',
      killerCallsign: 'Charlie',
      killerTeam: 'blue',
      victimId: 'p2',
      victimCallsign: 'Bravo',
      victimTeam: 'red',
      weaponType: 'pistol',
    });

    useCTFStore.getState().tickTimers(180, true, true);
    const ended = useCTFStore.getState();
    expect(ended.matchStatus).toBe('game_over');
    expect(ended.winnerId).toBe('p1');
    expect(ended.winnerCallsign).toBe('Alpha');

    // Snapshot carries authoritative playerStats & winnerId to clients
    const snapshot = ended.exportMatchState();
    expect(snapshot.winnerId).toBe('p1');
    expect(snapshot.playerStats?.find((s) => s.playerId === 'p1')?.kills).toBe(3);

    useCTFStore.getState().prepareClientArena(TEST_MAP, { mode: 'ffa', timeLimitSec: 180 });
    useMatchStatsStore.getState().resetStats();
    useCTFStore.getState().applyAuthoritativeState(snapshot, true);

    expect(useCTFStore.getState().winnerId).toBe('p1');
    expect(useMatchStatsStore.getState().statsByPlayerId.p1?.kills).toBe(3);
    expect(useMatchStatsStore.getState().statsByPlayerId.p2?.kills).toBe(2);
    expect(useMatchStatsStore.getState().statsByPlayerId.p3?.kills).toBe(1);
  });
});
