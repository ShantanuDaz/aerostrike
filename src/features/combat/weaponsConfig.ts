import type { WeaponConfig, WeaponType } from './types';

export const GRENADE_STARTING_COUNT = 2;
export const GRENADE_MAX_COUNT = 3;
export const GRENADE_FUSE_FRAMES = 95;
export const GRENADE_GRAVITY = 0.34;
export const GRENADE_LOB_LIFT = 1.8;

/** Headshot critical multiplier across the sandbox: rewards pixel-perfect precision (e.g. 75 * 1.4 = 105 lethal sniper headshot). */
export const HEADSHOT_MULTIPLIER = 1.4;

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  pistol: {
    id: 'pistol',
    name: 'Tactical Pistol',
    fireRateMs: 220,
    pellets: 1,
    speed: 19,
    damage: 20,
    recoil: 0.9,
    spread: 0.025,
    blastRadius: 0,
    maxAmmo: Infinity,
    color: '#e2e8f0',
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    fireRateMs: 125,
    pellets: 1,
    speed: 21,
    damage: 12,
    recoil: 1.2,
    spread: 0.065,
    blastRadius: 0,
    maxAmmo: 30,
    color: '#fbbf24',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Combat Shotgun',
    fireRateMs: 650,
    pellets: 8,
    speed: 18,
    damage: 11, // 11 * 8 = 88 point-blank meatshot
    recoil: 5.0,
    spread: 0.14,
    blastRadius: 0,
    maxAmmo: 8,
    color: '#f97316',
  },
  sniper: {
    id: 'sniper',
    name: 'Rail Sniper',
    fireRateMs: 1100,
    pellets: 1,
    speed: 34,
    damage: 75, // 75 * 1.4 = 105 lethal headshot on 100 HP target
    recoil: 5.8,
    spread: 0.005,
    blastRadius: 0,
    maxAmmo: 5,
    color: '#38bdf8',
  },
  rocket: {
    id: 'rocket',
    name: 'RPG Launcher',
    fireRateMs: 1300,
    pellets: 1,
    speed: 13.5,
    damage: 100,
    recoil: 6.2,
    spread: 0.03,
    blastRadius: 120,
    maxAmmo: 3,
    color: '#ef4444',
  },
  grenade: {
    id: 'grenade',
    name: 'Frag Grenade',
    fireRateMs: 900,
    pellets: 1,
    speed: 13.0,
    damage: 100,
    recoil: 1.4,
    spread: 0.02,
    blastRadius: 135,
    maxAmmo: GRENADE_MAX_COUNT,
    color: '#84cc16',
  },
};

export function computeProjectileLaunchVelocity(
  weaponType: WeaponType,
  bulletAngle: number,
  speed: number,
): { vx: number; vy: number } {
  const vx = Math.cos(bulletAngle) * speed;
  let vy = Math.sin(bulletAngle) * speed;
  if (weaponType === 'grenade') {
    vy -= GRENADE_LOB_LIFT;
  }
  return { vx, vy };
}

export function getProjectileLifespanFrames(config: WeaponConfig): number {
  if (config.id === 'grenade') {
    return GRENADE_FUSE_FRAMES;
  }
  return config.blastRadius > 0 ? 80 : 50;
}
