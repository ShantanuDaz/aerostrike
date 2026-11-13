import { describe, expect, it } from 'vitest';
import {
  createInitialGunplayState,
  canFireWeapon,
  executeShot,
  startReload,
  finishReloadIfReady,
  updateGunplayBloom,
  rayIntersectsAABB,
} from './gunplayController';
import { HOLODECK_WEAPONS } from '../core/types';
import type { AABB } from '../physics/sweptAABB';

describe('Holodeck Weapons & Gunplay System', () => {
  it('correctly manages ammo consumption and fire rate gating', () => {
    let state = createInitialGunplayState();
    expect(state.activeWeaponId).toBe('vandal');
    expect(state.ammo.vandal.clip).toBe(25);

    // Can fire at t = 1.0s
    expect(canFireWeapon(state, 1.0)).toBe(true);

    // Fire one shot
    state = executeShot(state, 1.0);
    expect(state.ammo.vandal.clip).toBe(24);
    expect(state.currentBloomRad).toBeGreaterThan(0);

    // Rapid immediate follow-up shot before minInterval should be blocked
    const minInterval = 1.0 / HOLODECK_WEAPONS.vandal.fireRateRps;
    expect(canFireWeapon(state, 1.0 + minInterval * 0.5)).toBe(false);

    // After minInterval has passed, shot should be allowed
    expect(canFireWeapon(state, 1.0 + minInterval + 0.001)).toBe(true);
  });

  it('handles reload timing and ammo transfer from reserve', () => {
    let state = createInitialGunplayState();
    // Fire 5 shots
    for (let i = 0; i < 5; i++) {
      state = executeShot(state, i * 0.2);
    }
    expect(state.ammo.vandal.clip).toBe(20);
    expect(state.ammo.vandal.reserve).toBe(75);

    // Start reload at t = 2.0s
    state = startReload(state, 2.0);
    expect(state.isReloading).toBe(true);
    expect(state.reloadEndTimeSec).toBe(2.0 + HOLODECK_WEAPONS.vandal.reloadTimeSec);

    // Halfway through reload, cannot fire and reload is not done
    expect(canFireWeapon(state, 3.0)).toBe(false);
    state = finishReloadIfReady(state, 3.0);
    expect(state.isReloading).toBe(true);
    expect(state.ammo.vandal.clip).toBe(20);

    // Finish reload after duration
    state = finishReloadIfReady(state, 5.0);
    expect(state.isReloading).toBe(false);
    expect(state.ammo.vandal.clip).toBe(25);
    expect(state.ammo.vandal.reserve).toBe(70);
  });

  it('recovers recoil bloom when standing still and expands bloom when running', () => {
    let state = createInitialGunplayState();
    state.currentBloomRad = 0.08;

    // Moving still (speed = 0) recovers bloom
    state = updateGunplayBloom(state, 0.1, 0, true);
    expect(state.currentBloomRad).toBeLessThan(0.08);

    // Moving fast expands bloom
    state = updateGunplayBloom(state, 0.1, 6.0, true);
    expect(state.currentBloomRad).toBeGreaterThan(0.03);
  });

  it('performs accurate raycast intersection against 3D AABB boxes', () => {
    const box: AABB = {
      min: [5, -1, -1],
      max: [7, 1, 1],
    };
    const rayOrigin: [number, number, number] = [0, 0, 0];
    const rayDir: [number, number, number] = [1, 0, 0]; // facing +X directly into box

    const result = rayIntersectsAABB(rayOrigin, rayDir, box);
    expect(result.hit).toBe(true);
    expect(result.distance).toBeCloseTo(5.0, 2);
    expect(result.normal).toEqual([-1, 0, 0]);

    // Ray pointing opposite direction
    const oppositeDir: [number, number, number] = [-1, 0, 0];
    const miss = rayIntersectsAABB(rayOrigin, oppositeDir, box);
    expect(miss.hit).toBe(false);
  });
});
