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
import { ChevronUp, Crosshair, Flame, RefreshCw, Wind } from 'lucide-react';

interface VirtualControlsProps {
  onFire: () => void;
  onSwitchWeapon: () => void;
}

interface StickOrigin {
  startX: number;
  startY: number;
}

interface ActiveStick extends StickOrigin {
  id: number;
  currentX: number;
  currentY: number;
  dragged: boolean;
  dist: number;
}

const WEAPON_BADGES: Record<WeaponType, { tag: string; label: string }> = {
  rifle: { tag: 'RFL', label: 'Rifle' },
  shotgun: { tag: 'SHG', label: 'Shotgun' },
  sniper: { tag: 'SNP', label: 'Sniper' },
  rocket: { tag: 'RPG', label: 'RPG' },
  pistol: { tag: 'PST', label: 'Pistol' },
};

const WEAPON_LIST: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];
const PRECISION_AUTO_FIRE_DIST = 46;

export function VirtualControls({ onFire, onSwitchWeapon }: VirtualControlsProps) {
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
  const showTouchHints = useSettingsStore((s) => s.showTouchHints);
  const touchAimMode = useSettingsStore((s) => s.touchAimMode);
  const touchLayout = useSettingsStore((s) => s.touchLayout);
  const showTouchBoostButton = useSettingsStore((s) => s.showTouchBoostButton);

  const isLeftHanded = touchLayout === 'left_handed';

  // Origin coordinates only update on touchstart/touchend (zero touchmove React re-renders)
  const [moveOrigin, setMoveOrigin] = useState<StickOrigin | null>(null);
  const [aimOrigin, setAimOrigin] = useState<StickOrigin | null>(null);
  const [precisionAutoFiring, setPrecisionAutoFiring] = useState(false);
  const [arsenalOpen, setArsenalOpen] = useState(false);

  const moveTouchRef = useRef<ActiveStick | null>(null);
  const aimTouchRef = useRef<ActiveStick | null>(null);
  const moveKnobRef = useRef<HTMLDivElement | null>(null);
  const aimKnobRef = useRef<HTMLDivElement | null>(null);
  const cooldownBarRef = useRef<HTMLDivElement | null>(null);
  const aimGraceTimerRef = useRef<number | null>(null);

  const touchAimModeRef = useRef(touchAimMode);
  const isLeftHandedRef = useRef(isLeftHanded);
  useEffect(() => {
    touchAimModeRef.current = touchAimMode;
  }, [touchAimMode]);
  useEffect(() => {
    isLeftHandedRef.current = isLeftHanded;
  }, [isLeftHanded]);

  const [isBoostingDirect, setIsBoostingDirect] = useState(false);
  const [isDashingDirect, setIsDashingDirect] = useState(false);
  const isBoostingDirectRef = useRef(false);
  const isDashingDirectRef = useRef(false);
  const lastButtonTouchMsRef = useRef<{
    weapon: number;
    drawer: number;
    dash: number;
    boost: number;
  }>({
    weapon: 0,
    drawer: 0,
    dash: 0,
    boost: 0,
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

  const clearAimGraceTimer = useCallback(() => {
    if (aimGraceTimerRef.current !== null) {
      window.clearTimeout(aimGraceTimerRef.current);
      aimGraceTimerRef.current = null;
    }
  }, []);

  const resetAllTouchControls = useCallback(() => {
    clearAimGraceTimer();
    moveTouchRef.current = null;
    aimTouchRef.current = null;
    isBoostingDirectRef.current = false;
    isDashingDirectRef.current = false;
    setMoveOrigin(null);
    setAimOrigin(null);
    setPrecisionAutoFiring(false);
    setArsenalOpen(false);
    setIsBoostingDirect(false);
    setIsDashingDirect(false);
    setInput({ moveX: 0, moveY: 0, boosting: false, shooting: false, dash: false });
  }, [clearAimGraceTimer, setInput]);

  const handleBoostStart = () => {
    isBoostingDirectRef.current = true;
    setIsBoostingDirect(true);
    setInput({ boosting: true });
  };

  const handleBoostEnd = () => {
    isBoostingDirectRef.current = false;
    setIsBoostingDirect(false);
    const mt = moveTouchRef.current;
    const isStickBoosting = mt ? mt.currentY - mt.startY < -22 : false;
    setInput({ boosting: isStickBoosting });
  };

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

  // --- MULTI-TOUCH HANDLERS ---
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
      const leftHanded = isLeftHandedRef.current;

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

        const isMoveZone = leftHanded ? clientX >= halfWidth : clientX < halfWidth;

        if (isMoveZone && !moveTouchRef.current) {
          e.preventDefault();
          moveTouchRef.current = {
            id: identifier,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            dragged: false,
            dist: 0,
          };
          setMoveOrigin({ startX: clientX, startY: clientY });
        } else if (!isMoveZone && !aimTouchRef.current) {
          e.preventDefault();
          aimTouchRef.current = {
            id: identifier,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            dragged: false,
            dist: 0,
          };
          setAimOrigin({ startX: clientX, startY: clientY });
          setPrecisionAutoFiring(false);

          if (touchAimModeRef.current === 'instant') {
            // Brief aim-grace window avoids firing frame-0 shot along stale aimAngle when dragging
            clearAimGraceTimer();
            aimGraceTimerRef.current = window.setTimeout(() => {
              aimGraceTimerRef.current = null;
              if (aimTouchRef.current && touchAimModeRef.current === 'instant') {
                setInput({ shooting: true });
              }
            }, 80);
          }
        }
      }
    },
    [isTouchHUD, arsenalOpen, clearAimGraceTimer, setInput],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        if (moveTouchRef.current && moveTouchRef.current.id === identifier) {
          e.preventDefault();
          const startX = moveTouchRef.current.startX;
          const startY = moveTouchRef.current.startY;
          const maxDist = 52;

          const dx = clientX - startX;
          const dy = clientY - startY;
          const dist = Math.hypot(dx, dy);
          const clampedDist = Math.min(maxDist, dist);
          const angle = Math.atan2(dy, dx);

          const offsetX = Math.cos(angle) * clampedDist;
          const offsetY = Math.sin(angle) * clampedDist;
          const currentX = startX + offsetX;
          const currentY = startY + offsetY;

          moveTouchRef.current.currentX = currentX;
          moveTouchRef.current.currentY = currentY;
          moveTouchRef.current.dist = dist;
          if (moveKnobRef.current) {
            moveKnobRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
          }

          const rawNormX = Math.max(-1, Math.min(1, offsetX / 46));
          const curvedX =
            Math.abs(rawNormX) > 0.14
              ? Math.sign(rawNormX) * Math.pow((Math.abs(rawNormX) - 0.14) / 0.86, 1.25)
              : 0;
          const boosting = offsetY < -22 || isBoostingDirectRef.current;
          const moveY = !boosting && offsetY > 24 ? 1 : 0;

          setInput({ moveX: curvedX, moveY, boosting });
        }

        if (aimTouchRef.current && aimTouchRef.current.id === identifier) {
          e.preventDefault();
          const startX = aimTouchRef.current.startX;
          const startY = aimTouchRef.current.startY;
          const maxDist = 60;

          const dx = clientX - startX;
          const dy = clientY - startY;
          const dist = Math.hypot(dx, dy);
          const clampedDist = Math.min(maxDist, dist);
          const angle = Math.atan2(dy, dx);

          const offsetX = Math.cos(angle) * clampedDist;
          const offsetY = Math.sin(angle) * clampedDist;
          aimTouchRef.current.currentX = startX + offsetX;
          aimTouchRef.current.currentY = startY + offsetY;
          aimTouchRef.current.dist = dist;
          if (aimKnobRef.current) {
            aimKnobRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
          }

          if (dist > 8) {
            aimTouchRef.current.dragged = true;
            clearAimGraceTimer();
            if (touchAimModeRef.current === 'precision') {
              const outerRimAutoFire = dist >= PRECISION_AUTO_FIRE_DIST;
              setPrecisionAutoFiring(outerRimAutoFire);
              setInput({ aimAngle: angle, shooting: outerRimAutoFire });
            } else {
              setInput({ aimAngle: angle, shooting: true });
            }
          }
        }
      }
    },
    [isTouchHUD, clearAimGraceTimer, setInput],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { identifier } = touch;

        if (moveTouchRef.current && moveTouchRef.current.id === identifier) {
          e.preventDefault();
          moveTouchRef.current = null;
          setMoveOrigin(null);
          setInput({ moveX: 0, moveY: 0, boosting: isBoostingDirectRef.current });
        }

        if (aimTouchRef.current && aimTouchRef.current.id === identifier) {
          e.preventDefault();
          const stick = aimTouchRef.current;
          const wasInstantTap =
            touchAimModeRef.current === 'instant' &&
            aimGraceTimerRef.current !== null &&
            !stick.dragged;
          const wasPrecisionReleaseShot =
            touchAimModeRef.current === 'precision' && stick.dist < PRECISION_AUTO_FIRE_DIST;

          clearAimGraceTimer();
          aimTouchRef.current = null;
          setAimOrigin(null);
          setPrecisionAutoFiring(false);
          setInput({ shooting: false });

          if (wasInstantTap || wasPrecisionReleaseShot) {
            onFire();
          }
        }
      }
    },
    [isTouchHUD, clearAimGraceTimer, onFire, setInput],
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
      clearAimGraceTimer();
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('blur', resetAllTouchControls);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setInput({ moveX: 0, moveY: 0, boosting: false, shooting: false, dash: false });
    };
  }, [
    isTouchHUD,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearAimGraceTimer,
    resetAllTouchControls,
    setInput,
  ]);

  // Do NOT render mobile thumb controls on Desktop mouse/keyboard setups!
  if (!isTouchHUD) return null;

  const weaponCfg = WEAPONS[equippedWeapon];
  const weaponMeta = WEAPON_BADGES[equippedWeapon];
  const ammoLabel = weaponCfg.maxAmmo === Infinity ? '∞' : `${currentAmmo}`;
  const isLowAmmo =
    weaponCfg.maxAmmo !== Infinity &&
    currentAmmo <= Math.max(1, Math.ceil(weaponCfg.maxAmmo * 0.25));
  const dashReady = dashCooldown <= 0.05 && !fuelOverheated && boostFuel >= 18;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden touch-none">
      {/* 1. DYNAMIC MOVEMENT & JETPACK STICK */}
      {moveOrigin && (
        <div
          style={{
            left: moveOrigin.startX - 52,
            top: moveOrigin.startY - 52,
          }}
          className="absolute w-[104px] h-[104px] rounded-full bg-slate-950/60 backdrop-blur-md border border-cyan-400/60 flex items-center justify-center glow-cyan pointer-events-none"
        >
          <div className="absolute w-full h-px bg-cyan-400/20" />
          <div className="absolute h-full w-px bg-cyan-400/20" />
          <div
            ref={moveKnobRef}
            style={{ transform: 'translate3d(0px, 0px, 0)' }}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg border border-white/80 flex items-center justify-center pointer-events-none will-change-transform"
          >
            <div className="w-3 h-3 rounded-full bg-white/90" />
          </div>
        </div>
      )}

      {/* 2. DYNAMIC AIM & FIRE STICK */}
      {aimOrigin && (
        <div
          style={{
            left: aimOrigin.startX - 60,
            top: aimOrigin.startY - 60,
          }}
          className={`absolute w-[120px] h-[120px] rounded-full bg-slate-950/60 backdrop-blur-md flex items-center justify-center pointer-events-none border ${
            touchAimMode === 'precision' && !precisionAutoFiring
              ? 'border-amber-400/65'
              : 'border-rose-500/65 glow-red'
          }`}
        >
          <div
            className={`w-[92px] h-[92px] rounded-full border border-dashed absolute ${
              touchAimMode === 'precision'
                ? precisionAutoFiring
                  ? 'border-rose-400/80'
                  : 'border-amber-300/45'
                : 'border-rose-400/45 w-14 h-14'
            }`}
          />
          <div
            ref={aimKnobRef}
            style={{ transform: 'translate3d(0px, 0px, 0)' }}
            className={`w-12 h-12 rounded-full border border-white/90 shadow-lg flex items-center justify-center pointer-events-none will-change-transform ${
              touchAimMode === 'precision' && !precisionAutoFiring
                ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                : 'bg-gradient-to-br from-rose-500 to-red-600'
            }`}
          >
            {touchAimMode === 'precision' && !precisionAutoFiring ? (
              <Crosshair className="w-4 h-4 text-slate-950" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-white" />
            )}
          </div>
        </div>
      )}

      {/* 3. SLEEK CHAMFERED THUMB CONTROLS (Quick Arsenal + Dash + Optional Boost) */}
      <div
        data-no-joystick="true"
        style={
          isLeftHanded
            ? {
                marginLeft: 'env(safe-area-inset-left, 0px)',
                marginBottom: 'env(safe-area-inset-bottom, 0px)',
              }
            : {
                marginRight: 'env(safe-area-inset-right, 0px)',
                marginBottom: 'env(safe-area-inset-bottom, 0px)',
              }
        }
        className={`absolute bottom-3 short:bottom-2.5 sm:tall:bottom-5 flex items-end gap-2 pointer-events-auto ${
          isLeftHanded ? 'left-3 sm:left-4 flex-row-reverse' : 'right-3 sm:right-4'
        }`}
      >
        {/* Weapon Cycle + Quick Arsenal Drawer */}
        <div className="relative flex flex-col items-center gap-1">
          {arsenalOpen && (
            <div
              data-no-joystick="true"
              className={`absolute bottom-full mb-2 ${
                isLeftHanded ? 'left-0' : 'right-0'
              } cyber-panel clip-chamfer p-1.5 border border-cyan-500/50 bg-slate-950/95 backdrop-blur-md shadow-2xl flex flex-col gap-1 min-w-[138px] animate-in fade-in slide-in-from-bottom-2 duration-100`}
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
            className={`px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-widest border clip-chamfer flex items-center gap-1 transition cursor-pointer ${
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
            className={`relative overflow-hidden w-14 h-12 sm:w-16 sm:h-14 bg-slate-950/75 hover:bg-slate-900 border backdrop-blur-md flex flex-col items-center justify-center text-cyan-200 clip-chamfer shadow-xl cursor-pointer active:scale-95 transition ${
              isLowAmmo ? 'border-amber-400/75' : 'border-cyan-500/50'
            }`}
            title="Switch Weapon"
          >
            <div className="flex items-center gap-1 text-[9px] font-mono font-black uppercase text-white">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: weaponCfg.color }}
              />
              <span>{weaponMeta.tag}</span>
              <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
            </div>
            <span
              className={`text-[10px] font-mono font-bold mt-0.5 ${
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

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
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
            className={`w-14 h-11 sm:w-16 sm:h-12 clip-chamfer backdrop-blur-md flex flex-col items-center justify-center border transition cursor-pointer shadow-xl ${
              isDashingDirect && dashReady
                ? 'bg-cyan-400/90 border-white text-slate-950 scale-95 glow-cyan'
                : dashReady
                  ? 'bg-sky-950/80 hover:bg-sky-900/80 border-cyan-400/70 text-cyan-200 glow-cyan'
                  : 'bg-slate-950/65 border-slate-700/70 text-slate-500 opacity-75'
            }`}
            title="Thruster Air-Dash"
          >
            <Wind className={`w-4 h-4 ${dashReady ? 'text-cyan-300' : 'text-slate-500'}`} />
            <span className="text-[8px] font-mono font-black uppercase tracking-wider leading-none mt-0.5">
              {dashCooldown > 0.05 ? `${dashCooldown.toFixed(1)}s` : 'Dash'}
            </span>
          </button>

          {showTouchBoostButton && (
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                lastButtonTouchMsRef.current.boost = performance.now();
                handleBoostStart();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                lastButtonTouchMsRef.current.boost = performance.now();
                handleBoostEnd();
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                lastButtonTouchMsRef.current.boost = performance.now();
                handleBoostEnd();
              }}
              onMouseDown={() => {
                if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.boost)) return;
                handleBoostStart();
              }}
              onMouseUp={() => {
                if (shouldIgnoreSyntheticMouse(lastButtonTouchMsRef.current.boost)) return;
                handleBoostEnd();
              }}
              onMouseLeave={() => {
                if (isBoostingDirectRef.current) handleBoostEnd();
              }}
              className={`w-14 h-14 sm:w-16 sm:h-16 clip-chamfer backdrop-blur-md flex flex-col items-center justify-center text-white border transition cursor-pointer shadow-xl ${
                isBoostingDirect
                  ? 'bg-amber-500/90 border-amber-200 scale-95 glow-amber'
                  : 'bg-amber-950/75 hover:bg-amber-900/80 border-amber-400/65 text-amber-200 glow-amber'
              }`}
              title="Jetpack Boost"
            >
              <Flame className="w-5 h-5 text-amber-300" />
              <span className="text-[8px] font-mono font-black uppercase tracking-wider mt-0.5">
                Boost
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 4. QUIET PASSIVE TOUCH HINTS (Only when idle; adapts automatically to left-handed mode) */}
      {showTouchHints && !moveOrigin && (
        <div
          style={
            isLeftHanded
              ? {
                  marginRight: 'env(safe-area-inset-right, 0px)',
                  marginBottom: 'env(safe-area-inset-bottom, 0px)',
                }
              : {
                  marginLeft: 'env(safe-area-inset-left, 0px)',
                  marginBottom: 'env(safe-area-inset-bottom, 0px)',
                }
          }
          className={`absolute bottom-8 short:bottom-4 pointer-events-none opacity-30 flex flex-col items-center gap-1 ${
            isLeftHanded ? 'right-6' : 'left-5'
          }`}
        >
          <div className="w-12 h-12 rounded-full border border-dashed border-cyan-400/60 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-cyan-400/60" />
          </div>
          <span className="text-[8px] font-mono text-cyan-300 tracking-widest uppercase">
            Move / Up Boost
          </span>
        </div>
      )}

      {showTouchHints && !aimOrigin && (
        <div
          style={
            isLeftHanded
              ? {
                  marginLeft: 'env(safe-area-inset-left, 0px)',
                  marginBottom: 'env(safe-area-inset-bottom, 0px)',
                }
              : {
                  marginRight: 'env(safe-area-inset-right, 0px)',
                  marginBottom: 'env(safe-area-inset-bottom, 0px)',
                }
          }
          className={`absolute bottom-8 short:bottom-4 pointer-events-none opacity-30 hidden short-wide:flex sm:flex flex-col items-center gap-1 ${
            isLeftHanded ? 'left-36' : 'right-36'
          }`}
        >
          <div className="w-12 h-12 rounded-full border border-dashed border-rose-400/60 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-rose-400/60" />
          </div>
          <span className="text-[8px] font-mono text-rose-300 tracking-widest uppercase">
            {touchAimMode === 'precision' ? 'Aim • Edge Fire' : 'Aim / Fire'}
          </span>
        </div>
      )}
    </div>
  );
}
