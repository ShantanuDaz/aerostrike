import type { Bullet, Particle, WeaponType } from './types';
import type { GameMap } from '../map/types';
import { createExplosionParticles, createSparks } from './particleSystem';
import { sounds } from '../audio/soundEngine';

export interface BulletCollisionResult {
  activeBullets: Bullet[];
  newParticles: Particle[];
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

  let earliestT: number | null = null;
  for (let i = 0; i < map.obstacles.length; i++) {
    const obs = map.obstacles[i];
    if (obs.type !== 'wall' && obs.type !== 'ground') continue;
    const t = segmentRectHitT(
      originX,
      originY,
      targetX,
      targetY,
      obs.x,
      obs.y,
      obs.width,
      obs.height,
    );
    if (t !== null && (earliestT === null || t < earliestT)) {
      earliestT = t;
    }
  }

  if (earliestT === null) {
    return { x: targetX, y: targetY };
  }

  const safeDist = Math.max(0, earliestT * barrelOffset - 2);
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

/**
 * Updates bullets for one frame with swept segment-to-humanoid collision
 * so bullets never tunnel and match the articulated soldier hitbox cleanly.
 */
export function updateBullets(
  bullets: Bullet[],
  map: GameMap,
  players: TargetPlayer[],
  dt: number = 1 / 60,
): BulletCollisionResult {
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dtScale = safeDt * 60;

  const activeBullets: Bullet[] = [];
  const newParticles: Particle[] = [];
  const hits: BulletCollisionResult['hits'] = [];

  for (const bullet of bullets) {
    const startX = bullet.x;
    const startY = bullet.y;
    const endX = startX + bullet.vx * dtScale;
    const endY = startY + bullet.vy * dtScale;

    // 1. Earliest solid obstacle hit along bullet path (ignore platforms and floor hazards)
    let earliestObsT: number | null = null;
    for (const obs of map.obstacles) {
      if (obs.type !== 'wall' && obs.type !== 'ground') continue;
      const t = segmentRectHitT(
        startX,
        startY,
        endX,
        endY,
        obs.x,
        obs.y,
        obs.width,
        obs.height,
      );
      if (t !== null && (earliestObsT === null || t < earliestObsT)) {
        earliestObsT = t;
      }
    }

    // 2. Earliest humanoid player hit (Head sphere + Torso/Legs capsule)
    let hitPlayer: TargetPlayer | null = null;
    let isHeadshot = false;
    let earliestPlayerT = 2;

    for (const p of players) {
      if (p.isDead || p.isInvulnerable) continue;
      if (p.id === bullet.shooterId) continue;
      if (bullet.team && p.team && bullet.team === p.team) continue;

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

    const hitT = blockedByObstacle
      ? (earliestObsT ?? 1)
      : hitPlayer
      ? earliestPlayerT
      : null;

    if (hitT !== null) {
      const impactX = startX + (endX - startX) * hitT;
      const impactY = startY + (endY - startY) * hitT;

      if (bullet.blastRadius > 0) {
        // Rocket / Explosive Splash
        sounds.playExplosion();
        newParticles.push(...createExplosionParticles(impactX, impactY, 28));

        for (const p of players) {
          if (p.isDead || p.isInvulnerable) continue;
          if (bullet.team && p.team && bullet.team === p.team && p.id !== bullet.shooterId) {
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
              knockbackX: Math.cos(angle) * (8 * falloff),
              knockbackY: Math.sin(angle) * (8 * falloff) - 2,
            });
          }
        }
      } else {
        // Direct kinetic hit
        newParticles.push(
          ...createSparks(
            impactX,
            impactY,
            hitPlayer && isHeadshot ? 11 : 7,
            hitPlayer && isHeadshot ? '#38bdf8' : '#fbbf24',
          ),
        );

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

  return { activeBullets, newParticles, hits };
}
