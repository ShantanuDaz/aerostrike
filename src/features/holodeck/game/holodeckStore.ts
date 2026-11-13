import { create } from 'zustand';
import type {
  HolodeckPlayerState,
  HolodeckRoundPhase,
  HolodeckWeaponId,
  SpikeEntity,
} from '../core/types';
import { createInitialSpikeEntity } from './spikeController';
import { HOLODECK_WEAPONS } from '../core/types';
import type { Team } from '../../ctf/types';

export interface HolodeckStoreState {
  isSoloSkirmish: boolean;
  roundPhase: HolodeckRoundPhase;
  roundTimerSec: number;
  scoreAttackers: number;
  scoreDefenders: number;
  currentRound: number;
  targetRounds: number;
  spike: SpikeEntity;
  localPlayer: HolodeckPlayerState;
  remotePlayers: Record<string, HolodeckPlayerState>;
  killFeed: { id: string; killer: string; victim: string; weapon: HolodeckWeaponId; headshot: boolean }[];

  // Actions
  setSoloSkirmish: (isSolo: boolean) => void;
  setRoundPhase: (phase: HolodeckRoundPhase) => void;
  setRoundTimerSec: (sec: number) => void;
  updateSpike: (spike: SpikeEntity) => void;
  setScores: (attackers: number, defenders: number) => void;
  advanceRound: (winner: Team) => void;
  updateLocalPlayer: (partial: Partial<HolodeckPlayerState>) => void;
  setRemotePlayer: (id: string, player: HolodeckPlayerState) => void;
  removeRemotePlayer: (id: string) => void;
  switchWeapon: (weaponId: HolodeckWeaponId) => void;
  buyWeapon: (weaponId: HolodeckWeaponId) => boolean;
  pushKillFeed: (killer: string, victim: string, weapon: HolodeckWeaponId, headshot: boolean) => void;
  resetMatch: () => void;
}

const DEFAULT_LOCAL_PLAYER: HolodeckPlayerState = {
  id: 'local_pilot',
  callsign: 'Spectre',
  team: 'red', // default Attacker
  isLocal: true,
  isHost: false,
  isAlive: true,
  health: 100,
  armor: 50,
  credits: 3000,
  position: [0, 0, 50],
  velocity: [0, 0, 0],
  yaw: 0,
  pitch: 0,
  isCrouching: false,
  isGrounded: true,
  isSprinting: false,
  activeWeaponId: 'vandal',
  ammo: {
    classic: { clip: 12, reserve: 36 },
    vandal: { clip: 25, reserve: 75 },
    operator: { clip: 5, reserve: 10 },
    knife: { clip: 0, reserve: 0 },
  },
  kills: 0,
  deaths: 0,
  plants: 0,
  defuses: 0,
};

export const useHolodeckStore = create<HolodeckStoreState>((set, get) => ({
  isSoloSkirmish: false,
  roundPhase: 'active',
  roundTimerSec: 100,
  scoreAttackers: 0,
  scoreDefenders: 0,
  currentRound: 1,
  targetRounds: 5,
  spike: createInitialSpikeEntity(),
  localPlayer: { ...DEFAULT_LOCAL_PLAYER },
  remotePlayers: {},
  killFeed: [],

  setSoloSkirmish: (isSoloSkirmish) => set({ isSoloSkirmish }),
  setRoundPhase: (roundPhase) => set({ roundPhase }),
  setRoundTimerSec: (roundTimerSec) => set({ roundTimerSec }),
  updateSpike: (spike) => set({ spike }),
  setScores: (scoreAttackers, scoreDefenders) => set({ scoreAttackers, scoreDefenders }),

  advanceRound: (winner: Team) => {
    const s = get();
    const nextAtk = winner === 'red' ? s.scoreAttackers + 1 : s.scoreAttackers;
    const nextDef = winner === 'blue' ? s.scoreDefenders + 1 : s.scoreDefenders;
    const isOver = nextAtk >= s.targetRounds || nextDef >= s.targetRounds;

    set({
      scoreAttackers: nextAtk,
      scoreDefenders: nextDef,
      currentRound: s.currentRound + 1,
      roundPhase: isOver ? 'game_over' : 'active',
      roundTimerSec: 100,
      spike: createInitialSpikeEntity(),
      localPlayer: {
        ...s.localPlayer,
        isAlive: true,
        health: 100,
        armor: 50,
        position: s.localPlayer.team === 'red' ? [0, 0, 50] : [0, 0, -50],
        ammo: {
          classic: { clip: 12, reserve: 36 },
          vandal: { clip: 25, reserve: 75 },
          operator: { clip: 5, reserve: 10 },
          knife: { clip: 0, reserve: 0 },
        },
      },
    });
  },

  updateLocalPlayer: (partial) => {
    set((state) => ({
      localPlayer: { ...state.localPlayer, ...partial },
    }));
  },

  setRemotePlayer: (id, player) => {
    set((state) => ({
      remotePlayers: { ...state.remotePlayers, [id]: player },
    }));
  },

  removeRemotePlayer: (id) => {
    set((state) => {
      const copy = { ...state.remotePlayers };
      delete copy[id];
      return { remotePlayers: copy };
    });
  },

  switchWeapon: (weaponId) => {
    set((state) => ({
      localPlayer: {
        ...state.localPlayer,
        activeWeaponId: weaponId,
      },
    }));
  },

  buyWeapon: (weaponId) => {
    const config = HOLODECK_WEAPONS[weaponId];
    set((state) => ({
      localPlayer: {
        ...state.localPlayer,
        activeWeaponId: weaponId,
        ammo: {
          ...state.localPlayer.ammo,
          [weaponId]: {
            clip: config.magazineSize,
            reserve: config.reserveAmmo,
          },
        },
      },
    }));
    return true;
  },

  pushKillFeed: (killer, victim, weapon, headshot) => {
    const id = `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    set((state) => ({
      killFeed: [{ id, killer, victim, weapon, headshot }, ...state.killFeed.slice(0, 4)],
    }));
  },

  resetMatch: () => {
    set({
      roundPhase: 'active',
      roundTimerSec: 100,
      scoreAttackers: 0,
      scoreDefenders: 0,
      currentRound: 1,
      spike: createInitialSpikeEntity(),
      localPlayer: { ...DEFAULT_LOCAL_PLAYER },
      remotePlayers: {},
      killFeed: [],
    });
  },
}));
