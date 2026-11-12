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
let waitingWorker: ServiceWorker | null = null;
let wakeLockSentinel: WakeLockSentinelLike | null = null;
let wakeLockDesired = false;
let reloadingForSwUpdate = false;

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
      // Fall through to clipboard fallback if share failed for another reason
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
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const controller = navigator.serviceWorker.controller || swRegistration?.active;
  if (!controller) return;

  try {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      const data = event.data as { version?: string; cachedCount?: number } | undefined;
      if (!data) return;
      usePwaStore.getState().setSwStatus({
        swVersion: data.version ?? null,
        offlineAssetCount: typeof data.cachedCount === 'number' ? data.cachedCount : null,
      });
    };
    controller.postMessage({ type: 'GET_CACHE_STATUS' }, [channel.port2]);
  } catch {
    // ignore restricted message channel contexts
  }
}

function trackInstallingWorker(worker: ServiceWorker | null) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      waitingWorker = worker;
      usePwaStore.getState().setSwStatus({ swUpdateReady: true });
    }
  });
}

export async function checkForSwUpdate(): Promise<boolean> {
  if (!swRegistration) return false;
  const store = usePwaStore.getState();
  store.setSwStatus({ swChecking: true });
  try {
    await swRegistration.update();
    if (swRegistration.waiting) {
      waitingWorker = swRegistration.waiting;
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
  const target = waitingWorker || swRegistration?.waiting;
  if (!target) {
    window.location.reload();
    return;
  }
  reloadingForSwUpdate = true;
  target.postMessage({ type: 'SKIP_WAITING' });
}

export async function promptNativeInstall(): Promise<'accepted' | 'dismissed' | 'ios_guide' | 'unavailable'> {
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
  if (!orientation?.lock) return;
  try {
    await orientation.lock('landscape');
  } catch {
    // Expected when browser is not in fullscreen or standalone PWA mode
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

  // Track display-mode transitions (e.g., installed mid-session or desktop window mode change)
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

  // Register Service Worker & update lifecycle
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swRegistration = reg;
          usePwaStore.getState().setSwStatus({ swRegistered: true });
          void querySwCacheStatus();

          if (reg.waiting && navigator.serviceWorker.controller) {
            waitingWorker = reg.waiting;
            usePwaStore.getState().setSwStatus({ swUpdateReady: true });
          }

          if (reg.installing) {
            trackInstallingWorker(reg.installing);
          }

          reg.addEventListener('updatefound', () => {
            trackInstallingWorker(reg.installing);
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      void querySwCacheStatus();
      if (reloadingForSwUpdate) {
        reloadingForSwUpdate = false;
        window.location.reload();
      }
    });
  }
}
