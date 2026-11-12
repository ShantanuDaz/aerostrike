import { afterEach, describe, expect, it, vi } from 'vitest';
import { music } from '../audio/musicEngine';
import { sounds } from '../audio/soundEngine';
import { MAX_CAMERA_ZOOM, MIN_CAMERA_ZOOM } from '../camera/cameraMath';
import { DEFAULT_SETTINGS, useSettingsStore } from './settingsStore';

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
  });
});
