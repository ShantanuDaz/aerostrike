interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  return coarsePointer || mobileUA;
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDocument;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function requestMobileFullscreen(): void {
  if (!isMobileDevice() || typeof document === 'undefined') return;
  if (getFullscreenElement()) return;

  const root = document.documentElement as FullscreenElement;
  try {
    if (typeof root.requestFullscreen === 'function') {
      const result = root.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Ignore browser user-gesture restrictions until the first tap
        });
      }
      return;
    }
    if (typeof root.webkitRequestFullscreen === 'function') {
      const result = root.webkitRequestFullscreen();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    }
  } catch {
    // Ignore unsupported fullscreen contexts (e.g., iOS Safari non-PWA tab)
  }
}
