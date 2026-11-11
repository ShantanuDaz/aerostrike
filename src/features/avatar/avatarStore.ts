import { create } from 'zustand';
import type { AvatarConfig } from './types';
import { usePlayerStore } from '../player/playerStore';
import { engineWorld } from '../game/engineWorld';
import {
  STORAGE_KEY,
  ENLISTED_KEY,
  DEFAULT_AVATAR,
  getOrCreatePlayerId,
  loadStoredAvatar,
  checkIsEnlisted,
} from './avatarConfig';

export { DEFAULT_AVATAR, loadStoredAvatar, getOrCreatePlayerId, checkIsEnlisted };

interface AvatarStore {
  avatar: AvatarConfig;
  playerId: string;
  isEnlisted: boolean;
  setAvatar: (config: Partial<AvatarConfig>) => void;
  confirmEnlistment: (config?: Partial<AvatarConfig>) => void;
  resetAvatar: () => void;
}

function syncAvatarToLocalPlayer(avatar: AvatarConfig) {
  try {
    const live = engineWorld.localPlayer ?? usePlayerStore.getState().player;
    if (live && live.avatar !== avatar) {
      usePlayerStore.getState().setPlayer({ ...live, avatar });
    }
  } catch {
    // ignore
  }
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  avatar: loadStoredAvatar(),
  playerId: getOrCreatePlayerId(),
  isEnlisted: checkIsEnlisted(),

  setAvatar: (patch) =>
    set((state) => {
      const next = { ...state.avatar, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      syncAvatarToLocalPlayer(next);
      return { avatar: next };
    }),

  confirmEnlistment: (patch) =>
    set((state) => {
      const next = patch ? { ...state.avatar, ...patch } : state.avatar;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(ENLISTED_KEY, 'true');
      } catch {
        // ignore
      }
      syncAvatarToLocalPlayer(next);
      return { avatar: next, isEnlisted: true };
    }),

  resetAvatar: () =>
    set(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ENLISTED_KEY);
      } catch {
        // ignore
      }
      syncAvatarToLocalPlayer(DEFAULT_AVATAR);
      return { avatar: DEFAULT_AVATAR, isEnlisted: false };
    }),
}));

useAvatarStore.subscribe((state) => {
  syncAvatarToLocalPlayer(state.avatar);
});
