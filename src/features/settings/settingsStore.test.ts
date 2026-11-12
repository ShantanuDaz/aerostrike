import { afterEach, describe, expect, it, vi } from 'vitest';
import { music } from '../audio/musicEngine';
import { sounds } from '../audio/soundEngine';
import { MAX_CAMERA_ZOOM, MIN_CAMERA_ZOOM } from '../camera/cameraMath';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TOUCH_CONTROL_SCALE,
  MAX_TOUCH_CONTROL_OPACITY,
  MAX_TOUCH_CONTROL_SCALE,
  MAX_TOUCH_DEADZONE,
  MIN_TOUCH_CONTROL_OPACITY,
  MIN_TOUCH_CONTROL_SCALE,
  MIN_TOUCH_DEADZONE,
  SETTINGS_SCHEMA_VERSION,
  loadStoredSettings,
  useSettingsStore,
} from './settingsStore';

describe('settingsStore audio decoupling & zoom/touch settings', () => {
  afterEach(() => {
    useSettingsStore.getState().resetSettings();
    vi.restoreAllMocks();
  });

  it('toggles SFX mute without muting adaptive background music', () => {
    const soundsSpy = vi.spyOn(sounds, 'applyAudioSettings');
    const musicSpy = vi.spyOn(music, 'applySettings');

    const muted = useSettingsStore.getState().toggleMute();
    expect(muted).toBe(true);

    expect(soundsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        muted: true,
      }),
    );
    expect(musicSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        muted: false,
      }),
    );
  });

  it('clamps cameraZoom updates and preserves new UX defaults on reset', () => {
    useSettingsStore.getState().updateSettings({
      cameraZoomMode: 'custom',
      cameraZoom: 5,
      hudScale: 'large',
      touchAimMode: 'precision',
      touchLayout: 'left_handed',
      highContrastTeamMarkers: true,
      hapticsEnabled: false,
    });

    let state = useSettingsStore.getState();
    expect(state.cameraZoomMode).toBe('custom');
    expect(state.cameraZoom).toBe(MAX_CAMERA_ZOOM);
    expect(state.hudScale).toBe('large');
    expect(state.touchAimMode).toBe('precision');
    expect(state.touchLayout).toBe('left_handed');
    expect(state.highContrastTeamMarkers).toBe(true);
    expect(state.hapticsEnabled).toBe(false);

    useSettingsStore.getState().updateSettings({ cameraZoom: 0.1 });
    expect(useSettingsStore.getState().cameraZoom).toBe(MIN_CAMERA_ZOOM);

    useSettingsStore.getState().resetSettings();
    state = useSettingsStore.getState();
    expect(state.cameraZoomMode).toBe(DEFAULT_SETTINGS.cameraZoomMode);
    expect(state.hudScale).toBe(DEFAULT_SETTINGS.hudScale);
    expect(state.touchAimMode).toBe(DEFAULT_SETTINGS.touchAimMode);
    expect(state.touchLayout).toBe(DEFAULT_SETTINGS.touchLayout);
    expect(state.touchControlScale).toBe(DEFAULT_TOUCH_CONTROL_SCALE);
  });

  it('clamps touchControlScale, touchControlOpacity, and touchStickDeadzone within bounds', () => {
    useSettingsStore.getState().updateSettings({
      touchControlScale: 3.0,
      touchControlOpacity: 2.5,
      touchStickDeadzone: 99,
      showTouchGrenadeButton: false,
      touchAimMode: 'instant',
    });

    let state = useSettingsStore.getState();
    expect(state.touchControlScale).toBe(MAX_TOUCH_CONTROL_SCALE);
    expect(state.touchControlOpacity).toBe(MAX_TOUCH_CONTROL_OPACITY);
    expect(state.touchStickDeadzone).toBe(MAX_TOUCH_DEADZONE);
    expect(state.showTouchGrenadeButton).toBe(false);
    expect(state.touchAimMode).toBe('instant');

    useSettingsStore.getState().updateSettings({
      touchControlScale: 0.1,
      touchControlOpacity: 0.05,
      touchStickDeadzone: 1,
    });

    state = useSettingsStore.getState();
    expect(state.touchControlScale).toBe(MIN_TOUCH_CONTROL_SCALE);
    expect(state.touchControlOpacity).toBe(MIN_TOUCH_CONTROL_OPACITY);
    expect(state.touchStickDeadzone).toBe(MIN_TOUCH_DEADZONE);
  });

  it('migrates legacy v1 instant touchAimMode to precision while preserving explicit v2 choice', () => {
    localStorage.setItem(
      'aerostrike_settings_v1',
      JSON.stringify({ touchAimMode: 'instant', masterVolume: 65 }),
    );
    const migrated = loadStoredSettings();
    expect(migrated.settingsVersion).toBe(SETTINGS_SCHEMA_VERSION);
    expect(migrated.touchAimMode).toBe('precision');
    expect(migrated.masterVolume).toBe(65);

    localStorage.setItem(
      'aerostrike_settings_v1',
      JSON.stringify({ settingsVersion: SETTINGS_SCHEMA_VERSION, touchAimMode: 'instant' }),
    );
    const explicitV2 = loadStoredSettings();
    expect(explicitV2.touchAimMode).toBe('instant');
    localStorage.removeItem('aerostrike_settings_v1');
  });
});
