import { create } from 'zustand';
import type { ActiveWeaponPickup, Bullet, Particle, WeaponType } from './types';
import type { GameMap } from '../map/types';
import {
  GRENADE_MAX_COUNT,
  GRENADE_STARTING_COUNT,
  WEAPONS,
  computeProjectileLaunchVelocity,
  getProjectileLifespanFrames,
} from './weaponsConfig';
import { sounds } from '../audio/soundEngine';
import { engineWorld } from '../game/engineWorld';
import { getSafeMuzzlePoint } from './updateBullets';

let bulletIdCounter = 0;

const WEAPON_CYCLE: readonly WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];

function createInitialAmmoMap(startingWeapon: WeaponType = 'rifle'): Record<WeaponType, number> {
  const ammo: Record<WeaponType, number> = {
    pistol: Infinity,
    rifle: 0,
    shotgun: 0,
    sniper: 0,
    rocket: 0,
    grenade: GRENADE_STARTING_COUNT,
  };
  ammo[startingWeapon] = WEAPONS[startingWeapon].maxAmmo;
  return ammo;
}

interface FireWeaponParams {
  shooterId: string;
  team?: 'blue' | 'red';
  originX: number;
  originY: number;
  aimAngle: number;
  map?: GameMap | null;
}

export interface AmmoNotice {
  text: string;
  atMs: number;
}

export interface FireResult {
  recoil: number;
  bulletsSpawned: Bullet[];
  firedWeapon: WeaponType;
  spreadOffsets: number[];
  speedScale: number;
}

interface CombatStore {
  equippedWeapon: WeaponType;
  currentAmmo: number;
  ammoByWeapon: Record<WeaponType, number>;
  lastFiredAt: number;
  grenades: number;
  maxGrenades: number;
  lastGrenadeAt: number;
  ammoNotice: AmmoNotice | null;

  setBullets: (bullets: Bullet[]) => void;
  setParticles: (particles: Particle[]) => void;
  initLoadout: (startingWeapon?: WeaponType) => void;
  setEquippedWeapon: (weapon: WeaponType) => void;
  grantWeaponPickup: (weapon: WeaponType) => void;
  refillGrenades: (count?: number) => void;
  cycleWeapon: () => void;
  setPickups: (pickups: ActiveWeaponPickup[]) => void;
  clearAmmoNotice: () => void;
  fireWeapon: (params: FireWeaponParams) => FireResult | null;
  throwGrenade: (params: FireWeaponParams) => FireResult | null;
  addBullets: (bullets: Bullet[]) => void;
  addParticles: (particles: Particle[]) => void;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  equippedWeapon: 'rifle',
  currentAmmo: WEAPONS.rifle.maxAmmo,
  ammoByWeapon: createInitialAmmoMap('rifle'),
  lastFiredAt: 0,
  grenades: GRENADE_STARTING_COUNT,
  maxGrenades: GRENADE_MAX_COUNT,
  lastGrenadeAt: 0,
  ammoNotice: null,

  setBullets: (bullets) => {
    engineWorld.bullets = bullets;
  },

  setParticles: (particles) => {
    engineWorld.particles = particles;
  },

  clearAmmoNotice: () => set({ ammoNotice: null }),

  initLoadout: (startingWeapon = 'rifle') => {
    const safeStart: WeaponType = startingWeapon === 'grenade' ? 'rifle' : startingWeapon;
    const ammoByWeapon = createInitialAmmoMap(safeStart);
    set({
      equippedWeapon: safeStart,
      ammoByWeapon,
      currentAmmo: ammoByWeapon[safeStart],
      lastFiredAt: 0,
      grenades: GRENADE_STARTING_COUNT,
      maxGrenades: GRENADE_MAX_COUNT,
      lastGrenadeAt: 0,
      ammoNotice: null,
    });
    engineWorld.notifyUrgentLocalStateChange();
  },

  setEquippedWeapon: (weapon) => {
    if (weapon === 'grenade') return;
    const { equippedWeapon, ammoByWeapon } = get();
    const ammo = ammoByWeapon[weapon];
    if (WEAPONS[weapon].maxAmmo !== Infinity && ammo <= 0) {
      return;
    }
    if (equippedWeapon === weapon && get().currentAmmo === ammo) {
      return;
    }
    set({
      equippedWeapon: weapon,
      currentAmmo: ammo,
    });
    engineWorld.notifyUrgentLocalStateChange();
  },

  grantWeaponPickup: (weapon) => {
    if (weapon === 'grenade') {
      get().refillGrenades(GRENADE_MAX_COUNT);
      return;
    }
    const { ammoByWeapon } = get();
    const grantedAmmo = WEAPONS[weapon].maxAmmo;
    const nextAmmoByWeapon = {
      ...ammoByWeapon,
      [weapon]: grantedAmmo,
    };
    set({
      equippedWeapon: weapon,
      ammoByWeapon: nextAmmoByWeapon,
      currentAmmo: grantedAmmo,
      ammoNotice: null,
    });
    engineWorld.notifyUrgentLocalStateChange();
  },

  refillGrenades: (count = GRENADE_MAX_COUNT) => {
    const state = get();
    const nextCount = Math.min(state.maxGrenades, Math.max(state.grenades, count));
    if (nextCount === state.grenades) return;
    set({
      grenades: nextCount,
      ammoByWeapon: {
        ...state.ammoByWeapon,
        grenade: nextCount,
      },
    });
  },

  cycleWeapon: () => {
    const { equippedWeapon, ammoByWeapon } = get();
    const currentIdx = WEAPON_CYCLE.indexOf(equippedWeapon);
    for (let offset = 1; offset <= WEAPON_CYCLE.length; offset++) {
      const candidate = WEAPON_CYCLE[(currentIdx + offset) % WEAPON_CYCLE.length];
      if (candidate === equippedWeapon) continue;
      if (WEAPONS[candidate].maxAmmo === Infinity || ammoByWeapon[candidate] > 0) {
        get().setEquippedWeapon(candidate);
        return;
      }
    }
  },

  setPickups: (pickups) => {
    engineWorld.pickups = pickups;
  },

  fireWeapon: ({ shooterId, team, originX, originY, aimAngle, map }) => {
    const state = get();
    let activeWeapon = state.equippedWeapon;
    let activeAmmo = state.ammoByWeapon[activeWeapon] ?? state.currentAmmo;
    let activeConfig = WEAPONS[activeWeapon];

    // Safety fallback if somehow holding an empty limited weapon
    if (activeConfig.maxAmmo !== Infinity && activeAmmo <= 0) {
      activeWeapon = state.ammoByWeapon.rifle > 0 ? 'rifle' : 'pistol';
      activeAmmo = state.ammoByWeapon[activeWeapon];
      activeConfig = WEAPONS[activeWeapon];
      set({ equippedWeapon: activeWeapon, currentAmmo: activeAmmo });
      engineWorld.notifyUrgentLocalStateChange();
    }

    const now = performance.now();
    if (now - state.lastFiredAt < activeConfig.fireRateMs) {
      return null;
    }

    const firedWeapon = activeWeapon;

    if (activeConfig.maxAmmo !== Infinity) {
      const nextAmmo = Math.max(0, activeAmmo - 1);
      const nextAmmoByWeapon = {
        ...state.ammoByWeapon,
        [firedWeapon]: nextAmmo,
      };

      if (nextAmmo <= 0) {
        const fallback: WeaponType =
          firedWeapon !== 'rifle' && nextAmmoByWeapon.rifle > 0 ? 'rifle' : 'pistol';
        set({
          equippedWeapon: fallback,
          ammoByWeapon: nextAmmoByWeapon,
          currentAmmo: nextAmmoByWeapon[fallback],
          lastFiredAt: now,
          ammoNotice: {
            text: `${WEAPONS[firedWeapon].name.toUpperCase()} EMPTY • ${WEAPONS[fallback].name.toUpperCase()}`,
            atMs: Date.now(),
          },
        });
        engineWorld.notifyUrgentLocalStateChange();
      } else {
        set({
          ammoByWeapon: nextAmmoByWeapon,
          currentAmmo: nextAmmo,
          lastFiredAt: now,
        });
      }
    } else {
      set({ lastFiredAt: now });
    }

    sounds.playWeaponSound(firedWeapon);

    const muzzle = getSafeMuzzlePoint(originX, originY, aimAngle, 18, map);
    const spawned: Bullet[] = [];
    const spreadOffsets: number[] = [];
    const spreadHalf = activeConfig.spread / 2;
    const speedScale = 0.95 + Math.random() * 0.1;
    const speed = activeConfig.speed * speedScale;

    for (let i = 0; i < activeConfig.pellets; i++) {
      const angleOffset =
        activeConfig.pellets > 1
          ? -spreadHalf + (activeConfig.spread * i) / (activeConfig.pellets - 1)
          : (Math.random() - 0.5) * activeConfig.spread;

      spreadOffsets.push(angleOffset);
      const bulletAngle = aimAngle + angleOffset;
      const lifespan = getProjectileLifespanFrames(activeConfig);
      const { vx, vy } = computeProjectileLaunchVelocity(firedWeapon, bulletAngle, speed);

      spawned.push({
        id: `b_${shooterId}_${bulletIdCounter++}`,
        shooterId,
        team,
        weaponType: firedWeapon,
        x: muzzle.x,
        y: muzzle.y,
        vx,
        vy,
        damage: activeConfig.damage,
        blastRadius: activeConfig.blastRadius,
        lifespan,
        maxLifespan: lifespan,
      });
    }

    engineWorld.addBullets(spawned);

    return {
      recoil: activeConfig.recoil,
      bulletsSpawned: spawned,
      firedWeapon,
      spreadOffsets,
      speedScale,
    };
  },

  throwGrenade: ({ shooterId, team, originX, originY, aimAngle, map }) => {
    const state = get();
    if (state.grenades <= 0) {
      return null;
    }

    const now = performance.now();
    const cfg = WEAPONS.grenade;
    if (now - state.lastGrenadeAt < cfg.fireRateMs) {
      return null;
    }

    const nextGrenades = Math.max(0, state.grenades - 1);
    set({
      grenades: nextGrenades,
      lastGrenadeAt: now,
      ammoByWeapon: {
        ...state.ammoByWeapon,
        grenade: nextGrenades,
      },
    });

    sounds.playWeaponSound('grenade');

    const muzzle = getSafeMuzzlePoint(originX, originY, aimAngle, 16, map);
    const speedScale = 1.0;
    const speed = cfg.speed * speedScale;
    const { vx, vy } = computeProjectileLaunchVelocity('grenade', aimAngle, speed);
    const lifespan = getProjectileLifespanFrames(cfg);

    const grenadeBullet: Bullet = {
      id: `g_${shooterId}_${bulletIdCounter++}`,
      shooterId,
      team,
      weaponType: 'grenade',
      x: muzzle.x,
      y: muzzle.y,
      vx,
      vy,
      damage: cfg.damage,
      blastRadius: cfg.blastRadius,
      lifespan,
      maxLifespan: lifespan,
    };

    engineWorld.addBullets([grenadeBullet]);

    return {
      recoil: cfg.recoil,
      bulletsSpawned: [grenadeBullet],
      firedWeapon: 'grenade',
      spreadOffsets: [0],
      speedScale,
    };
  },

  addBullets: (newBullets) => {
    engineWorld.addBullets(newBullets);
  },

  addParticles: (newParticles) => {
    engineWorld.addParticles(newParticles);
  },
}));
