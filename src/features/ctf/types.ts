export type Team = 'blue' | 'red';

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
  targetCaptures: TargetCapturesPreset;
  timeLimitSec: MatchTimeLimitPreset;
  respawnDelaySec: RespawnDelayPreset;
}

export const DEFAULT_MATCH_RULES: MatchRulesConfig = {
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

  const targetCaptures = validTargets.includes(raw?.targetCaptures as TargetCapturesPreset)
    ? (raw!.targetCaptures as TargetCapturesPreset)
    : fallback.targetCaptures;

  const timeLimitSec = validClocks.includes(raw?.timeLimitSec as MatchTimeLimitPreset)
    ? (raw!.timeLimitSec as MatchTimeLimitPreset)
    : fallback.timeLimitSec;

  const respawnDelaySec = validRespawns.includes(raw?.respawnDelaySec as RespawnDelayPreset)
    ? (raw!.respawnDelaySec as RespawnDelayPreset)
    : fallback.respawnDelaySec;

  return { targetCaptures, timeLimitSec, respawnDelaySec };
}

export interface ScoreBoard {
  blue: number;
  red: number;
  targetCaptures: number;
}
