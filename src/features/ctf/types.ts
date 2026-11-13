export type Team = 'blue' | 'red';

export type GameMode = 'ctf' | 'tdm' | 'ffa' | 'holodeck';

export const GAME_MODES: readonly GameMode[] = ['ctf', 'tdm', 'ffa', 'holodeck'] as const;

export interface GameModeMeta {
  id: GameMode;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  isTeamBased: boolean;
}

export const GAME_MODE_META: Record<GameMode, GameModeMeta> = {
  ctf: {
    id: 'ctf',
    label: 'Team Flag Steal',
    shortLabel: 'CTF',
    tagline: 'Capture Enemy Flag',
    description: 'Steal the rival team flag and bring it back to your post — capture anytime, even if your flag is out.',
    isTeamBased: true,
  },
  tdm: {
    id: 'tdm',
    label: 'Team Kills',
    shortLabel: 'TDM',
    tagline: 'Most Kills in Time',
    description: 'Blue vs Red squads compete for the highest team kill count before the match timer hits zero.',
    isTeamBased: true,
  },
  ffa: {
    id: 'ffa',
    label: 'Free For All',
    shortLabel: 'FFA',
    tagline: 'Top 3 Kill Podium',
    description: 'Every pilot for themselves — 1st, 2nd, and 3rd place are decided by total kills within the time limit.',
    isTeamBased: false,
  },
  holodeck: {
    id: 'holodeck',
    label: 'Data Core Defusal',
    shortLabel: 'SND',
    tagline: 'Search & Destroy',
    description: 'Attackers arm the Data Core at Site A or B; Defenders prevent or defuse before detonation.',
    isTeamBased: true,
  },
};

export type FlagStatus = 'at_base' | 'carried' | 'dropped';

export interface Flag {
  team: Team;
  status: FlagStatus;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  carrierId: string | null;
  returnTimer: number; // in seconds, counts down when dropped
}

export type MatchStatus = 'lobby' | 'countdown' | 'playing' | 'scored' | 'game_over';

export type TargetCapturesPreset = 1 | 3 | 5 | 7;
export type MatchTimeLimitPreset = 0 | 180 | 300 | 480; // 0 = Untimed
export type RespawnDelayPreset = 2.5 | 4.5 | 6.5;

export interface MatchRulesConfig {
  mode: GameMode;
  targetCaptures: TargetCapturesPreset;
  timeLimitSec: MatchTimeLimitPreset;
  respawnDelaySec: RespawnDelayPreset;
}

export const DEFAULT_MATCH_RULES: MatchRulesConfig = {
  mode: 'ctf',
  targetCaptures: 3,
  timeLimitSec: 300,
  respawnDelaySec: 4.5,
};

export function sanitizeMatchRules(
  raw?: Partial<MatchRulesConfig> | null,
  fallback: MatchRulesConfig = DEFAULT_MATCH_RULES,
): MatchRulesConfig {
  const validTargets: readonly TargetCapturesPreset[] = [1, 3, 5, 7];
  const validClocks: readonly MatchTimeLimitPreset[] = [0, 180, 300, 480];
  const validRespawns: readonly RespawnDelayPreset[] = [2.5, 4.5, 6.5];

  const fallbackMode: GameMode = GAME_MODES.includes(fallback.mode) ? fallback.mode : 'ctf';
  const mode: GameMode = GAME_MODES.includes(raw?.mode as GameMode)
    ? (raw!.mode as GameMode)
    : fallbackMode;

  const targetCaptures = validTargets.includes(raw?.targetCaptures as TargetCapturesPreset)
    ? (raw!.targetCaptures as TargetCapturesPreset)
    : fallback.targetCaptures;

  let timeLimitSec = validClocks.includes(raw?.timeLimitSec as MatchTimeLimitPreset)
    ? (raw!.timeLimitSec as MatchTimeLimitPreset)
    : fallback.timeLimitSec;

  // Timed kill modes (Team Kills & Free For All) require an active countdown timer.
  if (mode !== 'ctf' && timeLimitSec === 0) {
    timeLimitSec = 300;
  }

  const respawnDelaySec = validRespawns.includes(raw?.respawnDelaySec as RespawnDelayPreset)
    ? (raw!.respawnDelaySec as RespawnDelayPreset)
    : fallback.respawnDelaySec;

  return { mode, targetCaptures, timeLimitSec, respawnDelaySec };
}

export interface ScoreBoard {
  blue: number;
  red: number;
  targetCaptures: number;
}
