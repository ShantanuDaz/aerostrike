import type {
  MatchRulesConfig,
  MatchTimeLimitPreset,
  RespawnDelayPreset,
  TargetCapturesPreset,
  Team,
} from '../../ctf/types';
import type { GameMap } from '../../map/types';
import type { RosterMember } from '../../network/types';
import { sounds } from '../../audio/soundEngine';
import { MapSchematicPreview } from './MapSchematicPreview';
import { formatClockPreset, getCleanMapTitle, getMapModeTag } from './warRoomUtils';
import {
  Check,
  Clock,
  Flag,
  Lock,
  Map as MapIcon,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trophy,
  Users,
  X,
} from 'lucide-react';

interface TheaterSelectModalProps {
  isOpen: boolean;
  isHost: boolean;
  selectedMap: GameMap;
  availableMaps: Record<string, GameMap>;
  onSelectMap: (mapId: string) => void;
  onClose: () => void;
}

export function TheaterSelectModal({
  isOpen,
  isHost,
  selectedMap,
  availableMaps,
  onSelectMap,
  onClose,
}: TheaterSelectModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <MapIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                Select Combat Theater
              </h3>
              <span className="text-[9px] font-mono text-slate-400 uppercase block">
                {isHost
                  ? 'Host chooses arena for squad deployment'
                  : 'Active arena controlled by room host'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 bg-slate-950/60">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(availableMaps).map((m) => {
              const isSelected = selectedMap.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!isHost}
                  onClick={() => onSelectMap(m.id)}
                  className={`text-left p-2.5 border transition-all flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-2.5 clip-chamfer ${
                    isSelected
                      ? 'bg-cyan-950/45 border-cyan-400 glow-cyan'
                      : isHost
                        ? 'bg-slate-950/75 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80 cursor-pointer'
                        : 'bg-slate-950/50 border-slate-800/70 opacity-70 cursor-default'
                  }`}
                >
                  <MapSchematicPreview map={m} isSelected={isSelected} size="card" />

                  <div className="flex-1 sm:flex-none flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">
                        {getCleanMapTitle(m)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        {m.width}×{m.height} • {m.weaponSpawns.length} Crates
                        {(m.bouncePads?.length ?? 0) > 0 ? ` • ${m.bouncePads!.length} Pads` : ''}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 px-2 py-0.5 text-[9px] font-mono font-black uppercase ${
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
      </div>
    </div>
  );
}

interface SquadRosterModalProps {
  isOpen: boolean;
  totalPlayers: number;
  readyCount: number;
  blueMembers: RosterMember[];
  redMembers: RosterMember[];
  localPlayerId: string;
  localTeam: Team;
  localIsReady: boolean;
  onToggleReady: () => void;
  onSelectTeam: (team: Team) => void;
  onClose: () => void;
}

export function SquadRosterModal({
  isOpen,
  totalPlayers,
  readyCount,
  blueMembers,
  redMembers,
  localPlayerId,
  localTeam,
  localIsReady,
  onToggleReady,
  onSelectTeam,
  onClose,
}: SquadRosterModalProps) {
  if (!isOpen) return null;

  const renderRosterRow = (m: RosterMember, faction: Team) => {
    const isLocal = m.playerId === localPlayerId;
    const safeCallsign = m.callsign || 'Pilot';
    return (
      <div
        key={m.playerId}
        className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer ${
          faction === 'blue'
            ? isLocal
              ? 'bg-blue-950/75 border-cyan-400/60 glow-cyan'
              : 'bg-slate-950/80 border-slate-800'
            : isLocal
              ? 'bg-rose-950/75 border-rose-400/60 glow-red'
              : 'bg-slate-950/80 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
            style={{
              backgroundColor:
                m.avatar?.bodyColor || (faction === 'blue' ? '#2563eb' : '#dc2626'),
            }}
          />
          {isLocal ? (
            <button
              type="button"
              onClick={onToggleReady}
              className={`px-2 py-0.5 text-[9px] font-mono font-black uppercase border transition cursor-pointer shrink-0 flex items-center gap-1 ${
                localIsReady
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-400 text-amber-300'
              }`}
            >
              {localIsReady && <Check className="w-2.5 h-2.5" />}
              {localIsReady ? 'READY' : 'WAIT'}
            </button>
          ) : m.isHost ? (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              ★ HOST
            </span>
          ) : m.isReady ? (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shrink-0">
              READY
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
              WAIT
            </span>
          )}
          <span className="text-xs font-bold text-white truncate flex items-center gap-1">
            {safeCallsign}
            {isLocal && (
              <Sparkles
                className={`w-3 h-3 shrink-0 ${
                  faction === 'blue' ? 'text-cyan-300' : 'text-rose-300'
                }`}
              />
            )}
          </span>
        </div>

        <span
          className={`text-[9px] font-mono font-bold shrink-0 ${
            faction === 'blue' ? 'text-cyan-400/80' : 'text-rose-400/80'
          }`}
        >
          {m.isHost ? 'HOST' : isLocal ? 'YOU' : 'CADET'}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                Squad Roster ({totalPlayers})
              </h3>
              <span className="text-[9px] font-mono text-emerald-400 uppercase block">
                {readyCount}/{totalPlayers} Pilots Ready for Drop
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 bg-slate-950/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Blue Squad Column */}
            <div className="bg-slate-950/75 border border-cyan-500/35 p-3 clip-chamfer flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-cyan-400" />
                  Blue Squad
                </span>
                <span className="text-[10px] font-mono text-cyan-300 font-bold">
                  {blueMembers.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {blueMembers.map((m) => renderRosterRow(m, 'blue'))}
                {blueMembers.length === 0 && (
                  <div className="text-[10px] font-mono text-slate-500 text-center py-4">
                    [ NO BLUE PILOTS ]
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelectTeam('blue')}
                disabled={localTeam === 'blue'}
                className={`mt-auto w-full py-2 text-[10px] font-black uppercase tracking-widest clip-chamfer transition ${
                  localTeam === 'blue'
                    ? 'bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                }`}
              >
                {localTeam === 'blue' ? 'Your Active Squad' : 'Switch to Blue'}
              </button>
            </div>

            {/* Red Squad Column */}
            <div className="bg-slate-950/75 border border-rose-500/35 p-3 clip-chamfer flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                <span className="text-xs font-black text-red-shimmer uppercase tracking-wider flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-rose-400" />
                  Red Squad
                </span>
                <span className="text-[10px] font-mono text-rose-300 font-bold">
                  {redMembers.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {redMembers.map((m) => renderRosterRow(m, 'red'))}
                {redMembers.length === 0 && (
                  <div className="text-[10px] font-mono text-slate-500 text-center py-4">
                    [ NO RED PILOTS ]
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelectTeam('red')}
                disabled={localTeam === 'red'}
                className={`mt-auto w-full py-2 text-[10px] font-black uppercase tracking-widest clip-chamfer transition ${
                  localTeam === 'red'
                    ? 'bg-rose-500/15 border border-rose-400/50 text-rose-300 cursor-default'
                    : 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                }`}
              >
                {localTeam === 'red' ? 'Your Active Squad' : 'Switch to Red'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MatchRulesModalProps {
  isOpen: boolean;
  isHost: boolean;
  matchRules: MatchRulesConfig;
  onUpdateRules: (partial: Partial<MatchRulesConfig>) => void;
  onClose: () => void;
}

export function MatchRulesModal({
  isOpen,
  isHost,
  matchRules,
  onUpdateRules,
  onClose,
}: MatchRulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden border border-amber-500/45 glow-amber animate-in zoom-in-95 duration-150"
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-amber-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
                Match Rules &amp; Engagement
              </h3>
              <span className="text-[9px] font-mono text-slate-400 uppercase block">
                {isHost
                  ? 'Changes broadcast live to all connected cadets'
                  : 'Rules locked & synchronized by squad host'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-slate-950/65 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Capture Limit (First To)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {matchRules.targetCaptures}{' '}
                {matchRules.targetCaptures === 1 ? 'Capture' : 'Captures'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([1, 3, 5, 7] as TargetCapturesPreset[]).map((cap) => {
                const active = matchRules.targetCaptures === cap;
                return (
                  <button
                    key={cap}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onUpdateRules({ targetCaptures: cap })}
                    className={`py-2 px-2 border text-xs font-mono font-black uppercase clip-chamfer transition ${
                      active
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 glow-cyan'
                        : isHost
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:border-cyan-400/50 hover:text-white cursor-pointer'
                          : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                    }`}
                  >
                    FT{cap}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Match Clock
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {matchRules.timeLimitSec === 0
                  ? 'No Time Limit'
                  : `${formatClockPreset(matchRules.timeLimitSec)} + Sudden-Death OT`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([0, 180, 300, 480] as MatchTimeLimitPreset[]).map((sec) => {
                const active = matchRules.timeLimitSec === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onUpdateRules({ timeLimitSec: sec })}
                    className={`py-2 px-2 border text-xs font-mono font-black uppercase clip-chamfer transition ${
                      active
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 glow-cyan'
                        : isHost
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:border-cyan-400/50 hover:text-white cursor-pointer'
                          : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                    }`}
                  >
                    {sec === 0 ? 'Untimed' : formatClockPreset(sec)}
                  </button>
                );
              })}
            </div>
            {matchRules.timeLimitSec > 0 && (
              <p className="text-[10px] font-mono text-amber-300/85 mt-1.5">
                If tied when the clock hits 0:00, Sudden-Death Overtime begins — next capture wins!
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                <TimerReset className="w-3.5 h-3.5 text-emerald-400" />
                Redeploy Delay
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {matchRules.respawnDelaySec}s Cooldown
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { sec: 2.5, label: '2.5s Fast' },
                  { sec: 4.5, label: '4.5s Std' },
                  { sec: 6.5, label: '6.5s Tac' },
                ] as { sec: RespawnDelayPreset; label: string }[]
              ).map(({ sec, label }) => {
                const active = matchRules.respawnDelaySec === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onUpdateRules({ respawnDelaySec: sec })}
                    className={`py-2 px-2 border text-xs font-mono font-black uppercase clip-chamfer transition ${
                      active
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : isHost
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:border-emerald-400/50 hover:text-white cursor-pointer'
                          : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {!isHost && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-300 clip-chamfer">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Only the squad Host can adjust match rules.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface JoinRejectedModalProps {
  isOpen: boolean;
  rejectionReason: string | null;
  onLeaveRoom: () => void;
}

export function JoinRejectedModal({
  isOpen,
  rejectionReason,
  onLeaveRoom,
}: JoinRejectedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="cyber-panel-red clip-chamfer-lg p-6 sm:p-8 max-w-md w-full max-h-[90dvh] overflow-y-auto text-center flex flex-col items-center gap-5 shadow-2xl border border-rose-500/50 glow-red animate-in zoom-in-95 duration-150">
        <div className="w-16 h-16 bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-400 glow-red clip-chamfer shrink-0">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest block">
            // HOST SECURITY ENFORCEMENT //
          </span>
          <h2 className="text-xl font-black text-white uppercase tracking-tight mt-1">
            Deployment Restricted
          </h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            {rejectionReason ||
              'Match is currently in progress. Only enlisted squad members from the initial deployment can rejoin this battle.'}
          </p>
        </div>
        <div className="w-full pt-2">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="w-full py-3 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-mono text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg shadow-rose-950 clip-chamfer"
          >
            Return to Hangar
          </button>
        </div>
      </div>
    </div>
  );
}
