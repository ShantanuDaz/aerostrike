import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildRoomInviteUrl,
  parseLaunchParams,
  shareRoomInvite,
} from './pwaManager';
import { pwaManifest } from './manifestConfig';
import { usePwaStore } from './pwaStore';

function readPngBitDepth(filePath: string): number {
  const buf = fs.readFileSync(filePath);
  return buf.readUInt8(24);
}

describe('PWA launch params, share sheet, store & manifest integrity', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    usePwaStore.setState({
      canInstall: false,
      isInstalled: false,
      displayMode: 'browser',
      isOnline: true,
      swRegistered: false,
      swUpdateReady: false,
      swOfflineReady: false,
      swVersion: null,
      offlineAssetCount: null,
      wakeLockActive: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('parses ?room= and ?action= launch parameters cleanly', () => {
    expect(parseLaunchParams('?room= room-abc9 ')).toEqual({
      roomCode: 'ROOM-ABC9',
      action: null,
    });
    expect(parseLaunchParams('?action=solo')).toEqual({
      roomCode: null,
      action: 'solo',
    });
    expect(parseLaunchParams('?action=HOST')).toEqual({
      roomCode: null,
      action: 'host',
    });
    expect(parseLaunchParams('?action=armory')).toEqual({
      roomCode: null,
      action: 'armory',
    });
    expect(parseLaunchParams('?action=invalid&room=xy123')).toEqual({
      roomCode: 'XY123',
      action: null,
    });
    expect(parseLaunchParams('')).toEqual({
      roomCode: null,
      action: null,
    });
  });

  it('builds valid invite URLs and uses Web Share API when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: shareMock },
      configurable: true,
    });

    const result = await shareRoomInvite('ROOM-77A');
    expect(result).toBe('shared');
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock.mock.calls[0][0].url).toContain('room=ROOM-77A');
  });

  it('falls back to clipboard when Web Share is unavailable and handles AbortError cleanly', async () => {
    const abortErr = new Error('User cancelled');
    abortErr.name = 'AbortError';
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: vi.fn().mockRejectedValue(abortErr) },
      configurable: true,
    });
    expect(await shareRoomInvite('ROOM-CANCEL')).toBe('cancelled');

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: writeTextMock } },
      configurable: true,
    });
    const fallbackResult = await shareRoomInvite('ROOM-CLIP');
    expect(fallbackResult).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith(buildRoomInviteUrl('ROOM-CLIP'));
  });

  it('tracks display mode and SW update state in usePwaStore', () => {
    const store = usePwaStore.getState();
    store.setDisplayMode('standalone');
    expect(usePwaStore.getState().isInstalled).toBe(true);
    expect(usePwaStore.getState().displayMode).toBe('standalone');

    store.setSwStatus({
      swRegistered: true,
      swUpdateReady: true,
      swOfflineReady: true,
      offlineAssetCount: 24,
    });
    expect(usePwaStore.getState().swRegistered).toBe(true);
    expect(usePwaStore.getState().swUpdateReady).toBe(true);
    expect(usePwaStore.getState().swOfflineReady).toBe(true);
    expect(usePwaStore.getState().offlineAssetCount).toBe(24);
  });

  it('has a valid manifest config with 8-bit PNGs before SVGs and existing public files', () => {
    const publicDir = path.resolve(process.cwd(), 'public');

    expect(pwaManifest.theme_color).toBe('#060913');
    expect(pwaManifest.background_color).toBe('#060913');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.display_override).toContain('standalone');
    expect(pwaManifest.orientation).toBe('any');
    expect(pwaManifest.start_url).toBe('/');

    // Ensure raster PNGs appear before vector SVGs for Android WebAPK compatibility
    const firstSvgIdx = pwaManifest.icons.findIndex((i) => i.type === 'image/svg+xml');
    const lastPngIdx = pwaManifest.icons.findLastIndex((i) => i.type === 'image/png');
    expect(lastPngIdx).toBeGreaterThanOrEqual(0);
    expect(firstSvgIdx).toBeGreaterThan(lastPngIdx);

    // Verify any and maskable icons are separated cleanly and files exist
    const purposes = pwaManifest.icons.map((i) => i.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
    expect(purposes).not.toContain('any maskable');

    for (const icon of pwaManifest.icons) {
      const filePath = path.join(publicDir, icon.src.replace(/^\//, ''));
      expect(fs.existsSync(filePath), `Missing manifest icon: ${icon.src}`).toBe(true);
      if (icon.type === 'image/png') {
        expect(readPngBitDepth(filePath), `Expected 8-bit PNG for ${icon.src}`).toBe(8);
      }
    }

    for (const shortcut of pwaManifest.shortcuts ?? []) {
      for (const sIcon of shortcut.icons ?? []) {
        const filePath = path.join(publicDir, sIcon.src.replace(/^\//, ''));
        expect(fs.existsSync(filePath), `Missing shortcut icon: ${sIcon.src}`).toBe(true);
        expect(readPngBitDepth(filePath), `Expected 8-bit PNG for ${sIcon.src}`).toBe(8);
      }
    }

    for (const shot of pwaManifest.screenshots ?? []) {
      const filePath = path.join(publicDir, shot.src.replace(/^\//, ''));
      expect(fs.existsSync(filePath), `Missing screenshot: ${shot.src}`).toBe(true);
    }
  });
});
