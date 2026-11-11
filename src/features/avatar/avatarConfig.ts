import type { AvatarConfig } from './types';

export const STORAGE_KEY = 'mini_militia_avatar_v1';
export const ENLISTED_KEY = 'mini_militia_enlisted_v1';
export const PLAYER_ID_KEY = 'aerostrike_pilot_id_v1';
export const TAB_SESSION_KEY = 'aerostrike_tab_id_v1';

export function getOrCreatePlayerId(): string {
  try {
    let tabId = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!tabId) {
      tabId = Math.random().toString(36).substring(2, 7).toUpperCase();
      sessionStorage.setItem(TAB_SESSION_KEY, tabId);
    }
    let baseId = localStorage.getItem(PLAYER_ID_KEY);
    if (!baseId) {
      baseId = 'pilot_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem(PLAYER_ID_KEY, baseId);
    }
    return `${baseId}_${tabId}`;
  } catch {
    return 'pilot_' + Math.random().toString(36).substring(2, 10);
  }
}

export const DEFAULT_AVATAR: AvatarConfig = {
  callsign: 'Cadet_' + Math.floor(100 + Math.random() * 900),
  bodyColor: '#3b82f6',
  skinTone: '#fbcfe8',
  headgear: 'soldier_helmet',
  headgearColor: '#334155',
  visorStyle: 'classic',
  visorColor: '#0f172a',
  jetpackStyle: 'dual_tank',
};

export function loadStoredAvatar(): AvatarConfig {
  try {
    let tabId = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!tabId) {
      tabId = Math.random().toString(36).substring(2, 7).toUpperCase();
      sessionStorage.setItem(TAB_SESSION_KEY, tabId);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_AVATAR,
        ...parsed,
        callsign: parsed.callsign || `Cadet_${tabId}`,
      };
    }
    return {
      ...DEFAULT_AVATAR,
      callsign: `Cadet_${tabId}`,
    };
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function checkIsEnlisted(): boolean {
  try {
    return localStorage.getItem(ENLISTED_KEY) === 'true';
  } catch {
    return false;
  }
}
