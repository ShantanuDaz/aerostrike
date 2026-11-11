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
      targetCaptures: 5,
      timeLimitSec: 480,
      respawnDelaySec: 2.5,
    });

    const sanitized = sanitizeMatchRules({
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
});
