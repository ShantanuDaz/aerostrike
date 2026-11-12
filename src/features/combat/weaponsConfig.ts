import type { WeaponConfig, WeaponType } from './types';

export const GRENADE_STARTING_COUNT = 2;
export const GRENADE_MAX_COUNT = 3;
export const GRENADE_FUSE_FRAMES = 95;
export const GRENADE_GRAVITY = 0.34;
export const GRENADE_LOB_LIFT = 1.8;

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  pistol: {
    id: 'pistol',
    name: 'Tactical Pistol',
    fireRateMs: 260,
    pellets: 1,
    speed: 17,
    damage: 18,
    recoil: 1.0,
    spread: 0.03,
    blastRadius: 0,
    maxAmmo: Infinity,
    color: '#e2e8f0',
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    fireRateMs: 115,
    pellets: 1,
    speed: 20,
    damage: 14,
    recoil: 1.2,
    spread: 0.06,
    blastRadius: 0,
    maxAmmo: 30,
    color: '#fbbf24',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Combat Shotgun',
    fireRateMs: 700,
    pellets: 6,
    speed: 15,
    damage: 11, // 11 * 6 = 66 max
    recoil: 4.8,
    spread: 0.22,
    blastRadius: 0,
    maxAmmo: 8,
    color: '#f97316',
  },
  sniper: {
    id: 'sniper',
    name: 'Rail Sniper',
    fireRateMs: 1100,
    pellets: 1,
    speed: 30,
    damage: 75,
    recoil: 5.5,
    spread: 0.01,
    blastRadius: 0,
    maxAmmo: 5,
    color: '#38bdf8',
  },
  rocket: {
    id: 'rocket',
    name: 'RPG Launcher',
    fireRateMs: 1400,
    pellets: 1,
    speed: 9.5,
    damage: 90,
    recoil: 6.2,
    spread: 0.03,
    blastRadius: 115,
    maxAmmo: 3,
    color: '#ef4444',
  },
  grenade: {
    id: 'grenade',
    name: 'Frag Grenade',
    fireRateMs: 900,
    pellets: 1,
    speed: 12.2,
    damage: 95,
    recoil: 1.4,
    spread: 0.02,
    blastRadius: 132,
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
