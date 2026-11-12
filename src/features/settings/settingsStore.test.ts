import { afterEach, describe, expect, it, vi } from 'vitest';
import { music } from '../audio/musicEngine';
import { sounds } from '../audio/soundEngine';
import { useSettingsStore } from './settingsStore';

describe('settingsStore audio decoupling', () => {
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
});
