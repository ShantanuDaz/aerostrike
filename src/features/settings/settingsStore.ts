import { create } from 'zustand';
import type { WeaponType } from '../combat/types';
import { sounds } from '../audio/soundEngine';
import { music } from '../audio/musicEngine';

export type DefaultRadarMode = 'compact' | 'expanded' | 'hidden';
export type SettingsTab = 'avatar' | 'audio' | 'display' | 'controls';

export interface GameSettings {
  masterVolume: number;
  sfxMuted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  jetpackAudio: boolean;
  crtScanlines: boolean;
  screenShake: boolean;
  defaultRadarMode: DefaultRadarMode;
  showTouchHints: boolean;
  defaultWeapon: WeaponType;
}

const SETTINGS_STORAGE_KEY = 'aerostrike_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  sfxMuted: false,
  musicEnabled: true,
  musicVolume: 55,
  jetpackAudio: true,
  crtScanlines: true,
  screenShake: true,
  defaultRadarMode: 'compact',
  showTouchHints: true,
  defaultWeapon: 'rifle',
};

const VALID_RADAR_MODES: DefaultRadarMode[] = ['compact', 'expanded', 'hidden'];
const VALID_WEAPONS: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];

function loadStoredSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      masterVolume:
        typeof parsed.masterVolume === 'number'
          ? Math.max(0, Math.min(100, parsed.masterVolume))
          : DEFAULT_SETTINGS.masterVolume,
      sfxMuted:
        typeof parsed.sfxMuted === 'boolean'
          ? parsed.sfxMuted
          : DEFAULT_SETTINGS.sfxMuted,
      musicEnabled:
        typeof parsed.musicEnabled === 'boolean'
          ? parsed.musicEnabled
          : DEFAULT_SETTINGS.musicEnabled,
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? Math.max(0, Math.min(100, parsed.musicVolume))
          : DEFAULT_SETTINGS.musicVolume,
      jetpackAudio:
        typeof parsed.jetpackAudio === 'boolean'
          ? parsed.jetpackAudio
          : DEFAULT_SETTINGS.jetpackAudio,
      crtScanlines:
        typeof parsed.crtScanlines === 'boolean'
          ? parsed.crtScanlines
          : DEFAULT_SETTINGS.crtScanlines,
      screenShake:
        typeof parsed.screenShake === 'boolean'
          ? parsed.screenShake
          : DEFAULT_SETTINGS.screenShake,
      defaultRadarMode: VALID_RADAR_MODES.includes(parsed.defaultRadarMode as DefaultRadarMode)
        ? (parsed.defaultRadarMode as DefaultRadarMode)
        : DEFAULT_SETTINGS.defaultRadarMode,
      showTouchHints:
        typeof parsed.showTouchHints === 'boolean'
          ? parsed.showTouchHints
          : DEFAULT_SETTINGS.showTouchHints,
      defaultWeapon: VALID_WEAPONS.includes(parsed.defaultWeapon as WeaponType)
        ? (parsed.defaultWeapon as WeaponType)
        : DEFAULT_SETTINGS.defaultWeapon,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function syncAudioEngines(settings: GameSettings) {
  sounds.applyAudioSettings({
    volume: settings.masterVolume,
    muted: settings.sfxMuted,
    jetpackEnabled: settings.jetpackAudio,
  });
  music.applySettings({
    enabled: settings.musicEnabled,
    musicVolume: settings.musicVolume,
    masterVolume: settings.masterVolume,
    muted: false,
  });
}

function persistSettings(next: GameSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota or private mode failures
  }
  syncAudioEngines(next);
}

const initialSettings = loadStoredSettings();
syncAudioEngines(initialSettings);

interface SettingsStore extends GameSettings {
  updateSettings: (patch: Partial<GameSettings>) => void;
  toggleMute: () => boolean;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initialSettings,

  updateSettings: (patch) =>
    set((state) => {
      const next: GameSettings = {
        masterVolume: patch.masterVolume ?? state.masterVolume,
        sfxMuted: patch.sfxMuted ?? state.sfxMuted,
        musicEnabled: patch.musicEnabled ?? state.musicEnabled,
        musicVolume: patch.musicVolume ?? state.musicVolume,
        jetpackAudio: patch.jetpackAudio ?? state.jetpackAudio,
        crtScanlines: patch.crtScanlines ?? state.crtScanlines,
        screenShake: patch.screenShake ?? state.screenShake,
        defaultRadarMode: patch.defaultRadarMode ?? state.defaultRadarMode,
        showTouchHints: patch.showTouchHints ?? state.showTouchHints,
        defaultWeapon: patch.defaultWeapon ?? state.defaultWeapon,
      };
      persistSettings(next);
      return next;
    }),

  toggleMute: () => {
    const nextMuted = !get().sfxMuted;
    get().updateSettings({ sfxMuted: nextMuted });
    return nextMuted;
  },

  resetSettings: () => {
    persistSettings(DEFAULT_SETTINGS);
    set({ ...DEFAULT_SETTINGS });
  },
}));
