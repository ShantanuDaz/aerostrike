import { describe, expect, it } from 'vitest';
import {
  createInitialBots3D,
  hasLineOfSight,
  stepBot3D,
} from './botAI3D';
import { createInitialSpikeEntity } from './spikeController';
import type { AABB } from '../physics/sweptAABB';

describe('Holodeck 3D Tactical Bot AI', () => {
  const wallBetween: AABB = {
    min: [-5, 0, 5],
    max: [5, 4, 7],
  };

  it('detects unobstructed line of sight and detects wall occlusion', () => {
    // Clear path
    const clear = hasLineOfSight([0, 0, 0], [0, 0, 20], []);
    expect(clear).toBe(true);

    // Wall in between at z = 6
    const blocked = hasLineOfSight([0, 0, 0], [0, 0, 20], [wallBetween]);
    expect(blocked).toBe(false);
  });

  it('turns toward visible player and begins firing after human reaction delay', () => {
    const bots = createInitialBots3D();
    let bot = bots[0];
    const spike = createInitialSpikeEntity();
    const playerPos: [number, number, number] = [35, 0.4, 0]; // in line of sight

    // Step by 0.1s (under reaction threshold)
    let res = stepBot3D(bot, playerPos, true, spike, [], 0.1, 1.0);
    bot = res.bot;
    expect(res.shouldShoot).toBe(false);

    // Step past 0.35s reaction threshold
    res = stepBot3D(bot, playerPos, true, spike, [], 0.3, 1.4);
    bot = res.bot;
    expect(res.shouldShoot).toBe(true);
  });

  it('moves toward planted spike when playing defender', () => {
    const bots = createInitialBots3D();
    let bot = bots[0]; // Defender at (35, 0.4, -20)
    const spike = createInitialSpikeEntity();
    spike.state = 'planted';
    spike.position = [0, 0, 0];

    const initialDist = Math.hypot(bot.position[0], bot.position[2]);
    const res = stepBot3D(bot, [100, 100, 100], false, spike, [], 0.5, 1.0);
    const nextDist = Math.hypot(res.bot.position[0], res.bot.position[2]);

    expect(nextDist).toBeLessThan(initialDist); // moved closer to spike
  });

  it('calculates correct Three.js facing yaw towards target without moonwalking', () => {
    const bots = createInitialBots3D();
    const bot = bots[0];
    bot.position = [0, 0, 0];
    const spike = createInitialSpikeEntity();

    // Target at -Z (straight ahead in Three.js coordinates)
    const resFront = stepBot3D(bot, [0, 0, -20], true, spike, [], 0.05, 1.0);
    expect(resFront.bot.yaw).toBeCloseTo(0, 4);

    // Target at +Z (directly behind in Three.js coordinates)
    const resBack = stepBot3D(bot, [0, 0, 20], true, spike, [], 0.05, 1.0);
    expect(Math.abs(resBack.bot.yaw)).toBeCloseTo(Math.PI, 4);

    // Target at +X (directly to the right in Three.js coordinates)
    const resRight = stepBot3D(bot, [20, 0, 0], true, spike, [], 0.05, 1.0);
    expect(resRight.bot.yaw).toBeCloseTo(-Math.PI / 2, 4);
  });

  it('performs tactical jiggle-peeking when guarding lane and ducks during combat', () => {
    const bots = createInitialBots3D();
    const bot = bots[0];
    const spike = createInitialSpikeEntity();

    // Step bot during idle patrol
    bot.tacticalTimer = 0.2;
    const resIdle = stepBot3D(bot, [100, 100, 100], false, spike, [], 0.5, 1.0);
    expect(resIdle.bot.position[0]).not.toBe(bot.basePosition?.[0]);

    // Step bot right after firing a shot in combat -> ducks into crouch
    const combatBot = { ...bot, lastShotTimeSec: 1.0 };
    const resCombat = stepBot3D(combatBot, [35, 0.4, -5], true, spike, [], 0.05, 1.2);
    expect(resCombat.bot.isCrouching).toBe(true);
  });
});
