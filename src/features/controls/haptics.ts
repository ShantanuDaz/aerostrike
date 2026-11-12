import { useSettingsStore } from '../settings/settingsStore';

let lastHapticAt = 0;

export function triggerHaptic(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  if (!useSettingsStore.getState().hapticsEnabled) {
    return;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Avoid saturating mobile vibration motor during rapid fire
  if (now - lastHapticAt < 28) {
    return;
  }
  lastHapticAt = now;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore restricted/unsupported vibration contexts
  }
}

export function hapticShot(weapon?: string): void {
  if (weapon === 'rocket' || weapon === 'shotgun') {
    triggerHaptic(22);
    return;
  }
  if (weapon === 'sniper') {
    triggerHaptic(18);
    return;
  }
  triggerHaptic(8);
}

export function hapticDash(): void {
  triggerHaptic(14);
}

export function hapticDamage(): void {
  triggerHaptic([16, 18, 20]);
}

export function hapticFlagEvent(): void {
  triggerHaptic([18, 28, 32]);
}

export function hapticPickup(): void {
  triggerHaptic(12);
}
