import { useState, useEffect, useRef } from 'react';
import { useHolodeckStore } from '../game/holodeckStore';
import { useCTFStore } from '../../ctf/ctfStore';
import { HOLODECK_WEAPONS } from '../core/types';
import { useIsTouchHUD } from '../../controls/useIsTouchHUD';
import { useSettingsStore } from '../../settings/settingsStore';
import { sounds } from '../../audio/soundEngine';
import { HolodeckMinimapView } from './HolodeckMinimapView';
import { HudCommsOverlay, VoiceMicButton } from '../../comms/CommsPanel';
import { useNetworkStore } from '../../network/networkStore';
import {
  Bomb,
  Crosshair,
  Skull,
  Sliders,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';

interface HolodeckHUDProps {
  onExitToWarRoom: () => void;
  onAbortRoom?: () => void;
  isPointerLocked?: boolean;
  virtualControlsMode?: 'auto' | 'always_on' | 'off';
  onChangeVirtualControlsMode?: (mode: 'auto' | 'always_on' | 'off') => void;
}

export function HolodeckHUD({
  onExitToWarRoom,
  onAbortRoom,
  isPointerLocked = false,
  virtualControlsMode = 'auto',
  onChangeVirtualControlsMode,
}: HolodeckHUDProps) {
  const roundTimerSec = useHolodeckStore((s) => s.roundTimerSec);
  const scoreAttackers = useHolodeckStore((s) => s.scoreAttackers);
  const scoreDefenders = useHolodeckStore((s) => s.scoreDefenders);
  const spike = useHolodeckStore((s) => s.spike);
  const localPlayer = useHolodeckStore((s) => s.localPlayer);
  const killFeed = useHolodeckStore((s) => s.killFeed);
  const switchWeapon = useHolodeckStore((s) => s.switchWeapon);

  const matchRules = useCTFStore((s) => s.matchRules);
  const activeMode = matchRules.mode;
  const roomCode = useNetworkStore((s) => s.roomCode);

  const isTouchHUD = useIsTouchHUD();
  const showVirtualControls =
    virtualControlsMode === 'always_on' || (virtualControlsMode !== 'off' && isTouchHUD);

  const sfxMuted = useSettingsStore((s) => s.sfxMuted);
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const toggleMute = useSettingsStore((s) => s.toggleMute);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [menuOpen, setMenuOpen] = useState(false);
  const dockCooldownRef = useRef<HTMLDivElement | null>(null);

  const isBlue = localPlayer.team === 'blue';
  const isPlanted = spike.state === 'planted' || spike.state === 'defusing';

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hpPct = Math.max(0, Math.min(100, localPlayer.health));
  const shieldPct = Math.max(0, Math.min(100, (localPlayer.armor / 50) * 100));
  const visibleKillFeed = isTouchHUD ? killFeed.slice(-2) : killFeed.slice(-3);

  const isFFA = activeMode === 'ffa';
  const isTDM = activeMode === 'tdm';

  return (
    <>
      {/* --- TOP PERIMETER HUD STRIP --- */}
      <div
        data-no-joystick="true"
        className="fixed inset-x-0 top-0 safe-insets-top-x pointer-events-none z-20 flex flex-col items-center gap-1.5"
      >
        <div className="w-full flex items-start justify-between px-1.5 xs:px-2 pt-1.5 sm:px-3 sm:pt-2.5 gap-1.5">
          {/* Top-Left: Pilot Vitals & Cascading Killfeed */}
          <div className="flex flex-col items-start gap-1 pointer-events-auto min-w-0">
            <div
              className={`cyber-panel clip-chamfer px-2 xs:px-2.5 py-1 xs:py-1.5 sm:px-3 sm:py-1.5 flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 border-l-2 ${
                isBlue
                  ? 'border-l-cyan-400 border-y-cyan-500/30 border-r-cyan-500/30'
                  : 'border-l-rose-500 border-y-rose-500/30 border-r-rose-500/30'
              }`}
            >
              <div className="hidden md:flex flex-col pr-2 border-r border-slate-700/70">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none flex items-center gap-1">
                  <span className={isBlue ? 'text-cyan-300' : 'text-rose-400'}>
                    {isBlue ? '◆' : '▲'}
                  </span>
                  {isFFA ? 'FFA Solo' : isBlue ? 'Blue Unit' : 'Red Unit'}
                </span>
                <span className="text-xs font-black text-white font-mono leading-tight max-w-[96px] truncate">
                  {localPlayer.callsign}
                </span>
              </div>

              <div className="flex flex-col gap-1 xs:gap-1.5">
                {/* Health Bar */}
                <div className="flex items-center gap-1.5 xs:gap-2">
                  <span className="text-[10px] font-mono font-black text-rose-400 w-5 tracking-wider">
                    HP
                  </span>
                  <div className="w-20 xs:w-28 sm:w-36 h-3.5 bg-slate-950 rounded-xs overflow-hidden border border-slate-700/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] relative">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hpPct < 30
                          ? 'bg-gradient-to-r from-red-600 to-rose-500 animate-pulse'
                          : hpPct < 60
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400'
                      }`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono font-black min-w-[28px] text-right tabular-nums ${
                      hpPct < 30 ? 'text-rose-400 animate-pulse' : 'text-slate-100'
                    }`}
                  >
                    {Math.ceil(localPlayer.health)}
                  </span>
                </div>

                {/* Shield / Armor Bar */}
                <div className="flex items-center gap-1.5 xs:gap-2">
                  <span className="text-[10px] font-mono font-black text-cyan-400 w-5 tracking-wider">
                    SHD
                  </span>
                  <div className="w-20 xs:w-28 sm:w-36 h-3 bg-slate-950 rounded-xs overflow-hidden border border-slate-700/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] relative">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all duration-75"
                      style={{ width: `${shieldPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-black min-w-[28px] text-right tabular-nums text-cyan-300">
                    {localPlayer.armor}
                  </span>
                </div>

                {/* Tactical Sprint / Stamina Bar */}
                <div className="flex items-center gap-1.5 xs:gap-2">
                  <span className="text-[10px] font-mono font-black text-slate-400 w-5 tracking-wider flex items-center">
                    <Wind className="w-3 h-3 text-cyan-400" />
                  </span>
                  <div className="w-20 xs:w-28 sm:w-36 h-2 bg-slate-950 rounded-xs overflow-hidden border border-slate-700/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] relative">
                    <div
                      className={`h-full transition-all duration-75 ${
                        localPlayer.isSprinting
                          ? 'bg-gradient-to-r from-amber-400 to-rose-400'
                          : 'bg-gradient-to-r from-cyan-400 to-sky-300'
                      }`}
                      style={{ width: localPlayer.isGrounded ? '100%' : '40%' }}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-bold min-w-[28px] text-right tabular-nums text-cyan-300">
                    {localPlayer.isSprinting ? 'RUN' : localPlayer.isGrounded ? 'RDY' : 'AIR'}
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Kill Feed Strip (Cascades directly beneath Vitals on Left) */}
            {visibleKillFeed.length > 0 && (
              <div className="mt-0.5 flex flex-col items-start gap-1 pointer-events-none max-w-[200px] xs:max-w-[240px] sm:max-w-[300px]">
                {visibleKillFeed.map((kf) => (
                  <div
                    key={kf.id}
                    className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-950/80 border-l-2 border-slate-500/80 text-[10px] font-mono clip-chamfer backdrop-blur-xs shadow-sm animate-in fade-in slide-in-from-left-2 duration-150"
                  >
                    <span className="font-bold truncate max-w-[76px] text-rose-400">
                      {kf.killer}
                    </span>
                    <span className="text-[9px] px-1 py-px bg-slate-900 border border-slate-700 text-slate-300 font-black uppercase">
                      {kf.weapon.slice(0, 3)}
                    </span>
                    {kf.headshot && <Crosshair className="w-2.5 h-2.5 text-amber-400 inline shrink-0" />}
                    <span className="font-bold truncate max-w-[76px] text-cyan-400">
                      {kf.victim}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top-Center: Cyber Chamfer Match Header */}
          <div className="flex flex-col items-center pointer-events-auto">
            <div className="cyber-panel clip-chamfer px-2.5 py-1 sm:px-4 sm:py-1.5 flex items-center gap-2 sm:gap-3 border border-cyan-500/35 bg-slate-950/85 shadow-2xl backdrop-blur-md">
              {isTDM ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Skull className="w-3 h-3 text-cyan-400" />
                    <span className="hidden sm:inline text-[10px] font-mono font-bold text-cyan-300 uppercase">
                      Blue
                    </span>
                    <span className="text-base sm:text-lg font-black text-cyan-300 font-mono leading-none">
                      {scoreDefenders}
                    </span>
                  </div>

                  <div className="flex flex-col items-center px-2 border-x border-slate-700/70">
                    <span className="text-xs sm:text-sm font-black text-white font-mono leading-tight">
                      {formatTimer(roundTimerSec)}
                    </span>
                    <span className="text-[7.5px] text-amber-300 uppercase tracking-widest font-black leading-none">
                      TDM • FIRST TO 25
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg font-black text-rose-400 font-mono leading-none">
                      {scoreAttackers}
                    </span>
                    <span className="hidden sm:inline text-[10px] font-mono font-bold text-rose-300 uppercase">
                      Red
                    </span>
                    <Skull className="w-3 h-3 text-rose-400" />
                  </div>
                </>
              ) : isFFA ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.5 text-[8.5px] font-mono font-black bg-amber-500/20 border border-amber-400/50 text-amber-300">
                      KILLS
                    </span>
                    <span className="text-base sm:text-lg font-black text-amber-300 font-mono leading-none">
                      {localPlayer.kills}
                    </span>
                  </div>

                  <div className="flex flex-col items-center px-2 border-x border-slate-700/70">
                    <span className="text-xs sm:text-sm font-black text-white font-mono leading-tight">
                      {formatTimer(roundTimerSec)}
                    </span>
                    <span className="text-[7.5px] text-amber-300 uppercase tracking-widest font-black leading-none">
                      FFA • DEATHS {localPlayer.deaths}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[9.5px] font-mono font-black text-cyan-300 uppercase">
                      {localPlayer.callsign}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Defenders (Blue) */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                    <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase">
                      BLUE
                    </span>
                    <span className="text-base sm:text-lg font-black text-cyan-300 font-mono leading-none">
                      {scoreDefenders}
                    </span>
                  </div>

                  {/* Center Timer */}
                  <div className="flex flex-col items-center px-3 border-x border-slate-700/70">
                    <span className="text-xs sm:text-sm font-black text-white font-mono leading-tight">
                      {formatTimer(roundTimerSec)}
                    </span>
                    <span className="text-[7.5px] text-cyan-300 uppercase tracking-widest font-black leading-none">
                      {activeMode === 'ctf' ? 'FLAG STEAL' : 'TACTICAL ARENA'}
                    </span>
                  </div>

                  {/* Attackers (Red) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg font-black text-rose-400 font-mono leading-none">
                      {scoreAttackers}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-rose-300 uppercase">
                      RED
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  </div>
                </>
              )}
            </div>

            {/* Planted Alert Banner */}
            {isPlanted && (
              <div className="mt-1 cyber-panel clip-chamfer px-3 py-0.5 bg-rose-950/90 border border-rose-500 text-rose-200 text-[9.5px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg animate-pulse glow-red">
                <Bomb className="w-3 h-3 text-rose-400 shrink-0" />
                <span>DATA CORE ARMED AT SITE {spike.site || 'A'}</span>
              </div>
            )}
          </div>

          {/* Top-Right: Controls & Tactical Radar */}
          <div className="flex flex-col items-end gap-1 pointer-events-auto shrink-0">
            {/* Action Row */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {Boolean(roomCode) && <VoiceMicButton compact showLabelOnDesktop={false} />}

              {/* Audio Mute Toggle */}
              <button
                type="button"
                onClick={() => toggleMute()}
                className="min-w-[34px] min-h-[34px] px-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-300 hover:text-white transition cursor-pointer clip-chamfer flex items-center justify-center"
                title={sfxMuted ? 'Unmute Audio' : 'Mute Audio'}
                aria-label="Toggle Audio"
              >
                {sfxMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                )}
              </button>

              {/* Tactical Menu / Settings [ESC] */}
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setMenuOpen(true);
                }}
                className="min-w-[34px] min-h-[34px] px-2 sm:px-2.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 hover:text-white transition cursor-pointer clip-chamfer flex items-center justify-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider"
                title="Tactical Menu & Settings [Esc]"
                aria-label="Tactical Menu"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>

            {/* Tactical Radar Minimap */}
            <HolodeckMinimapView />
          </div>
        </div>
      </div>

      {/* --- SPECTATOR / DOWNED CARD --- */}
      {!localPlayer.isAlive && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/90 border border-rose-500/70 text-rose-100 px-3.5 py-1.5 text-[10px] sm:text-xs font-mono clip-chamfer glow-red flex flex-col items-center gap-1 min-w-[220px] shadow-xl animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-center">
            <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Suit Critical • Offline</span>
          </div>
          <span className="text-[9px] text-slate-400 uppercase tracking-widest">
            Spectating • Awaiting Next Round Reinforcements
          </span>
        </div>
      )}

      {/* Pointer Lock Help Prompt (Desktop only) */}
      {!isPointerLocked && !showVirtualControls && localPlayer.isAlive && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-2 bg-slate-950/90 border border-cyan-400/80 text-cyan-300 font-mono text-xs font-black uppercase clip-chamfer shadow-2xl flex items-center gap-2 glow-cyan animate-pulse">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <span>Click Game Screen To Lock Aim &amp; Fire [ESC To Pause]</span>
        </div>
      )}

      {/* --- BOTTOM-CENTER ARSENAL DOCK (Desktop Mode Only) --- */}
      {!showVirtualControls && (
        <div
          data-no-joystick="true"
          className="fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-[96vw] overflow-x-auto"
        >
          <div className="relative overflow-hidden cyber-panel clip-chamfer px-1 sm:px-1.5 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1 border border-cyan-500/30 shadow-2xl backdrop-blur-md bg-slate-950/85">
            {(['vandal', 'operator', 'classic', 'knife'] as const).map((wId, idx) => {
              const active = localPlayer.activeWeaponId === wId;
              const cfg = HOLODECK_WEAPONS[wId];
              const wAmmo = localPlayer.ammo[wId] || { clip: 0, reserve: 0 };
              const isLow = cfg.category !== 'melee' && wAmmo.clip <= Math.ceil(cfg.magazineSize * 0.25);
              return (
                <button
                  key={wId}
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    switchWeapon(wId);
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider transition clip-chamfer ${
                    active
                      ? isLow
                        ? 'bg-amber-500/20 border border-amber-400 text-white font-black'
                        : 'bg-cyan-500/20 border border-cyan-400 text-white font-black glow-cyan'
                      : 'bg-slate-950/70 border border-transparent text-slate-400 hover:text-white font-bold'
                  }`}
                  title={`${cfg.name} [Key ${idx + 1}]`}
                >
                  <span
                    className={`text-[8.5px] px-1 ${
                      active ? 'bg-cyan-400 text-slate-950 font-black' : 'text-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span>{cfg.name.split(' ')[0]}</span>
                  <span className={`${isLow ? 'text-amber-300' : 'text-cyan-300'} pl-0.5 font-bold`}>
                    {cfg.category === 'melee' ? '∞' : `${wAmmo.clip}/${wAmmo.reserve}`}
                  </span>
                </button>
              );
            })}
            <div
              ref={dockCooldownRef}
              style={{ transform: 'scaleX(0)' }}
              className="absolute bottom-0 inset-x-0 h-0.5 bg-cyan-400/90 origin-left pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* --- SQUAD COMMS OVERLAY (Quick Emojis, Chat Drawer & Voice Speakers) --- */}
      <HudCommsOverlay isTouchHUD={showVirtualControls} />

      {/* --- TACTICAL MENU MODAL (ESC / [MENU] BUTTON) --- */}
      {menuOpen && (
        <div
          data-no-joystick="true"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 select-none animate-in fade-in duration-100"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-panel clip-chamfer-lg max-w-sm w-full border border-cyan-500/45 shadow-2xl flex flex-col bg-slate-950/95"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 clip-chamfer bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Tactical Deployment
                  </h3>
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                    Holodeck 3D Matrix
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-400 clip-chamfer cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-3 font-mono text-xs">
              {/* Virtual Controls Toggle */}
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 clip-chamfer flex items-center justify-between">
                <div>
                  <span className="font-bold text-cyan-300 text-xs block">Virtual Controls</span>
                  <span className="text-[9px] text-slate-500">Touch thumbsticks &amp; buttons</span>
                </div>
                <div className="flex items-center gap-1">
                  {(['auto', 'always_on', 'off'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChangeVirtualControlsMode?.(opt)}
                      className={`px-2 py-1 text-[9.5px] uppercase font-bold clip-chamfer cursor-pointer transition ${
                        virtualControlsMode === opt
                          ? 'bg-cyan-500 text-slate-950 font-black glow-cyan'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt === 'auto' ? 'Auto' : opt === 'always_on' ? 'On' : 'Off'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Volume */}
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 clip-chamfer flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-slate-300 text-[10px]">
                  <span>Audio Volume</span>
                  <span className="text-cyan-300 font-bold">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer glow-cyan"
                >
                  Resume Combat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onExitToWarRoom();
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer"
                >
                  Exit to War Room
                </button>
                {onAbortRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onAbortRoom();
                    }}
                    className="w-full py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-bold text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer"
                  >
                    Abort Match
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
