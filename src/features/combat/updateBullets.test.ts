import { describe, expect, it } from 'vitest';
import type { Bullet } from './types';
import type { GameMap } from '../map/types';
import {
  getSafeMuzzlePoint,
  segmentRectHitT,
  updateBullets,
  type TargetPlayer,
} from './updateBullets';

function makeMap(obstacles: GameMap['obstacles'] = []): GameMap {
  return {
    id: 'bullet-test-map',
    name: 'Bullet Test Map',
    width: 1600,
    height: 1000,
    backgroundColor: '#000',
    baseBlue: { x: 0, y: 700, width: 150, height: 150 },
    baseRed: { x: 1450, y: 700, width: 150, height: 150 },
    flagBlue: { x: 80, y: 800 },
    flagRed: { x: 1520, y: 800 },
    spawnPointsBlue: [{ x: 100, y: 800 }],
    spawnPointsRed: [{ x: 1500, y: 800 }],
    weaponSpawns: [],
    obstacles,
  };
}

function makeBullet(overrides: Partial<Bullet> = {}): Bullet {
  return {
    id: 'b_1',
    shooterId: 'shooter_blue',
    team: 'blue',
    weaponType: 'rifle',
    x: 200,
    y: 400,
    vx: 20,
    vy: 0,
    damage: 20,
    blastRadius: 0,
    lifespan: 40,
    maxLifespan: 40,
    ...overrides,
  };
}

function makeTarget(overrides: Partial<TargetPlayer> = {}): TargetPlayer {
  return {
    id: 'enemy_red',
    team: 'red',
    x: 215,
    y: 400,
    radius: 16,
    isDead: false,
    isInvulnerable: false,
    ...overrides,
  };
}

describe('updateBullets swept collision, muzzle safety, and splash', () => {
  it('computes segment vs AABB entry parameter t cleanly', () => {
    expect(segmentRectHitT(0, 50, 100, 50, 40, 20, 20, 60)).toBeCloseTo(0.4, 5);
    expect(segmentRectHitT(0, 10, 100, 10, 40, 20, 20, 60)).toBeNull();
    expect(segmentRectHitT(45, 30, 55, 40, 40, 20, 20, 60)).toBe(0);
  });

  it('clamps getSafeMuzzlePoint before point-blank walls to prevent wall tunneling', () => {
    const map = makeMap([{ x: 210, y: 350, width: 30, height: 120, type: 'wall' }]);
    const muzzle = getSafeMuzzlePoint(202, 400, 0, 18, map);
    expect(muzzle.x).toBeLessThan(210);
    expect(muzzle.x).toBeGreaterThanOrEqual(202);

    // Without obstacle interference, uses full barrel length
    const clearMuzzle = getSafeMuzzlePoint(100, 400, 0, 18, map);
    expect(clearMuzzle.x).toBeCloseTo(118, 4);
  });

  it('blocks bullets with solid walls before reaching hidden enemy', () => {
    const map = makeMap([{ x: 208, y: 350, width: 12, height: 100, type: 'wall' }]);
    const bullet = makeBullet({ x: 195, y: 400, vx: 35 });
    const enemyBehindWall = makeTarget({ x: 235, y: 400 });

    const res = updateBullets([bullet], map, [enemyBehindWall], 1 / 60);
    expect(res.activeBullets).toHaveLength(0);
    expect(res.hits).toHaveLength(0);
    expect(res.newParticles.length).toBeGreaterThan(0);
  });

  it('ignores hazards while applying 1.3x headshot multiplier vs 1.0x torso hits', () => {
    const map = makeMap([{ x: 190, y: 300, width: 100, height: 200, type: 'hazard' }]);

    // Headshot sphere is centered at (p.x, p.y - 16)
    const headShotBullet = makeBullet({ x: 195, y: 384, vx: 25, damage: 20 });
    const target = makeTarget({ x: 210, y: 400 });
    const headRes = updateBullets([headShotBullet], map, [target], 1 / 60);
    expect(headRes.hits).toHaveLength(1);
    expect(headRes.hits[0].isCrit).toBe(true);
    expect(headRes.hits[0].damage).toBe(Math.round(20 * 1.3));

    // Torso capsule covers y + [ -2 .. +13 ]
    const bodyShotBullet = makeBullet({ id: 'b_2', x: 195, y: 408, vx: 25, damage: 20 });
    const bodyRes = updateBullets([bodyShotBullet], map, [target], 1 / 60);
    expect(bodyRes.hits).toHaveLength(1);
    expect(bodyRes.hits[0].isCrit).toBe(false);
    expect(bodyRes.hits[0].damage).toBe(20);
  });

  it('skips dead, invulnerable, self, and same-team targets on direct hits', () => {
    const map = makeMap();
    const bullet = makeBullet({ x: 195, y: 400, vx: 40 });
    const targets: TargetPlayer[] = [
      makeTarget({ id: 'shooter_blue', team: 'blue', x: 205, y: 400 }),
      makeTarget({ id: 'ally_blue', team: 'blue', x: 210, y: 400 }),
      makeTarget({ id: 'dead_red', team: 'red', x: 212, y: 400, isDead: true }),
      makeTarget({ id: 'shield_red', team: 'red', x: 214, y: 400, isInvulnerable: true }),
    ];

    const res = updateBullets([bullet], map, targets, 1 / 60);
    expect(res.hits).toHaveLength(0);
    expect(res.activeBullets).toHaveLength(1);
  });

  it('applies radial splash damage and allows self-rocket knockback while sparing allies', () => {
    const map = makeMap([{ x: 300, y: 350, width: 20, height: 100, type: 'wall' }]);
    const rocket = makeBullet({
      id: 'rpg_1',
      weaponType: 'rocket',
      shooterId: 'shooter_blue',
      team: 'blue',
      x: 285,
      y: 400,
      vx: 20,
      damage: 90,
      blastRadius: 115,
    });

    const targets: TargetPlayer[] = [
      makeTarget({ id: 'enemy_close', team: 'red', x: 310, y: 400 }),
      makeTarget({ id: 'enemy_far', team: 'red', x: 390, y: 400 }),
      makeTarget({ id: 'ally_close', team: 'blue', x: 285, y: 400 }),
      makeTarget({ id: 'shooter_blue', team: 'blue', x: 270, y: 400 }),
    ];

    const res = updateBullets([rocket], map, targets, 1 / 60);
    expect(res.activeBullets).toHaveLength(0);

    const hitIds = res.hits.map((h) => h.targetId);
    expect(hitIds).toContain('enemy_close');
    expect(hitIds).toContain('enemy_far');
    expect(hitIds).toContain('shooter_blue'); // rocket splash permits self-damage/rocket-jump
    expect(hitIds).not.toContain('ally_close');

    const closeHit = res.hits.find((h) => h.targetId === 'enemy_close')!;
    const farHit = res.hits.find((h) => h.targetId === 'enemy_far')!;
    expect(closeHit.damage).toBeGreaterThan(farHit.damage);
  });

  it('accelerates rockets over flight and drops bullets when lifespan expires', () => {
    const map = makeMap();
    const rocket = makeBullet({
      weaponType: 'rocket',
      x: 100,
      y: 200,
      vx: 10,
      vy: 0,
      lifespan: 5,
    });
    const expiring = makeBullet({
      id: 'b_expire',
      x: 100,
      y: 250,
      vx: 10,
      lifespan: 0.5,
    });

    const res = updateBullets([rocket, expiring], map, [], 1 / 60);
    expect(res.activeBullets).toHaveLength(1);
    expect(res.activeBullets[0].vx).toBeGreaterThan(10);
    expect(res.activeBullets[0].lifespan).toBeCloseTo(4, 3);
  });
});
