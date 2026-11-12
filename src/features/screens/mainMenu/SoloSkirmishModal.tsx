import { useEffect, useState } from 'react';
import type { MatchTimeLimitPreset, TargetCapturesPreset, Team } from '../../ctf/types';
import type { BotDifficulty, SoloSquadSize } from '../../game/botAI';
import { engineWorld } from '../../game/engineWorld';
import { useMapStore } from '../../map/mapStore';
import { sounds } from '../../audio/soundEngine';
import { MapSchematicPreview } from '../warRoom/MapSchematicPreview';
import { formatClockPreset, getCleanMapTitle, getMapModeTag } from '../warRoom/warRoomUtils';
import {
  Bot,
  Clock,
  Flag,
  Gamepad2,
  Map as MapIcon,
  Play,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react';

export interface SoloLaunchConfig {
  mapId: string;
  squadSize: SoloSquadSize;
  difficulty: BotDifficulty;
  playerTeam: Team;
  targetCaptures: TargetCapturesPreset;
  timeLimitSec: MatchTimeLimitPreset;
}

interface SoloSkirmishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (config: SoloLaunchConfig) => void;
}

export function SoloSkirmishModal({
  isOpen,
  onClose,
  onDeploy,
}: SoloSkirmishModalProps) {
  const availableMaps = useMapStore((s) => s.availableMaps);
  const selectedMap = useMapStore((s) => s.selectedMap);

  const [mapId, setMapId] = useState<string>(() => selectedMap.id);
  const [squadSize, setSquadSize] = useState<SoloSquadSize>(
    () => engineWorld.soloConfig.squadSize,
  );
  const [difficulty, setDifficulty] = useState<BotDifficulty>(
    () => engineWorld.soloConfig.difficulty,
  );
  const [playerTeam, setPlayerTeam] = useState<Team>(
    () => engineWorld.soloConfig.playerTeam,
  );
  const [targetCaptures, setTargetCaptures] = useState<TargetCapturesPreset>(3);
  const [timeLimitSec, setTimeLimitSec] = useState<MatchTimeLimitPreset>(300);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDeploy = () => {
    sounds.playUiClick();
    onDeploy({
      mapId,
      squadSize,
      difficulty,
      playerTeam,
      targetCaptures,
      timeLimitSec,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-2xl max-h-[93dvh] flex flex-col overflow-hidden border border-emerald-500/45 glow-cyan animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-emerald-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono truncate">
                Solo Skirmish Setup
              </h3>
              <span className="text-[9px] font-mono text-slate-400 uppercase block truncate">
                Configure offline arena, AI difficulty, team side &amp; victory rules
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
          {/* Combat Theater Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                <MapIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Combat Theater
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {getCleanMapTitle(availableMaps[mapId] ?? selectedMap)}
              </span>
            </div>
            <div className="grid grid-cols-1 short-wide:grid-cols-3 sm:grid-cols-3 gap-2">
              {Object.values(availableMaps).map((m) => {
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
                        ? 'bg-emerald-950/40 border-emerald-400 glow-cyan'
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
                            ? 'bg-emerald-400 text-slate-950'
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

          {/* Side + Squad Format + Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Team Side */}
            <div className="p-2.5 bg-slate-900/65 border border-slate-800 clip-chamfer space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                <Flag className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Deploy Side
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setPlayerTeam('blue');
                  }}
                  className={`py-2 text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                    playerTeam === 'blue'
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-cyan-200'
                  }`}
                >
                  Blue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setPlayerTeam('red');
                  }}
                  className={`py-2 text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                    playerTeam === 'red'
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-rose-200'
                  }`}
                >
                  Red
                </button>
              </div>
            </div>

            {/* Squad Size */}
            <div className="p-2.5 bg-slate-900/65 border border-slate-800 clip-chamfer space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Squad Size
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['1v1', '2v2', '3v3'] as SoloSquadSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      setSquadSize(sz);
                    }}
                    className={`py-2 text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                      squadSize === sz
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Difficulty */}
            <div className="p-2.5 bg-slate-900/65 border border-slate-800 clip-chamfer space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                AI Skill
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'cadet', label: 'Cadet' },
                    { id: 'veteran', label: 'Vet' },
                    { id: 'ace', label: 'Ace' },
                  ] as { id: BotDifficulty; label: string }[]
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      setDifficulty(d.id);
                    }}
                    className={`py-2 text-[10px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                      difficulty === d.id
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Capture Limit + Clock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Capture Goal
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  First to {targetCaptures}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([1, 3, 5, 7] as TargetCapturesPreset[]).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      setTargetCaptures(cap);
                    }}
                    className={`py-1.5 text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                      targetCaptures === cap
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    FT{cap}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Match Clock
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {timeLimitSec === 0
                    ? 'Unlimited'
                    : `${formatClockPreset(timeLimitSec)} + OT`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 180, 300, 480] as MatchTimeLimitPreset[]).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      setTimeLimitSec(sec);
                    }}
                    className={`py-1.5 text-[10px] sm:text-[11px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                      timeLimitSec === sec
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec === 0 ? '∞' : formatClockPreset(sec)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-950/95">
          <div className="hidden xs:flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Offline Bot CTF • {squadSize.toUpperCase()} •{' '}
              {difficulty.toUpperCase()} AI
            </span>
          </div>
          <button
            type="button"
            onClick={handleDeploy}
            className="flex-1 xs:flex-none ml-auto px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-[0.14em] clip-chamfer shadow-xl transition cursor-pointer flex items-center justify-center gap-2 glow-cyan"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Deploy Skirmish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
