import { useCTFStore } from '../ctf/ctfStore';
import { useMapStore } from '../map/mapStore';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import { clearOptimisticClaims } from '../combat/optimisticClaims';
import { useMatchStatsStore, type PlayerMatchStats } from '../combat/statsStore';
import { useSettingsStore } from '../settings/settingsStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { buildActiveStations, engineWorld } from '../game/engineWorld';
import { Award, Clock, LogOut, RefreshCw, Trophy, Zap } from 'lucide-react';

interface GameOverModalProps {
  onLeaveMatch?: () => void;
}

function getScoreValue(row: PlayerMatchStats): number {
  return row.captures * 100 + row.kills * 10 - row.deaths;
}

export function GameOverModal({ onLeaveMatch }: GameOverModalProps) {
  const matchStatus = useCTFStore((s) => s.matchStatus);
  const winner = useCTFStore((s) => s.winner);
  const score = useCTFStore((s) => s.score);
  const targetCaptures = useCTFStore((s) => s.targetCaptures);
  const isOvertime = useCTFStore((s) => s.isOvertime);
  const timeRemainingSec = useCTFStore((s) => s.timeRemainingSec);
  const matchRules = useCTFStore((s) => s.matchRules);
  const initMatch = useCTFStore((s) => s.initMatch);
  const selectedMap = useMapStore((s) => s.selectedMap);
  const roomCode = useNetworkStore((s) => s.roomCode);
  const isHost = useNetworkStore((s) => s.isHost);
  const statsByPlayerId = useMatchStatsStore((s) => s.statsByPlayerId);
  const localPlayerId = useAvatarStore((s) => s.playerId);

  if (matchStatus !== 'game_over') return null;

  const isBlueWinner = winner === 'blue';
  const canStartRematch = !roomCode || isHost;
  const winConditionLabel = isOvertime
    ? 'Sudden-Death Overtime Decider'
    : score.blue < targetCaptures &&
        score.red < targetCaptures &&
        matchRules.timeLimitSec > 0 &&
        timeRemainingSec === 0
      ? 'Regulation Time Expired • Score Advantage'
      : `Target Limit Reached • First to ${targetCaptures}`;

  const sortedAll = Object.values(statsByPlayerId).sort(
    (a, b) => getScoreValue(b) - getScoreValue(a),
  );
  const mvp = sortedAll[0] ?? null;
  const blueStats = sortedAll.filter((s) => s.team === 'blue');
  const redStats = sortedAll.filter((s) => s.team === 'red');

  const handlePlayAgain = () => {
    if (!canStartRematch) return;
    clearOptimisticClaims();
    engineWorld.resetWorldForMatch(
      (selectedMap.weaponSpawns || []).map((ws) => ({
        id: ws.id,
        x: ws.x,
        y: ws.y,
        weaponType: ws.weaponType,
        respawnTimer: 0,
      })),
      true,
      buildActiveStations(selectedMap),
    );
    const stats = useMatchStatsStore.getState();
    stats.resetStats();
    useCombatStore.getState().initLoadout(useSettingsStore.getState().defaultWeapon);
    const myPlayerId = useAvatarStore.getState().playerId;
    usePlayerStore.getState().spawnAtTeamBase(selectedMap, myPlayerId);
    const spawnedLocal = usePlayerStore.getState().player;
    stats.registerParticipant(myPlayerId, spawnedLocal.avatar.callsign, spawnedLocal.team);

    if (!roomCode) {
      engineWorld.spawnSoloBots(selectedMap, spawnedLocal.team, engineWorld.soloConfig);
      for (const bot of engineWorld.soloBots) {
        stats.registerParticipant(bot.id, bot.player.avatar.callsign, bot.team);
      }
    } else {
      for (const member of Object.values(useNetworkStore.getState().roster)) {
        stats.registerParticipant(member.playerId, member.callsign, member.team);
      }
      if (isHost) {
        networkManager.broadcastRematch(selectedMap.id);
      }
    }
    initMatch(selectedMap);
  };

  return (
    <div className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in zoom-in-95 duration-200 select-none">
      <div
        className={`clip-chamfer-lg max-w-lg short-wide:max-w-2xl w-full max-h-[94dvh] overflow-hidden flex flex-col shadow-2xl relative border ${
          isBlueWinner ? 'cyber-panel-blue' : 'cyber-panel-red'
        }`}
      >
        <div className="overflow-y-auto cyber-scroll p-4 sm:tall:p-6 short:p-3.5 text-center flex flex-col items-center gap-3 sm:tall:gap-4 short:gap-2">
          <div
            className={`w-12 h-12 sm:tall:w-16 sm:tall:h-16 short:w-10 short:h-10 clip-chamfer flex items-center justify-center shadow-2xl shrink-0 ${
              isBlueWinner
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 glow-cyan'
                : 'bg-rose-500/20 text-rose-300 border border-rose-400 glow-red'
            }`}
          >
            <Trophy className="w-6 h-6 sm:tall:w-8 sm:tall:h-8 short:w-5 short:h-5" />
          </div>

          <div className="w-full">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Mission Complete
            </span>
            <h2
              className={`text-2xl sm:tall:text-3xl short:text-xl font-black italic uppercase tracking-tight mt-0.5 ${
                isBlueWinner ? 'text-cyber-shimmer' : 'text-red-shimmer'
              }`}
            >
              {winner} Squad Victory
            </h2>
            <span
              className={`inline-block mt-1 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer border ${
                isOvertime
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                  : 'bg-slate-900/80 border-slate-700/80 text-slate-300'
              }`}
            >
              {winConditionLabel}
            </span>
          </div>

          {/* Score & MVP Split */}
          <div className="grid grid-cols-1 short-wide:grid-cols-2 sm:grid-cols-2 gap-2.5 w-full">
            <div className="flex items-center justify-center gap-6 bg-slate-950/80 border border-cyan-500/30 px-5 py-2.5 clip-chamfer">
              <div className="text-center">
                <span className="text-[10px] font-mono font-black text-cyan-400 block tracking-widest uppercase">
                  Blue
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white font-mono leading-tight">
                  {score.blue}
                </span>
              </div>
              <span className="text-slate-600 font-black text-lg font-mono">:</span>
              <div className="text-center">
                <span className="text-[10px] font-mono font-black text-rose-400 block tracking-widest uppercase">
                  Red
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white font-mono leading-tight">
                  {score.red}
                </span>
              </div>
            </div>

            {mvp && (
              <div className="bg-amber-950/35 border border-amber-400/45 px-4 py-2 clip-chamfer flex items-center gap-3 text-left">
                <div className="w-9 h-9 clip-chamfer bg-amber-400/15 border border-amber-400/50 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-300 block">
                    Match MVP
                  </span>
                  <div className="text-sm font-black font-mono text-white truncate">
                    {mvp.callsign}
                  </div>
                  <div className="text-[10px] font-mono text-slate-300">
                    {mvp.captures} CAP • {mvp.kills} K • {mvp.deaths} D
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Final Match Scoreboard */}
          {sortedAll.length > 0 && (
            <div className="grid grid-cols-1 short-wide:grid-cols-2 sm:grid-cols-2 gap-2 w-full text-left">
              {(
                [
                  { label: 'Blue Squad', rows: blueStats, tone: 'cyan' },
                  { label: 'Red Squad', rows: redStats, tone: 'rose' },
                ] as const
              ).map((group) => (
                <div
                  key={group.label}
                  className={`bg-slate-950/75 border clip-chamfer p-2 ${
                    group.tone === 'cyan' ? 'border-cyan-500/25' : 'border-rose-500/25'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between text-[9px] font-mono font-black uppercase tracking-widest pb-1 mb-1 border-b ${
                      group.tone === 'cyan'
                        ? 'text-cyan-300 border-cyan-500/20'
                        : 'text-rose-300 border-rose-500/20'
                    }`}
                  >
                    <span>{group.label}</span>
                    <div className="flex items-center gap-2.5 text-slate-400">
                      <span className="w-5 text-right">C</span>
                      <span className="w-5 text-right">K</span>
                      <span className="w-5 text-right">D</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.rows.map((row) => {
                      const isMe = row.playerId === localPlayerId;
                      return (
                        <div
                          key={row.playerId}
                          className={`flex items-center justify-between px-1.5 py-0.5 text-[10px] font-mono clip-chamfer ${
                            isMe
                              ? group.tone === 'cyan'
                                ? 'bg-cyan-500/15 text-white font-bold'
                                : 'bg-rose-500/15 text-white font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          <span className="truncate pr-1.5">
                            {row.callsign}
                            {isMe ? ' (YOU)' : ''}
                          </span>
                          <div className="flex items-center gap-2.5 shrink-0 font-bold">
                            <span className="w-5 text-right text-amber-300">{row.captures}</span>
                            <span
                              className={`w-5 text-right ${
                                group.tone === 'cyan' ? 'text-cyan-300' : 'text-rose-300'
                              }`}
                            >
                              {row.kills}
                            </span>
                            <span className="w-5 text-right text-slate-400">{row.deaths}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rematch & Leave Actions */}
          <div className="flex flex-col short-wide:flex-row gap-2 w-full">
            {canStartRematch ? (
              <button
                type="button"
                onClick={handlePlayAgain}
                className="flex items-center justify-center gap-2 w-full short-wide:flex-1 py-2.5 sm:tall:py-3 short:py-2 px-3 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-[11px] sm:tall:text-xs uppercase tracking-[0.12em] sm:tall:tracking-[0.15em] clip-chamfer shadow-xl transition cursor-pointer glow-cyan whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:tall:w-4 sm:tall:h-4 shrink-0" /> Play Again
              </button>
            ) : (
              <div className="flex items-center justify-center gap-1.5 w-full short-wide:flex-1 py-2.5 sm:tall:py-3 short:py-2 px-3 bg-slate-900/90 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] sm:tall:text-xs font-bold uppercase tracking-wider sm:tall:tracking-widest clip-chamfer text-center leading-tight">
                <Clock className="w-3.5 h-3.5 sm:tall:w-4 sm:tall:h-4 animate-pulse shrink-0" />{' '}
                Waiting for Host Rematch
              </div>
            )}

            {onLeaveMatch && (
              <button
                type="button"
                onClick={onLeaveMatch}
                className="flex items-center justify-center gap-2 w-full short-wide:flex-1 py-2.5 sm:tall:py-2.5 short:py-2 px-3 bg-slate-950/85 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 font-mono text-[11px] sm:tall:text-xs font-bold uppercase tracking-wider sm:tall:tracking-widest clip-chamfer transition cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 sm:tall:w-4 sm:tall:h-4 text-rose-400 shrink-0" />{' '}
                Return to Lobby
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
