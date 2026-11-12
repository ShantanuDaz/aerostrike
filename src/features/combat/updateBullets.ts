import type { Bullet, ExplosionEvent, Particle, WeaponType } from './types';
import type { GameMap } from '../map/types';
import { raycastMapTerrain } from '../map/terrainGeometry';
import { GRENADE_GRAVITY } from './weaponsConfig';
import {
  createDirectionalSparks,
  createExplosionParticles,
  createSparks,
} from './particleSystem';
import { sounds } from '../audio/soundEngine';

export interface BulletCollisionResult {
  activeBullets: Bullet[];
  newParticles: Particle[];
  explosions: ExplosionEvent[];
  hits: {
    targetId: string;
    damage: number;
    dealerId: string;
    weaponType: WeaponType;
    isCrit?: boolean;
    impactX: number;
    impactY: number;
    knockbackX: number;
    knockbackY: number;
  }[];
}

export interface TargetPlayer {
  id: string;
  team?: 'blue' | 'red';
  x: number;
  y: number;
  radius: number;
  isDead?: boolean;
  isInvulnerable?: boolean;
}

/**
 * Zero-allocation Liang-Barsky segment vs AABB intersection returning earliest t in [0, 1], or null.
 */
export function segmentRectHitT(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): number | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  if (Math.abs(dx) < 1e-8) {
    if (x1 < rx || x1 > rx + rw) return null;
  } else {
    let rEnter = (rx - x1) / dx;
    let rExit = (rx + rw - x1) / dx;
    if (dx < 0) {
      const tmp = rEnter;
      rEnter = rExit;
      rExit = tmp;
    }
    if (rEnter > t0) t0 = rEnter;
    if (rExit < t1) t1 = rExit;
    if (t0 > t1) return null;
  }

  if (Math.abs(dy) < 1e-8) {
    if (y1 < ry || y1 > ry + rh) return null;
  } else {
    let rEnter = (ry - y1) / dy;
    let rExit = (ry + rh - y1) / dy;
    if (dy < 0) {
      const tmp = rEnter;
      rEnter = rExit;
      rExit = tmp;
    }
    if (rEnter > t0) t0 = rEnter;
    if (rExit < t1) t1 = rExit;
    if (t0 > t1) return null;
  }

  return t0 <= t1 ? t0 : null;
}

/**
 * Computes a muzzle spawn position clamped before any obstacle along the barrel ray
 * so point-blank shots against cover cannot tunnel through walls.
 */
export function getSafeMuzzlePoint(
  originX: number,
  originY: number,
  aimAngle: number,
  barrelOffset: number,
  map?: GameMap | null,
): { x: number; y: number } {
  const cos = Math.cos(aimAngle);
  const sin = Math.sin(aimAngle);
  const targetX = originX + cos * barrelOffset;
  const targetY = originY + sin * barrelOffset;

  if (!map) {
    return { x: targetX, y: targetY };
  }

  const terrainHit = raycastMapTerrain(originX, originY, targetX, targetY, map);
  if (!terrainHit) {
    return { x: targetX, y: targetY };
  }

  const safeDist = Math.max(0, terrainHit.t * barrelOffset - 2);
  return {
    x: originX + cos * safeDist,
    y: originY + sin * safeDist,
  };
}

/**
 * Analytic segment vs circle intersection returning earliest entry t in [0, 1], or null.
 */
function segmentCircleHitT(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;

  // Starts inside circle
  if (fx * fx + fy * fy <= r * r) {
    return 0;
  }

  const a = dx * dx + dy * dy;
  if (a < 1e-8) return null;

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;

  return null;
}

/**
 * Shortest distance squared between two non-degenerate 2D line segments AB and CD,
 * plus approximate parameter s in [0, 1] along AB.
 */
function closestSegmentPair(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): { distSq: number; s: number } {
  const ux = bx - ax;
  const uy = by - ay;
  const vx = dx - cx;
  const vy = dy - cy;
  const wx = ax - cx;
  const wy = ay - cy;

  const a = ux * ux + uy * uy;
  const b = ux * vx + uy * vy;
  const c = vx * vx + vy * vy;
  const d = ux * wx + uy * wy;
  const e = vx * wx + vy * wy;
  const D = a * c - b * b;

  let sN: number;
  let sD = D;
  let tN: number;
  let tD = D;

  if (D < 1e-6) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0;
    else if (-d > a) sN = sD;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) sN = 0;
    else if (-d + b > a) sN = sD;
    else {
      sN = -d + b;
      sD = a;
    }
  }

  const sc = Math.abs(sN) < 1e-6 ? 0 : sN / sD;
  const tc = Math.abs(tN) < 1e-6 ? 0 : tN / tD;

  const rx = wx + sc * ux - tc * vx;
  const ry = wy + sc * uy - tc * vy;
  return { distSq: rx * rx + ry * ry, s: sc };
}

export interface UpdateBulletsOptions {
  allowFriendlyFire?: boolean;
}

/**
 * Emits explosion SFX, particles, and radial splash hits for rockets & frag grenades.
 */
function detonateExplosive(
  bullet: Bullet,
  impactX: number,
  impactY: number,
  players: TargetPlayer[],
  newParticles: Particle[],
  explosions: ExplosionEvent[],
  hits: BulletCollisionResult['hits'],
  allowFriendlyFire: boolean = false,
): void {
  sounds.playExplosion();
  const isFrag = bullet.weaponType === 'grenade';
  const particleCount = isFrag ? 48 : 38;
  newParticles.push(
    ...createExplosionParticles(
      impactX,
      impactY,
      particleCount,
      isFrag ? '#a3e635' : '#fb923c',
    ),
  );
  explosions.push({
    x: impactX,
    y: impactY,
    radius: bullet.blastRadius,
    weaponType: bullet.weaponType,
  });

  for (const p of players) {
    if (p.isDead || p.isInvulnerable) continue;
    if (
      !allowFriendlyFire &&
      bullet.team &&
      p.team &&
      bullet.team === p.team &&
      p.id !== bullet.shooterId
    ) {
      continue;
    }

    const dist = Math.hypot(p.x - impactX, p.y - impactY);
    if (dist <= bullet.blastRadius) {
      const falloff = 1 - dist / bullet.blastRadius;
      const splashDmg = Math.round(bullet.damage * falloff);
      const angle = Math.atan2(p.y - impactY, p.x - impactX);

      hits.push({
        targetId: p.id,
        damage: splashDmg,
        dealerId: bullet.shooterId,
        weaponType: bullet.weaponType,
        isCrit: falloff >= 0.85,
        impactX: p.x,
        impactY: p.y - 12,
        knockbackX: Math.cos(angle) * (9.5 * falloff),
        knockbackY: Math.sin(angle) * (9.5 * falloff) - 2.6,
      });
    }
  }
}

/**
 * Updates bullets for one frame with swept segment-to-humanoid collision
 * so bullets never tunnel and match the articulated soldier hitbox cleanly.
 */
export function updateBullets(
  bullets: Bullet[],
  map: GameMap,
  players: TargetPlayer[],
  dt: number = 1 / 60,
  options?: UpdateBulletsOptions,
): BulletCollisionResult {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtScale = safeDt * 60;
  const allowFriendlyFire = Boolean(options?.allowFriendlyFire);

  const activeBullets: Bullet[] = [];
  const newParticles: Particle[] = [];
  const explosions: ExplosionEvent[] = [];
  const hits: BulletCollisionResult['hits'] = [];

  for (const bullet of bullets) {
    const isGrenade = bullet.weaponType === 'grenade';
    const startX = bullet.x;
    const startY = bullet.y;

    let stepVx = bullet.vx;
    let stepVy = bullet.vy;
    if (isGrenade) {
      stepVx *= Math.pow(0.996, dtScale);
      stepVy += GRENADE_GRAVITY * dtScale;
    }

    const endX = startX + stepVx * dtScale;
    const endY = startY + stepVy * dtScale;

    // 1. Earliest solid terrain/obstacle hit along bullet path (ignore platforms and hazards)
    const terrainHit = raycastMapTerrain(startX, startY, endX, endY, map);
    const earliestObsT = terrainHit ? terrainHit.t : null;

    // 2. Earliest humanoid player hit (Head sphere + Torso/Legs capsule)
    let hitPlayer: TargetPlayer | null = null;
    let isHeadshot = false;
    let earliestPlayerT = 2;

    for (const p of players) {
      if (p.isDead || p.isInvulnerable) continue;
      if (p.id === bullet.shooterId) continue;
      if (!allowFriendlyFire && bullet.team && p.team && bullet.team === p.team) continue;

      // Head sphere: centered at (p.x, p.y - 16), radius 11.5 (helmet/visor crit zone)
      const headHitT = segmentCircleHitT(
        startX,
        startY,
        endX,
        endY,
        p.x,
        p.y - 16,
        11.5,
      );
      const hitHead = headHitT !== null;

      // Torso & legs vertical capsule: (p.x, p.y - 2) to (p.x, p.y + 13), radius 13
      const bodySeg = closestSegmentPair(
        startX,
        startY,
        endX,
        endY,
        p.x,
        p.y - 2,
        p.x,
        p.y + 13,
      );
      const hitBody = bodySeg.distSq <= 13 * 13;

      if (hitHead || hitBody) {
        const effectiveHeadT = headHitT ?? 2;
        const contactT = hitHead && (!hitBody || effectiveHeadT <= bodySeg.s)
          ? effectiveHeadT
          : bodySeg.s;

        if (contactT < earliestPlayerT) {
          earliestPlayerT = contactT;
          hitPlayer = p;
          isHeadshot = hitHead && (!hitBody || effectiveHeadT <= bodySeg.s + 0.05);
        }
      }
    }

    // Ensure walls block shots if hit BEFORE player
    const blockedByObstacle =
      earliestObsT !== null && (hitPlayer === null || earliestObsT <= earliestPlayerT);

    if (blockedByObstacle && earliestObsT !== null) {
      hitPlayer = null;
    }

    // Grenade special physics: direct enemy impact detonates immediately, terrain bounces until fuse expires
    if (isGrenade) {
      if (hitPlayer) {
        const impactX = startX + (endX - startX) * earliestPlayerT;
        const impactY = startY + (endY - startY) * earliestPlayerT;
        detonateExplosive(
          bullet,
          impactX,
          impactY,
          players,
          newParticles,
          explosions,
          hits,
          allowFriendlyFire,
        );
        continue;
      }

      if (terrainHit) {
        const { nx, ny, hitX, hitY } = terrainHit;
        const dot = stepVx * nx + stepVy * ny;
        let bouncedVx = stepVx;
        let bouncedVy = stepVy;
        if (dot < 0) {
          const tx = stepVx - dot * nx;
          const ty = stepVy - dot * ny;
          const restitution = 0.54;
          const tangentialDamp = 0.8;
          bouncedVx = tx * tangentialDamp - dot * nx * restitution;
          bouncedVy = ty * tangentialDamp - dot * ny * restitution;
          if (ny < -0.5 && Math.abs(bouncedVy) < 1.1) {
            bouncedVy = 0;
          }
        }

        const speedBefore = Math.hypot(stepVx, stepVy);
        if (speedBefore > 2.5) {
          sounds.playGrenadeBounce();
          newParticles.push(...createDirectionalSparks(hitX, hitY, nx, ny, 3, '#a3e635'));
        }

        bullet.x = hitX + nx * 2.5;
        bullet.y = hitY + ny * 2.5;
        bullet.vx = bouncedVx;
        bullet.vy = bouncedVy;
        bullet.lifespan -= dtScale;

        if (bullet.lifespan <= 0) {
          detonateExplosive(
            bullet,
            bullet.x,
            bullet.y,
            players,
            newParticles,
            explosions,
            hits,
            allowFriendlyFire,
          );
        } else {
          activeBullets.push(bullet);
        }
        continue;
      }

      bullet.x = endX;
      bullet.y = endY;
      bullet.vx = stepVx;
      bullet.vy = stepVy;
      bullet.lifespan -= dtScale;

      if (Math.random() < 0.25 * dtScale) {
        newParticles.push(...createSparks(bullet.x, bullet.y, 1, '#a3e635'));
      }

      if (bullet.lifespan <= 0) {
        detonateExplosive(
          bullet,
          bullet.x,
          bullet.y,
          players,
          newParticles,
          explosions,
          hits,
          allowFriendlyFire,
        );
      } else {
        activeBullets.push(bullet);
      }
      continue;
    }

    const hitT = blockedByObstacle
      ? (earliestObsT ?? 1)
      : hitPlayer
      ? earliestPlayerT
      : null;

    if (hitT !== null) {
      const impactX = startX + (endX - startX) * hitT;
      const impactY = startY + (endY - startY) * hitT;

      if (bullet.blastRadius > 0) {
        detonateExplosive(
          bullet,
          impactX,
          impactY,
          players,
          newParticles,
          explosions,
          hits,
          allowFriendlyFire,
        );
      } else {
        // Direct kinetic hit (directional ricochet sparks on sloped/curved terrain)
        if (blockedByObstacle && terrainHit) {
          newParticles.push(
            ...createDirectionalSparks(
              impactX,
              impactY,
              terrainHit.nx,
              terrainHit.ny,
              7,
              '#fbbf24',
            ),
          );
        } else {
          newParticles.push(
            ...createSparks(
              impactX,
              impactY,
              hitPlayer && isHeadshot ? 11 : 7,
              hitPlayer && isHeadshot ? '#38bdf8' : '#fbbf24',
            ),
          );
        }

        if (hitPlayer) {
          const angle = Math.atan2(bullet.vy, bullet.vx);
          const finalDamage = isHeadshot
            ? Math.round(bullet.damage * 1.3)
            : bullet.damage;

          hits.push({
            targetId: hitPlayer.id,
            damage: finalDamage,
            dealerId: bullet.shooterId,
            weaponType: bullet.weaponType,
            isCrit: isHeadshot,
            impactX,
            impactY,
            knockbackX: Math.cos(angle) * (isHeadshot ? 4.5 : 3.2),
            knockbackY: Math.sin(angle) * 3.0 - 1.5,
          });
        }
      }

      continue;
    }

    // 4. Advance bullet position & decay lifespan
    bullet.x = endX;
    bullet.y = endY;
    bullet.lifespan -= dtScale;

    if (bullet.weaponType === 'rocket') {
      const accel = Math.pow(1.028, dtScale);
      bullet.vx *= accel;
      bullet.vy *= accel;
      if (Math.random() < 0.4 * dtScale) {
        newParticles.push(...createSparks(bullet.x, bullet.y, 1, '#94a3b8'));
      }
    }

    if (bullet.lifespan > 0) {
      activeBullets.push(bullet);
    }
  }

  return { activeBullets, newParticles, explosions, hits };
}
