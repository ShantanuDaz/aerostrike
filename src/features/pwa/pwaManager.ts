import { sounds } from '../audio/soundEngine';
import { isMobileDevice, isStandalonePWA } from '../controls/mobileFullscreen';
import { detectDisplayMode, usePwaStore } from './pwaStore';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type LaunchShortcutAction = 'solo' | 'host' | 'armory';

export interface ParsedLaunchParams {
  roomCode: string | null;
  action: LaunchShortcutAction | null;
}

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener?(type: string, listener: () => void): void;
}

interface WindowWithLaunchQueue extends Window {
  launchQueue?: {
    setConsumer(consumer: (launchParams: { targetURL?: string }) => void): void;
  };
}

let initialized = false;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let updateServiceWorkerFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let wakeLockSentinel: WakeLockSentinelLike | null = null;
let wakeLockDesired = false;

export function parseLaunchParams(search: string): ParsedLaunchParams {
  const params = new URLSearchParams(search);
  const rawRoom = params.get('room');
  const roomCode = rawRoom && rawRoom.trim().length > 0 ? rawRoom.trim().toUpperCase() : null;

  const rawAction = params.get('action')?.trim().toLowerCase();
  const action: LaunchShortcutAction | null =
    rawAction === 'solo' || rawAction === 'host' || rawAction === 'armory'
      ? rawAction
      : null;

  return { roomCode, action };
}

export function buildRoomInviteUrl(roomCode: string): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return `?room=${encodeURIComponent(roomCode)}`;
  }
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
}

export function isNativeShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareRoomInvite(
  roomCode: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = buildRoomInviteUrl(roomCode);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Join AEROSTRIKE: OMEGA (${roomCode})`,
        text: `Deploy into my AEROSTRIKE: OMEGA squad! Room code: ${roomCode}`,
        url,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}

export function clearAppBadge(): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.clearAppBadge === 'function') {
    void navigator.clearAppBadge().catch(() => {});
  }
}

export function setAppBadge(count?: number): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.setAppBadge === 'function') {
    void navigator.setAppBadge(count).catch(() => {});
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    const already = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : false;
    if (already) {
      usePwaStore.getState().setStoragePersisted(true);
      return true;
    }
    const granted = await navigator.storage.persist();
    usePwaStore.getState().setStoragePersisted(granted);
    return granted;
  } catch {
    return false;
  }
}

export async function querySwCacheStatus(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await window.caches.keys();
    let totalCount = 0;
    for (const key of keys) {
      if (key.includes('workbox') || key.includes('aerostrike')) {
        const cache = await window.caches.open(key);
        totalCount += (await cache.keys()).length;
      }
    }
    if (totalCount === 0 && keys.length > 0) {
      for (const key of keys) {
        const cache = await window.caches.open(key);
        totalCount += (await cache.keys()).length;
      }
    }
    usePwaStore.getState().setSwStatus({
      offlineAssetCount: totalCount,
    });
  } catch {
    // ignore restricted Cache API contexts
  }
}

export function bindWorkboxController(
  registration: ServiceWorkerRegistration | undefined,
  updateFn: (reloadPage?: boolean) => Promise<void>,
): void {
  if (registration) {
    swRegistration = registration;
  }
  updateServiceWorkerFn = updateFn;
  if (registration) {
    usePwaStore.getState().setSwStatus({
      swRegistered: true,
      swUpdateReady: Boolean(registration.waiting && navigator.serviceWorker?.controller),
    });
    void querySwCacheStatus();
  }
}

export async function checkForSwUpdate(): Promise<boolean> {
  const reg =
    swRegistration ||
    (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration().catch(() => undefined)
      : undefined);

  if (!reg) return false;
  swRegistration = reg;

  const store = usePwaStore.getState();
  store.setSwStatus({ swChecking: true });
  try {
    await reg.update();
    if (reg.waiting) {
      store.setSwStatus({ swUpdateReady: true });
      return true;
    }
    await querySwCacheStatus();
    return false;
  } catch {
    return false;
  } finally {
    store.setSwStatus({ swChecking: false });
  }
}

export function applySwUpdate(): void {
  if (updateServiceWorkerFn) {
    void updateServiceWorkerFn(true);
    return;
  }
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  window.location.reload();
}

export async function promptNativeInstall(): Promise<
  'accepted' | 'dismissed' | 'ios_guide' | 'unavailable'
> {
  const store = usePwaStore.getState();

  if (deferredInstallPrompt) {
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      store.setCanInstall(false);
      if (choice.outcome === 'accepted') {
        store.setIsInstalled(true);
        void requestPersistentStorage();
      }
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }

  if (store.isIOS && !store.isInstalled) {
    store.setShowIOSGuideModal(true);
    return 'ios_guide';
  }

  return 'unavailable';
}

async function acquireWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return;
  if (document.visibilityState !== 'visible') return;
  if (wakeLockSentinel && !wakeLockSentinel.released) return;

  const nav = navigator;
  if (!nav.wakeLock?.request) return;

  try {
    const sentinel = await nav.wakeLock.request('screen');
    wakeLockSentinel = sentinel;
    usePwaStore.getState().setWakeLockActive(true);
    sentinel.addEventListener?.('release', () => {
      if (wakeLockSentinel === sentinel) {
        wakeLockSentinel = null;
        usePwaStore.getState().setWakeLockActive(false);
      }
    });
  } catch {
    usePwaStore.getState().setWakeLockActive(false);
  }
}

async function releaseWakeLock(): Promise<void> {
  if (!wakeLockSentinel) {
    usePwaStore.getState().setWakeLockActive(false);
    return;
  }
  const current = wakeLockSentinel;
  wakeLockSentinel = null;
  usePwaStore.getState().setWakeLockActive(false);
  try {
    await current.release();
  } catch {
    // ignore
  }
}

export function syncScreenWakeLock(active: boolean): void {
  wakeLockDesired = active;
  if (active) {
    void acquireWakeLock();
  } else {
    void releaseWakeLock();
  }
}

export async function tryLockLandscapeOrientation(): Promise<void> {
  if (typeof window === 'undefined' || !isMobileDevice()) return;
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & { lock?: (mode: string) => Promise<void> })
    | undefined;
  if (orientation && typeof orientation.lock === 'function') {
    try {
      await orientation.lock('landscape');
      return;
    } catch {
      // Expected when browser is not in fullscreen or standalone PWA mode
    }
  }

  // Fallback for vendor-prefixed screen orientation APIs on older mobile engines
  const legacyScreen = window.screen as unknown as {
    lockOrientation?: (m: string) => boolean;
    mozLockOrientation?: (m: string) => boolean;
    msLockOrientation?: (m: string) => boolean;
  };
  try {
    legacyScreen.lockOrientation?.('landscape') ||
      legacyScreen.mozLockOrientation?.('landscape') ||
      legacyScreen.msLockOrientation?.('landscape');
  } catch {
    // ignore
  }
}

export function tryUnlockOrientation(): void {
  if (typeof window === 'undefined') return;
  const orientation = window.screen?.orientation;
  if (orientation && typeof orientation.unlock === 'function') {
    try {
      orientation.unlock();
    } catch {
      // ignore
    }
  }
}

export function initPwaLifecycle(onExternalRoomLaunch?: (roomCode: string) => void): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const store = usePwaStore.getState();
  store.setDisplayMode(detectDisplayMode());
  store.setIsOnline(navigator.onLine);
  clearAppBadge();

  if (isStandalonePWA()) {
    void requestPersistentStorage();
  }

  // Capture Chrome/Edge/Android install prompt
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    usePwaStore.getState().setCanInstall(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const s = usePwaStore.getState();
    s.setCanInstall(false);
    s.setIsInstalled(true);
    s.setShowIOSGuideModal(false);
    void requestPersistentStorage();
  });

  // Network online/offline listeners
  window.addEventListener('online', () => {
    usePwaStore.getState().setIsOnline(true);
  });
  window.addEventListener('offline', () => {
    usePwaStore.getState().setIsOnline(false);
  });

  // Track display-mode transitions
  const standaloneMql = window.matchMedia?.('(display-mode: standalone)');
  const fullscreenMql = window.matchMedia?.('(display-mode: fullscreen)');
  const syncDisplayMode = () => {
    usePwaStore.getState().setDisplayMode(detectDisplayMode());
  };
  standaloneMql?.addEventListener?.('change', syncDisplayMode);
  fullscreenMql?.addEventListener?.('change', syncDisplayMode);

  // Foreground resume: re-acquire wake lock, clear app badges, and resume WebAudio if suspended
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearAppBadge();
      if (wakeLockDesired) {
        void acquireWakeLock();
      }
      const ctx = sounds.getSharedContext(false);
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
    }
  });

  // Launch Queue API for launch_handler: focus-existing
  const winLaunch = window as WindowWithLaunchQueue;
  winLaunch.launchQueue?.setConsumer((launchParams) => {
    if (!launchParams?.targetURL) return;
    try {
      const target = new URL(launchParams.targetURL);
      const parsed = parseLaunchParams(target.search);
      if (parsed.roomCode && onExternalRoomLaunch) {
        onExternalRoomLaunch(parsed.roomCode);
      }
    } catch {
      // ignore malformed URL
    }
  });

  // Query cached assets once SW is active
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      void querySwCacheStatus();
    });
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg) {
          swRegistration = reg;
          usePwaStore.getState().setSwStatus({ swRegistered: true });
          void querySwCacheStatus();
        }
      })
      .catch(() => {});
  }
}
