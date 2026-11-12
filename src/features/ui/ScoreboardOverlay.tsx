import type { PlayerMatchStats } from '../combat/statsStore';
import type { MatchRulesConfig } from '../ctf/types';
import type { GameMap } from '../map/types';
import { formatMatchClock } from './hudUtils';
import { X } from 'lucide-react';

interface ScoreboardOverlayProps {
  visible: boolean;
  manualOpen: boolean;
  onCloseManual: () => void;
  roomCode: string | null;
  selectedMap: GameMap;
  targetCaptures: number;
  isOvertime: boolean;
  matchRules: MatchRulesConfig;
  timeRemainingSec: number;
  score: { blue: number; red: number };
  blueStats: PlayerMatchStats[];
  redStats: PlayerMatchStats[];
  localPlayerId: string;
  isTouchHUD: boolean;
}

export function ScoreboardOverlay({
  visible,
  manualOpen,
  onCloseManual,
  roomCode,
  selectedMap,
  targetCaptures,
  isOvertime,
  matchRules,
  timeRemainingSec,
  score,
  blueStats,
  redStats,
  localPlayerId,
  isTouchHUD,
}: ScoreboardOverlayProps) {
  if (!visible) return null;

  return (
    <div
      data-no-joystick="true"
      onClick={() => {
        if (manualOpen) onCloseManual();
      }}
      className={`fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/55 backdrop-blur-xs select-none ${
        manualOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg max-w-2xl w-full border border-cyan-500/45 shadow-2xl p-3.5 sm:p-5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-cyan-400">
              {roomCode ? `SECTOR UPLINK • ROOM ${roomCode}` : 'SOLO SKIRMISH • 2v2 AI SQUAD'}
            </span>
            <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
              {selectedMap.name} • First to {targetCaptures} •{' '}
              {isOvertime
                ? 'Sudden-Death OT'
                : matchRules.timeLimitSec > 0
                  ? formatMatchClock(timeRemainingSec)
                  : 'Untimed'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-sm sm:text-lg font-black">
              <span className="text-cyan-300">{score.blue}</span>
              <span className="text-slate-600">:</span>
              <span className="text-rose-400">{score.red}</span>
            </div>

            {manualOpen && (
              <button
                type="button"
                onClick={onCloseManual}
                className="p-1 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-400 clip-chamfer cursor-pointer"
                title="Close Scoreboard"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* BLUE SQUAD */}
          <div className="bg-slate-950/80 border border-cyan-500/30 clip-chamfer p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 pb-1.5 border-b border-cyan-500/20 mb-1.5">
              <span>Blue Squad ({score.blue})</span>
              <div className="flex items-center gap-3 text-slate-400">
                <span className="w-6 text-right">CAP</span>
                <span className="w-6 text-right">K</span>
                <span className="w-6 text-right">D</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {blueStats.length === 0 ? (
                <span className="text-[10px] font-mono text-slate-500 py-2 text-center">
                  No Blue units deployed
                </span>
              ) : (
                blueStats.map((row) => {
                  const isMe = row.playerId === localPlayerId;
                  return (
                    <div
                      key={row.playerId}
                      className={`flex items-center justify-between px-2 py-1 text-xs font-mono clip-chamfer ${
                        isMe
                          ? 'bg-cyan-500/15 border border-cyan-400/50 text-white font-bold'
                          : 'bg-slate-900/60 text-slate-200'
                      }`}
                    >
                      <span className="truncate pr-2">
                        {row.callsign}
                        {isMe && (
                          <span className="ml-1.5 text-[9px] text-cyan-300 uppercase">YOU</span>
                        )}
                      </span>
                      <div className="flex items-center gap-3 shrink-0 font-bold">
                        <span className="w-6 text-right text-amber-300">{row.captures}</span>
                        <span className="w-6 text-right text-cyan-300">{row.kills}</span>
                        <span className="w-6 text-right text-slate-400">{row.deaths}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RED SQUAD */}
          <div className="bg-slate-950/80 border border-rose-500/30 clip-chamfer p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-rose-300 pb-1.5 border-b border-rose-500/20 mb-1.5">
              <span>Red Squad ({score.red})</span>
              <div className="flex items-center gap-3 text-slate-400">
                <span className="w-6 text-right">CAP</span>
                <span className="w-6 text-right">K</span>
                <span className="w-6 text-right">D</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {redStats.length === 0 ? (
                <span className="text-[10px] font-mono text-slate-500 py-2 text-center">
                  No Red units deployed
                </span>
              ) : (
                redStats.map((row) => {
                  const isMe = row.playerId === localPlayerId;
                  return (
                    <div
                      key={row.playerId}
                      className={`flex items-center justify-between px-2 py-1 text-xs font-mono clip-chamfer ${
                        isMe
                          ? 'bg-rose-500/15 border border-rose-400/50 text-white font-bold'
                          : 'bg-slate-900/60 text-slate-200'
                      }`}
                    >
                      <span className="truncate pr-2">
                        {row.callsign}
                        {isMe && (
                          <span className="ml-1.5 text-[9px] text-rose-300 uppercase">YOU</span>
                        )}
                      </span>
                      <div className="flex items-center gap-3 shrink-0 font-bold">
                        <span className="w-6 text-right text-amber-300">{row.captures}</span>
                        <span className="w-6 text-right text-rose-300">{row.kills}</span>
                        <span className="w-6 text-right text-slate-400">{row.deaths}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center">
          {isTouchHUD
            ? 'Tap outside to dismiss scoreboard'
            : 'Hold [TAB] to view scoreboard • [S] Drop Platforms • [Shift] Air-Dash'}
        </div>
      </div>
    </div>
  );
}
