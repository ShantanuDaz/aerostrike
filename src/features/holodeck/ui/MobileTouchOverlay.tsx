import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Crosshair,
  ArrowUp,
  RotateCcw,
  Eye,
  Shield,
  Bomb,
  ChevronUp,
} from 'lucide-react';
import type { HolodeckWeaponId } from '../core/types';
import { HOLODECK_WEAPONS } from '../core/types';
import { useIsTouchHUD } from '../../controls/useIsTouchHUD';
import { useSettingsStore } from '../../settings/settingsStore';
import { getScaledStickMetrics } from '../../controls/touchStickMath';
import { shouldIgnoreSyntheticMouse } from '../../controls/touchExclusion';
import { sounds } from '../../audio/soundEngine';

interface MobileTouchOverlayProps {
  onMove: (forward: number, right: number) => void;
  onLook: (deltaYaw: number, deltaPitch: number) => void;
  onFireStart: () => void;
  onFireEnd: () => void;
  onJump: () => void;
  onCrouchToggle: () => void;
  onReload: () => void;
  onScopeToggle: () => void;
  onSelectWeapon: (weaponId: HolodeckWeaponId) => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
  isCrouching: boolean;
  isScoped: boolean;
  activeWeaponId: HolodeckWeaponId;
  ammo?: { clip: number; reserve: number };
  canInteractSpike?: boolean;
  spikeAction?: { action: 'planting' | 'defusing'; progress: number; total: number } | null;
  lastFiredAt?: number;
  forceVisible?: boolean;
}

export const HOLODECK_WEAPON_META: Record<
  HolodeckWeaponId,
  { tag: string; label: string; color: string; keyHint: string; category: string }
> = {
  vandal: { tag: 'VND', label: 'Vandal Rifle', color: '#f59e0b', keyHint: '1', category: 'Rifle' },
  operator: { tag: 'OPR', label: 'Operator Sniper', color: '#a855f7', keyHint: '2', category: 'Sniper' },
  classic: { tag: 'PST', label: 'Classic Pistol', color: '#06b6d4', keyHint: '3', category: 'Sidearm' },
  knife: { tag: 'KNF', label: 'Tactical Blade', color: '#10b981', keyHint: '4', category: 'Melee' },
};

const WEAPON_ORDER: HolodeckWeaponId[] = ['vandal', 'operator', 'classic', 'knife'];

function getStickCenter(el: HTMLDivElement | null): { x: number; y: number } | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function MobileTouchOverlay({
  onMove,
  onLook,
  onFireStart,
  onFireEnd,
  onJump,
  onCrouchToggle,
  onReload,
  onScopeToggle,
  onSelectWeapon,
  onInteractStart,
  onInteractEnd,
  isCrouching,
  isScoped,
  activeWeaponId,
  ammo,
  canInteractSpike,
  spikeAction,
  lastFiredAt,
  forceVisible = false,
}: MobileTouchOverlayProps) {
  const isTouchHUD = useIsTouchHUD();
  const touchLayout = useSettingsStore((s) => s.touchLayout);
  const touchControlScale = useSettingsStore((s) => s.touchControlScale);
  const touchControlOpacity = useSettingsStore((s) => s.touchControlOpacity);
  const touchStickDeadzone = useSettingsStore((s) => s.touchStickDeadzone);
  const showTouchHints = useSettingsStore((s) => s.showTouchHints);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const isLeftHanded = touchLayout === 'left_handed';
  const stickMetrics = getScaledStickMetrics(touchControlScale, touchStickDeadzone);
  const stickMetricsRef = useRef(stickMetrics);

  useEffect(() => {
    stickMetricsRef.current = stickMetrics;
  }, [stickMetrics]);

  // States
  const [arsenalOpen, setArsenalOpen] = useState(false);
  const [moveActive, setMoveActive] = useState(false);
  const [aimActive, setAimActive] = useState(false);
  const [aimFiring, setAimFiring] = useState(false);
  const [primaryFireActive, setPrimaryFireActive] = useState(false);
  const [isInteractingVisual, setIsInteractingVisual] = useState(false);

  // Refs for tracking
  const aimFiringRef = useRef(false);
  const primaryFireActiveRef = useRef(false);
  const lastDrawerOpenedAtRef = useRef<number>(0);

  const movePadRef = useRef<HTMLDivElement | null>(null);
  const aimPadRef = useRef<HTMLDivElement | null>(null);
  const moveKnobRef = useRef<HTMLDivElement | null>(null);
  const aimKnobRef = useRef<HTMLDivElement | null>(null);
  const cooldownBarRef = useRef<HTMLDivElement | null>(null);

  const moveTouchId = useRef<number | null>(null);
  const moveCenter = useRef<{ x: number; y: number } | null>(null);

  const aimTouchId = useRef<number | null>(null);
  const aimCenter = useRef<{ x: number; y: number } | null>(null);
  const lastAimPos = useRef<{ x: number; y: number } | null>(null);

  const screenSwipeId = useRef<number | null>(null);
  const lastScreenSwipePos = useRef<{ x: number; y: number } | null>(null);

  const lastButtonTouchMsRef = useRef<{
    drawer: number;
    weapon: number;
    reload: number;
    crouch: number;
    jump: number;
    scope: number;
    spike: number;
    item: number;
    fire: number;
  }>({
    drawer: 0,
    weapon: 0,
    reload: 0,
    crouch: 0,
    jump: 0,
    scope: 0,
    spike: 0,
    item: 0,
    fire: 0,
  });

  const triggerHaptic = useCallback(
    (durationMs = 15) => {
      if (hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(durationMs);
        } catch {
          // ignore
        }
      }
    },
    [hapticsEnabled],
  );

  // Animate weapon fire rate recharge bar (Identical to 2D VirtualControls)
  useEffect(() => {
    const activeCfg = HOLODECK_WEAPONS[activeWeaponId];
    const fireIntervalMs = (1 / activeCfg.fireRateRps) * 1000;
    if (fireIntervalMs <= 0 || !lastFiredAt) {
      if (cooldownBarRef.current) cooldownBarRef.current.style.transform = 'scaleX(0)';
      return;
    }

    let rafId = 0;
    const tickCooldown = () => {
      const elapsed = performance.now() - lastFiredAt;
      const remainingPct = Math.max(0, 1 - elapsed / fireIntervalMs);
      if (cooldownBarRef.current) {
        cooldownBarRef.current.style.transform = `scaleX(${remainingPct})`;
      }
      if (remainingPct > 0.01) {
        rafId = requestAnimationFrame(tickCooldown);
      } else if (cooldownBarRef.current) {
        cooldownBarRef.current.style.transform = 'scaleX(0)';
      }
    };
    rafId = requestAnimationFrame(tickCooldown);
    return () => cancelAnimationFrame(rafId);
  }, [activeWeaponId, lastFiredAt]);

  // Window-level Multi-Touch Event Handlers
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD && !forceVisible) return;
      const target = e.target as HTMLElement | null;

      // Never intercept interactive UI controls or drawer
      if (
        target &&
        target.closest('button, input, select, textarea, a, [role="button"], [data-no-joystick]')
      ) {
        return;
      }

      // If Arsenal Rack is open and user taps on the canvas outside, safely dismiss it
      if (arsenalOpen) {
        if (performance.now() - lastDrawerOpenedAtRef.current > 250) {
          setArsenalOpen(false);
        }
      }

      const halfWidth = window.innerWidth / 2;
      const m = stickMetricsRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        // Exclude top HUD strip & top-right Minimap
        if (clientY < 56) continue;
        if (clientX >= halfWidth && clientY <= 150) continue;

        const isMoveSide = isLeftHanded ? clientX > halfWidth : clientX <= halfWidth;

        if (isMoveSide) {
          if (moveTouchId.current === null) {
            e.preventDefault();
            moveTouchId.current = identifier;
            setMoveActive(true);

            const moveCenterPt = getStickCenter(movePadRef.current);
            if (
              moveCenterPt &&
              Math.hypot(clientX - moveCenterPt.x, clientY - moveCenterPt.y) < m.movePadSize
            ) {
              moveCenter.current = moveCenterPt;
            } else {
              moveCenter.current = { x: clientX, y: clientY };
            }
          }
        } else {
          // Aim / Look Side
          const aimCenterPt = getStickCenter(aimPadRef.current);
          const distToAimPad = aimCenterPt
            ? Math.hypot(clientX - aimCenterPt.x, clientY - aimCenterPt.y)
            : Infinity;

          if (distToAimPad < m.aimPadSize * 1.15 && aimTouchId.current === null) {
            e.preventDefault();
            aimTouchId.current = identifier;
            aimCenter.current = aimCenterPt!;
            lastAimPos.current = { x: clientX, y: clientY };
            setAimActive(true);
          } else if (screenSwipeId.current === null) {
            // Free Camera Look Swipe on right half of screen
            screenSwipeId.current = identifier;
            lastScreenSwipePos.current = { x: clientX, y: clientY };
          }
        }
      }
    },
    [isTouchHUD, forceVisible, arsenalOpen, isLeftHanded],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD && !forceVisible) return;
      const m = stickMetricsRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        // 1. Move Joystick Touch
        if (identifier === moveTouchId.current && moveCenter.current) {
          e.preventDefault();
          const dx = clientX - moveCenter.current.x;
          const dy = clientY - moveCenter.current.y;
          const dist = Math.hypot(dx, dy);
          const maxDist = m.moveMaxDist;
          const clampedDist = Math.min(dist, maxDist);
          const angle = Math.atan2(dy, dx);

          const offsetX = Math.cos(angle) * clampedDist;
          const offsetY = Math.sin(angle) * clampedDist;

          if (moveKnobRef.current) {
            moveKnobRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
          }

          const dz = m.aimDeadzoneDist;
          if (clampedDist < dz) {
            onMove(0, 0);
          } else {
            const normDist = (clampedDist - dz) / (maxDist - dz);
            const normX = Math.cos(angle) * normDist;
            const normY = Math.sin(angle) * normDist;
            // In 3D: forward is negative Y (up on screen), right is positive X
            onMove(-normY, normX);
          }
        }

        // 2. Fixed Aim Stick Touch (Edge-Fire + Camera Look)
        if (identifier === aimTouchId.current && aimCenter.current) {
          e.preventDefault();
          const dx = clientX - aimCenter.current.x;
          const dy = clientY - aimCenter.current.y;
          const dist = Math.hypot(dx, dy);
          const maxDist = m.aimMaxDist;
          const clampedDist = Math.min(dist, maxDist);
          const angle = Math.atan2(dy, dx);

          const offsetX = Math.cos(angle) * clampedDist;
          const offsetY = Math.sin(angle) * clampedDist;

          if (aimKnobRef.current) {
            aimKnobRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
          }

          // Camera Look delta
          if (lastAimPos.current) {
            const deltaX = clientX - lastAimPos.current.x;
            const deltaY = clientY - lastAimPos.current.y;
            lastAimPos.current = { x: clientX, y: clientY };
            const aimSens = 0.0034;
            onLook(-deltaX * aimSens, -deltaY * aimSens);
          }

          // Edge Firing Ring Trigger ("Edge = Shoot")
          const firePerimeter = m.aimFirePerimeterDist;
          const isPastPerimeter = dist >= firePerimeter * 0.92;

          if (isPastPerimeter && !aimFiringRef.current) {
            aimFiringRef.current = true;
            setAimFiring(true);
            triggerHaptic(20);
            onFireStart();
          } else if (!isPastPerimeter && aimFiringRef.current && !primaryFireActiveRef.current) {
            aimFiringRef.current = false;
            setAimFiring(false);
            onFireEnd();
          }
        }

        // 3. Free Camera Swipe Touch
        if (identifier === screenSwipeId.current && lastScreenSwipePos.current) {
          const deltaX = clientX - lastScreenSwipePos.current.x;
          const deltaY = clientY - lastScreenSwipePos.current.y;
          lastScreenSwipePos.current = { x: clientX, y: clientY };

          const swipeSens = 0.0034;
          onLook(-deltaX * swipeSens, -deltaY * swipeSens);
        }
      }
    },
    [isTouchHUD, forceVisible, onMove, onLook, onFireStart, onFireEnd, triggerHaptic],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { identifier } = touch;

        if (identifier === moveTouchId.current) {
          moveTouchId.current = null;
          moveCenter.current = null;
          setMoveActive(false);
          if (moveKnobRef.current) {
            moveKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
          }
          onMove(0, 0);
        }

        if (identifier === aimTouchId.current) {
          aimTouchId.current = null;
          aimCenter.current = null;
          lastAimPos.current = null;
          setAimActive(false);
          if (aimFiringRef.current) {
            aimFiringRef.current = false;
            setAimFiring(false);
            if (!primaryFireActiveRef.current) onFireEnd();
          }
          if (aimKnobRef.current) {
            aimKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
          }
        }

        if (identifier === screenSwipeId.current) {
          screenSwipeId.current = null;
          lastScreenSwipePos.current = null;
        }
      }
    },
    [onMove, onFireEnd],
  );

  useEffect(() => {
    if (!isTouchHUD && !forceVisible) return;
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isTouchHUD, forceVisible, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Primary Fire Handlers (Dedicated button next to aim stick)
  const handlePrimaryFireStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    primaryFireActiveRef.current = true;
    setPrimaryFireActive(true);
    triggerHaptic(20);
    onFireStart();
  };

  const handlePrimaryFireEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    primaryFireActiveRef.current = false;
    setPrimaryFireActive(false);
    if (!aimFiringRef.current) onFireEnd();
  };

  // Spike Interact Handlers
  const handleInteractStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(30);
    setIsInteractingVisual(true);
    onInteractStart?.();
  };

  const handleInteractEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    setIsInteractingVisual(false);
    onInteractEnd?.();
  };

  const activeWeaponMeta = HOLODECK_WEAPON_META[activeWeaponId];
  const activeCfg = HOLODECK_WEAPONS[activeWeaponId];
  const isMelee = activeCfg.category === 'melee';
  const clipCount = ammo?.clip ?? activeCfg.magazineSize;
  const reserveCount = ammo?.reserve ?? activeCfg.reserveAmmo;
  const isLowAmmo = !isMelee && clipCount <= Math.ceil(activeCfg.magazineSize * 0.25);

  const moveCornerStyle = isLeftHanded
    ? { right: 'env(safe-area-inset-right, 14px)' }
    : { left: 'env(safe-area-inset-left, 14px)' };

  const aimCornerStyle = isLeftHanded
    ? { left: 'env(safe-area-inset-left, 14px)' }
    : { right: 'env(safe-area-inset-right, 14px)' };

  const actionBottomPx = Math.round(
    stickMetrics.aimPadSize + 16 + (touchControlScale - 1) * 10
  );

  const isInteractingSpike = Boolean(canInteractSpike || spikeAction);

  if (!isTouchHUD && !forceVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none overflow-hidden touch-none">
      {/* 1. FIXED CORNER MOVEMENT JOYSTICK (Sleek 2D Cyber-Bordered Style) */}
      <div
        ref={movePadRef}
        style={{
          ...moveCornerStyle,
          bottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)',
          width: `${stickMetrics.movePadSize}px`,
          height: `${stickMetrics.movePadSize}px`,
          opacity: touchControlOpacity,
        }}
        className={`absolute rounded-full backdrop-blur-sm flex items-center justify-center pointer-events-none transition-colors duration-100 border-2 ${
          moveActive
            ? 'bg-slate-950/70 border-cyan-400/80 glow-cyan'
            : 'bg-slate-950/40 border-cyan-400/35'
        }`}
      >
        <div className="absolute w-full h-px bg-cyan-400/20" />
        <div className="absolute h-full w-px bg-cyan-400/20" />

        {showTouchHints && (
          <>
            <span className="absolute top-1.5 text-[8.5px] font-mono font-black uppercase tracking-widest text-cyan-300/65">
              BOOST
            </span>
            <span className="absolute bottom-1.5 text-[8.5px] font-mono font-black uppercase tracking-widest text-cyan-300/45">
              DROP
            </span>
          </>
        )}

        <div
          ref={moveKnobRef}
          style={{
            width: `${stickMetrics.moveKnobSize}px`,
            height: `${stickMetrics.moveKnobSize}px`,
            transform: 'translate3d(0px, 0px, 0)',
          }}
          className={`rounded-full shadow-lg border flex items-center justify-center pointer-events-none will-change-transform ${
            moveActive
              ? 'bg-gradient-to-br from-cyan-400 to-blue-600 border-white/90'
              : 'bg-gradient-to-br from-cyan-500/80 to-blue-700/80 border-cyan-200/70'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
        </div>
      </div>

      {/* 2. FIXED CORNER AIM & EDGE-FIRE STICK (Identical to 2D Aim Stick) */}
      <div
        ref={aimPadRef}
        style={{
          ...aimCornerStyle,
          bottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)',
          width: `${stickMetrics.aimPadSize}px`,
          height: `${stickMetrics.aimPadSize}px`,
          opacity: touchControlOpacity,
        }}
        className={`absolute rounded-full backdrop-blur-sm flex items-center justify-center pointer-events-none transition-colors duration-100 border-2 ${
          aimFiring || primaryFireActive
            ? 'bg-rose-950/65 border-rose-500 glow-red'
            : aimActive
              ? 'bg-slate-950/70 border-amber-400/80'
              : 'bg-slate-950/40 border-amber-400/35'
        }`}
      >
        {/* Perimeter Firing Ring Cue ("Edge = Shoot") */}
        <div
          style={{
            width: `${stickMetrics.aimPerimeterRingSize}px`,
            height: `${stickMetrics.aimPerimeterRingSize}px`,
          }}
          className={`rounded-full border border-dashed absolute ${
            aimFiring || primaryFireActive ? 'border-rose-400/90' : 'border-amber-300/35'
          }`}
        />

        <div className="absolute w-3/4 h-px bg-amber-300/15" />
        <div className="absolute h-3/4 w-px bg-amber-300/15" />

        {showTouchHints && !aimActive && (
          <span className="absolute bottom-1.5 text-[8px] font-mono font-black uppercase tracking-widest text-amber-200/65">
            EDGE = SHOOT
          </span>
        )}

        <div
          ref={aimKnobRef}
          style={{
            width: `${stickMetrics.aimKnobSize}px`,
            height: `${stickMetrics.aimKnobSize}px`,
            transform: 'translate3d(0px, 0px, 0)',
          }}
          className={`rounded-full border shadow-lg flex items-center justify-center pointer-events-none will-change-transform ${
            aimFiring || primaryFireActive
              ? 'bg-gradient-to-br from-rose-500 to-red-600 border-white'
              : aimActive
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-white/90'
                : 'bg-gradient-to-br from-amber-500/80 to-orange-600/80 border-amber-200/75'
          }`}
        >
          {aimFiring || primaryFireActive ? (
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          ) : (
            <Crosshair className="w-3.5 h-3.5 text-slate-950" />
          )}
        </div>
      </div>

      {/* 3. SLEEK CHAMFERED THUMB ACTIONS CLUSTER (Stacked Cleanly Above Aim Stick) */}
      <div
        data-no-joystick="true"
        style={{
          ...aimCornerStyle,
          bottom: `${actionBottomPx}px`,
          opacity: touchControlOpacity,
        }}
        className={`absolute flex items-end gap-1.5 pointer-events-auto z-40 ${
          isLeftHanded ? 'flex-row-reverse' : ''
        }`}
      >
        {/* Weapon Arsenal Rack Flyout & Quick Cycle */}
        <div data-no-joystick="true" className="relative flex flex-col items-center gap-1">
          {arsenalOpen && (
            <div
              data-no-joystick="true"
              className={`absolute bottom-0 ${
                isLeftHanded ? 'left-full ml-2' : 'right-full mr-2'
              } cyber-panel clip-chamfer p-1.5 border border-cyan-500/60 bg-slate-950/95 backdrop-blur-md shadow-2xl flex flex-col gap-1 min-w-[148px] animate-in fade-in duration-100 z-50`}
            >
              <div className="text-[8px] font-mono font-black uppercase tracking-widest text-cyan-400 px-1 pb-1 border-b border-cyan-500/30 flex items-center justify-between">
                <span>Tactical Rack</span>
                <span>[1-4]</span>
              </div>
              {WEAPON_ORDER.map((wId) => {
                const meta = HOLODECK_WEAPON_META[wId];
                const active = activeWeaponId === wId;
                const cfg = HOLODECK_WEAPONS[wId];
                const wAmmo = ammo && activeWeaponId === wId ? ammo.clip : cfg.magazineSize;
                return (
                  <button
                    key={wId}
                    type="button"
                    data-no-joystick="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      sounds.playUiClick();
                      triggerHaptic(15);
                      onSelectWeapon(wId);
                      setArsenalOpen(false);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      sounds.playUiClick();
                      triggerHaptic(15);
                      onSelectWeapon(wId);
                      setArsenalOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 text-[9.5px] font-mono uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                      active
                        ? 'bg-cyan-500/25 border-cyan-400 text-white font-black'
                        : 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 text-slate-200 font-bold'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span>{meta.label}</span>
                    </span>
                    <span className={active ? 'text-cyan-300' : 'text-slate-400'}>
                      {cfg.category === 'melee' ? '∞' : `${wAmmo}/${cfg.reserveAmmo}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Toggle Rack Flyout */}
          <button
            type="button"
            data-no-joystick="true"
            onClick={(e) => {
              e.stopPropagation();
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.drawer)) return;
              sounds.playUiClick();
              triggerHaptic(10);
              lastDrawerOpenedAtRef.current = performance.now();
              setArsenalOpen((v) => !v);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.drawer = performance.now();
              lastDrawerOpenedAtRef.current = performance.now();
              sounds.playUiClick();
              triggerHaptic(10);
              setArsenalOpen((v) => !v);
            }}
            className={`px-2 py-0.5 text-[7.5px] font-mono font-bold uppercase tracking-widest border clip-chamfer flex items-center gap-1 transition cursor-pointer ${
              arsenalOpen
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 glow-cyan'
                : 'bg-slate-950/85 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Open Weapon Rack"
          >
            <ChevronUp className={`w-2.5 h-2.5 transition-transform ${arsenalOpen ? 'rotate-180' : ''}`} />
            <span>Rack</span>
          </button>

          {/* Active Weapon Badge with Cooldown Bar */}
          <button
            type="button"
            data-no-joystick="true"
            onClick={(e) => {
              e.stopPropagation();
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.weapon)) return;
              triggerHaptic(15);
              const curIdx = WEAPON_ORDER.indexOf(activeWeaponId);
              const nextId = WEAPON_ORDER[(curIdx + 1) % WEAPON_ORDER.length];
              onSelectWeapon(nextId);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.weapon = performance.now();
              triggerHaptic(15);
              const curIdx = WEAPON_ORDER.indexOf(activeWeaponId);
              const nextId = WEAPON_ORDER[(curIdx + 1) % WEAPON_ORDER.length];
              onSelectWeapon(nextId);
            }}
            className={`relative overflow-hidden bg-slate-950/85 hover:bg-slate-900 border clip-chamfer px-2 py-1 flex items-center gap-1.5 transition cursor-pointer shadow-xl ${
              isLowAmmo
                ? 'border-amber-400/80 text-amber-200'
                : 'border-cyan-500/60 text-cyan-200 glow-cyan'
            }`}
            title="Next Weapon"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: activeWeaponMeta.color }}
            />
            <div className="flex flex-col text-left leading-none">
              <span className="text-[9px] font-mono font-black uppercase tracking-wider">
                {activeWeaponMeta.tag}
              </span>
              <span className="text-[8px] font-mono font-bold text-slate-400">
                {isMelee ? '∞' : `${clipCount}/${reserveCount}`}
              </span>
            </div>
            {/* Live recharge sweep bar */}
            <div
              ref={cooldownBarRef}
              style={{ transform: 'scaleX(0)' }}
              className="absolute bottom-0 inset-x-0 h-0.5 bg-cyan-400 origin-left pointer-events-none"
            />
          </button>
        </div>

        {/* Reload Button */}
        {!isMelee && (
          <button
            type="button"
            data-no-joystick="true"
            onClick={(e) => {
              e.stopPropagation();
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.reload)) return;
              triggerHaptic(15);
              sounds.playUiClick();
              onReload();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.reload = performance.now();
              triggerHaptic(15);
              sounds.playUiClick();
              onReload();
            }}
            className="flex flex-col items-center justify-center px-2 py-1.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400 text-slate-300 hover:text-white clip-chamfer shadow-xl transition cursor-pointer active:scale-95"
            title="Reload [R]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-[7.5px] font-mono font-bold uppercase mt-0.5">R-LOAD</span>
          </button>
        )}

        {/* Crouch / Stand Toggle */}
        <button
          type="button"
          data-no-joystick="true"
          onClick={(e) => {
            e.stopPropagation();
            if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.crouch)) return;
            triggerHaptic(15);
            onCrouchToggle();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.crouch = performance.now();
            triggerHaptic(15);
            onCrouchToggle();
          }}
          className={`flex flex-col items-center justify-center px-2 py-1.5 border clip-chamfer shadow-xl transition cursor-pointer active:scale-95 ${
            isCrouching
              ? 'bg-cyan-500 border-cyan-300 text-slate-950 glow-cyan font-black'
              : 'bg-slate-950/85 border-slate-700 text-slate-300'
          }`}
          title="Toggle Crouch [C / CTRL]"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[7.5px] font-mono font-black uppercase mt-0.5">
            {isCrouching ? 'CRCH' : 'STND'}
          </span>
        </button>

        {/* Jump Button (Reaches elevated platforms smoothly) */}
        <button
          type="button"
          data-no-joystick="true"
          onClick={(e) => {
            e.stopPropagation();
            if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.jump)) return;
            triggerHaptic(15);
            onJump();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.jump = performance.now();
            triggerHaptic(15);
            onJump();
          }}
          className="flex flex-col items-center justify-center px-2.5 py-1.5 bg-cyan-950/70 border border-cyan-400/80 active:bg-cyan-500 text-cyan-300 active:text-slate-950 clip-chamfer shadow-xl transition cursor-pointer active:scale-95 glow-cyan"
          title="Jump [SPACE]"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span className="text-[7.5px] font-mono font-black uppercase mt-0.5">JUMP</span>
        </button>

        {/* ADS / Scope Button */}
        <button
          type="button"
          data-no-joystick="true"
          onClick={(e) => {
            e.stopPropagation();
            if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.scope)) return;
            triggerHaptic(15);
            onScopeToggle();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.scope = performance.now();
            triggerHaptic(15);
            onScopeToggle();
          }}
          className={`flex flex-col items-center justify-center px-2 py-1.5 border clip-chamfer shadow-xl transition cursor-pointer active:scale-95 ${
            isScoped
              ? 'bg-amber-500 border-amber-300 text-slate-950 glow-amber font-black'
              : 'bg-slate-950/85 border-slate-700 text-amber-400'
          }`}
          title="Scope ADS [Right-Click]"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="text-[7.5px] font-mono font-black uppercase mt-0.5">
            {isScoped ? 'ZOOM' : 'ADS'}
          </span>
        </button>

        {/* Spike Defuse/Plant Button (Contextual) */}
        {isInteractingSpike && (
          <button
            type="button"
            data-no-joystick="true"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.spike = performance.now();
              handleInteractStart(e);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleInteractEnd(e);
            }}
            onMouseDown={(e) => {
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.spike)) return;
              handleInteractStart(e);
            }}
            onMouseUp={handleInteractEnd}
            onMouseLeave={handleInteractEnd}
            className={`flex flex-col items-center justify-center px-2.5 py-1.5 border-2 clip-chamfer shadow-2xl transition cursor-pointer active:scale-95 ${
              isInteractingVisual
                ? 'bg-amber-500 border-amber-300 text-slate-950 glow-amber'
                : 'bg-amber-950/90 border-amber-400 text-amber-300 animate-pulse'
            }`}
            title="Interact Core [Hold E]"
          >
            <Bomb className="w-4 h-4 text-amber-300" />
            <span className="text-[7.5px] font-mono font-black uppercase mt-0.5">
              {spikeAction?.action === 'defusing' ? 'DEFUSE' : 'PLANT'}
            </span>
          </button>
        )}

        {/* Prominent Primary Fire Trigger Pill */}
        <button
          type="button"
          data-no-joystick="true"
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.fire = performance.now();
            handlePrimaryFireStart(e);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePrimaryFireEnd(e);
          }}
          onMouseDown={(e) => {
            if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.fire)) return;
            handlePrimaryFireStart(e);
          }}
          onMouseUp={handlePrimaryFireEnd}
          onMouseLeave={handlePrimaryFireEnd}
          className={`flex items-center gap-1 px-3 py-1.5 border clip-chamfer transition cursor-pointer active:scale-95 select-none ${
            primaryFireActive || aimFiring
              ? 'bg-gradient-to-r from-red-600 to-rose-700 border-white text-white shadow-[0_0_20px_rgba(239,68,68,1)]'
              : 'bg-gradient-to-r from-rose-950/90 to-red-950/90 border-rose-500/80 text-rose-200 hover:border-rose-400 glow-rose'
          }`}
          title="Fire Weapon"
        >
          <Crosshair className="w-3.5 h-3.5 text-white animate-pulse" />
          <span className="text-[9px] font-mono font-black uppercase tracking-wider text-white">
            FIRE
          </span>
        </button>
      </div>
    </div>
  );
}
