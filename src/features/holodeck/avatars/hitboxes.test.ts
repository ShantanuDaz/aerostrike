import { describe, expect, it } from 'vitest';
import {
  buildPlayerHitboxes,
  raycastPlayerHitboxes,
  HITBOX_MULTIPLIERS,
} from './hitboxZones';

describe('Discrete Hitbox Zones & Multipliers', () => {
  it('detects a pinpoint headshot with 4.0x critical damage multiplier', () => {
    // Player standing at (0, 0, 10)
    const hitboxes = buildPlayerHitboxes('target_1', [0, 0, 10], false);
    // Shooter at (0, 1.7, 0) aiming directly forward at head height (1.7m)
    const rayOrigin: [number, number, number] = [0, 1.7, 0];
    const rayDir: [number, number, number] = [0, 0, 1];

    const result = raycastPlayerHitboxes(rayOrigin, rayDir, hitboxes);
    expect(result.hit).toBe(true);
    expect(result.zone).toBe('head');
    expect(result.multiplier).toBe(HITBOX_MULTIPLIERS.head);
    expect(result.multiplier).toBe(4.0);
    expect(result.playerId).toBe('target_1');
  });

  it('detects a center-mass torso hit with 1.0x standard damage multiplier', () => {
    const hitboxes = buildPlayerHitboxes('target_1', [0, 0, 10], false);
    // Shooter at (0, 1.1, 0) aiming directly forward at chest height (1.1m)
    const rayOrigin: [number, number, number] = [0, 1.1, 0];
    const rayDir: [number, number, number] = [0, 0, 1];

    const result = raycastPlayerHitboxes(rayOrigin, rayDir, hitboxes);
    expect(result.hit).toBe(true);
    expect(result.zone).toBe('torso');
    expect(result.multiplier).toBe(1.0);
  });

  it('detects a low leg hit with 0.75x reduced damage multiplier', () => {
    const hitboxes = buildPlayerHitboxes('target_1', [0, 0, 10], false);
    // Shooter aiming low at knee height (0.4m)
    const rayOrigin: [number, number, number] = [0, 0.4, 0];
    const rayDir: [number, number, number] = [0, 0, 1];

    const result = raycastPlayerHitboxes(rayOrigin, rayDir, hitboxes);
    expect(result.hit).toBe(true);
    expect(result.zone).toBe('limbs');
    expect(result.multiplier).toBe(0.75);
  });

  it('returns no hit when ray passes wide or over the target', () => {
    const hitboxes = buildPlayerHitboxes('target_1', [0, 0, 10], false);
    // Ray shooting over the head at 2.5m
    const rayOrigin: [number, number, number] = [0, 2.5, 0];
    const rayDir: [number, number, number] = [0, 0, 1];

    const result = raycastPlayerHitboxes(rayOrigin, rayDir, hitboxes);
    expect(result.hit).toBe(false);
  });
});
