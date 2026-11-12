import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import { useMatchStatsStore, formatWeaponShortLabel } from '../combat/statsStore';
import type { WeaponType } from '../combat/types';
import { useCTFStore, type BannerTone } from '../ctf/ctfStore';
import { useNetworkStore } from '../network/networkStore';
import { useMapStore } from '../map/mapStore';
import { useSettingsStore } from '../settings/settingsStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { useIsTouchHUD } from '../controls/useIsTouchHUD';
import { sounds } from '../audio/soundEngine';
import { networkManager } from '../network/peerRoom';
import { formatMatchClock } from './hudUtils';
import { ScoreboardOverlay } from './ScoreboardOverlay';
import { InGameMenuModal } from './InGameMenuModal';
import { HudCommsOverlay, VoiceMicButton } from '../comms/CommsPanel';
import {
  AlertTriangle,
  Bomb,
  Flag,
  Pause,
  RefreshCw,
  RotateCw,
  Skull,
  SlidersHorizontal,
  Users,
  WifiOff,
  Wind,
  X,
  Zap,
} from 'lucide-react';

interface HUDProps {
  onExitToWarRoom: () => void;
  onAbortRoom?: () => void;
}

const ARSENAL_SLOTS: { id: WeaponType; shortLabel: string; keyHint: string }[] = [
  { id: 'rifle', shortLabel: 'Rifle', keyHint: '1' },
  { id: 'shotgun', shortLabel: 'Shotgun', keyHint: '2' },
  { id: 'sniper', shortLabel: 'Sniper', keyHint: '3' },
  { id: 'rocket', shortLabel: 'RPG', keyHint: '4' },
  { id: 'pistol', shortLabel: 'Pistol', keyHint: '5' },
];

const BANNER_STYLES: Record<BannerTone, string> = {
  cyan: 'bg-slate-950/85 border-cyan-400/55 text-cyan-200',
  blue: 'bg-sky-950/90 border-cyan-400/75 text-cyan-100 glow-cyan',
  red: 'bg-rose-950/90 border-rose-400/75 text-rose-100 glow-red',
  amber: 'bg-amber-950/90 border-amber-400/75 text-amber-200 glow-amber',
};

function checkPortraitPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth && window.innerWidth < 768;
}

export function HUD({ onExitToWarRoom, onAbortRoom }: HUDProps) {
  const player = usePlayerStore((s) => s.player);
  const isHost = useNetworkStore((s) => s.isHost);
  const roomCode = useNetworkStore((s) => s.roomCode);
  const hostSignalLost = useNetworkStore((s) => s.hostSignalLost);
  const hostDisconnectReason = useNetworkStore((s) => s.hostDisconnectReason);
  const hostReconnectAttempts = useNetworkStore((s) => s.hostReconnectAttempts);

  const equippedWeapon = useCombatStore((s) => s.equippedWeapon);
  const currentAmmo = useCombatStore((s) => s.currentAmmo);
  const ammoByWeapon = useCombatStore((s) => s.ammoByWeapon);
  const lastFiredAt = useCombatStore((s) => s.lastFiredAt);
  const grenades = useCombatStore((s) => s.grenades);
  const maxGrenades = useCombatStore((s) => s.maxGrenades);
  const ammoNotice = useCombatStore((s) => s.ammoNotice);
  const clearAmmoNotice = useCombatStore((s) => s.clearAmmoNotice);
  const setEquippedWeapon = useCombatStore((s) => s.setEquippedWeapon);

  const statsByPlayerId = useMatchStatsStore((s) => s.statsByPlayerId);
  const killFeed = useMatchStatsStore((s) => s.killFeed);
  const localDeathSummary = useMatchStatsStore((s) => s.localDeathSummary);
  const tacticalMenuOpen = useMatchStatsStore((s) => s.tacticalMenuOpen);
  const setTacticalMenuOpen = useMatchStatsStore((s) => s.setTacticalMenuOpen);

  const score = useCTFStore((s) => s.score);
  const targetCaptures = useCTFStore((s) => s.targetCaptures);
  const timeRemainingSec = useCTFStore((s) => s.timeRemainingSec);
  const isOvertime = useCTFStore((s) => s.isOvertime);
  const matchRules = useCTFStore((s) => s.matchRules);
  const bannerMessage = useCTFStore((s) => s.bannerMessage);
  const bannerTone = useCTFStore((s) => s.bannerTone);
  const flags = useCTFStore((s) => s.flags);
  const selectedMap = useMapStore((s) => s.selectedMap);

  const hudScale = useSettingsStore((s) => s.hudScale);
  const highContrast = useSettingsStore((s) => s.highContrastTeamMarkers);

  const isTouchHUD = useIsTouchHUD();

  const [tabHeld, setTabHeld] = useState(false);
  const [manualScoreboardOpen, setManualScoreboardOpen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(checkPortraitPhone);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  const dockCooldownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => setIsPortrait(checkPortraitPhone());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Auto-expire transient weapon empty toast
  useEffect(() => {
    if (!ammoNotice) return;
    const timer = window.setTimeout(() => clearAmmoNotice(), 2200);
    return () => window.clearTimeout(timer);
  }, [ammoNotice, clearAmmoNotice]);

  // Animate thin cooldown bar across desktop arsenal dock cleanly without React commits
  useEffect(() => {
    if (isTouchHUD) return;
    const fireRateMs = WEAPONS[equippedWeapon].fireRateMs;
    if (fireRateMs <= 0 || !lastFiredAt) {
      if (dockCooldownRef.current) {
        dockCooldownRef.current.style.transform = 'scaleX(0)';
      }
      return;
    }

    let rafId = 0;
    const tick = () => {
      const elapsed = performance.now() - lastFiredAt;
      const pct = Math.max(0, 1 - elapsed / fireRateMs);
      if (dockCooldownRef.current) {
        dockCooldownRef.current.style.transform = `scaleX(${pct})`;
      }
      if (pct > 0.01) {
        rafId = requestAnimationFrame(tick);
      } else if (dockCooldownRef.current) {
        dockCooldownRef.current.style.transform = 'scaleX(0)';
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isTouchHUD, equippedWeapon, lastFiredAt]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setTabHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setTabHeld(false);
      }
    };
    const clearTab = () => setTabHeld(false);
    const onVisibility = () => {
      if (document.hidden) setTabHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearTab);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearTab);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const isBlue = player.team === 'blue';
  const hpPct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
  const fuelPct = Math.max(0, Math.min(100, (player.boostFuel / player.maxFuel) * 100));
  const dashCooldown = player.dashCooldown ?? 0;
  const dashHasFuel = !player.fuelOverheated && player.boostFuel >= 18;
  const dashReady = dashCooldown <= 0.05 && dashHasFuel;
  const dashBarPct =
    dashCooldown > 0.05
      ? Math.max(0, Math.min(100, (1 - dashCooldown / 2.4) * 100))
      : dashHasFuel
        ? 100
        : 20;

  const showScoreboard = tabHeld || manualScoreboardOpen;
  const allStats = Object.values(statsByPlayerId);
  const sortRoster = (a: (typeof allStats)[number], b: (typeof allStats)[number]) =>
    b.captures * 100 + b.kills * 10 - b.deaths - (a.captures * 100 + a.kills * 10 - a.deaths);
  const blueStats = allStats.filter((s) => s.team === 'blue').sort(sortRoster);
  const redStats = allStats.filter((s) => s.team === 'red').sort(sortRoster);

  const visibleKillFeed = isTouchHUD ? killFeed.slice(-2) : killFeed;

  // Responsive HUD scale tokens
  const barWidthCls =
    hudScale === 'compact'
      ? 'w-8 xs:w-11 sm:w-20'
      : hudScale === 'large'
        ? 'w-12 xs:w-16 sm:w-28'
        : 'w-9 xs:w-14 sm:w-24';
  const vitalsLabelCls =
    hudScale === 'compact'
      ? 'text-[9px] sm:text-[9px]'
      : hudScale === 'large'
        ? 'text-[10px] sm:text-[11px]'
        : 'text-[10px] sm:text-[10px]';
  const scoreDigitCls =
    hudScale === 'compact'
      ? 'text-sm sm:text-base'
      : hudScale === 'large'
        ? 'text-base sm:text-xl'
        : 'text-sm sm:text-lg';
  const panelPadCls =
    hudScale === 'compact'
      ? 'px-1.5 xs:px-2 py-1'
      : hudScale === 'large'
        ? 'px-2.5 xs:px-3 py-1.5 sm:px-3.5 sm:py-2'
        : 'px-2 xs:px-2.5 py-1 xs:py-1.5 sm:px-3 sm:py-1.5';

  const respawnTotal = Math.max(0.5, matchRules.respawnDelaySec);
  const respawnElapsedPct = player.isDead
    ? Math.max(0, Math.min(100, ((respawnTotal - player.respawnTimer) / respawnTotal) * 100))
    : 0;

  return (
    <>
      {/* TOP PERIMETER HUD STRIP */}
      <div
        data-no-joystick="true"
        className="fixed inset-x-0 top-0 safe-insets-top-x pointer-events-none z-20 flex flex-col items-center gap-1.5"
      >
        <div className="w-full flex flex-col items-center px-1.5 xs:px-2 pt-1.5 sm:px-3 sm:pt-2.5 gap-1.5">
          <div className="w-full flex items-start justify-between gap-1 xs:gap-2">
            {/* Top-Left: Telemetry Vitals (HP + JET + DASH) & Carrier Alert */}
            <div className="flex flex-col items-start gap-1 pointer-events-auto min-w-0">
              <div
                className={`cyber-panel clip-chamfer ${panelPadCls} flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 border-l-2 ${
                  isBlue
                    ? 'border-l-cyan-400 border-y-cyan-500/30 border-r-cyan-500/30'
                    : 'border-l-rose-500 border-y-rose-500/30 border-r-rose-500/30'
                }`}
              >
                <div className="hidden md:flex flex-col pr-2 border-r border-slate-700/70">
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none flex items-center gap-1">
                    {highContrast && (
                      <span className={isBlue ? 'text-cyan-300' : 'text-rose-400'}>
                        {isBlue ? '◆' : '▲'}
                      </span>
                    )}
                    {isBlue ? 'Blue Unit' : 'Red Unit'}
                  </span>
                  <span className="text-xs font-black text-white font-mono leading-tight max-w-[96px] truncate">
                    {player.avatar.callsign}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 xs:gap-1">
                  {/* Health Bar */}
                  <div className="flex items-center gap-1 xs:gap-1.5">
                    <span
                      className={`${vitalsLabelCls} font-mono font-black text-rose-400 w-4 tracking-wider`}
                    >
                      HP
                    </span>
                    <div
                      className={`${barWidthCls} h-1.5 bg-slate-950 rounded-xs overflow-hidden border border-slate-800`}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-75"
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                    <span
                      className={`${vitalsLabelCls} font-mono font-bold text-slate-200 min-w-[20px] text-right tabular-nums`}
                    >
                      {Math.ceil(player.health)}
                    </span>
                  </div>

                  {/* Jetpack Fuel Bar */}
                  <div className="flex items-center gap-1 xs:gap-1.5">
                    <span
                      className={`${vitalsLabelCls} font-mono font-black w-4 tracking-wider ${
                        player.fuelOverheated ? 'text-amber-400' : 'text-cyan-400'
                      }`}
                    >
                      JET
                    </span>
                    <div
                      className={`${barWidthCls} h-1.5 bg-slate-950 rounded-xs overflow-hidden border border-slate-800`}
                    >
                      <div
                        className={`h-full transition-all duration-75 ${
                          player.fuelOverheated
                            ? 'bg-gradient-to-r from-rose-500 to-amber-400'
                            : 'bg-gradient-to-r from-sky-500 to-cyan-300'
                        }`}
                        style={{ width: `${fuelPct}%` }}
                      />
                    </div>
                    <span
                      className={`${vitalsLabelCls} font-mono min-w-[20px] text-right tabular-nums ${
                        player.fuelOverheated ? 'text-amber-300' : 'text-cyan-300/90'
                      }`}
                    >
                      {Math.round(fuelPct)}%
                    </span>
                  </div>

                  {/* Thruster Dash Bar */}
                  <div className="flex items-center gap-1 xs:gap-1.5">
                    <span
                      className={`${vitalsLabelCls} font-mono font-black w-4 tracking-wider flex items-center gap-0.5 ${
                        dashReady ? 'text-sky-300' : 'text-slate-500'
                      }`}
                      title="Thruster Air-Dash [Shift]"
                    >
                      <Wind className="w-2.5 h-2.5 shrink-0" />
                    </span>
                    <div
                      className={`${barWidthCls} h-1 bg-slate-950 rounded-xs overflow-hidden border border-slate-800`}
                    >
                      <div
                        className={`h-full transition-all duration-75 ${
                          dashReady
                            ? 'bg-gradient-to-r from-cyan-400 to-sky-300'
                            : dashCooldown > 0.05
                              ? 'bg-slate-500'
                              : 'bg-amber-500/70'
                        }`}
                        style={{ width: `${dashBarPct}%` }}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold min-w-[20px] text-right tabular-nums ${
                        dashReady ? 'text-cyan-300' : 'text-slate-400'
                      }`}
                    >
                      {dashCooldown > 0.05 ? `${dashCooldown.toFixed(1)}s` : dashReady ? 'RDY' : 'LOW'}
                    </span>
                  </div>
                </div>
              </div>

              {player.carryingFlag && (
                <div
                  className={`px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider clip-chamfer flex items-center gap-1.5 animate-pulse pointer-events-none border ${
                    flags[player.team].status === 'at_base'
                      ? 'bg-amber-950/90 border-amber-400/70 text-amber-200 glow-amber'
                      : 'bg-rose-950/90 border-rose-400/75 text-rose-200 glow-red'
                  }`}
                >
                  <Flag
                    className={`w-3 h-3 shrink-0 ${
                      flags[player.team].status === 'at_base' ? 'text-amber-300' : 'text-rose-300'
                    }`}
                  />
                  <span>
                    {flags[player.team].status === 'at_base'
                      ? 'Flag Secured • Return to Base'
                      : flags[player.team].status === 'carried'
                        ? 'Own Flag Stolen • Recover Flag to Score'
                        : `Own Flag Dropped (${Math.max(1, Math.ceil(flags[player.team].returnTimer))}s) • Return to Score`}
                  </span>
                </div>
              )}

              {/* Compact Kill Feed Strip (capped to 2 rows on touch screens so thumb stays clear) */}
              {visibleKillFeed.length > 0 && (
                <div className="mt-0.5 flex flex-col items-start gap-1 pointer-events-none max-w-[196px] xs:max-w-[240px] sm:max-w-[300px]">
                  {visibleKillFeed.map((evt) => {
                    const isHazardOrSelf = evt.weaponType === 'hazard' || evt.weaponType === 'self';
                    const killerColor = evt.killerTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300';
                    const victimColor = evt.victimTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300';
                    return (
                      <div
                        key={evt.id}
                        className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-950/75 border-l-2 border-slate-500/80 text-[10px] font-mono clip-chamfer backdrop-blur-xs shadow-sm animate-in fade-in slide-in-from-left-2 duration-150"
                      >
                        {isHazardOrSelf ? (
                          <>
                            <Skull className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span className={`font-bold truncate max-w-[92px] ${victimColor}`}>
                              {evt.victimCallsign}
                            </span>
                            <span className="text-[9px] px-1 py-px bg-amber-950/80 border border-amber-500/40 text-amber-300 font-black uppercase">
                              {formatWeaponShortLabel(evt.weaponType)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`font-bold truncate max-w-[82px] ${killerColor}`}>
                              {evt.killerCallsign}
                            </span>
                            <span className="text-[9px] px-1 py-px bg-slate-900 border border-slate-700 text-slate-300 font-black uppercase">
                              {formatWeaponShortLabel(evt.weaponType)}
                            </span>
                            <span className={`font-bold truncate max-w-[82px] ${victimColor}`}>
                              {evt.victimCallsign}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top-Center: Clean CTF Scoreboard Pill */}
            <div
              className={`cyber-panel clip-chamfer ${
                hudScale === 'compact'
                  ? 'px-2 py-1 sm:px-3'
                  : hudScale === 'large'
                    ? 'px-3 py-1.5 sm:px-5 sm:py-2'
                    : 'px-2 xs:px-2.5 py-1 sm:px-4 sm:py-1.5'
              } flex items-center gap-1.5 xs:gap-2 sm:gap-3 border border-cyan-500/35 pointer-events-auto shrink-0`}
            >
              <div className="flex items-center gap-1 xs:gap-1.5">
                {highContrast && <span className="text-[10px] text-cyan-300">◆</span>}
                <Flag
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                    flags.blue.status !== 'at_base'
                      ? 'text-amber-400 animate-pulse'
                      : 'text-cyan-400'
                  }`}
                />
                <span className="hidden sm:inline text-[10px] font-mono font-bold text-cyan-300/80 uppercase tracking-wider">
                  Blue
                </span>
                <span className={`${scoreDigitCls} font-black text-cyan-300 font-mono leading-none`}>
                  {score.blue}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 font-mono text-xs font-black">
                {isOvertime ? (
                  <span
                    className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/70 text-amber-300 animate-pulse"
                    title="Sudden-Death Overtime — Next capture wins!"
                  >
                    OT
                  </span>
                ) : matchRules.timeLimitSec > 0 ? (
                  <span
                    className={`text-[10px] sm:text-xs font-black tabular-nums px-1.5 border-x border-slate-700/70 ${
                      timeRemainingSec <= 10
                        ? 'text-rose-400 animate-pulse'
                        : timeRemainingSec <= 30
                          ? 'text-amber-300'
                          : 'text-slate-200'
                    }`}
                    title={`First to ${targetCaptures} Captures`}
                  >
                    {formatMatchClock(timeRemainingSec)}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest border-x border-slate-700/70 px-1.5">
                    FT{targetCaptures}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 xs:gap-1.5">
                <span className={`${scoreDigitCls} font-black text-rose-400 font-mono leading-none`}>
                  {score.red}
                </span>
                <span className="hidden sm:inline text-[10px] font-mono font-bold text-rose-300/80 uppercase tracking-wider">
                  Red
                </span>
                <Flag
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                    flags.red.status !== 'at_base'
                      ? 'text-amber-400 animate-pulse'
                      : 'text-rose-400'
                  }`}
                />
                {highContrast && <span className="text-[10px] text-rose-400">▲</span>}
              </div>
            </div>

            {/* Top-Right: Streamlined Ergonomic Actions (Voice + Scoreboard + Menu/Pause) */}
            <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
              {Boolean(roomCode) && <VoiceMicButton compact showLabelOnDesktop={false} />}

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setManualScoreboardOpen((open) => !open);
                }}
                className={`min-w-[36px] min-h-[36px] px-2 sm:px-2.5 bg-slate-950/85 hover:bg-slate-900 border transition cursor-pointer clip-chamfer flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                  manualScoreboardOpen
                    ? 'border-cyan-400 text-cyan-200 glow-cyan'
                    : 'border-slate-700/80 hover:border-cyan-400/50 text-slate-300 hover:text-white'
                }`}
                title="Tactical Scoreboard [Tab]"
                aria-label="Tactical Scoreboard"
              >
                <Users className="w-4 h-4" />
                <span className="hidden md:inline">Board</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setTacticalMenuOpen(!tacticalMenuOpen);
                }}
                className={`min-w-[36px] min-h-[36px] px-2 sm:px-2.5 bg-slate-950/85 hover:bg-slate-900 border transition cursor-pointer clip-chamfer flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                  tacticalMenuOpen
                    ? 'border-cyan-400 text-cyan-200 glow-cyan'
                    : 'border-slate-700/80 hover:border-cyan-400/50 text-slate-200 hover:text-white'
                }`}
                title="Tactical Menu & Settings [Esc]"
                aria-label="Tactical Menu"
              >
                {roomCode ? (
                  <SlidersHorizontal className="w-4 h-4 text-cyan-300" />
                ) : (
                  <Pause className="w-4 h-4 text-cyan-300" />
                )}
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>
          </div>

          {/* Portrait Orientation Recommendation for Touch Mobile */}
          {isTouchHUD && isPortrait && !portraitDismissed && (
            <div className="pointer-events-auto bg-slate-950/90 border border-cyan-500/45 text-cyan-200 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer backdrop-blur-md shadow-lg flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Rotate to Landscape for wider view (or tap − zoom)</span>
              <button
                type="button"
                onClick={() => setPortraitDismissed(true)}
                className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Dismiss rotate tip"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Host Disconnect Alert Banner (Non-blocking Cadet Uplink Warning) */}
          {!isHost && Boolean(roomCode) && hostSignalLost && (
            <div className="pointer-events-auto bg-amber-950/90 border border-amber-400/75 text-amber-100 px-3 py-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer backdrop-blur-md shadow-lg flex flex-wrap items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-pulse" />
              <span>
                Host Signal Lost • Reconnecting
                {hostReconnectAttempts > 0 ? ` (#${hostReconnectAttempts})` : '...'}
              </span>
              {hostDisconnectReason && (
                <span className="hidden md:inline text-[10px] font-normal text-amber-200/80 normal-case">
                  ({hostDisconnectReason})
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  networkManager.retryHostConnection();
                }}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-400/30 border border-amber-400/60 text-amber-100 text-[10px] font-black uppercase clip-chamfer transition cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  (onAbortRoom ?? onExitToWarRoom)();
                }}
                className="px-2 py-0.5 bg-rose-600/85 hover:bg-rose-500 border border-rose-400/70 text-white text-[10px] font-black uppercase clip-chamfer transition cursor-pointer"
              >
                Exit Room
              </button>
            </div>
          )}

          {/* Death Spectator Card / Status Toast */}
          {player.isDead ? (
            <div className="bg-slate-950/90 border border-rose-500/70 text-rose-100 px-3.5 py-1.5 text-[10px] sm:text-xs font-mono clip-chamfer glow-red pointer-events-none flex flex-col items-center gap-1 min-w-[220px] max-w-sm shadow-xl">
              <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-center">
                <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                {localDeathSummary ? (
                  <span>
                    Downed by{' '}
                    <span
                      className={
                        localDeathSummary.killerTeam === 'blue'
                          ? 'text-cyan-300'
                          : 'text-rose-300'
                      }
                    >
                      {localDeathSummary.killerCallsign}
                    </span>{' '}
                    • {formatWeaponShortLabel(localDeathSummary.weaponType)}
                  </span>
                ) : (
                  <span>Suit Critical</span>
                )}
              </div>
              <div className="w-full flex items-center gap-2 text-[9px] text-slate-300 uppercase tracking-widest">
                <span>Spectating</span>
                <div className="flex-1 h-1.5 bg-slate-900 rounded-xs overflow-hidden border border-rose-500/30">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-cyan-400 transition-all duration-100"
                    style={{ width: `${respawnElapsedPct}%` }}
                  />
                </div>
                <span className="text-cyan-300 font-black tabular-nums">
                  {Math.max(1, Math.ceil(player.respawnTimer))}s
                </span>
              </div>
            </div>
          ) : bannerMessage ? (
            <div
              className={`border px-3.5 py-1 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest clip-chamfer backdrop-blur-md flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150 pointer-events-none ${BANNER_STYLES[bannerTone]}`}
            >
              <Zap className="w-3 h-3 shrink-0" />
              <span>{bannerMessage}</span>
            </div>
          ) : null}

          {/* Transient Low/Empty Ammo Auto-Switch Toast */}
          {ammoNotice && (
            <div className="bg-amber-950/90 border border-amber-400/70 text-amber-200 px-3 py-0.5 text-[10px] font-mono font-black uppercase tracking-widest clip-chamfer flex items-center gap-1.5 pointer-events-none animate-in fade-in duration-100">
              <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
              <span>{ammoNotice.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP BOTTOM-CENTER ARSENAL DOCK (Hidden on mobile touch screens) */}
      {!isTouchHUD && (
        <div
          data-no-joystick="true"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
        >
          <div className="relative overflow-hidden cyber-panel clip-chamfer px-1.5 py-1 flex items-center gap-1 border border-cyan-500/30 shadow-2xl">
            {ARSENAL_SLOTS.map((slot) => {
              const active = equippedWeapon === slot.id;
              const cfg = WEAPONS[slot.id];
              const isUnlimited = cfg.maxAmmo === Infinity;
              const slotAmmo = ammoByWeapon[slot.id] ?? 0;
              const hasAmmo = isUnlimited || slotAmmo > 0;
              const isLowAmmo =
                !isUnlimited &&
                hasAmmo &&
                slotAmmo <= Math.max(1, Math.ceil(cfg.maxAmmo * 0.25));
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!hasAmmo}
                  onClick={() => {
                    if (hasAmmo && equippedWeapon !== slot.id) {
                      sounds.playUiClick();
                      setEquippedWeapon(slot.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition clip-chamfer ${
                    active
                      ? isLowAmmo
                        ? 'bg-amber-500/20 border border-amber-400 text-white font-black cursor-pointer'
                        : 'bg-cyan-500/20 border border-cyan-400 text-white font-black glow-cyan cursor-pointer'
                      : hasAmmo
                        ? 'bg-slate-950/70 border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 font-bold cursor-pointer'
                        : 'bg-slate-950/40 border border-transparent text-slate-600 font-bold opacity-45 cursor-not-allowed'
                  }`}
                  title={
                    hasAmmo
                      ? `${cfg.name} [Key ${slot.keyHint}]`
                      : `${cfg.name} (Out of ammo — find a crate)`
                  }
                >
                  <span
                    className={`text-[9px] px-1 ${
                      active
                        ? isLowAmmo
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'bg-cyan-400 text-slate-950 font-black'
                        : 'text-slate-500'
                    }`}
                  >
                    {slot.keyHint}
                  </span>
                  <span>{slot.shortLabel}</span>
                  {active ? (
                    <span className={`${isLowAmmo ? 'text-amber-300' : 'text-cyan-300'} pl-0.5`}>
                      {isUnlimited ? '∞' : `${currentAmmo}/${cfg.maxAmmo}`}
                    </span>
                  ) : (
                    <span
                      className={`text-[9px] pl-0.5 ${isLowAmmo ? 'text-amber-400/90' : 'text-slate-500'}`}
                    >
                      {isUnlimited ? '∞' : slotAmmo}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="h-5 w-px bg-slate-700/75 mx-0.5 shrink-0" />
            <button
              type="button"
              disabled={grenades <= 0}
              onClick={() => {
                if (grenades > 0) {
                  window.dispatchEvent(new CustomEvent('aerostrike:throw-grenade'));
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition clip-chamfer border ${
                grenades > 0
                  ? 'bg-lime-950/70 hover:bg-lime-900/70 border-lime-500/60 text-lime-200 font-bold cursor-pointer'
                  : 'bg-slate-950/40 border-transparent text-slate-600 font-bold opacity-45 cursor-not-allowed'
              }`}
              title={
                grenades > 0
                  ? 'Throw Frag Grenade [Key G or Right-Click]'
                  : 'Out of Frag Grenades — Resupply at Supply Crate'
              }
            >
              <span
                className={`text-[9px] px-1 ${
                  grenades > 0 ? 'bg-lime-400 text-slate-950 font-black' : 'text-slate-500'
                }`}
              >
                G
              </span>
              <Bomb className={`w-3 h-3 ${grenades > 0 ? 'text-lime-300' : 'text-slate-600'}`} />
              <span>Frag</span>
              <span className={grenades > 0 ? 'text-lime-300 font-black' : 'text-slate-500'}>
                {grenades}/{maxGrenades}
              </span>
            </button>
            <div
              ref={dockCooldownRef}
              style={{ transform: 'scaleX(0)' }}
              className="absolute bottom-0 inset-x-0 h-0.5 bg-cyan-400/90 origin-left pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* SQUAD COMMS OVERLAY (Quick Emojis, Chat Drawer & Speaking Strip) */}
      <HudCommsOverlay isTouchHUD={isTouchHUD} />

      {/* TAB TACTICAL SCOREBOARD OVERLAY */}
      <ScoreboardOverlay
        visible={showScoreboard}
        manualOpen={manualScoreboardOpen}
        onCloseManual={() => setManualScoreboardOpen(false)}
        roomCode={roomCode}
        selectedMap={selectedMap}
        targetCaptures={targetCaptures}
        isOvertime={isOvertime}
        matchRules={matchRules}
        timeRemainingSec={timeRemainingSec}
        score={score}
        blueStats={blueStats}
        redStats={redStats}
        localPlayerId={player.id}
        isTouchHUD={isTouchHUD}
      />

      {/* TACTICAL MENU / PAUSE & QUICK SETTINGS MODAL */}
      <InGameMenuModal
        open={tacticalMenuOpen}
        isTouchHUD={isTouchHUD}
        onClose={() => setTacticalMenuOpen(false)}
        onLeaveMatch={onExitToWarRoom}
      />
    </>
  );
}
