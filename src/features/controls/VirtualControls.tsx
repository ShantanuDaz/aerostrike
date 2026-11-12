import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import type { WeaponType } from '../combat/types';
import { WEAPONS } from '../combat/weaponsConfig';
import { useSettingsStore } from '../settings/settingsStore';
import { useCTFStore } from '../ctf/ctfStore';
import { useMatchStatsStore } from '../combat/statsStore';
import { useNetworkStore } from '../network/networkStore';
import { useChatStore } from '../comms/chatStore';
import { sounds } from '../audio/soundEngine';
import { useIsTouchHUD } from './useIsTouchHUD';
import { engineWorld } from '../game/engineWorld';
import { isPointInRadarExclusion, shouldIgnoreSyntheticMouse } from './touchExclusion';
import {
  type StickCenter,
  evaluateAimStick,
  evaluateMoveStick,
  getScaledStickMetrics,
  pickFixedStickTarget,
} from './touchStickMath';
import { Bomb, ChevronUp, Crosshair, RefreshCw, Wind } from 'lucide-react';

interface VirtualControlsProps {
  onSwitchWeapon: () => void;
  onThrowGrenade: () => void;
}

const WEAPON_BADGES: Record<WeaponType, { tag: string; label: string }> = {
  rifle: { tag: 'RFL', label: 'Rifle' },
  shotgun: { tag: 'SHG', label: 'Shotgun' },
  sniper: { tag: 'SNP', label: 'Sniper' },
  rocket: { tag: 'RPG', label: 'RPG' },
  pistol: { tag: 'PST', label: 'Pistol' },
  grenade: { tag: 'FRG', label: 'Frag' },
};

const WEAPON_LIST: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];

function getStickCenter(el: HTMLDivElement | null): StickCenter | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function VirtualControls({ onSwitchWeapon, onThrowGrenade }: VirtualControlsProps) {
  const isTouchHUD = useIsTouchHUD();
  const setInput = usePlayerStore((s) => s.setInput);
  const dashCooldown = usePlayerStore((s) => s.player.dashCooldown ?? 0);
  const boostFuel = usePlayerStore((s) => s.player.boostFuel);
  const fuelOverheated = usePlayerStore((s) => Boolean(s.player.fuelOverheated));
  const equippedWeapon = useCombatStore((s) => s.equippedWeapon);
  const currentAmmo = useCombatStore((s) => s.currentAmmo);
  const ammoByWeapon = useCombatStore((s) => s.ammoByWeapon);
  const setEquippedWeapon = useCombatStore((s) => s.setEquippedWeapon);
  const lastFiredAt = useCombatStore((s) => s.lastFiredAt);
  const grenades = useCombatStore((s) => s.grenades);
  const lastGrenadeAt = useCombatStore((s) => s.lastGrenadeAt);
  const showTouchHints = useSettingsStore((s) => s.showTouchHints);
  const touchLayout = useSettingsStore((s) => s.touchLayout);
  const touchControlScale = useSettingsStore((s) => s.touchControlScale);
  const touchControlOpacity = useSettingsStore((s) => s.touchControlOpacity);
  const touchStickDeadzone = useSettingsStore((s) => s.touchStickDeadzone);
  const touchAimMode = useSettingsStore((s) => s.touchAimMode);
  const showTouchGrenadeButton = useSettingsStore((s) => s.showTouchGrenadeButton);

  const isLeftHanded = touchLayout === 'left_handed';
  const stickMetrics = getScaledStickMetrics(touchControlScale, touchStickDeadzone);
  const stickMetricsRef = useRef(stickMetrics);
  const touchAimModeRef = useRef(touchAimMode);

  useEffect(() => {
    stickMetricsRef.current = stickMetrics;
  }, [stickMetrics]);

  useEffect(() => {
    touchAimModeRef.current = touchAimMode;
  }, [touchAimMode]);

  const [moveActive, setMoveActive] = useState(false);
  const [aimActive, setAimActive] = useState(false);
  const [aimFiring, setAimFiring] = useState(false);
  const [arsenalOpen, setArsenalOpen] = useState(false);
  const [isDashingDirect, setIsDashingDirect] = useState(false);
  const [grenadeReadyFlash, setGrenadeReadyFlash] = useState(false);

  const movePadRef = useRef<HTMLDivElement | null>(null);
  const aimPadRef = useRef<HTMLDivElement | null>(null);
  const moveKnobRef = useRef<HTMLDivElement | null>(null);
  const aimKnobRef = useRef<HTMLDivElement | null>(null);
  const cooldownBarRef = useRef<HTMLDivElement | null>(null);
  const grenadeCooldownBarRef = useRef<HTMLDivElement | null>(null);

  const moveTouchIdRef = useRef<number | null>(null);
  const aimTouchIdRef = useRef<number | null>(null);
  const moveCenterRef = useRef<StickCenter | null>(null);
  const aimCenterRef = useRef<StickCenter | null>(null);
  const aimFiringRef = useRef(false);
  const isDashingDirectRef = useRef(false);

  const lastButtonTouchMsRef = useRef<{
    weapon: number;
    drawer: number;
    dash: number;
    grenade: number;
  }>({
    weapon: 0,
    drawer: 0,
    dash: 0,
    grenade: 0,
  });

  // Animate fire-rate recharge bar on the touch weapon badge without 60 FPS React state
  useEffect(() => {
    if (!isTouchHUD) return;
    const fireRateMs = WEAPONS[equippedWeapon].fireRateMs;
    if (fireRateMs <= 0 || !lastFiredAt) {
      if (cooldownBarRef.current) {
        cooldownBarRef.current.style.transform = 'scaleX(0)';
      }
      return;
    }

    let rafId = 0;
    const tickCooldown = () => {
      const elapsed = performance.now() - lastFiredAt;
      const remainingPct = Math.max(0, 1 - elapsed / fireRateMs);
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
  }, [isTouchHUD, equippedWeapon, lastFiredAt]);

  // Animate Frag Grenade throw cooldown bar without React state ticks
  useEffect(() => {
    if (!isTouchHUD || !showTouchGrenadeButton) return;
    const cooldownMs = WEAPONS.grenade.fireRateMs;
    if (cooldownMs <= 0 || !lastGrenadeAt) {
      if (grenadeCooldownBarRef.current) {
        grenadeCooldownBarRef.current.style.transform = 'scaleX(0)';
      }
      return;
    }

    let rafId = 0;
    const tickGrenadeCooldown = () => {
      const elapsed = performance.now() - lastGrenadeAt;
      const remainingPct = Math.max(0, 1 - elapsed / cooldownMs);
      if (grenadeCooldownBarRef.current) {
        grenadeCooldownBarRef.current.style.transform = `scaleX(${remainingPct})`;
      }
      if (remainingPct > 0.01) {
        rafId = requestAnimationFrame(tickGrenadeCooldown);
      } else if (grenadeCooldownBarRef.current) {
        grenadeCooldownBarRef.current.style.transform = 'scaleX(0)';
      }
    };
    rafId = requestAnimationFrame(tickGrenadeCooldown);
    return () => cancelAnimationFrame(rafId);
  }, [isTouchHUD, showTouchGrenadeButton, lastGrenadeAt]);

  const resetAllTouchControls = useCallback(() => {
    moveTouchIdRef.current = null;
    aimTouchIdRef.current = null;
    moveCenterRef.current = null;
    aimCenterRef.current = null;
    aimFiringRef.current = false;
    isDashingDirectRef.current = false;

    if (moveKnobRef.current) {
      moveKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    if (aimKnobRef.current) {
      aimKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }

    setMoveActive(false);
    setAimActive(false);
    setAimFiring(false);
    setArsenalOpen(false);
    setIsDashingDirect(false);
    setInput({ moveX: 0, moveY: 0, boosting: false, shooting: false, dash: false });
  }, [setInput]);

  useEffect(() => {
    return useCTFStore.subscribe((state, prevState) => {
      if (prevState.matchStatus === 'playing' && state.matchStatus !== 'playing') {
        resetAllTouchControls();
      }
    });
  }, [resetAllTouchControls]);

  const handleDashStart = () => {
    isDashingDirectRef.current = true;
    setIsDashingDirect(true);
    setInput({ dash: true });
  };

  const handleDashEnd = () => {
    isDashingDirectRef.current = false;
    setIsDashingDirect(false);
    setInput({ dash: false });
  };

  const triggerGrenadeThrow = () => {
    if (grenades <= 0) return;
    setGrenadeReadyFlash(true);
    window.setTimeout(() => setGrenadeReadyFlash(false), 140);
    onThrowGrenade();
  };

  // --- FIXED-CORNER MULTI-TOUCH HANDLERS ---
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD) return;
      if (useChatStore.getState().isInputFocused) return;
      if (useCTFStore.getState().matchStatus !== 'playing') return;
      const isMultiplayer = Boolean(useNetworkStore.getState().roomCode);
      if (!isMultiplayer && useMatchStatsStore.getState().tacticalMenuOpen) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest('button, input, select, textarea, a, [role="button"], [data-no-joystick]')
      ) {
        return;
      }

      if (arsenalOpen) {
        setArsenalOpen(false);
      }

      const halfWidth = window.innerWidth / 2;
      const m = stickMetricsRef.current;
      const aimMode = touchAimModeRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        // Exclude top HUD bar
        if (clientY < 54) {
          continue;
        }

        // Exclude live Minimap Radar + Zoom strip on top-right
        if (clientX >= halfWidth) {
          const mm = engineWorld.minimapTarget;
          const mmRect =
            mm.canvas && typeof mm.canvas.getBoundingClientRect === 'function'
              ? mm.canvas.getBoundingClientRect()
              : null;
          if (isPointInRadarExclusion(clientX, clientY, window.innerWidth, mm, mmRect)) {
            continue;
          }
        }

        const moveCenter = getStickCenter(movePadRef.current);
        const aimCenter = getStickCenter(aimPadRef.current);
        const stickTarget = pickFixedStickTarget(
          clientX,
          clientY,
          moveCenter,
          aimCenter,
          moveTouchIdRef.current !== null,
          aimTouchIdRef.current !== null,
          m.stickHitRadius,
        );

        if (stickTarget === 'move' && moveCenter) {
          e.preventDefault();
          moveTouchIdRef.current = identifier;
          moveCenterRef.current = moveCenter;

          const res = evaluateMoveStick(
            clientX - moveCenter.x,
            clientY - moveCenter.y,
            m.moveMaxDist,
          );
          if (moveKnobRef.current) {
            moveKnobRef.current.style.transform = `translate3d(${res.offsetX}px, ${res.offsetY}px, 0)`;
          }
          setMoveActive(true);
          setInput({
            moveX: res.moveX,
            moveY: res.moveY,
            boosting: res.boosting,
          });
        } else if (stickTarget === 'aim' && aimCenter) {
          e.preventDefault();
          aimTouchIdRef.current = identifier;
          aimCenterRef.current = aimCenter;

          const res = evaluateAimStick(clientX - aimCenter.x, clientY - aimCenter.y, {
            maxDist: m.aimMaxDist,
            deadzoneDist: m.aimDeadzoneDist,
            firePerimeterDist: m.aimFirePerimeterDist,
            aimMode,
          });
          if (aimKnobRef.current) {
            aimKnobRef.current.style.transform = `translate3d(${res.offsetX}px, ${res.offsetY}px, 0)`;
          }
          aimFiringRef.current = res.isFiring;
          setAimActive(true);
          setAimFiring(res.isFiring);

          if (res.hasAim) {
            setInput({ aimAngle: res.angle, shooting: res.isFiring });
          } else {
            setInput({ shooting: false });
          }
        }
      }
    },
    [isTouchHUD, arsenalOpen, setInput],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD) return;
      const m = stickMetricsRef.current;
      const aimMode = touchAimModeRef.current;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        if (moveTouchIdRef.current === identifier) {
          e.preventDefault();
          const center = moveCenterRef.current ?? getStickCenter(movePadRef.current);
          if (!center) continue;
          const res = evaluateMoveStick(clientX - center.x, clientY - center.y, m.moveMaxDist);
          if (moveKnobRef.current) {
            moveKnobRef.current.style.transform = `translate3d(${res.offsetX}px, ${res.offsetY}px, 0)`;
          }
          setInput({
            moveX: res.moveX,
            moveY: res.moveY,
            boosting: res.boosting,
          });
        }

        if (aimTouchIdRef.current === identifier) {
          e.preventDefault();
          const center = aimCenterRef.current ?? getStickCenter(aimPadRef.current);
          if (!center) continue;
          const res = evaluateAimStick(clientX - center.x, clientY - center.y, {
            maxDist: m.aimMaxDist,
            deadzoneDist: m.aimDeadzoneDist,
            firePerimeterDist: m.aimFirePerimeterDist,
            aimMode,
          });
          if (aimKnobRef.current) {
            aimKnobRef.current.style.transform = `translate3d(${res.offsetX}px, ${res.offsetY}px, 0)`;
          }

          if (aimFiringRef.current !== res.isFiring) {
            aimFiringRef.current = res.isFiring;
            setAimFiring(res.isFiring);
          }

          if (res.hasAim) {
            setInput({ aimAngle: res.angle, shooting: res.isFiring });
          } else {
            setInput({ shooting: false });
          }
        }
      }
    },
    [isTouchHUD, setInput],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const { identifier } = e.changedTouches[i];

        if (moveTouchIdRef.current === identifier) {
          e.preventDefault();
          moveTouchIdRef.current = null;
          moveCenterRef.current = null;
          if (moveKnobRef.current) {
            moveKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
          }
          setMoveActive(false);
          setInput({ moveX: 0, moveY: 0, boosting: false });
        }

        if (aimTouchIdRef.current === identifier) {
          e.preventDefault();
          aimTouchIdRef.current = null;
          aimCenterRef.current = null;
          aimFiringRef.current = false;
          if (aimKnobRef.current) {
            aimKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
          }
          setAimActive(false);
          setAimFiring(false);
          setInput({ shooting: false });
        }
      }
    },
    [isTouchHUD, setInput],
  );

  useEffect(() => {
    if (!isTouchHUD) return;
    const options: AddEventListenerOptions = { passive: false };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetAllTouchControls();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);
    document.addEventListener('touchcancel', handleTouchEnd, options);
    window.addEventListener('blur', resetAllTouchControls);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('blur', resetAllTouchControls);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setInput({ moveX: 0, moveY: 0, boosting: false, shooting: false, dash: false });
    };
  }, [isTouchHUD, handleTouchStart, handleTouchMove, handleTouchEnd, resetAllTouchControls, setInput]);

  // Do NOT render mobile thumb controls on Desktop mouse/keyboard setups!
  if (!isTouchHUD) return null;

  const weaponCfg = WEAPONS[equippedWeapon];
  const weaponMeta = WEAPON_BADGES[equippedWeapon];
  const ammoLabel = weaponCfg.maxAmmo === Infinity ? '∞' : `${currentAmmo}`;
  const isLowAmmo =
    weaponCfg.maxAmmo !== Infinity &&
    currentAmmo <= Math.max(1, Math.ceil(weaponCfg.maxAmmo * 0.25));
  const dashReady = dashCooldown <= 0.05 && !fuelOverheated && boostFuel >= 18;

  const moveCornerStyle = isLeftHanded
    ? {
        marginRight: 'env(safe-area-inset-right, 0px)',
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }
    : {
        marginLeft: 'env(safe-area-inset-left, 0px)',
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      };

  const aimCornerStyle = isLeftHanded
    ? {
        marginLeft: 'env(safe-area-inset-left, 0px)',
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      }
    : {
        marginRight: 'env(safe-area-inset-right, 0px)',
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
      };

  const actionBtnW = Math.round(52 * stickMetrics.scale);
  const actionBtnH = Math.round(44 * stickMetrics.scale);
  const actionBottomPx = Math.round(12 + stickMetrics.aimPadSize + 8 * stickMetrics.scale);
  const knobCoreSize = Math.max(6, Math.round(10 * stickMetrics.scale));
  const hintTextSize = stickMetrics.scale < 0.8 ? 'text-[6px]' : 'text-[7px]';
  const hasGrenades = grenades > 0;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden touch-none">
      {/* 1. FIXED CORNER MOVEMENT & JETPACK STICK */}
      <div
        ref={movePadRef}
        style={{
          ...moveCornerStyle,
          width: `${stickMetrics.movePadSize}px`,
          height: `${stickMetrics.movePadSize}px`,
          opacity: touchControlOpacity,
        }}
        className={`absolute bottom-3 sm:bottom-4 rounded-full backdrop-blur-sm flex items-center justify-center pointer-events-none transition-colors duration-100 border-2 ${
          isLeftHanded ? 'right-3 sm:right-4' : 'left-3 sm:left-4'
        } ${
          moveActive
            ? 'bg-slate-950/70 border-cyan-400/80 glow-cyan'
            : 'bg-slate-950/40 border-cyan-400/35'
        }`}
      >
        <div className="absolute w-full h-px bg-cyan-400/20" />
        <div className="absolute h-full w-px bg-cyan-400/20" />

        {showTouchHints && (
          <>
            <span
              className={`absolute top-1.5 ${hintTextSize} font-mono font-black uppercase tracking-widest text-cyan-300/65`}
            >
              Boost
            </span>
            <span
              className={`absolute bottom-1.5 ${hintTextSize} font-mono font-black uppercase tracking-widest text-cyan-300/45`}
            >
              Drop
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
          <div
            style={{ width: `${knobCoreSize}px`, height: `${knobCoreSize}px` }}
            className="rounded-full bg-white/90"
          />
        </div>
      </div>

      {/* 2. FIXED CORNER AIM & FIRE STICK */}
      <div
        ref={aimPadRef}
        style={{
          ...aimCornerStyle,
          width: `${stickMetrics.aimPadSize}px`,
          height: `${stickMetrics.aimPadSize}px`,
          opacity: touchControlOpacity,
        }}
        className={`absolute bottom-3 sm:bottom-4 rounded-full backdrop-blur-sm flex items-center justify-center pointer-events-none transition-colors duration-100 border-2 ${
          isLeftHanded ? 'left-3 sm:left-4' : 'right-3 sm:right-4'
        } ${
          aimFiring
            ? 'bg-rose-950/65 border-rose-500 glow-red'
            : aimActive
              ? 'bg-slate-950/70 border-amber-400/80'
              : 'bg-slate-950/40 border-amber-400/35'
        }`}
      >
        {/* Perimeter Firing Ring Cue (precision mode) or Instant Fire Inner Cue */}
        {touchAimMode === 'precision' ? (
          <div
            style={{
              width: `${stickMetrics.aimPerimeterRingSize}px`,
              height: `${stickMetrics.aimPerimeterRingSize}px`,
            }}
            className={`rounded-full border border-dashed absolute ${
              aimFiring ? 'border-rose-400/90' : 'border-amber-300/35'
            }`}
          />
        ) : (
          <div
            style={{
              width: `${Math.max(16, stickMetrics.aimDeadzoneDist * 2.4)}px`,
              height: `${Math.max(16, stickMetrics.aimDeadzoneDist * 2.4)}px`,
            }}
            className={`rounded-full border border-dotted absolute ${
              aimFiring ? 'border-rose-400/80' : 'border-amber-300/30'
            }`}
          />
        )}
        <div className="absolute w-3/4 h-px bg-amber-300/15" />
        <div className="absolute h-3/4 w-px bg-amber-300/15" />

        {showTouchHints && !aimActive && (
          <span
            className={`absolute bottom-1.5 ${hintTextSize} font-mono font-black uppercase tracking-widest text-amber-200/65`}
          >
            {touchAimMode === 'instant' ? 'Drag = Shoot' : 'Edge = Shoot'}
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
            aimFiring
              ? 'bg-gradient-to-br from-rose-500 to-red-600 border-white'
              : aimActive
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-white/90'
                : 'bg-gradient-to-br from-amber-500/80 to-orange-600/80 border-amber-200/75'
          }`}
        >
          {aimFiring ? (
            <div
              style={{ width: `${knobCoreSize}px`, height: `${knobCoreSize}px` }}
              className="rounded-full bg-white"
            />
          ) : (
            <Crosshair
              style={{
                width: `${Math.max(10, Math.round(14 * stickMetrics.scale))}px`,
                height: `${Math.max(10, Math.round(14 * stickMetrics.scale))}px`,
              }}
              className="text-slate-950"
            />
          )}
        </div>
      </div>

      {/* 3. SLEEK CHAMFERED THUMB ACTIONS (Positioned cleanly above the fixed Aim pad) */}
      <div
        data-no-joystick="true"
        style={{
          ...aimCornerStyle,
          bottom: `${actionBottomPx}px`,
        }}
        className={`absolute flex items-end gap-1.5 pointer-events-auto ${
          isLeftHanded ? 'left-3 sm:left-4 flex-row-reverse' : 'right-3 sm:right-4'
        }`}
      >
        {/* Weapon Cycle + Quick Arsenal Drawer */}
        <div className="relative flex flex-col items-center gap-1">
          {arsenalOpen && (
            <div
              data-no-joystick="true"
              className={`absolute bottom-0 ${
                isLeftHanded ? 'left-full ml-2' : 'right-full mr-2'
              } cyber-panel clip-chamfer p-1.5 border border-cyan-500/50 bg-slate-950/95 backdrop-blur-md shadow-2xl flex flex-col gap-1 min-w-[138px] animate-in fade-in duration-100`}
            >
              {WEAPON_LIST.map((wId) => {
                const cfg = WEAPONS[wId];
                const meta = WEAPON_BADGES[wId];
                const ammo = ammoByWeapon[wId] ?? 0;
                const available = cfg.maxAmmo === Infinity || ammo > 0;
                const active = wId === equippedWeapon;
                return (
                  <button
                    key={wId}
                    type="button"
                    disabled={!available}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!available) return;
                      sounds.playUiClick();
                      setEquippedWeapon(wId);
                      setArsenalOpen(false);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!available) return;
                      sounds.playUiClick();
                      setEquippedWeapon(wId);
                      setArsenalOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400 text-white font-black'
                        : available
                          ? 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 text-slate-200 font-bold'
                          : 'bg-slate-950/50 border-transparent text-slate-600 opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span>{meta.label}</span>
                    </span>
                    <span className={active ? 'text-cyan-300' : 'text-slate-400'}>
                      {cfg.maxAmmo === Infinity ? '∞' : ammo}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            style={{ opacity: touchControlOpacity }}
            onClick={(e) => {
              e.stopPropagation();
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.drawer)) return;
              sounds.playUiClick();
              setArsenalOpen((v) => !v);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.drawer = performance.now();
              sounds.playUiClick();
              setArsenalOpen((v) => !v);
            }}
            className={`px-1.5 py-0.5 text-[7.5px] font-mono font-bold uppercase tracking-widest border clip-chamfer flex items-center gap-0.5 transition cursor-pointer ${
              arsenalOpen
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                : 'bg-slate-950/80 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Open Weapon Rack"
          >
            <ChevronUp
              className={`w-2.5 h-2.5 transition-transform ${arsenalOpen ? 'rotate-180' : ''}`}
            />
            <span>Rack</span>
          </button>

          <button
            type="button"
            style={{
              width: `${actionBtnW}px`,
              height: `${actionBtnH}px`,
              opacity: touchControlOpacity,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.weapon)) return;
              onSwitchWeapon();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.weapon = performance.now();
              onSwitchWeapon();
            }}
            className={`relative overflow-hidden bg-slate-950/75 hover:bg-slate-900 border backdrop-blur-md flex flex-col items-center justify-center text-cyan-200 clip-chamfer shadow-xl cursor-pointer active:scale-95 transition ${
              isLowAmmo ? 'border-amber-400/75' : 'border-cyan-500/50'
            }`}
            title="Switch Weapon"
          >
            <div className="flex items-center gap-0.5 text-[8.5px] font-mono font-black uppercase text-white leading-none">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: weaponCfg.color }}
              />
              <span>{weaponMeta.tag}</span>
              <RefreshCw className="w-2 h-2 text-cyan-400" />
            </div>
            <span
              className={`text-[9.5px] font-mono font-bold mt-0.5 leading-none ${
                isLowAmmo ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              {ammoLabel}
            </span>
            <div
              ref={cooldownBarRef}
              style={{ transform: 'scaleX(0)' }}
              className="absolute bottom-0 inset-x-0 h-0.5 bg-cyan-400 origin-left pointer-events-none"
            />
          </button>
        </div>

        {/* Frag Grenade Button (Replaces Jet Button) */}
        {showTouchGrenadeButton && (
          <button
            type="button"
            disabled={!hasGrenades}
            style={{
              width: `${actionBtnW}px`,
              height: `${actionBtnH}px`,
              opacity: touchControlOpacity,
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              lastButtonTouchMsRef.current.grenade = performance.now();
              triggerGrenadeThrow();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.grenade)) return;
              triggerGrenadeThrow();
            }}
            className={`relative overflow-hidden clip-chamfer backdrop-blur-md flex flex-col items-center justify-center border transition shadow-xl ${
              grenadeReadyFlash && hasGrenades
                ? 'bg-lime-400/90 border-white text-slate-950 scale-95 cursor-pointer'
                : hasGrenades
                  ? 'bg-lime-950/80 hover:bg-lime-900/80 border-lime-400/75 text-lime-200 cursor-pointer active:scale-95'
                  : 'bg-slate-950/65 border-slate-700/70 text-slate-500 opacity-60 cursor-not-allowed'
            }`}
            title={hasGrenades ? 'Throw Frag Grenade' : 'No Frag Grenades left (Resupply at Supply Crate)'}
            aria-label="Throw Frag Grenade"
          >
            <div className="flex items-center gap-0.5 leading-none">
              <Bomb className={`w-3.5 h-3.5 ${hasGrenades ? 'text-lime-300' : 'text-slate-500'}`} />
              <span
                className={`text-[9px] font-mono font-black tabular-nums ${
                  hasGrenades ? 'text-white' : 'text-slate-500'
                }`}
              >
                {grenades}
              </span>
            </div>
            <span className="text-[7px] font-mono font-black uppercase tracking-wider leading-none mt-0.5">
              Frag
            </span>
            <div
              ref={grenadeCooldownBarRef}
              style={{ transform: 'scaleX(0)' }}
              className="absolute bottom-0 inset-x-0 h-0.5 bg-lime-400 origin-left pointer-events-none"
            />
          </button>
        )}

        {/* Thruster Air-Dash Button */}
        <button
          type="button"
          style={{
            width: `${actionBtnW}px`,
            height: `${actionBtnH}px`,
            opacity: touchControlOpacity,
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.dash = performance.now();
            handleDashStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.dash = performance.now();
            handleDashEnd();
          }}
          onTouchCancel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            lastButtonTouchMsRef.current.dash = performance.now();
            handleDashEnd();
          }}
          onMouseDown={() => {
            if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.dash)) return;
            handleDashStart();
          }}
          onMouseUp={() => {
            if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.dash)) return;
            handleDashEnd();
          }}
          onMouseLeave={() => {
            if (isDashingDirectRef.current) handleDashEnd();
          }}
          className={`clip-chamfer backdrop-blur-md flex flex-col items-center justify-center border transition cursor-pointer shadow-xl ${
            isDashingDirect && dashReady
              ? 'bg-cyan-400/90 border-white text-slate-950 scale-95 glow-cyan'
              : dashReady
                ? 'bg-sky-950/80 hover:bg-sky-900/80 border-cyan-400/70 text-cyan-200 glow-cyan'
                : 'bg-slate-950/65 border-slate-700/70 text-slate-500 opacity-75'
          }`}
          title="Thruster Air-Dash"
        >
          <Wind className={`w-3.5 h-3.5 ${dashReady ? 'text-cyan-300' : 'text-slate-500'}`} />
          <span className="text-[7.5px] font-mono font-black uppercase tracking-wider leading-none mt-0.5">
            {dashCooldown > 0.05 ? `${dashCooldown.toFixed(1)}s` : 'Dash'}
          </span>
        </button>
      </div>
    </div>
  );
}
