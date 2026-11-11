import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { useSettingsStore } from '../settings/settingsStore';
import { useIsTouchHUD } from './useIsTouchHUD';
import { Flame, RefreshCw, Wind } from 'lucide-react';

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
}

export function VirtualControls({ onFire, onSwitchWeapon }: VirtualControlsProps) {
  const isTouchHUD = useIsTouchHUD();
  const setInput = usePlayerStore((s) => s.setInput);
  const dashCooldown = usePlayerStore((s) => s.player.dashCooldown ?? 0);
  const boostFuel = usePlayerStore((s) => s.player.boostFuel);
  const fuelOverheated = usePlayerStore((s) => Boolean(s.player.fuelOverheated));
  const equippedWeapon = useCombatStore((s) => s.equippedWeapon);
  const currentAmmo = useCombatStore((s) => s.currentAmmo);
  const showTouchHints = useSettingsStore((s) => s.showTouchHints);

  // Origin coordinates only update on touchstart/touchend (zero touchmove React re-renders)
  const [leftOrigin, setLeftOrigin] = useState<StickOrigin | null>(null);
  const [rightOrigin, setRightOrigin] = useState<StickOrigin | null>(null);

  const leftTouchRef = useRef<ActiveStick | null>(null);
  const rightTouchRef = useRef<ActiveStick | null>(null);
  const leftKnobRef = useRef<HTMLDivElement | null>(null);
  const rightKnobRef = useRef<HTMLDivElement | null>(null);
  const aimGraceTimerRef = useRef<number | null>(null);

  const [isBoostingDirect, setIsBoostingDirect] = useState(false);
  const [isDashingDirect, setIsDashingDirect] = useState(false);
  const isBoostingDirectRef = useRef(false);
  const isDashingDirectRef = useRef(false);

  const clearAimGraceTimer = useCallback(() => {
    if (aimGraceTimerRef.current !== null) {
      window.clearTimeout(aimGraceTimerRef.current);
      aimGraceTimerRef.current = null;
    }
  }, []);

  const resetAllTouchControls = useCallback(() => {
    clearAimGraceTimer();
    leftTouchRef.current = null;
    rightTouchRef.current = null;
    isBoostingDirectRef.current = false;
    isDashingDirectRef.current = false;
    setLeftOrigin(null);
    setRightOrigin(null);
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
    const lt = leftTouchRef.current;
    const isLeftBoosting = lt ? lt.currentY - lt.startY < -22 : false;
    setInput({ boosting: isLeftBoosting });
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
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest('button, input, select, textarea, a, [role="button"], [data-no-joystick]')
      ) {
        return;
      }

      const halfWidth = window.innerWidth / 2;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        // Exclude top HUD bar
        if (clientY < 54) {
          continue;
        }

        // Left 50%: Movement & Jetpack Stick
        if (clientX < halfWidth && !leftTouchRef.current) {
          e.preventDefault();
          leftTouchRef.current = {
            id: identifier,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            dragged: false,
          };
          setLeftOrigin({ startX: clientX, startY: clientY });
        }
        // Right 50%: Aim & Fire Stick (excluding top-right Radar zone)
        else if (clientX >= halfWidth && !rightTouchRef.current) {
          if (clientX > window.innerWidth - 155 && clientY < 140) {
            continue;
          }

          e.preventDefault();
          rightTouchRef.current = {
            id: identifier,
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            dragged: false,
          };
          setRightOrigin({ startX: clientX, startY: clientY });

          // Brief aim-grace window avoids firing frame-0 shot along stale aimAngle when dragging
          clearAimGraceTimer();
          aimGraceTimerRef.current = window.setTimeout(() => {
            aimGraceTimerRef.current = null;
            if (rightTouchRef.current) {
              setInput({ shooting: true });
            }
          }, 80);
        }
      }
    },
    [isTouchHUD, clearAimGraceTimer, setInput],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isTouchHUD) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const { clientX, clientY, identifier } = touch;

        if (leftTouchRef.current && leftTouchRef.current.id === identifier) {
          e.preventDefault();
          const startX = leftTouchRef.current.startX;
          const startY = leftTouchRef.current.startY;
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

          leftTouchRef.current.currentX = currentX;
          leftTouchRef.current.currentY = currentY;
          if (leftKnobRef.current) {
            leftKnobRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
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

        if (rightTouchRef.current && rightTouchRef.current.id === identifier) {
          e.preventDefault();
          const startX = rightTouchRef.current.startX;
          const startY = rightTouchRef.current.startY;
          const maxDist = 60;

          const dx = clientX - startX;
          const dy = clientY - startY;
          const dist = Math.hypot(dx, dy);
          const clampedDist = Math.min(maxDist, dist);
          const angle = Math.atan2(dy, dx);

          const offsetX = Math.cos(angle) * clampedDist;
          const offsetY = Math.sin(angle) * clampedDist;
          rightTouchRef.current.currentX = startX + offsetX;
          rightTouchRef.current.currentY = startY + offsetY;
          if (rightKnobRef.current) {
            rightKnobRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
          }

          if (dist > 8) {
            rightTouchRef.current.dragged = true;
            clearAimGraceTimer();
            setInput({ aimAngle: angle, shooting: true });
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

        if (leftTouchRef.current && leftTouchRef.current.id === identifier) {
          e.preventDefault();
          leftTouchRef.current = null;
          setLeftOrigin(null);
          setInput({ moveX: 0, moveY: 0, boosting: isBoostingDirectRef.current });
        }

        if (rightTouchRef.current && rightTouchRef.current.id === identifier) {
          e.preventDefault();
          const wasQuickStationaryTap =
            aimGraceTimerRef.current !== null && !rightTouchRef.current.dragged;
          clearAimGraceTimer();
          rightTouchRef.current = null;
          setRightOrigin(null);
          setInput({ shooting: false });
          if (wasQuickStationaryTap) {
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

  // Do NOT render distracting mobile thumb controls on Desktop mouse/keyboard setups!
  if (!isTouchHUD) return null;

  const weaponCfg = WEAPONS[equippedWeapon];
  const ammoLabel = weaponCfg.maxAmmo === Infinity ? '∞' : `${currentAmmo}`;
  const dashReady = dashCooldown <= 0.05 && !fuelOverheated && boostFuel >= 18;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden touch-none">
      {/* 1. DYNAMIC LEFT MOVE STICK */}
      {leftOrigin && (
        <div
          style={{
            left: leftOrigin.startX - 52,
            top: leftOrigin.startY - 52,
          }}
          className="absolute w-[104px] h-[104px] rounded-full bg-slate-950/60 backdrop-blur-md border border-cyan-400/60 flex items-center justify-center glow-cyan pointer-events-none"
        >
          <div className="absolute w-full h-px bg-cyan-400/20" />
          <div className="absolute h-full w-px bg-cyan-400/20" />
          <div
            ref={leftKnobRef}
            style={{ transform: 'translate3d(0px, 0px, 0)' }}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg border border-white/80 flex items-center justify-center pointer-events-none will-change-transform"
          >
            <div className="w-3 h-3 rounded-full bg-white/90" />
          </div>
        </div>
      )}

      {/* 2. DYNAMIC RIGHT AIM & FIRE STICK */}
      {rightOrigin && (
        <div
          style={{
            left: rightOrigin.startX - 60,
            top: rightOrigin.startY - 60,
          }}
          className="absolute w-[120px] h-[120px] rounded-full bg-slate-950/60 backdrop-blur-md border border-rose-500/60 flex items-center justify-center glow-red pointer-events-none"
        >
          <div className="w-14 h-14 rounded-full border border-dashed border-rose-400/45 absolute" />
          <div
            ref={rightKnobRef}
            style={{ transform: 'translate3d(0px, 0px, 0)' }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-red-600 border border-white/90 shadow-lg flex items-center justify-center pointer-events-none will-change-transform"
          >
            <div className="w-3 h-3 rounded-full bg-white" />
          </div>
        </div>
      )}

      {/* 3. SLEEK CHAMFERED BOTTOM-RIGHT THUMB CONTROLS (Weapon + Dash + Boost) */}
      <div className="absolute right-3 bottom-4 sm:right-4 sm:bottom-5 flex items-end gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwitchWeapon();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSwitchWeapon();
          }}
          className="w-14 h-12 sm:w-16 sm:h-14 bg-slate-950/75 hover:bg-slate-900 border border-cyan-500/50 backdrop-blur-md flex flex-col items-center justify-center text-cyan-200 clip-chamfer shadow-xl cursor-pointer active:scale-95 transition"
          title="Switch Weapon"
        >
          <div className="flex items-center gap-1 text-[9px] font-mono font-black uppercase text-white">
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span>{equippedWeapon.slice(0, 3)}</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-cyan-300 mt-0.5">
            {ammoLabel}
          </span>
        </button>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDashStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDashEnd();
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDashEnd();
            }}
            onMouseDown={handleDashStart}
            onMouseUp={handleDashEnd}
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

          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBoostStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBoostEnd();
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBoostEnd();
            }}
            onMouseDown={handleBoostStart}
            onMouseUp={handleBoostEnd}
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
        </div>
      </div>

      {/* 4. QUIET PASSIVE TOUCH HINTS (Only when idle) */}
      {showTouchHints && !leftOrigin && (
        <div className="absolute left-5 bottom-8 pointer-events-none opacity-30 flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full border border-dashed border-cyan-400/60 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-cyan-400/60" />
          </div>
          <span className="text-[8px] font-mono text-cyan-300 tracking-widest uppercase">
            Move
          </span>
        </div>
      )}

      {showTouchHints && !rightOrigin && (
        <div className="absolute right-36 bottom-8 pointer-events-none opacity-30 hidden sm:flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full border border-dashed border-rose-400/60 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-rose-400/60" />
          </div>
          <span className="text-[8px] font-mono text-rose-300 tracking-widest uppercase">
            Aim / Fire
          </span>
        </div>
      )}
    </div>
  );
}
