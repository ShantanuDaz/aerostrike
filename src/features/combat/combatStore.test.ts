import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCombatStore } from './combatStore';
import { GRENADE_MAX_COUNT, GRENADE_STARTING_COUNT, WEAPONS } from './weaponsConfig';
import { engineWorld } from '../game/engineWorld';
import type { GameMap } from '../map/types';

const TEST_MAP: GameMap = {
  id: 'combat-test-map',
  name: 'Combat Test',
  width: 1000,
  height: 800,
  backgroundColor: '#000',
  baseBlue: { x: 0, y: 600, width: 100, height: 100 },
  baseRed: { x: 900, y: 600, width: 100, height: 100 },
  flagBlue: { x: 50, y: 650 },
  flagRed: { x: 950, y: 650 },
  spawnPointsBlue: [{ x: 100, y: 650 }],
  spawnPointsRed: [{ x: 900, y: 650 }],
  weaponSpawns: [],
  obstacles: [{ x: 510, y: 250, width: 40, height: 100, type: 'wall' }],
};

describe('useCombatStore ammo isolation and firing', () => {
  beforeEach(() => {
    engineWorld.bullets = [];
    engineWorld.particles = [];
    useCombatStore.getState().initLoadout('rifle');
  });

  it('initializes loadout ammo strictly per weapon while keeping pistol infinite', () => {
    const state = useCombatStore.getState();
    expect(state.equippedWeapon).toBe('rifle');
    expect(state.currentAmmo).toBe(WEAPONS.rifle.maxAmmo);
    expect(state.ammoByWeapon.pistol).toBe(Number.POSITIVE_INFINITY);
    expect(state.ammoByWeapon.shotgun).toBe(0);
    expect(state.ammoByWeapon.sniper).toBe(0);
    expect(state.ammoByWeapon.rocket).toBe(0);
  });

  it('blocks infinite-ammo weapon swap exploit into empty weapons', () => {
    const store = useCombatStore.getState();
    store.setEquippedWeapon('sniper');
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');

    // Empty weapon cannot regain ammo via cycling back and forth
    store.grantWeaponPickup('rocket');
    expect(useCombatStore.getState().equippedWeapon).toBe('rocket');
    expect(useCombatStore.getState().ammoByWeapon.rocket).toBe(WEAPONS.rocket.maxAmmo);

    let nowMs = 10000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    for (let i = 0; i < WEAPONS.rocket.maxAmmo; i++) {
      nowMs += 2000;
      const fired = useCombatStore.getState().fireWeapon({
        shooterId: 'pilot_1',
        team: 'blue',
        originX: 200,
        originY: 300,
        aimAngle: 0,
      });
      expect(fired?.firedWeapon).toBe('rocket');
    }

    // Exhausted rocket falls back to rifle (with remaining rifle ammo preserved), and switching back to rocket is blocked
    const afterEmpty = useCombatStore.getState();
    expect(afterEmpty.ammoByWeapon.rocket).toBe(0);
    expect(afterEmpty.equippedWeapon).toBe('rifle');

    afterEmpty.setEquippedWeapon('rocket');
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');

    perfSpy.mockRestore();
  });

  it('cycles only through weapons that still have remaining ammo', () => {
    const store = useCombatStore.getState();
    // Only rifle (30) and pistol (Infinity) available initially
    store.cycleWeapon();
    expect(useCombatStore.getState().equippedWeapon).toBe('pistol');
    store.cycleWeapon();
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');

    // Grant sniper -> cycle traverses rifle -> sniper -> pistol -> rifle
    store.grantWeaponPickup('sniper');
    expect(useCombatStore.getState().equippedWeapon).toBe('sniper');
    store.cycleWeapon();
    expect(useCombatStore.getState().equippedWeapon).toBe('pistol');
    store.cycleWeapon();
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');
    store.cycleWeapon();
    expect(useCombatStore.getState().equippedWeapon).toBe('sniper');
  });

  it('throttles fire rate, spawns correct pellet spread, and clamps muzzle before walls', () => {
    let nowMs = 5000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    useCombatStore.getState().grantWeaponPickup('shotgun');
    const first = useCombatStore.getState().fireWeapon({
      shooterId: 'pilot_1',
      team: 'blue',
      originX: 500,
      originY: 300,
      aimAngle: 0,
      map: TEST_MAP,
    });

    expect(first).not.toBeNull();
    expect(first!.bulletsSpawned).toHaveLength(WEAPONS.shotgun.pellets);
    expect(first!.spreadOffsets).toHaveLength(WEAPONS.shotgun.pellets);
    expect(first!.speedScale).toBeGreaterThanOrEqual(0.95);
    expect(first!.speedScale).toBeLessThanOrEqual(1.05);
    // Clamped before wall at x=510
    expect(first!.bulletsSpawned[0].x).toBeLessThan(510);
    expect(engineWorld.bullets).toHaveLength(WEAPONS.shotgun.pellets);
    expect(useCombatStore.getState().ammoByWeapon.shotgun).toBe(WEAPONS.shotgun.maxAmmo - 1);

    // Within 700ms fireRateMs cooldown -> rejected
    nowMs += 200;
    const throttled = useCombatStore.getState().fireWeapon({
      shooterId: 'pilot_1',
      team: 'blue',
      originX: 500,
      originY: 300,
      aimAngle: 0,
      map: TEST_MAP,
    });
    expect(throttled).toBeNull();

    // Past cooldown -> allowed
    nowMs += 600;
    const second = useCombatStore.getState().fireWeapon({
      shooterId: 'pilot_1',
      team: 'blue',
      originX: 500,
      originY: 300,
      aimAngle: 0,
      map: TEST_MAP,
    });
    expect(second).not.toBeNull();

    perfSpy.mockRestore();
  });

  it('throws frag grenades independently of primary weapon, enforces cooldown/stock, and refills at supply', () => {
    let nowMs = 2000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    expect(useCombatStore.getState().grenades).toBe(GRENADE_STARTING_COUNT);
    expect(useCombatStore.getState().maxGrenades).toBe(GRENADE_MAX_COUNT);

    // Attempting to equip grenade directly as a primary gun is ignored
    useCombatStore.getState().setEquippedWeapon('grenade');
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');

    const first = useCombatStore.getState().throwGrenade({
      shooterId: 'pilot_1',
      team: 'blue',
      originX: 200,
      originY: 300,
      aimAngle: 0,
      map: TEST_MAP,
    });
    expect(first).not.toBeNull();
    expect(first!.firedWeapon).toBe('grenade');
    expect(first!.bulletsSpawned[0].weaponType).toBe('grenade');
    expect(useCombatStore.getState().grenades).toBe(GRENADE_STARTING_COUNT - 1);
    expect(useCombatStore.getState().equippedWeapon).toBe('rifle');
    expect(useCombatStore.getState().ammoByWeapon.rifle).toBe(WEAPONS.rifle.maxAmmo);

    // Within fireRateMs cooldown -> blocked
    nowMs += 200;
    expect(
      useCombatStore.getState().throwGrenade({
        shooterId: 'pilot_1',
        team: 'blue',
        originX: 200,
        originY: 300,
        aimAngle: 0,
      }),
    ).toBeNull();

    // Past cooldown -> throws second grenade, leaving 0
    nowMs += WEAPONS.grenade.fireRateMs;
    const second = useCombatStore.getState().throwGrenade({
      shooterId: 'pilot_1',
      team: 'blue',
      originX: 200,
      originY: 300,
      aimAngle: 0,
    });
    expect(second).not.toBeNull();
    expect(useCombatStore.getState().grenades).toBe(0);

    // Out of grenades -> blocked
    nowMs += WEAPONS.grenade.fireRateMs;
    expect(
      useCombatStore.getState().throwGrenade({
        shooterId: 'pilot_1',
        team: 'blue',
        originX: 200,
        originY: 300,
        aimAngle: 0,
      }),
    ).toBeNull();

    // Supply station refills up to maxGrenades
    useCombatStore.getState().refillGrenades();
    expect(useCombatStore.getState().grenades).toBe(GRENADE_MAX_COUNT);

    perfSpy.mockRestore();
  });
});
