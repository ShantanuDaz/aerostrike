import { create } from 'zustand';
import type { WeaponType } from '../combat/types';
import { sounds } from '../audio/soundEngine';
import { music } from '../audio/musicEngine';
import { voiceManager } from '../comms/voiceManager';
import { DEFAULT_CAMERA_ZOOM, clampCameraZoom } from '../camera/cameraMath';

export type DefaultRadarMode = 'compact' | 'expanded' | 'hidden';
export type SettingsTab = 'avatar' | 'audio' | 'display' | 'controls';
export type CameraZoomMode = 'auto' | 'custom';
export type HudScale = 'compact' | 'standard' | 'large';
export type TouchAimMode = 'instant' | 'precision';
export type TouchLayout = 'right_handed' | 'left_handed';

export interface GameSettings {
  masterVolume: number;
  sfxMuted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  voiceVolume: number;
  voiceMuted: boolean;
  jetpackAudio: boolean;
  crtScanlines: boolean;
  screenShake: boolean;
  defaultRadarMode: DefaultRadarMode;
  showTouchHints: boolean;
  defaultWeapon: WeaponType;
  cameraZoomMode: CameraZoomMode;
  cameraZoom: number;
  hudScale: HudScale;
  highContrastTeamMarkers: boolean;
  touchAimMode: TouchAimMode;
  touchLayout: TouchLayout;
  touchAimLine: boolean;
  hapticsEnabled: boolean;
  showTouchBoostButton: boolean;
}

const SETTINGS_STORAGE_KEY = 'aerostrike_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  sfxMuted: false,
  musicEnabled: true,
  musicVolume: 55,
  voiceVolume: 90,
  voiceMuted: false,
  jetpackAudio: true,
  crtScanlines: true,
  screenShake: true,
  defaultRadarMode: 'compact',
  showTouchHints: true,
  defaultWeapon: 'rifle',
  cameraZoomMode: 'auto',
  cameraZoom: DEFAULT_CAMERA_ZOOM,
  hudScale: 'standard',
  highContrastTeamMarkers: false,
  touchAimMode: 'instant',
  touchLayout: 'right_handed',
  touchAimLine: true,
  hapticsEnabled: true,
  showTouchBoostButton: true,
};

const VALID_RADAR_MODES: DefaultRadarMode[] = ['compact', 'expanded', 'hidden'];
const VALID_WEAPONS: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];
const VALID_ZOOM_MODES: CameraZoomMode[] = ['auto', 'custom'];
const VALID_HUD_SCALES: HudScale[] = ['compact', 'standard', 'large'];
const VALID_TOUCH_AIM_MODES: TouchAimMode[] = ['instant', 'precision'];
const VALID_TOUCH_LAYOUTS: TouchLayout[] = ['right_handed', 'left_handed'];

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
      voiceVolume:
        typeof parsed.voiceVolume === 'number'
          ? Math.max(0, Math.min(100, parsed.voiceVolume))
          : DEFAULT_SETTINGS.voiceVolume,
      voiceMuted:
        typeof parsed.voiceMuted === 'boolean'
          ? parsed.voiceMuted
          : DEFAULT_SETTINGS.voiceMuted,
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
      cameraZoomMode: VALID_ZOOM_MODES.includes(parsed.cameraZoomMode as CameraZoomMode)
        ? (parsed.cameraZoomMode as CameraZoomMode)
        : DEFAULT_SETTINGS.cameraZoomMode,
      cameraZoom:
        typeof parsed.cameraZoom === 'number'
          ? clampCameraZoom(parsed.cameraZoom)
          : DEFAULT_SETTINGS.cameraZoom,
      hudScale: VALID_HUD_SCALES.includes(parsed.hudScale as HudScale)
        ? (parsed.hudScale as HudScale)
        : DEFAULT_SETTINGS.hudScale,
      highContrastTeamMarkers:
        typeof parsed.highContrastTeamMarkers === 'boolean'
          ? parsed.highContrastTeamMarkers
          : DEFAULT_SETTINGS.highContrastTeamMarkers,
      touchAimMode: VALID_TOUCH_AIM_MODES.includes(parsed.touchAimMode as TouchAimMode)
        ? (parsed.touchAimMode as TouchAimMode)
        : DEFAULT_SETTINGS.touchAimMode,
      touchLayout: VALID_TOUCH_LAYOUTS.includes(parsed.touchLayout as TouchLayout)
        ? (parsed.touchLayout as TouchLayout)
        : DEFAULT_SETTINGS.touchLayout,
      touchAimLine:
        typeof parsed.touchAimLine === 'boolean'
          ? parsed.touchAimLine
          : DEFAULT_SETTINGS.touchAimLine,
      hapticsEnabled:
        typeof parsed.hapticsEnabled === 'boolean'
          ? parsed.hapticsEnabled
          : DEFAULT_SETTINGS.hapticsEnabled,
      showTouchBoostButton:
        typeof parsed.showTouchBoostButton === 'boolean'
          ? parsed.showTouchBoostButton
          : DEFAULT_SETTINGS.showTouchBoostButton,
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
  voiceManager.applyVoiceSettings({
    voiceVolume: settings.voiceVolume,
    voiceMuted: settings.voiceMuted,
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
        voiceVolume:
          patch.voiceVolume !== undefined
            ? Math.max(0, Math.min(100, patch.voiceVolume))
            : state.voiceVolume,
        voiceMuted: patch.voiceMuted ?? state.voiceMuted,
        jetpackAudio: patch.jetpackAudio ?? state.jetpackAudio,
        crtScanlines: patch.crtScanlines ?? state.crtScanlines,
        screenShake: patch.screenShake ?? state.screenShake,
        defaultRadarMode: patch.defaultRadarMode ?? state.defaultRadarMode,
        showTouchHints: patch.showTouchHints ?? state.showTouchHints,
        defaultWeapon: patch.defaultWeapon ?? state.defaultWeapon,
        cameraZoomMode: patch.cameraZoomMode ?? state.cameraZoomMode,
        cameraZoom:
          patch.cameraZoom !== undefined
            ? clampCameraZoom(patch.cameraZoom)
            : state.cameraZoom,
        hudScale: patch.hudScale ?? state.hudScale,
        highContrastTeamMarkers:
          patch.highContrastTeamMarkers ?? state.highContrastTeamMarkers,
        touchAimMode: patch.touchAimMode ?? state.touchAimMode,
        touchLayout: patch.touchLayout ?? state.touchLayout,
        touchAimLine: patch.touchAimLine ?? state.touchAimLine,
        hapticsEnabled: patch.hapticsEnabled ?? state.hapticsEnabled,
        showTouchBoostButton: patch.showTouchBoostButton ?? state.showTouchBoostButton,
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
