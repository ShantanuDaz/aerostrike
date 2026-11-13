import { useEffect, useState } from 'react';
import {
  GAME_MODE_META,
  sanitizeMatchRules,
  type GameMode,
  type MatchRulesConfig,
  type MatchTimeLimitPreset,
  type RespawnDelayPreset,
  type TargetCapturesPreset,
} from '../../ctf/types';
import { useCTFStore } from '../../ctf/ctfStore';
import { useMapStore } from '../../map/mapStore';
import { sounds } from '../../audio/soundEngine';
import { MapSchematicPreview } from '../warRoom/MapSchematicPreview';
import { formatClockPreset, getCleanMapTitle, getMapModeTag } from '../warRoom/warRoomUtils';
import {
  Box,
  Clock,
  Crosshair,
  Flag,
  Map as MapIcon,
  Rocket,
  Skull,
  Swords,
  TimerReset,
  Trophy,
  X,
} from 'lucide-react';

export interface HostLaunchConfig {
  mapId: string;
  matchRules: MatchRulesConfig;
}

interface HostMatchModalProps {
  isOpen: boolean;
  is3DMode?: boolean;
  onClose: () => void;
  onConfirmHost: (config: HostLaunchConfig) => void;
}

const MODE_ICON: Record<GameMode, typeof Flag> = {
  ctf: Flag,
  tdm: Crosshair,
  ffa: Swords,
  holodeck: Box,
};

export function HostMatchModal({
  isOpen,
  is3DMode = false,
  onClose,
  onConfirmHost,
}: HostMatchModalProps) {
  const availableMaps = useMapStore((s) => s.availableMaps);
  const selectedMap = useMapStore((s) => s.selectedMap);
  const currentRules = useCTFStore((s) => s.matchRules);

  const initialMapId = is3DMode
    ? (selectedMap.id.startsWith('holodeck-') ? selectedMap.id : 'holodeck-alpha')
    : (!selectedMap.id.startsWith('holodeck-') ? selectedMap.id : 'ctf-canyon-arena');

  const initialMode: GameMode = is3DMode
    ? (currentRules.mode === 'holodeck' || currentRules.mode === 'tdm' || currentRules.mode === 'ffa' ? currentRules.mode : 'holodeck')
    : (currentRules.mode !== 'holodeck' ? currentRules.mode : 'ctf');

  const [mapId, setMapId] = useState<string>(initialMapId);
  const [rules, setRules] = useState<MatchRulesConfig>(() =>
    sanitizeMatchRules({ ...currentRules, mode: initialMode }),
  );

  const availableModes: GameMode[] = is3DMode
    ? ['holodeck', 'tdm', 'ffa']
    : ['ctf', 'tdm', 'ffa'];

  const displayedMaps = Object.values(availableMaps).filter((m) =>
    is3DMode ? m.id.startsWith('holodeck-') : !m.id.startsWith('holodeck-'),
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateRules = (patch: Partial<MatchRulesConfig>) => {
    sounds.playUiClick();
    setRules((prev) => sanitizeMatchRules(patch, prev));
  };

  const handleOpenWarRoom = () => {
    sounds.playUiClick();
    onConfirmHost({
      mapId,
      matchRules: sanitizeMatchRules(rules),
    });
  };

  const timePresets: MatchTimeLimitPreset[] =
    rules.mode === 'ctf' ? [0, 180, 300, 480] : [180, 300, 480];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-2xl max-h-[93dvh] flex flex-col overflow-hidden border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2 min-w-0">
            {is3DMode ? (
              <Box className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            ) : (
              <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono truncate">
                {is3DMode ? 'Host 3D Tactical Holodeck Match' : 'Host 2D Vector Arena Match'}
              </h3>
              <span className="text-[9px] font-mono text-slate-400 uppercase block truncate">
                {is3DMode
                  ? 'Select 3D tactical mode, theater & rules before opening War Room'
                  : 'Select 2D vector mode, arena & rules before opening War Room'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Close</span>
          </button>
        </div>

        {/* Scrollable Config Body */}
        <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll p-3.5 sm:p-5 bg-slate-950/65 space-y-4">
          {/* Game Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                <Skull className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                Game Mode
              </span>
              <span className="text-[10px] font-mono uppercase text-cyan-300">
                {GAME_MODE_META[rules.mode].shortLabel}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {availableModes.map((m) => {
                const meta = GAME_MODE_META[m];
                const Icon = MODE_ICON[m];
                const active = rules.mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateRules({ mode: m })}
                    className={`text-left p-2.5 border transition clip-chamfer cursor-pointer flex flex-col gap-1 ${
                      active
                        ? 'bg-cyan-950/50 border-cyan-400 glow-cyan'
                        : 'bg-slate-950/75 border-slate-800 hover:border-cyan-500/45 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wide">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            active ? 'text-cyan-300' : 'text-slate-400'
                          }`}
                        />
                        {meta.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-mono font-black uppercase ${
                          active
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-900 text-slate-400 border border-slate-700/80'
                        }`}
                      >
                        {meta.shortLabel}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 leading-snug">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combat Theater Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                {is3DMode ? (
                  <Box className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <MapIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                {is3DMode ? '3D Combat Theater' : '2D Combat Arena'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {getCleanMapTitle(availableMaps[mapId] ?? selectedMap)}
              </span>
            </div>

            {/* Strict Dimension Pill */}
            <div className="flex items-center gap-1.5 mb-2.5">
              {is3DMode ? (
                <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase clip-chamfer bg-cyan-500 text-slate-950 flex items-center gap-1 glow-cyan">
                  <Box className="w-3 h-3" />
                  <span>3D Tactical Theaters ({displayedMaps.length})</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase clip-chamfer bg-cyan-500 text-slate-950 flex items-center gap-1 glow-cyan">
                  <MapIcon className="w-3 h-3" />
                  <span>2D Vector Arenas ({displayedMaps.length})</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 short-wide:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {displayedMaps.map((m) => {
                const isSelected = mapId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      setMapId(m.id);
                    }}
                    className={`text-left p-2 border transition flex short-wide:flex-col sm:flex-col items-center short-wide:items-stretch sm:items-stretch gap-2.5 clip-chamfer cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/45 border-cyan-400 glow-cyan'
                        : 'bg-slate-950/75 border-slate-800 hover:border-cyan-500/45 hover:bg-slate-900/80'
                    }`}
                  >
                    <MapSchematicPreview map={m} isSelected={isSelected} size="card" />
                    <div className="flex-1 short-wide:flex-none sm:flex-none flex items-center justify-between gap-1.5 min-w-0">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate">
                          {getCleanMapTitle(m)}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 truncate">
                          {m.width}×{m.height}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 text-[9px] font-mono font-black uppercase ${
                          isSelected
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-900 text-slate-400 border border-slate-700/80'
                        }`}
                      >
                        {isSelected ? 'ACTIVE' : getMapModeTag(m)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Match Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(rules.mode === 'ctf' || rules.mode === 'holodeck') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {rules.mode === 'holodeck' ? 'Round Goal' : 'Capture Goal'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {rules.mode === 'holodeck'
                      ? `First to ${rules.targetCaptures === 1 ? 3 : rules.targetCaptures === 3 ? 5 : rules.targetCaptures === 5 ? 7 : 9} Rounds`
                      : `First to ${rules.targetCaptures}`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([1, 3, 5, 7] as TargetCapturesPreset[]).map((cap) => {
                    const label =
                      rules.mode === 'holodeck'
                        ? `BO${cap === 1 ? 3 : cap === 3 ? 5 : cap === 5 ? 7 : 9}`
                        : `FT${cap}`;
                    return (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => updateRules({ targetCaptures: cap })}
                        className={`py-1.5 text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                          rules.targetCaptures === cap
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 glow-cyan'
                            : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Match Clock
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {rules.timeLimitSec === 0
                    ? 'Unlimited'
                    : rules.mode === 'ffa'
                      ? `${formatClockPreset(rules.timeLimitSec)} Timed`
                      : `${formatClockPreset(rules.timeLimitSec)} + OT`}
                </span>
              </div>
              <div className={`grid gap-1.5 ${timePresets.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {timePresets.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updateRules({ timeLimitSec: sec })}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                      rules.timeLimitSec === sec
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec === 0 ? '∞' : formatClockPreset(sec)}
                  </button>
                ))}
              </div>
            </div>

            <div className={rules.mode !== 'ctf' && rules.mode !== 'holodeck' ? '' : 'sm:col-span-2'}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  <TimerReset className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Redeploy Delay
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {rules.respawnDelaySec}s
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { sec: 2.5, label: '2.5s Fast' },
                    { sec: 4.5, label: '4.5s Std' },
                    { sec: 6.5, label: '6.5s Tac' },
                  ] as { sec: RespawnDelayPreset; label: string }[]
                ).map(({ sec, label }) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updateRules({ respawnDelaySec: sec })}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                      rules.respawnDelaySec === sec
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-950/95">
          <span className="hidden xs:inline-block text-[10px] font-mono text-slate-400 truncate">
            {GAME_MODE_META[rules.mode].label} • {formatClockPreset(rules.timeLimitSec)} •{' '}
            {getCleanMapTitle(availableMaps[mapId] ?? selectedMap)}
          </span>
          <button
            type="button"
            onClick={handleOpenWarRoom}
            className="flex-1 xs:flex-none ml-auto px-5 py-2.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-[0.14em] clip-chamfer shadow-xl transition cursor-pointer flex items-center justify-center gap-2 glow-cyan"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Open War Room</span>
          </button>
        </div>
      </div>
    </div>
  );
}
