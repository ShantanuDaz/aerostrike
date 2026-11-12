import { useCTFStore } from '../ctf/ctfStore';
import { useMapStore } from '../map/mapStore';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { usePlayerStore } from '../player/playerStore';
import { useCombatStore } from '../combat/combatStore';
import { clearOptimisticClaims } from '../combat/optimisticClaims';
import { useMatchStatsStore } from '../combat/statsStore';
import { useSettingsStore } from '../settings/settingsStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { buildActiveStations, engineWorld } from '../game/engineWorld';
import { Trophy, RefreshCw, Zap, LogOut, Clock } from 'lucide-react';

interface GameOverModalProps {
  onLeaveMatch?: () => void;
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
      engineWorld.spawnSoloBots(selectedMap, spawnedLocal.team);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in zoom-in-95 duration-200 select-none">
      <div
        className={`clip-chamfer-lg p-5 sm:p-8 max-w-md w-full max-h-[92dvh] overflow-y-auto text-center flex flex-col items-center gap-4 sm:gap-5 shadow-2xl relative border ${
          isBlueWinner ? 'cyber-panel-blue' : 'cyber-panel-red'
        }`}
      >
        <div
          className={`w-16 h-16 sm:w-20 sm:h-20 clip-chamfer flex items-center justify-center shadow-2xl shrink-0 ${
            isBlueWinner
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 glow-cyan'
              : 'bg-rose-500/20 text-rose-300 border border-rose-400 glow-red'
          }`}
        >
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <div>
          <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Mission Complete
          </span>
          <h2
            className={`text-2xl sm:text-3xl font-black italic uppercase tracking-tight mt-1 ${
              isBlueWinner ? 'text-cyber-shimmer' : 'text-red-shimmer'
            }`}
          >
            {winner} Squad Victory
          </h2>
          <span
            className={`inline-block mt-1.5 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer border ${
              isOvertime
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300'
            }`}
          >
            {winConditionLabel}
          </span>
        </div>

        {/* Final Scoreboard */}
        <div className="flex items-center justify-center gap-6 bg-slate-950/80 border border-cyan-500/30 px-6 py-3 sm:px-8 sm:py-4 clip-chamfer w-full">
          <div className="text-center">
            <span className="text-[10px] font-mono font-black text-cyan-400 block mb-0.5 tracking-widest uppercase">
              Blue
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {score.blue}
            </span>
          </div>
          <span className="text-slate-600 font-black text-lg font-mono">:</span>
          <div className="text-center">
            <span className="text-[10px] font-mono font-black text-rose-400 block mb-0.5 tracking-widest uppercase">
              Red
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white font-mono">
              {score.red}
            </span>
          </div>
        </div>

        {/* Rematch & Leave Actions */}
        <div className="flex flex-col gap-2 w-full">
          {canStartRematch ? (
            <button
              type="button"
              onClick={handlePlayAgain}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-[0.15em] clip-chamfer shadow-xl transition cursor-pointer glow-cyan"
            >
              <RefreshCw className="w-4 h-4" /> Play Again
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900/90 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold uppercase tracking-widest clip-chamfer">
              <Clock className="w-4 h-4 animate-pulse" /> Waiting for Host Rematch
            </div>
          )}

          {onLeaveMatch && (
            <button
              type="button"
              onClick={onLeaveMatch}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-950/85 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 font-mono text-xs font-bold uppercase tracking-widest clip-chamfer transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" /> Return to Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
