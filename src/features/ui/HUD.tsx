import { useEffect, useState } from 'react';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import { useMatchStatsStore, formatWeaponShortLabel } from '../combat/statsStore';
import type { WeaponType } from '../combat/types';
import { useCTFStore } from '../ctf/ctfStore';
import { useNetworkStore } from '../network/networkStore';
import { useMapStore } from '../map/mapStore';
import { useSettingsStore } from '../settings/settingsStore';
import { WEAPONS } from '../combat/weaponsConfig';
import { useIsTouchHUD } from '../controls/useIsTouchHUD';
import { sounds } from '../audio/soundEngine';
import { networkManager } from '../network/peerRoom';
import { formatMatchClock } from './hudUtils';
import { ScoreboardOverlay } from './ScoreboardOverlay';
import {
  Flag,
  LogOut,
  Music,
  RefreshCw,
  Skull,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  Wind,
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
  const setEquippedWeapon = useCombatStore((s) => s.setEquippedWeapon);
  const statsByPlayerId = useMatchStatsStore((s) => s.statsByPlayerId);
  const killFeed = useMatchStatsStore((s) => s.killFeed);
  const score = useCTFStore((s) => s.score);
  const targetCaptures = useCTFStore((s) => s.targetCaptures);
  const timeRemainingSec = useCTFStore((s) => s.timeRemainingSec);
  const isOvertime = useCTFStore((s) => s.isOvertime);
  const matchRules = useCTFStore((s) => s.matchRules);
  const bannerMessage = useCTFStore((s) => s.bannerMessage);
  const flags = useCTFStore((s) => s.flags);
  const selectedMap = useMapStore((s) => s.selectedMap);

  const isMuted = useSettingsStore((s) => s.sfxMuted);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleMute);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const isTouchHUD = useIsTouchHUD();

  const [tabHeld, setTabHeld] = useState(false);
  const [manualScoreboardOpen, setManualScoreboardOpen] = useState(false);

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

  return (
    <>
      {/* TOP PERIMETER HUD STRIP */}
      <div
        data-no-joystick="true"
        className="fixed inset-x-0 top-0 pointer-events-none z-20 flex flex-col items-center px-2 pt-1.5 sm:px-3 sm:pt-2.5 gap-1.5"
      >
        <div className="w-full flex items-start justify-between gap-2">
          {/* Top-Left: Compact Telemetry Vitals (HP + JET) & Carrier Alert */}
          <div className="flex flex-col items-start gap-1 pointer-events-auto">
            <div
              className={`cyber-panel clip-chamfer px-2.5 py-1.5 sm:px-3 sm:py-1.5 flex items-center gap-2 sm:gap-2.5 border-l-2 ${
                isBlue
                  ? 'border-l-cyan-400 border-y-cyan-500/30 border-r-cyan-500/30'
                  : 'border-l-rose-500 border-y-rose-500/30 border-r-rose-500/30'
              }`}
            >
              <div className="hidden md:flex flex-col pr-2 border-r border-slate-700/70">
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest leading-none">
                  {isBlue ? 'Blue Unit' : 'Red Unit'}
                </span>
                <span className="text-xs font-black text-white font-mono leading-tight max-w-[92px] truncate">
                  {player.avatar.callsign}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {/* Health Bar */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] sm:text-[9px] font-mono font-black text-rose-400 w-4 tracking-wider">
                    HP
                  </span>
                  <div className="w-12 sm:w-24 h-1.5 bg-slate-950 rounded-xs overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-75"
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-200 min-w-[20px] text-right">
                    {Math.ceil(player.health)}
                  </span>
                </div>

                {/* Jetpack Fuel Bar */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[8px] sm:text-[9px] font-mono font-black w-4 tracking-wider ${
                      player.fuelOverheated ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  >
                    JET
                  </span>
                  <div className="w-12 sm:w-24 h-1.5 bg-slate-950 rounded-xs overflow-hidden border border-slate-800">
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
                    className={`text-[9px] sm:text-[10px] font-mono min-w-[20px] text-right ${
                      player.fuelOverheated ? 'text-amber-300' : 'text-cyan-300/90'
                    }`}
                  >
                    {Math.round(fuelPct)}%
                  </span>
                </div>

                {/* Thruster Dash Bar */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[8px] sm:text-[9px] font-mono font-black w-4 tracking-wider flex items-center gap-0.5 ${
                      dashReady ? 'text-sky-300' : 'text-slate-500'
                    }`}
                    title="Thruster Air-Dash [Shift]"
                  >
                    <Wind className="w-2.5 h-2.5 shrink-0" />
                  </span>
                  <div className="w-12 sm:w-24 h-1 bg-slate-950 rounded-xs overflow-hidden border border-slate-800">
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
                    className={`text-[8px] sm:text-[9px] font-mono font-bold min-w-[20px] text-right ${
                      dashReady ? 'text-cyan-300' : 'text-slate-400'
                    }`}
                  >
                    {dashCooldown > 0.05 ? `${dashCooldown.toFixed(1)}s` : dashReady ? 'RDY' : 'LOW'}
                  </span>
                </div>
              </div>
            </div>

            {player.carryingFlag && (
              <div className="bg-amber-950/90 border border-amber-400/70 text-amber-200 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider clip-chamfer flex items-center gap-1.5 glow-amber animate-pulse pointer-events-none">
                <Flag className="w-3 h-3 text-amber-300 shrink-0" />
                <span>Flag Secured • Return to Base</span>
              </div>
            )}

            {/* Compact Kill Feed Strip */}
            {killFeed.length > 0 && (
              <div className="mt-0.5 flex flex-col items-start gap-1 pointer-events-none max-w-[250px] sm:max-w-[300px]">
                {killFeed.map((evt) => {
                  const isHazardOrSelf = evt.weaponType === 'hazard' || evt.weaponType === 'self';
                  const killerColor = evt.killerTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300';
                  const victimColor = evt.victimTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300';
                  return (
                    <div
                      key={evt.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-950/75 border-l-2 border-slate-500/80 text-[9px] sm:text-[10px] font-mono clip-chamfer backdrop-blur-xs shadow-sm animate-in fade-in slide-in-from-left-2 duration-150"
                    >
                      {isHazardOrSelf ? (
                        <>
                          <Skull className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className={`font-bold truncate max-w-[92px] ${victimColor}`}>
                            {evt.victimCallsign}
                          </span>
                          <span className="text-[8px] px-1 py-px bg-amber-950/80 border border-amber-500/40 text-amber-300 font-black uppercase">
                            {formatWeaponShortLabel(evt.weaponType)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={`font-bold truncate max-w-[82px] ${killerColor}`}>
                            {evt.killerCallsign}
                          </span>
                          <span className="text-[8px] px-1 py-px bg-slate-900 border border-slate-700 text-slate-300 font-black uppercase">
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
          <div className="cyber-panel clip-chamfer px-2.5 py-1 sm:px-4 sm:py-1.5 flex items-center gap-2 sm:gap-3 border border-cyan-500/35 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <Flag
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                  flags.blue.status !== 'at_base'
                    ? 'text-amber-400 animate-pulse'
                    : 'text-cyan-400'
                }`}
              />
              <span className="hidden sm:inline text-[9px] font-mono font-bold text-cyan-300/80 uppercase tracking-wider">
                Blue
              </span>
              <span className="text-sm sm:text-lg font-black text-cyan-300 font-mono leading-none">
                {score.blue}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500 font-mono text-xs font-black">
              {isOvertime ? (
                <span
                  className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/70 text-amber-300 animate-pulse"
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
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest border-x border-slate-700/70 px-1.5">
                  FT{targetCaptures}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-lg font-black text-rose-400 font-mono leading-none">
                {score.red}
              </span>
              <span className="hidden sm:inline text-[9px] font-mono font-bold text-rose-300/80 uppercase tracking-wider">
                Red
              </span>
              <Flag
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                  flags.red.status !== 'at_base'
                    ? 'text-amber-400 animate-pulse'
                    : 'text-rose-400'
                }`}
              />
            </div>
          </div>

          {/* Top-Right: Scoreboard, Audio & Exit Bar */}
          <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                setManualScoreboardOpen((open) => !open);
              }}
              className={`p-1.5 sm:p-2 bg-slate-950/85 hover:bg-slate-900 border transition cursor-pointer clip-chamfer ${
                manualScoreboardOpen
                  ? 'border-cyan-400 text-cyan-200 glow-cyan'
                  : 'border-slate-700/80 hover:border-cyan-400/50 text-slate-300 hover:text-white'
              }`}
              title="Tactical Scoreboard [Tab]"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                updateSettings({ musicEnabled: !musicEnabled });
                sounds.playUiClick();
              }}
              className={`p-1.5 sm:p-2 bg-slate-950/85 hover:bg-slate-900 border transition cursor-pointer clip-chamfer ${
                musicEnabled
                  ? 'border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
                  : 'border-slate-700/80 text-slate-500 hover:text-slate-300'
              }`}
              title={musicEnabled ? 'Mute Background Music' : 'Enable Background Music'}
            >
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleSound()}
              title={isMuted ? 'Unmute SFX' : 'Mute SFX'}
              className="p-1.5 sm:p-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-300 hover:text-white transition cursor-pointer clip-chamfer"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                onExitToWarRoom();
              }}
              className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 bg-slate-950/85 hover:bg-rose-950/75 border border-rose-500/40 hover:border-rose-400 text-rose-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer"
              title={roomCode ? (isHost ? 'Return Squad to War Room' : 'Leave Battle') : 'Leave Practice Range'}
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="hidden sm:inline">
                {roomCode && isHost ? 'War Room' : 'Leave'}
              </span>
            </button>
          </div>
        </div>

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
              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-400/30 border border-amber-400/60 text-amber-100 text-[9px] font-black uppercase clip-chamfer transition cursor-pointer flex items-center gap-1"
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
              className="px-2 py-0.5 bg-rose-600/85 hover:bg-rose-500 border border-rose-400/70 text-white text-[9px] font-black uppercase clip-chamfer transition cursor-pointer"
            >
              Exit Room
            </button>
          </div>
        )}

        {/* Non-blocking Transient Status / Respawn Toast */}
        {player.isDead ? (
          <div className="bg-rose-950/90 border border-rose-400/70 text-rose-100 px-3.5 py-1 text-[10px] sm:text-xs font-mono font-black uppercase tracking-widest clip-chamfer glow-red pointer-events-none">
            Suit Critical • Redeploy in {Math.max(1, Math.ceil(player.respawnTimer))}s
          </div>
        ) : bannerMessage ? (
          <div className="bg-slate-950/85 border border-cyan-400/50 text-cyan-200 px-3.5 py-1 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest clip-chamfer backdrop-blur-md flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150 pointer-events-none">
            <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
        ) : null}
      </div>

      {/* DESKTOP BOTTOM-CENTER ARSENAL DOCK (Hidden cleanly on mobile touch screens) */}
      {!isTouchHUD && (
        <div
          data-no-joystick="true"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
        >
          <div className="cyber-panel clip-chamfer px-1.5 py-1 flex items-center gap-1 border border-cyan-500/30 shadow-2xl">
            {ARSENAL_SLOTS.map((slot) => {
              const active = equippedWeapon === slot.id;
              const cfg = WEAPONS[slot.id];
              const isUnlimited = cfg.maxAmmo === Infinity;
              const slotAmmo = ammoByWeapon[slot.id] ?? 0;
              const hasAmmo = isUnlimited || slotAmmo > 0;
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
                      ? 'bg-cyan-500/20 border border-cyan-400 text-white font-black glow-cyan cursor-pointer'
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
                      active ? 'bg-cyan-400 text-slate-950 font-black' : 'text-slate-500'
                    }`}
                  >
                    {slot.keyHint}
                  </span>
                  <span>{slot.shortLabel}</span>
                  {active ? (
                    <span className="text-cyan-300 pl-0.5">
                      {isUnlimited ? '∞' : `${currentAmmo}/${cfg.maxAmmo}`}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-500 pl-0.5">
                      {isUnlimited ? '∞' : slotAmmo}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
    </>
  );
}
