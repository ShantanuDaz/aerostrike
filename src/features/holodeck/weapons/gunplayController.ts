import {
  HOLODECK_WEAPONS,
  type HolodeckWeaponConfig,
  type HolodeckWeaponId,
} from '../core/types';
import type { AABB } from '../physics/sweptAABB';

export interface GunplayState {
  activeWeaponId: HolodeckWeaponId;
  ammo: Record<HolodeckWeaponId, { clip: number; reserve: number }>;
  currentBloomRad: number;
  lastShotTimeSec: number;
  isReloading: boolean;
  reloadEndTimeSec: number;
  isScoped: boolean;
}

export interface HitscanHitResult {
  hit: boolean;
  distance: number;
  point: [number, number, number];
  normal: [number, number, number];
  targetId?: string;
  hitboxZone?: 'head' | 'torso' | 'limbs';
  damageDealt?: number;
}

export function createInitialGunplayState(): GunplayState {
  const ammo: Record<HolodeckWeaponId, { clip: number; reserve: number }> = {
    classic: { clip: 12, reserve: 36 },
    vandal: { clip: 25, reserve: 75 },
    operator: { clip: 5, reserve: 10 },
    knife: { clip: 0, reserve: 0 },
  };

  return {
    activeWeaponId: 'vandal',
    ammo,
    currentBloomRad: 0,
    lastShotTimeSec: 0,
    isReloading: false,
    reloadEndTimeSec: 0,
    isScoped: false,
  };
}

/**
 * Updates gun recoil bloom and recovery over time.
 */
export function updateGunplayBloom(
  state: GunplayState,
  dt: number,
  playerSpeed: number,
  isGrounded: boolean,
): GunplayState {
  const config = HOLODECK_WEAPONS[state.activeWeaponId];
  let bloom = state.currentBloomRad;

  // Natural recovery towards base spread
  const recovery = config.recoverySpeedRadPerSec * dt;
  bloom = Math.max(0, bloom - recovery);

  // Add velocity-based inaccuracy
  if (!isGrounded) {
    bloom = Math.max(bloom, config.maxSpreadRad * 0.85);
  } else if (playerSpeed > 1.0) {
    const moveInaccuracy = (playerSpeed / 5.4) * config.recoilBloomPerShotRad * config.movementInaccuracyMultiplier;
    bloom = Math.max(bloom, moveInaccuracy);
  }

  return {
    ...state,
    currentBloomRad: Math.min(bloom, config.maxSpreadRad),
  };
}

/**
 * Calculates current total shot spread cone (base + bloom).
 */
export function calculateCurrentSpread(
  state: GunplayState,
  config: HolodeckWeaponConfig,
  isScoped: boolean,
): number {
  if (state.activeWeaponId === 'operator') {
    if (isScoped) {
      return state.currentBloomRad + config.firstShotAccuracySpreadRad;
    }
    // High no-scope penalty
    return 0.18 + state.currentBloomRad;
  }
  return config.firstShotAccuracySpreadRad + state.currentBloomRad;
}

/**
 * Evaluates whether weapon can fire right now.
 */
export function canFireWeapon(state: GunplayState, nowSec: number): boolean {
  if (state.isReloading && nowSec < state.reloadEndTimeSec) {
    return false;
  }
  const config = HOLODECK_WEAPONS[state.activeWeaponId];
  const minInterval = 1.0 / config.fireRateRps;
  if (nowSec - state.lastShotTimeSec < minInterval) {
    return false;
  }
  if (config.category !== 'melee' && state.ammo[state.activeWeaponId].clip <= 0) {
    return false;
  }
  return true;
}

/**
 * Executes a shot: consumes ammo and expands recoil bloom.
 */
export function executeShot(state: GunplayState, nowSec: number): GunplayState {
  const config = HOLODECK_WEAPONS[state.activeWeaponId];
  const weaponAmmo = state.ammo[state.activeWeaponId];

  const nextClip = config.category === 'melee' ? 0 : Math.max(0, weaponAmmo.clip - 1);
  const nextBloom = Math.min(
    config.maxSpreadRad,
    state.currentBloomRad + config.recoilBloomPerShotRad,
  );

  return {
    ...state,
    ammo: {
      ...state.ammo,
      [state.activeWeaponId]: {
        ...weaponAmmo,
        clip: nextClip,
      },
    },
    currentBloomRad: nextBloom,
    lastShotTimeSec: nowSec,
  };
}

/**
 * Starts reloading if weapon has reserve ammo and clip isn't full.
 */
export function startReload(state: GunplayState, nowSec: number): GunplayState {
  const config = HOLODECK_WEAPONS[state.activeWeaponId];
  if (config.category === 'melee') return state;

  const currentAmmo = state.ammo[state.activeWeaponId];
  if (currentAmmo.clip >= config.magazineSize || currentAmmo.reserve <= 0) {
    return state;
  }

  return {
    ...state,
    isReloading: true,
    reloadEndTimeSec: nowSec + config.reloadTimeSec,
  };
}

/**
 * Completes reload if timer expired.
 */
export function finishReloadIfReady(state: GunplayState, nowSec: number): GunplayState {
  if (!state.isReloading || nowSec < state.reloadEndTimeSec) {
    return state;
  }

  const config = HOLODECK_WEAPONS[state.activeWeaponId];
  const currentAmmo = state.ammo[state.activeWeaponId];
  const needed = config.magazineSize - currentAmmo.clip;
  const take = Math.min(needed, currentAmmo.reserve);

  return {
    ...state,
    isReloading: false,
    ammo: {
      ...state.ammo,
      [state.activeWeaponId]: {
        clip: currentAmmo.clip + take,
        reserve: currentAmmo.reserve - take,
      },
    },
  };
}

/**
 * Raycasts against an AABB box from origin along rayDir.
 */
export function rayIntersectsAABB(
  origin: [number, number, number],
  rayDir: [number, number, number],
  box: AABB,
): { hit: boolean; distance: number; normal: [number, number, number] } {
  let tMin = -Infinity;
  let tMax = Infinity;
  let hitNormal: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = rayDir[i];
    const bMin = box.min[i];
    const bMax = box.max[i];

    if (Math.abs(d) < 1e-6) {
      if (o < bMin || o > bMax) {
        return { hit: false, distance: Infinity, normal: [0, 0, 0] };
      }
    } else {
      let t1 = (bMin - o) / d;
      let t2 = (bMax - o) / d;
      let sign = -1;

      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        sign = 1;
      }

      if (t1 > tMin) {
        tMin = t1;
        hitNormal = [0, 0, 0];
        hitNormal[i] = sign;
      }
      tMax = Math.min(tMax, t2);

      if (tMin > tMax || tMax < 0) {
        return { hit: false, distance: Infinity, normal: [0, 0, 0] };
      }
    }
  }

  if (tMin < 0) {
    return { hit: false, distance: Infinity, normal: [0, 0, 0] };
  }

  return { hit: true, distance: tMin, normal: hitNormal };
}
