import type { Team } from '../../ctf/types';
import type { HolodeckRoundPhase } from '../core/types';

export interface RoundEvaluationInput {
  roundPhase: HolodeckRoundPhase;
  roundTimeRemainingSec: number;
  spikeState: 'idle' | 'carried' | 'planting' | 'planted' | 'defusing' | 'defused' | 'detonated';
  aliveAttackers: number;
  aliveDefenders: number;
}

export interface RoundEvaluationResult {
  roundEnded: boolean;
  winningTeam: Team | null;
  winReason: 'detonation' | 'defusal' | 'attackers_eliminated' | 'defenders_eliminated' | 'time_expired' | null;
}

export function evaluateRoundOutcome(input: RoundEvaluationInput): RoundEvaluationResult {
  const { roundPhase, roundTimeRemainingSec, spikeState, aliveAttackers, aliveDefenders } = input;

  if (roundPhase === 'round_ended' || roundPhase === 'game_over') {
    return { roundEnded: false, winningTeam: null, winReason: null };
  }

  // 1. Spike Detonation -> Immediate Attacker Victory
  if (spikeState === 'detonated') {
    return { roundEnded: true, winningTeam: 'red', winReason: 'detonation' };
  }

  // 2. Spike Defused -> Immediate Defender Victory
  if (spikeState === 'defused') {
    return { roundEnded: true, winningTeam: 'blue', winReason: 'defusal' };
  }

  // 3. All Attackers Eliminated
  if (aliveAttackers <= 0) {
    if (spikeState === 'planted' || spikeState === 'defusing') {
      // Defenders still need to defuse!
      return { roundEnded: false, winningTeam: null, winReason: null };
    }
    return { roundEnded: true, winningTeam: 'blue', winReason: 'attackers_eliminated' };
  }

  // 4. All Defenders Eliminated
  if (aliveDefenders <= 0) {
    return { roundEnded: true, winningTeam: 'red', winReason: 'defenders_eliminated' };
  }

  // 5. Round Clock Expiration (when spike is not planted)
  if (roundTimeRemainingSec <= 0 && spikeState !== 'planted' && spikeState !== 'defusing') {
    return { roundEnded: true, winningTeam: 'blue', winReason: 'time_expired' };
  }

  return { roundEnded: false, winningTeam: null, winReason: null };
}
