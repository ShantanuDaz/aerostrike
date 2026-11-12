import { sortFFAStandings, type PlayerMatchStats } from '../combat/statsStore';
import { GAME_MODE_META, type MatchRulesConfig } from '../ctf/types';
import type { GameMap } from '../map/types';
import { useSettingsStore } from '../settings/settingsStore';
import { engineWorld } from '../game/engineWorld';
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
  ffaStats?: PlayerMatchStats[];
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
  ffaStats,
  localPlayerId,
  isTouchHUD,
}: ScoreboardOverlayProps) {
  const highContrast = useSettingsStore((s) => s.highContrastTeamMarkers);

  if (!visible) return null;

  const gameMode = matchRules.mode;
  const isCTF = gameMode === 'ctf';
  const isFFA = gameMode === 'ffa';
  const rankedFFA = ffaStats ?? sortFFAStandings([...blueStats, ...redStats]);
  const ffaLeader = rankedFFA[0];

  const soloSubtitle = `SOLO ${GAME_MODE_META[gameMode].shortLabel} • ${engineWorld.soloConfig.squadSize.toUpperCase()} AI (${engineWorld.soloConfig.difficulty.toUpperCase()})`;

  const modeSummary = isCTF
    ? `First to ${targetCaptures}`
    : isFFA
      ? 'Free For All • Top 3 Kills'
      : 'Team Kills';

  const podiumBadgeClass = (idx: number) =>
    idx === 0
      ? 'bg-amber-400/20 border-amber-400 text-amber-300'
      : idx === 1
        ? 'bg-slate-300/20 border-slate-300 text-slate-200'
        : idx === 2
          ? 'bg-orange-500/20 border-orange-400 text-orange-300'
          : 'bg-slate-800 border-slate-700 text-slate-400';

  return (
    <div
      data-no-joystick="true"
      onClick={() => {
        if (manualOpen) onCloseManual();
      }}
      className={`fixed inset-0 z-40 safe-insets flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/55 backdrop-blur-xs select-none ${
        manualOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg max-w-2xl w-full max-h-[92dvh] overflow-hidden border border-cyan-500/45 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 sm:px-5 pt-3 sm:tall:pt-4 pb-2 border-b border-slate-800">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 truncate">
              {roomCode ? `SECTOR UPLINK • ROOM ${roomCode} • ${GAME_MODE_META[gameMode].shortLabel}` : soloSubtitle}
            </span>
            <h3 className="text-xs sm:text-base font-black uppercase tracking-wider text-white truncate">
              {selectedMap.name} • {modeSummary} •{' '}
              {isOvertime
                ? 'Sudden-Death OT'
                : matchRules.timeLimitSec > 0
                  ? formatMatchClock(timeRemainingSec)
                  : 'Untimed'}
            </h3>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {isFFA ? (
              <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-amber-300">
                <span>#1</span>
                <span className="truncate max-w-[90px]">
                  {ffaLeader ? ffaLeader.callsign : '--'}
                </span>
                <span className="text-white">({ffaLeader?.kills ?? 0}K)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-sm sm:text-lg font-black">
                <span className="text-cyan-300">{score.blue}</span>
                <span className="text-slate-600">:</span>
                <span className="text-rose-400">{score.red}</span>
              </div>
            )}

            {manualOpen && (
              <button
                type="button"
                onClick={onCloseManual}
                className="p-1.5 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-400 clip-chamfer cursor-pointer"
                title="Close Scoreboard"
                aria-label="Close Scoreboard"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll px-3.5 sm:px-5 py-2.5 sm:tall:py-3">
          {isFFA ? (
            <div className="bg-slate-950/80 border border-amber-500/35 clip-chamfer p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 pb-1.5 border-b border-amber-500/20 mb-1.5">
                <span>Free For All Standings ({rankedFFA.length})</span>
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="w-8 text-right">K</span>
                  <span className="w-8 text-right">D</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {rankedFFA.length === 0 ? (
                  <span className="text-[10px] font-mono text-slate-500 py-2 text-center">
                    No pilots deployed
                  </span>
                ) : (
                  rankedFFA.map((row, idx) => {
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
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-black border shrink-0 ${podiumBadgeClass(idx)}`}
                          >
                            #{idx + 1}
                          </span>
                          <span className="truncate">
                            {row.callsign}
                            {isMe && (
                              <span className="ml-1.5 text-[9px] text-cyan-300 uppercase">YOU</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 font-bold tabular-nums">
                          <span className="w-8 text-right text-amber-300">{row.kills}</span>
                          <span className="w-8 text-right text-slate-400">{row.deaths}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 short-wide:grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* BLUE SQUAD */}
              <div className="bg-slate-950/80 border border-cyan-500/30 clip-chamfer p-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 pb-1.5 border-b border-cyan-500/20 mb-1.5">
                  <span>
                    {highContrast ? '◆ ' : ''}Blue Squad ({score.blue})
                  </span>
                  <div className="flex items-center gap-3 text-slate-400">
                    {isCTF && <span className="w-6 text-right">CAP</span>}
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
                            {isCTF && (
                              <span className="w-6 text-right text-amber-300">{row.captures}</span>
                            )}
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
                  <span>
                    {highContrast ? '▲ ' : ''}Red Squad ({score.red})
                  </span>
                  <div className="flex items-center gap-3 text-slate-400">
                    {isCTF && <span className="w-6 text-right">CAP</span>}
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
                            {isCTF && (
                              <span className="w-6 text-right text-amber-300">{row.captures}</span>
                            )}
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
          )}
        </div>

        <div className="shrink-0 px-3.5 sm:px-5 pb-2.5 sm:tall:pb-3.5 pt-1 text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center border-t border-slate-800/70">
          {isTouchHUD
            ? 'Tap outside to dismiss scoreboard'
            : 'Hold [TAB] Scoreboard • [Wheel / + / −] Zoom • [Esc] Menu • [Shift] Dash'}
        </div>
      </div>
    </div>
  );
}
