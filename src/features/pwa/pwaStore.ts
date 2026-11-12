import { create } from 'zustand';
import { isIOSDevice, isStandalonePWA } from '../controls/mobileFullscreen';

export type PwaDisplayMode = 'browser' | 'standalone' | 'fullscreen';

export interface PwaState {
  canInstall: boolean;
  isInstalled: boolean;
  displayMode: PwaDisplayMode;
  isIOS: boolean;
  isOnline: boolean;
  installDismissed: boolean;
  showIOSGuideModal: boolean;
  swRegistered: boolean;
  swUpdateReady: boolean;
  swOfflineReady: boolean;
  swChecking: boolean;
  swVersion: string | null;
  offlineAssetCount: number | null;
  wakeLockActive: boolean;
  storagePersisted: boolean | null;

  setCanInstall: (val: boolean) => void;
  setIsInstalled: (val: boolean) => void;
  setDisplayMode: (mode: PwaDisplayMode) => void;
  setIsOnline: (val: boolean) => void;
  dismissInstallBanner: () => void;
  setShowIOSGuideModal: (val: boolean) => void;
  setSwStatus: (
    partial: Partial<
      Pick<
        PwaState,
        | 'swRegistered'
        | 'swUpdateReady'
        | 'swOfflineReady'
        | 'swChecking'
        | 'swVersion'
        | 'offlineAssetCount'
      >
    >,
  ) => void;
  setWakeLockActive: (val: boolean) => void;
  setStoragePersisted: (val: boolean | null) => void;
}

const INSTALL_DISMISSED_KEY = 'aerostrike_pwa_install_dismissed';

function readDismissedFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function detectDisplayMode(): PwaDisplayMode {
  if (typeof window === 'undefined') return 'browser';
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || window.matchMedia?.('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  return 'browser';
}

export const usePwaStore = create<PwaState>((set) => ({
  canInstall: false,
  isInstalled: isStandalonePWA(),
  displayMode: detectDisplayMode(),
  isIOS: isIOSDevice(),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  installDismissed: readDismissedFlag(),
  showIOSGuideModal: false,
  swRegistered: false,
  swUpdateReady: false,
  swOfflineReady: false,
  swChecking: false,
  swVersion: null,
  offlineAssetCount: null,
  wakeLockActive: false,
  storagePersisted: null,

  setCanInstall: (canInstall) => set({ canInstall }),
  setIsInstalled: (isInstalled) => set({ isInstalled }),
  setDisplayMode: (displayMode) =>
    set({
      displayMode,
      isInstalled: displayMode !== 'browser',
    }),
  setIsOnline: (isOnline) => set({ isOnline }),
  dismissInstallBanner: () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(INSTALL_DISMISSED_KEY, '1');
      } catch {
        // ignore storage errors
      }
    }
    set({ installDismissed: true });
  },
  setShowIOSGuideModal: (showIOSGuideModal) => set({ showIOSGuideModal }),
  setSwStatus: (partial) => set(partial),
  setWakeLockActive: (wakeLockActive) => set({ wakeLockActive }),
  setStoragePersisted: (storagePersisted) => set({ storagePersisted }),
}));
