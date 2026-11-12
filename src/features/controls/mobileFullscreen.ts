interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

let hasEnteredFullscreen = false;
let userDismissedFullscreen = false;
let trackingBound = false;

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  return coarsePointer || mobileUA;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    (window.matchMedia?.('(display-mode: standalone)').matches ?? false) ||
    (window.matchMedia?.('(display-mode: fullscreen)').matches ?? false)
  );
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDocument;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function isFullscreenActive(): boolean {
  return Boolean(getFullscreenElement());
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as FullscreenElement;
  return (
    typeof root.requestFullscreen === 'function' ||
    typeof root.webkitRequestFullscreen === 'function'
  );
}

function bindFullscreenTracking(): void {
  if (trackingBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return;
  }
  trackingBound = true;

  const onFullscreenChange = () => {
    const active = getFullscreenElement();
    if (active) {
      hasEnteredFullscreen = true;
      userDismissedFullscreen = false;
    } else if (hasEnteredFullscreen && !document.hidden) {
      // User explicitly dismissed fullscreen via gesture/back button — respect it
      userDismissedFullscreen = true;
    }
  };

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}

export function resetFullscreenDismissal(): void {
  userDismissedFullscreen = false;
}

export function requestMobileFullscreen(force: boolean = false): void {
  if (typeof document === 'undefined') return;
  if (!force && !isMobileDevice()) return;
  bindFullscreenTracking();
  if (!force && userDismissedFullscreen) return;
  if (getFullscreenElement()) {
    hasEnteredFullscreen = true;
    return;
  }

  const root = document.documentElement as FullscreenElement;
  try {
    if (typeof root.requestFullscreen === 'function') {
      const result = root.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      if (result && typeof result.catch === 'function') {
        result
          .then(() => {
            hasEnteredFullscreen = true;
            userDismissedFullscreen = false;
          })
          .catch(() => {
            // Ignore browser user-gesture restrictions until an active gesture
          });
      }
      return;
    }
    if (typeof root.webkitRequestFullscreen === 'function') {
      const result = root.webkitRequestFullscreen();
      if (result && typeof result.catch === 'function') {
        result
          .then(() => {
            hasEnteredFullscreen = true;
            userDismissedFullscreen = false;
          })
          .catch(() => {});
      }
    }
  } catch {
    // Ignore unsupported fullscreen contexts (e.g., iOS Safari non-PWA tab)
  }
}

export function toggleFullscreen(): void {
  if (typeof document === 'undefined') return;
  bindFullscreenTracking();
  if (getFullscreenElement()) {
    const doc = document as FullscreenDocument;
    try {
      if (typeof doc.exitFullscreen === 'function') {
        void doc.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        void doc.webkitExitFullscreen();
      }
    } catch {
      // Ignore errors exiting fullscreen
    }
    userDismissedFullscreen = true;
    return;
  }
  requestMobileFullscreen(true);
}
