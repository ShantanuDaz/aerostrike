import { rayIntersectsAABB } from '../weapons/gunplayController';
import type { AABB } from '../physics/sweptAABB';

export type HitboxZoneType = 'head' | 'torso' | 'limbs';

export interface PlayerHitboxSet {
  playerId: string;
  head: AABB;
  torso: AABB;
  limbs: AABB;
}

export interface HitboxRayResult {
  hit: boolean;
  playerId?: string;
  zone?: HitboxZoneType;
  multiplier: number;
  distance: number;
  point: [number, number, number];
}

export const HITBOX_MULTIPLIERS: Record<HitboxZoneType, number> = {
  head: 4.0, // 1-tap headshot kill multiplier
  torso: 1.0,
  limbs: 0.75,
};

/**
 * Builds discrete 3D hitbox bounds for a player given their current position and crouch state.
 */
export function buildPlayerHitboxes(
  playerId: string,
  pos: [number, number, number],
  isCrouching = false,
): PlayerHitboxSet {
  const [px, py, pz] = pos;
  const scaleY = isCrouching ? 0.65 : 1.0;

  // Head: sits at top of avatar
  const headHeight = 0.35 * scaleY;
  const headTop = py + (isCrouching ? 1.15 : 1.85);
  const headBottom = headTop - headHeight;
  const headRadius = 0.22;

  const head: AABB = {
    min: [px - headRadius, headBottom, pz - headRadius],
    max: [px + headRadius, headTop, pz + headRadius],
  };

  // Torso: chest and abdomen
  const torsoTop = headBottom;
  const torsoBottom = py + (isCrouching ? 0.45 : 0.85);
  const torsoRadiusX = 0.32;
  const torsoRadiusZ = 0.22;

  const torso: AABB = {
    min: [px - torsoRadiusX, torsoBottom, pz - torsoRadiusZ],
    max: [px + torsoRadiusX, torsoTop, pz + torsoRadiusZ],
  };

  // Limbs: legs and arms lower zone
  const limbsTop = torsoBottom;
  const limbsBottom = py;
  const limbsRadius = 0.35;

  const limbs: AABB = {
    min: [px - limbsRadius, limbsBottom, pz - limbsRadius],
    max: [px + limbsRadius, limbsTop, pz + limbsRadius],
  };

  return { playerId, head, torso, limbs };
}

/**
 * Raycasts a bullet against a player's discrete hitbox set.
 * Prioritizes headshots (highest multiplier) if multiple zones intersect.
 */
export function raycastPlayerHitboxes(
  origin: [number, number, number],
  rayDir: [number, number, number],
  hitboxes: PlayerHitboxSet,
): HitboxRayResult {
  const headHit = rayIntersectsAABB(origin, rayDir, hitboxes.head);
  const torsoHit = rayIntersectsAABB(origin, rayDir, hitboxes.torso);
  const limbsHit = rayIntersectsAABB(origin, rayDir, hitboxes.limbs);

  const hits: { zone: HitboxZoneType; dist: number; point: [number, number, number] }[] = [];

  if (headHit.hit) {
    const pt: [number, number, number] = [
      origin[0] + rayDir[0] * headHit.distance,
      origin[1] + rayDir[1] * headHit.distance,
      origin[2] + rayDir[2] * headHit.distance,
    ];
    hits.push({ zone: 'head', dist: headHit.distance, point: pt });
  }

  if (torsoHit.hit) {
    const pt: [number, number, number] = [
      origin[0] + rayDir[0] * torsoHit.distance,
      origin[1] + rayDir[1] * torsoHit.distance,
      origin[2] + rayDir[2] * torsoHit.distance,
    ];
    hits.push({ zone: 'torso', dist: torsoHit.distance, point: pt });
  }

  if (limbsHit.hit) {
    const pt: [number, number, number] = [
      origin[0] + rayDir[0] * limbsHit.distance,
      origin[1] + rayDir[1] * limbsHit.distance,
      origin[2] + rayDir[2] * limbsHit.distance,
    ];
    hits.push({ zone: 'limbs', dist: limbsHit.distance, point: pt });
  }

  if (hits.length === 0) {
    return { hit: false, multiplier: 0, distance: Infinity, point: [0, 0, 0] };
  }

  // Pick closest hit
  hits.sort((a, b) => a.dist - b.dist);
  const best = hits[0];

  return {
    hit: true,
    playerId: hitboxes.playerId,
    zone: best.zone,
    multiplier: HITBOX_MULTIPLIERS[best.zone],
    distance: best.dist,
    point: best.point,
  };
}
