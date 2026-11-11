import { create } from 'zustand';
import {
  DEFAULT_MATCH_RULES,
  sanitizeMatchRules,
  type Flag,
  type MatchRulesConfig,
  type MatchStatus,
  type Team,
} from './types';
import type { GameMap } from '../map/types';
import type { MatchSyncStatePayload } from '../network/types';
import { sounds } from '../audio/soundEngine';
import { useMatchStatsStore } from '../combat/statsStore';

let bannerTimeoutId: ReturnType<typeof setTimeout> | null = null;
let scoredResetTimeoutId: ReturnType<typeof setTimeout> | null = null;
// High-precision float clock updated silently each frame; synced to React store at <= 1 Hz.
let liveClockSec: number = DEFAULT_MATCH_RULES.timeLimitSec;

function scheduleBannerClear(
  setBanner: (msg: string | null) => void,
  delayMs: number = 2600,
) {
  if (bannerTimeoutId !== null) {
    clearTimeout(bannerTimeoutId);
  }
  bannerTimeoutId = setTimeout(() => {
    bannerTimeoutId = null;
    setBanner(null);
  }, delayMs);
}

interface CTFState {
  flags: Record<Team, Flag>;
  score: { blue: number; red: number };
  targetCaptures: number;
  matchRules: MatchRulesConfig;
  timeRemainingSec: number;
  isOvertime: boolean;
  matchStatus: MatchStatus;
  winner: Team | null;
  bannerMessage: string | null;
  stateSeq: number;
  lastScorer: {
    playerId: string;
    callsign: string;
    team: Team;
    captureSeq: number;
  } | null;

  setMatchRules: (rules: Partial<MatchRulesConfig>) => void;
  resetMatchRules: () => void;
  syncClockFromHost: (
    rules?: Partial<MatchRulesConfig>,
    hostTimeRemainingSec?: number,
    hostIsOvertime?: boolean,
  ) => void;
  initMatch: (map: GameMap, rulesOverride?: Partial<MatchRulesConfig>) => void;
  prepareClientArena: (map: GameMap, rulesOverride?: Partial<MatchRulesConfig>) => void;
  pickupFlag: (team: Team, carrierId: string) => boolean;
  dropFlag: (team: Team, x: number, y: number) => boolean;
  returnFlag: (team: Team) => boolean;
  captureFlag: (scoringTeam: Team, carrierName?: string, carrierId?: string) => boolean;
  tickTimers: (
    deltaSec: number,
    canAutoReturn?: boolean,
    isAuthoritativeClock?: boolean,
  ) => Team | null;
  setMatchStatus: (status: MatchStatus) => void;
  setBanner: (msg: string | null) => void;
  exportMatchState: () => MatchSyncStatePayload;
  applyAuthoritativeState: (payload: MatchSyncStatePayload, force?: boolean) => void;
  resetSequence: () => void;
}

const DEFAULT_FLAGS: Record<Team, Flag> = {
  blue: {
    team: 'blue',
    status: 'at_base',
    x: 280,
    y: 1320,
    baseX: 280,
    baseY: 1320,
    carrierId: null,
    returnTimer: 0,
  },
  red: {
    team: 'red',
    status: 'at_base',
    x: 2920,
    y: 1320,
    baseX: 2920,
    baseY: 1320,
    carrierId: null,
    returnTimer: 0,
  },
};

export const useCTFStore = create<CTFState>((set, get) => ({
  flags: DEFAULT_FLAGS,
  score: { blue: 0, red: 0 },
  targetCaptures: DEFAULT_MATCH_RULES.targetCaptures,
  matchRules: { ...DEFAULT_MATCH_RULES },
  timeRemainingSec: DEFAULT_MATCH_RULES.timeLimitSec,
  isOvertime: false,
  matchStatus: 'playing',
  winner: null,
  bannerMessage: null,
  stateSeq: 0,
  lastScorer: null,

  setMatchRules: (rules) => {
    const next = sanitizeMatchRules(rules, get().matchRules);
    liveClockSec = next.timeLimitSec;
    set({
      matchRules: next,
      targetCaptures: next.targetCaptures,
      timeRemainingSec: next.timeLimitSec,
      isOvertime: false,
    });
  },

  resetMatchRules: () => {
    liveClockSec = DEFAULT_MATCH_RULES.timeLimitSec;
    set({
      matchRules: { ...DEFAULT_MATCH_RULES },
      targetCaptures: DEFAULT_MATCH_RULES.targetCaptures,
      timeRemainingSec: DEFAULT_MATCH_RULES.timeLimitSec,
      isOvertime: false,
    });
  },

  syncClockFromHost: (rules, hostTimeRemainingSec, hostIsOvertime) => {
    const curr = get();
    const nextRules = rules ? sanitizeMatchRules(rules, curr.matchRules) : curr.matchRules;
    const rulesChanged =
      nextRules.targetCaptures !== curr.matchRules.targetCaptures ||
      nextRules.timeLimitSec !== curr.matchRules.timeLimitSec ||
      nextRules.respawnDelaySec !== curr.matchRules.respawnDelaySec;

    if (typeof hostTimeRemainingSec === 'number') {
      const clampedHostSec = Math.max(0, hostTimeRemainingSec);
      const nextOt = Boolean(hostIsOvertime);
      const drift = Math.abs(liveClockSec - clampedHostSec);
      const wholeSec = Math.ceil(clampedHostSec);

      if (drift > 1.5) {
        liveClockSec = clampedHostSec;
      }

      if (rulesChanged || nextOt !== curr.isOvertime || (drift > 1.5 && wholeSec !== curr.timeRemainingSec)) {
        set({
          matchRules: nextRules,
          targetCaptures: nextRules.targetCaptures,
          isOvertime: nextOt,
          timeRemainingSec: drift > 1.5 ? wholeSec : curr.timeRemainingSec,
        });
      }
    } else if (rulesChanged) {
      liveClockSec = nextRules.timeLimitSec;
      set({
        matchRules: nextRules,
        targetCaptures: nextRules.targetCaptures,
        timeRemainingSec: nextRules.timeLimitSec,
        isOvertime: false,
      });
    }
  },

  initMatch: (map, rulesOverride) => {
    if (scoredResetTimeoutId !== null) {
      clearTimeout(scoredResetTimeoutId);
      scoredResetTimeoutId = null;
    }
    const rules = rulesOverride
      ? sanitizeMatchRules(rulesOverride, get().matchRules)
      : get().matchRules;
    liveClockSec = rules.timeLimitSec;

    set((state) => ({
      score: { blue: 0, red: 0 },
      targetCaptures: rules.targetCaptures,
      matchRules: rules,
      timeRemainingSec: rules.timeLimitSec,
      isOvertime: false,
      winner: null,
      matchStatus: 'playing',
      bannerMessage: 'MATCH STARTED! CAPTURE THE ENEMY FLAG!',
      stateSeq: state.stateSeq + 1,
      lastScorer: null,
      flags: {
        blue: {
          team: 'blue',
          status: 'at_base',
          x: map.flagBlue.x,
          y: map.flagBlue.y,
          baseX: map.flagBlue.x,
          baseY: map.flagBlue.y,
          carrierId: null,
          returnTimer: 0,
        },
        red: {
          team: 'red',
          status: 'at_base',
          x: map.flagRed.x,
          y: map.flagRed.y,
          baseX: map.flagRed.x,
          baseY: map.flagRed.y,
          carrierId: null,
          returnTimer: 0,
        },
      },
    }));
    scheduleBannerClear((msg) => set({ bannerMessage: msg }), 2600);
  },

  prepareClientArena: (map, rulesOverride) => {
    if (scoredResetTimeoutId !== null) {
      clearTimeout(scoredResetTimeoutId);
      scoredResetTimeoutId = null;
    }
    const rules = rulesOverride
      ? sanitizeMatchRules(rulesOverride, get().matchRules)
      : get().matchRules;
    liveClockSec = rules.timeLimitSec;

    set({
      score: { blue: 0, red: 0 },
      targetCaptures: rules.targetCaptures,
      matchRules: rules,
      timeRemainingSec: rules.timeLimitSec,
      isOvertime: false,
      winner: null,
      matchStatus: 'playing',
      bannerMessage: 'MATCH STARTED! CAPTURE THE ENEMY FLAG!',
      stateSeq: 0,
      lastScorer: null,
      flags: {
        blue: {
          team: 'blue',
          status: 'at_base',
          x: map.flagBlue.x,
          y: map.flagBlue.y,
          baseX: map.flagBlue.x,
          baseY: map.flagBlue.y,
          carrierId: null,
          returnTimer: 0,
        },
        red: {
          team: 'red',
          status: 'at_base',
          x: map.flagRed.x,
          y: map.flagRed.y,
          baseX: map.flagRed.x,
          baseY: map.flagRed.y,
          carrierId: null,
          returnTimer: 0,
        },
      },
    });
    scheduleBannerClear((msg) => set({ bannerMessage: msg }), 2600);
  },

  pickupFlag: (team, carrierId) => {
    const flag = get().flags[team];
    if (flag.status === 'carried') return false;

    sounds.playFlagPickup();
    set((state) => ({
      stateSeq: state.stateSeq + 1,
      flags: {
        ...state.flags,
        [team]: {
          ...flag,
          status: 'carried',
          carrierId,
          returnTimer: 0,
        },
      },
      bannerMessage: `${team.toUpperCase()} FLAG TAKEN`,
    }));
    scheduleBannerClear((msg) => set({ bannerMessage: msg }), 2600);
    return true;
  },

  dropFlag: (team, x, y) => {
    const flag = get().flags[team];
    if (flag.status !== 'carried') return false;

    set((state) => ({
      stateSeq: state.stateSeq + 1,
      flags: {
        ...state.flags,
        [team]: {
          ...flag,
          status: 'dropped',
          carrierId: null,
          x,
          y,
          returnTimer: 20,
        },
      },
      bannerMessage: `${team.toUpperCase()} FLAG DROPPED`,
    }));
    scheduleBannerClear((msg) => set({ bannerMessage: msg }), 2400);
    return true;
  },

  returnFlag: (team) => {
    const flag = get().flags[team];
    if (flag.status === 'at_base') return false;
    sounds.playFlagReturn();
    set((state) => ({
      stateSeq: state.stateSeq + 1,
      flags: {
        ...state.flags,
        [team]: {
          ...flag,
          status: 'at_base',
          x: flag.baseX,
          y: flag.baseY,
          carrierId: null,
          returnTimer: 0,
        },
      },
      bannerMessage: `${team.toUpperCase()} FLAG RETURNED`,
    }));
    scheduleBannerClear((msg) => set({ bannerMessage: msg }), 2400);
    return true;
  },

  captureFlag: (scoringTeam, carrierName = 'Soldier', carrierId) => {
    const state = get();
    if (state.matchStatus !== 'playing') return false;

    const enemyTeam: Team = scoringTeam === 'blue' ? 'red' : 'blue';
    const enemyFlag = state.flags[enemyTeam];
    if (enemyFlag.status !== 'carried') return false;

    sounds.playFlagCapture();

    const scorerId = carrierId || enemyFlag.carrierId || 'unknown';
    const captureSeq = state.stateSeq + 1;
    const lastScorer = {
      playerId: scorerId,
      callsign: carrierName,
      team: scoringTeam,
      captureSeq,
    };

    const newScore = {
      ...state.score,
      [scoringTeam]: state.score[scoringTeam] + 1,
    };

    const hasWon = state.isOvertime || newScore[scoringTeam] >= state.targetCaptures;

    set((curr) => ({
      stateSeq: curr.stateSeq + 1,
      score: newScore,
      matchStatus: hasWon ? 'game_over' : 'scored',
      winner: hasWon ? scoringTeam : null,
      lastScorer,
      bannerMessage: hasWon
        ? curr.isOvertime
          ? `OVERTIME VICTORY • TEAM ${scoringTeam.toUpperCase()} WINS!`
          : `TEAM ${scoringTeam.toUpperCase()} WINS THE MATCH!`
        : `${scoringTeam.toUpperCase()} TEAM SCORED! (${carrierName})`,
      flags: {
        ...curr.flags,
        [enemyTeam]: {
          ...enemyFlag,
          status: 'at_base',
          x: enemyFlag.baseX,
          y: enemyFlag.baseY,
          carrierId: null,
          returnTimer: 0,
        },
      },
    }));

    useMatchStatsStore
      .getState()
      .recordCapture(scorerId, carrierName, scoringTeam, `cap_${captureSeq}`);

    if (!hasWon) {
      if (scoredResetTimeoutId !== null) {
        clearTimeout(scoredResetTimeoutId);
      }
      scoredResetTimeoutId = setTimeout(() => {
        scoredResetTimeoutId = null;
        if (get().matchStatus === 'scored') {
          set((curr) => ({
            matchStatus: 'playing',
            bannerMessage: null,
            stateSeq: curr.stateSeq + 1,
          }));
        }
      }, 2800);
    }
    return true;
  },

  tickTimers: (deltaSec, canAutoReturn = true, isAuthoritativeClock = true) => {
    const { flags, matchStatus, matchRules, isOvertime, timeRemainingSec, score } = get();
    if (matchStatus !== 'playing') return null;

    let returnedTeam: Team | null = null;
    for (const team of ['blue', 'red'] as Team[]) {
      const flag = flags[team];
      if (flag.status === 'dropped') {
        const nextTimer = flag.returnTimer - deltaSec;
        if (nextTimer <= 0) {
          flag.returnTimer = 0;
          if (canAutoReturn && get().returnFlag(team)) {
            returnedTeam = team;
          }
        } else {
          // Mutate countdown timer silently without forcing 60 FPS HUD React re-renders
          flag.returnTimer = nextTimer;
        }
      }
    }

    if (matchRules.timeLimitSec > 0 && !isOvertime) {
      liveClockSec = Math.max(0, liveClockSec - deltaSec);
      const nextWholeSec = Math.ceil(liveClockSec);

      if (liveClockSec <= 0) {
        if (isAuthoritativeClock) {
          if (score.blue === score.red) {
            sounds.playFlagPickup();
            set((curr) => ({
              stateSeq: curr.stateSeq + 1,
              timeRemainingSec: 0,
              isOvertime: true,
              bannerMessage: 'SUDDEN DEATH OVERTIME • NEXT CAPTURE WINS!',
            }));
            scheduleBannerClear((msg) => set({ bannerMessage: msg }), 3500);
          } else {
            const timeWinner: Team = score.blue > score.red ? 'blue' : 'red';
            sounds.playFlagCapture();
            set((curr) => ({
              stateSeq: curr.stateSeq + 1,
              timeRemainingSec: 0,
              isOvertime: false,
              matchStatus: 'game_over',
              winner: timeWinner,
              bannerMessage: `TIME EXPIRED • TEAM ${timeWinner.toUpperCase()} WINS!`,
            }));
          }
        } else if (timeRemainingSec !== 0) {
          set({ timeRemainingSec: 0 });
        }
      } else if (nextWholeSec !== timeRemainingSec) {
        set({ timeRemainingSec: nextWholeSec });
      }
    }

    return returnedTeam;
  },

  setMatchStatus: (matchStatus) => set({ matchStatus }),
  setBanner: (bannerMessage) => set({ bannerMessage }),

  exportMatchState: () => {
    const state = get();
    const exportedClock =
      state.matchRules.timeLimitSec > 0
        ? Math.ceil(Math.max(0, liveClockSec))
        : 0;
    return {
      seq: state.stateSeq,
      score: { ...state.score },
      targetCaptures: state.targetCaptures,
      matchRules: { ...state.matchRules },
      timeRemainingSec: exportedClock,
      isOvertime: state.isOvertime,
      matchStatus: state.matchStatus,
      winner: state.winner,
      bannerMessage: state.bannerMessage,
      lastScorer: state.lastScorer,
      flags: {
        blue: { ...state.flags.blue },
        red: { ...state.flags.red },
      },
    };
  },

  applyAuthoritativeState: (payload, force = false) => {
    const curr = get();
    if (!force && payload.seq <= curr.stateSeq) {
      return;
    }

    const prevScoreTotal = curr.score.blue + curr.score.red;
    const nextScoreTotal = payload.score.blue + payload.score.red;
    const nextRules = payload.matchRules
      ? sanitizeMatchRules(payload.matchRules, curr.matchRules)
      : { ...curr.matchRules, targetCaptures: sanitizeMatchRules({ targetCaptures: payload.targetCaptures as 1 | 3 | 5 | 7 }, curr.matchRules).targetCaptures };

    if (nextScoreTotal > prevScoreTotal || (payload.matchStatus === 'game_over' && curr.matchStatus !== 'game_over')) {
      sounds.playFlagCapture();
    } else if (payload.isOvertime && !curr.isOvertime) {
      sounds.playFlagPickup();
    } else {
      for (const team of ['blue', 'red'] as Team[]) {
        const prevStatus = curr.flags[team].status;
        const nextStatus = payload.flags[team].status;
        if (prevStatus !== nextStatus) {
          if (nextStatus === 'carried') sounds.playFlagPickup();
          else if (nextStatus === 'at_base') sounds.playFlagReturn();
        }
      }
    }

    const incomingClock =
      typeof payload.timeRemainingSec === 'number'
        ? Math.max(0, payload.timeRemainingSec)
        : nextRules.timeLimitSec;
    liveClockSec = incomingClock;

    set({
      stateSeq: payload.seq,
      score: { ...payload.score },
      targetCaptures: nextRules.targetCaptures,
      matchRules: nextRules,
      timeRemainingSec: Math.ceil(incomingClock),
      isOvertime: Boolean(payload.isOvertime),
      matchStatus: payload.matchStatus,
      winner: payload.winner,
      bannerMessage: payload.bannerMessage,
      lastScorer: payload.lastScorer ?? null,
      flags: {
        blue: { ...payload.flags.blue },
        red: { ...payload.flags.red },
      },
    });

    if (payload.lastScorer) {
      useMatchStatsStore
        .getState()
        .recordCapture(
          payload.lastScorer.playerId,
          payload.lastScorer.callsign,
          payload.lastScorer.team,
          `cap_${payload.lastScorer.captureSeq}`,
        );
    }

    if (payload.bannerMessage && payload.matchStatus === 'playing') {
      scheduleBannerClear((msg) => set({ bannerMessage: msg }), 2500);
    }
  },

  resetSequence: () => set({ stateSeq: 0 }),
}));
