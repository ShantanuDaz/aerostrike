import type { Team } from '../../ctf/types';

export type HolodeckWeaponId = 'classic' | 'vandal' | 'operator' | 'knife';

export interface HolodeckWeaponConfig {
  id: HolodeckWeaponId;
  name: string;
  category: 'sidearm' | 'rifle' | 'sniper' | 'melee';
  damageHead: number;
  damageBody: number;
  damageLegs: number;
  fireRateRps: number; // rounds per second
  magazineSize: number;
  reserveAmmo: number;
  reloadTimeSec: number;
  firstShotAccuracySpreadRad: number;
  recoilBloomPerShotRad: number;
  maxSpreadRad: number;
  recoverySpeedRadPerSec: number;
  movementInaccuracyMultiplier: number;
  cost: number;
  automatic: boolean;
  zoomFov?: number;
}

export const HOLODECK_WEAPONS: Record<HolodeckWeaponId, HolodeckWeaponConfig> = {
  classic: {
    id: 'classic',
    name: 'Classic Pistol',
    category: 'sidearm',
    damageHead: 78,
    damageBody: 26,
    damageLegs: 22,
    fireRateRps: 6.75,
    magazineSize: 12,
    reserveAmmo: 36,
    reloadTimeSec: 1.5,
    firstShotAccuracySpreadRad: 0.006,
    recoilBloomPerShotRad: 0.018,
    maxSpreadRad: 0.065,
    recoverySpeedRadPerSec: 0.18,
    movementInaccuracyMultiplier: 2.2,
    cost: 0,
    automatic: false,
  },
  vandal: {
    id: 'vandal',
    name: 'Vandal Rifle',
    category: 'rifle',
    damageHead: 160, // 1-tap headshot kill
    damageBody: 40,
    damageLegs: 34,
    fireRateRps: 9.75,
    magazineSize: 25,
    reserveAmmo: 75,
    reloadTimeSec: 2.5,
    firstShotAccuracySpreadRad: 0.0035,
    recoilBloomPerShotRad: 0.022,
    maxSpreadRad: 0.09,
    recoverySpeedRadPerSec: 0.22,
    movementInaccuracyMultiplier: 3.5,
    cost: 2900,
    automatic: true,
  },
  operator: {
    id: 'operator',
    name: 'Operator Sniper',
    category: 'sniper',
    damageHead: 255, // instant kill
    damageBody: 150, // instant body kill
    damageLegs: 120,
    fireRateRps: 0.75,
    magazineSize: 5,
    reserveAmmo: 10,
    reloadTimeSec: 3.7,
    firstShotAccuracySpreadRad: 0.0005, // pinpoint when scoped & still
    recoilBloomPerShotRad: 0.12,
    maxSpreadRad: 0.25,
    recoverySpeedRadPerSec: 0.15,
    movementInaccuracyMultiplier: 8.0, // immense spread when moving
    cost: 4700,
    automatic: false,
    zoomFov: 20,
  },
  knife: {
    id: 'knife',
    name: 'Tactical Blade',
    category: 'melee',
    damageHead: 100,
    damageBody: 50,
    damageLegs: 40,
    fireRateRps: 1.8,
    magazineSize: 0,
    reserveAmmo: 0,
    reloadTimeSec: 0,
    firstShotAccuracySpreadRad: 0,
    recoilBloomPerShotRad: 0,
    maxSpreadRad: 0,
    recoverySpeedRadPerSec: 1,
    movementInaccuracyMultiplier: 1,
    cost: 0,
    automatic: false,
  },
};

export type SpikeState =
  | 'idle'
  | 'carried'
  | 'planting'
  | 'planted'
  | 'defusing'
  | 'defused'
  | 'detonated';

export type PlantSite = 'A' | 'B';

export interface SpikeEntity {
  state: SpikeState;
  carrierId: string | null;
  planterId: string | null;
  defuserId: string | null;
  site: PlantSite | null;
  position: [number, number, number]; // [x, y, z]
  plantProgress: number; // 0..4.0 seconds
  defuseProgress: number; // 0..7.0 seconds
  detonationTimer: number; // counts down from 45.0 seconds
}

export type HolodeckRoundPhase =
  | 'buy_phase'
  | 'active'
  | 'spike_planted'
  | 'round_ended'
  | 'game_over';

export interface HolodeckPlayerState {
  id: string;
  callsign: string;
  team: Team; // blue = Defender, red = Attacker
  isLocal: boolean;
  isHost: boolean;
  isAlive: boolean;
  health: number; // 0..100
  armor: number; // 0..50
  credits: number;
  position: [number, number, number];
  velocity: [number, number, number];
  yaw: number; // radians
  pitch: number; // radians [-pi/2, pi/2]
  isCrouching: boolean;
  isGrounded: boolean;
  isSprinting: boolean;
  activeWeaponId: HolodeckWeaponId;
  ammo: Record<HolodeckWeaponId, { clip: number; reserve: number }>;
  kills: number;
  deaths: number;
  plants: number;
  defuses: number;
}

export interface HolodeckMatchScore {
  attackers: number;
  defenders: number;
  targetRounds: number; // default first to 5 or 9
  currentRound: number;
}
