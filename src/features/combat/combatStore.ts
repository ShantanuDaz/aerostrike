import { create } from 'zustand';
import type { ActiveWeaponPickup, Bullet, Particle, WeaponType } from './types';
import type { GameMap } from '../map/types';
import { WEAPONS } from './weaponsConfig';
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

interface CombatStore {
  equippedWeapon: WeaponType;
  currentAmmo: number;
  ammoByWeapon: Record<WeaponType, number>;
  lastFiredAt: number;

  setBullets: (bullets: Bullet[]) => void;
  setParticles: (particles: Particle[]) => void;
  initLoadout: (startingWeapon?: WeaponType) => void;
  setEquippedWeapon: (weapon: WeaponType) => void;
  grantWeaponPickup: (weapon: WeaponType) => void;
  cycleWeapon: () => void;
  setPickups: (pickups: ActiveWeaponPickup[]) => void;
  fireWeapon: (params: FireWeaponParams) => { recoil: number; bulletsSpawned: Bullet[]; firedWeapon: WeaponType } | null;
  addBullets: (bullets: Bullet[]) => void;
  addParticles: (particles: Particle[]) => void;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  equippedWeapon: 'rifle',
  currentAmmo: WEAPONS.rifle.maxAmmo,
  ammoByWeapon: createInitialAmmoMap('rifle'),
  lastFiredAt: 0,

  setBullets: (bullets) => {
    engineWorld.bullets = bullets;
  },

  setParticles: (particles) => {
    engineWorld.particles = particles;
  },

  initLoadout: (startingWeapon = 'rifle') => {
    const ammoByWeapon = createInitialAmmoMap(startingWeapon);
    set({
      equippedWeapon: startingWeapon,
      ammoByWeapon,
      currentAmmo: ammoByWeapon[startingWeapon],
      lastFiredAt: 0,
    });
    engineWorld.notifyUrgentLocalStateChange();
  },

  setEquippedWeapon: (weapon) => {
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
    });
    engineWorld.notifyUrgentLocalStateChange();
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
    const spreadHalf = activeConfig.spread / 2;

    for (let i = 0; i < activeConfig.pellets; i++) {
      const angleOffset =
        activeConfig.pellets > 1
          ? -spreadHalf + (activeConfig.spread * i) / (activeConfig.pellets - 1)
          : (Math.random() - 0.5) * activeConfig.spread;

      const bulletAngle = aimAngle + angleOffset;
      const speed = activeConfig.speed * (0.95 + Math.random() * 0.1);

      spawned.push({
        id: `b_${shooterId}_${bulletIdCounter++}`,
        shooterId,
        team,
        weaponType: firedWeapon,
        x: muzzle.x,
        y: muzzle.y,
        vx: Math.cos(bulletAngle) * speed,
        vy: Math.sin(bulletAngle) * speed,
        damage: activeConfig.damage,
        blastRadius: activeConfig.blastRadius,
        lifespan: activeConfig.blastRadius > 0 ? 80 : 50,
        maxLifespan: activeConfig.blastRadius > 0 ? 80 : 50,
      });
    }

    engineWorld.addBullets(spawned);

    return {
      recoil: activeConfig.recoil,
      bulletsSpawned: spawned,
      firedWeapon,
    };
  },

  addBullets: (newBullets) => {
    engineWorld.addBullets(newBullets);
  },

  addParticles: (newParticles) => {
    engineWorld.addParticles(newParticles);
  },
}));
