import { describe, expect, it } from 'vitest';
import {
  createInitialSpikeEntity,
  stepSpike,
  HALF_DEFUSE_SEC,
} from './spikeController';
import { evaluateRoundOutcome } from './roundRules';

describe('Search & Defuse / Spike Mechanics', () => {
  it('plants the Spike after holding plant in a site for 4.0s', () => {
    let spike = createInitialSpikeEntity();
    const beep = { timer: 0 };

    // Hold plant for 2.0s
    let result = stepSpike(spike, 2.0, true, 'A', false, 'pilot_red', null, beep);
    spike = result.spike;
    expect(spike.state).toBe('planting');
    expect(spike.plantProgress).toBe(2.0);
    expect(result.justPlanted).toBe(false);

    // Hold for remaining 2.0s
    result = stepSpike(spike, 2.0, true, 'A', false, 'pilot_red', null, beep);
    spike = result.spike;
    expect(spike.state).toBe('planted');
    expect(spike.site).toBe('A');
    expect(result.justPlanted).toBe(true);
    expect(spike.detonationTimer).toBe(45.0);
  });

  it('aborts plant if player stops holding before 4.0s', () => {
    let spike = createInitialSpikeEntity();
    const beep = { timer: 0 };

    // Plant for 1.5s
    let result = stepSpike(spike, 1.5, true, 'A', false, 'pilot_red', null, beep);
    spike = result.spike;
    expect(spike.state).toBe('planting');

    // Release button
    result = stepSpike(spike, 0.1, false, 'A', false, 'pilot_red', null, beep);
    spike = result.spike;
    expect(spike.state).toBe('carried');
    expect(spike.plantProgress).toBe(0);
  });

  it('defuses the Spike after 7.0s and preserves half-defuse milestone at 3.5s', () => {
    let spike = createInitialSpikeEntity();
    spike.state = 'planted';
    spike.site = 'A';
    const beep = { timer: 0 };

    // Defuse for 3.8s (crossing half-defuse milestone)
    let result = stepSpike(spike, 3.8, false, null, true, null, 'pilot_blue', beep);
    spike = result.spike;
    expect(spike.state).toBe('defusing');
    expect(spike.defuseProgress).toBe(3.8);

    // Defender lets go (e.g. to fight an attacker)
    result = stepSpike(spike, 0.1, false, null, false, null, null, beep);
    spike = result.spike;
    expect(spike.state).toBe('planted');
    // Half-defuse milestone preserved!
    expect(spike.defuseProgress).toBe(HALF_DEFUSE_SEC);

    // Defender resumes defusing for remaining 3.5s
    result = stepSpike(spike, 3.5, false, null, true, null, 'pilot_blue', beep);
    spike = result.spike;
    expect(spike.state).toBe('defused');
    expect(result.justDefused).toBe(true);
  });

  it('evaluates round outcome when spike is defused or detonated', () => {
    // Defusal gives victory to Blue (Defenders)
    const defusedOutcome = evaluateRoundOutcome({
      roundPhase: 'spike_planted',
      roundTimeRemainingSec: 20,
      spikeState: 'defused',
      aliveAttackers: 3,
      aliveDefenders: 2,
    });
    expect(defusedOutcome.roundEnded).toBe(true);
    expect(defusedOutcome.winningTeam).toBe('blue');
    expect(defusedOutcome.winReason).toBe('defusal');

    // Detonation gives victory to Red (Attackers)
    const detonatedOutcome = evaluateRoundOutcome({
      roundPhase: 'spike_planted',
      roundTimeRemainingSec: 0,
      spikeState: 'detonated',
      aliveAttackers: 0,
      aliveDefenders: 4,
    });
    expect(detonatedOutcome.roundEnded).toBe(true);
    expect(detonatedOutcome.winningTeam).toBe('red');
    expect(detonatedOutcome.winReason).toBe('detonation');
  });
});
