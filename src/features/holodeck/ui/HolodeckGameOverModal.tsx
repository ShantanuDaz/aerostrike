import { memo, useEffect } from 'react';
import { useHolodeckStore } from '../game/holodeckStore';
import { useCTFStore } from '../../ctf/ctfStore';
import { useMapStore } from '../../map/mapStore';
import { sounds } from '../../audio/soundEngine';
import {
  Trophy,
  Skull,
  RotateCcw,
  DoorOpen,
  Crosshair,
  Shield,
} from 'lucide-react';

interface HolodeckGameOverModalProps {
  onExitToWarRoom: () => void;
}

export const HolodeckGameOverModal = memo(function HolodeckGameOverModal({
  onExitToWarRoom,
}: HolodeckGameOverModalProps) {
  const roundPhase = useHolodeckStore((s) => s.roundPhase);
  const scoreAttackers = useHolodeckStore((s) => s.scoreAttackers);
  const scoreDefenders = useHolodeckStore((s) => s.scoreDefenders);
  const localPlayer = useHolodeckStore((s) => s.localPlayer);
  const resetMatch = useHolodeckStore((s) => s.resetMatch);
  const matchRules = useCTFStore((s) => s.matchRules);
  const selectedMap = useMapStore((s) => s.selectedMap);
  const activeMode = matchRules.mode;

  const isOpen = roundPhase === 'game_over';

  const isWinner =
    activeMode === 'ffa'
      ? localPlayer.kills >= 10
      : (localPlayer.team === 'red' && scoreAttackers > scoreDefenders) ||
        (localPlayer.team === 'blue' && scoreDefenders > scoreAttackers);

  useEffect(() => {
    if (isOpen) {
      if (isWinner) {
        sounds.playSpikeDefused(); // Victory chime
      } else {
        sounds.playExplosion();
      }
    }
  }, [isOpen, isWinner]);

  if (!isOpen) return null;

  const modeTitle =
    activeMode === 'tdm'
      ? '3D Team Deathmatch'
      : activeMode === 'ffa'
        ? '3D Free For All'
        : 'Search & Defuse';

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/50 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl glow-cyan animate-in zoom-in-95 duration-200">
        {/* Crest & Banner */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
            isWinner
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_20px_#f59e0b]'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_20px_#f43f5e]'
          }`}
        >
          {isWinner ? <Trophy className="w-8 h-8" /> : <Skull className="w-8 h-8" />}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-widest uppercase text-white mb-1">
          {isWinner ? 'VICTORY ACHIEVED' : 'MISSION FAILED'}
        </h1>
        <span className="text-xs uppercase tracking-widest text-slate-400 mb-6">
          {selectedMap.name} • {modeTitle} Final Report
        </span>

        {/* Score Board Badge */}
        <div className="flex items-center gap-6 bg-slate-950/80 border border-slate-800 px-6 py-3 rounded-xl mb-6">
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-rose-400 uppercase">Attackers</span>
            <span className="text-3xl font-black text-rose-400">{scoreAttackers}</span>
          </div>
          <span className="text-slate-600 text-xl font-bold">-</span>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-cyan-400 uppercase">Defenders</span>
            <span className="text-3xl font-black text-cyan-400">{scoreDefenders}</span>
          </div>
        </div>

        {/* Combat Stats Grid */}
        <div className="w-full grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex flex-col items-center">
            <Crosshair className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-lg font-black text-white">{localPlayer.kills}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Kills</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex flex-col items-center">
            <Skull className="w-4 h-4 text-rose-400 mb-1" />
            <span className="text-lg font-black text-white">{localPlayer.deaths}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Deaths</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex flex-col items-center">
            <Shield className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-lg font-black text-white">{localPlayer.plants + localPlayer.defuses}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Objectives</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              resetMatch();
            }}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rematch // Deploy</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onExitToWarRoom();
            }}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            <DoorOpen className="w-4 h-4" />
            <span>War Room</span>
          </button>
        </div>
      </div>
    </div>
  );
});
