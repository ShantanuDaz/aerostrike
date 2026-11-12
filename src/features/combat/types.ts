export type WeaponType = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'rocket' | 'grenade';

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  fireRateMs: number;
  pellets: number;
  speed: number;
  damage: number;
  recoil: number;
  spread: number; // in radians
  blastRadius: number; // 0 for standard bullets, >0 for splash
  maxAmmo: number;
  color: string;
}

export interface Bullet {
  id: string;
  shooterId: string;
  team?: 'blue' | 'red';
  weaponType: WeaponType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  blastRadius: number;
  lifespan: number; // frames left
  maxLifespan: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  gravity?: number;
  drag?: number;
}

export interface ExplosionEvent {
  x: number;
  y: number;
  radius: number;
  weaponType: WeaponType;
}

export interface BlastVisualEffect {
  x: number;
  y: number;
  radius: number;
  weaponType: WeaponType;
  age: number;
  duration: number;
}

export interface ActiveWeaponPickup {
  id: string;
  x: number;
  y: number;
  weaponType: WeaponType;
  respawnTimer: number; // 0 = available
}
