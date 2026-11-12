import { useEffect, useState, useRef } from 'react';
import { useNetworkStore } from '../network/networkStore';
import { networkManager } from '../network/peerRoom';
import { useSettingsStore } from '../settings/settingsStore';
import { sounds } from '../audio/soundEngine';
import {
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Terminal,
  Zap,
} from 'lucide-react';

interface ConnectingScreenProps {
  roomCode: string;
  onConnected: () => void;
  onCancel: () => void;
}

export function ConnectingScreen({
  roomCode,
  onConnected,
  onCancel,
}: ConnectingScreenProps) {
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isHost = useNetworkStore((s) => s.isHost);
  const isRoomCreator = useNetworkStore((s) => s.isRoomCreator);
  const isAuthApproved = useNetworkStore((s) => s.isAuthApproved);
  const isJoinRejected = useNetworkStore((s) => s.isJoinRejected);
  const rejectionReason = useNetworkStore((s) => s.rejectionReason);
  const hostSignalLost = useNetworkStore((s) => s.hostSignalLost);
  const hostDisconnectReason = useNetworkStore((s) => s.hostDisconnectReason);
  const hostReconnectAttempts = useNetworkStore((s) => s.hostReconnectAttempts);
  const crtScanlines = useSettingsStore((s) => s.crtScanlines);

  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const hasTriggeredRef = useRef(false);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  // Require Host authorization approval for Cadets (do not advance on raw open socket)
  const isReadyToTransition = Boolean(
    (isRoomCreator && isConnected) ||
    (!isRoomCreator && isAuthApproved)
  );

  const isFinishing = isReadyToTransition && !isJoinRejected;

  const showTimeoutFallback =
    !isRoomCreator &&
    !isFinishing &&
    !isJoinRejected &&
    (hostSignalLost || (elapsedSeconds >= 7 && !isAuthApproved));

  // Elapsed timer & progressive logs
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    const step1 = setTimeout(() => setStepIndex(1), 350);
    const step2 = setTimeout(() => setStepIndex(2), 900);
    const step3 = setTimeout(() => setStepIndex(3), 1600);

    return () => {
      clearInterval(timer);
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, []);

  // Handle successful connection transition
  useEffect(() => {
    if (!isFinishing || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    try {
      sounds.playFlagPickup();
    } catch {
      // ignore
    }

    const finishDelay = isRoomCreator ? 0 : 400;
    const finishTimer = setTimeout(() => {
      onConnectedRef.current();
    }, finishDelay);

    return () => clearTimeout(finishTimer);
  }, [isFinishing, isRoomCreator]);

  const logs = [
    `[00:00.12] Connecting to PeerJS Signaling Broker (0.peerjs.com:443)`,
    `[00:00.38] Target Host Frequency locked: "${roomCode}"`,
    isRoomCreator
      ? `[00:00.65] Host Authority protocol established. Initializing War Room...`
      : `[00:00.65] Direct WebRTC DataChannel dialing Host Commander...`,
    isFinishing
      ? `[00:00.95] CLEARANCE VERIFIED. Deploying squad uplink to War Room...`
      : `[00:00.95] Negotiating ICE / TURN traversal for P2P handshake...`,
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between p-3 sm:p-6 cyber-grid-bg text-slate-100 select-none overflow-y-auto relative">
      {/* Scanline CRT overlay */}
      {crtScanlines && (
        <div className="absolute inset-0 scanline-overlay z-0 pointer-events-none" />
      )}

      {/* Top Header Bar */}
      <header className="w-full max-w-2xl flex items-center justify-between relative z-10 pt-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition text-xs font-mono cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Abort Uplink</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300 glow-cyan uppercase">
          <Zap className="w-3 h-3 text-cyan-400" />
          PEERJS DIRECT P2P
        </div>
      </header>

      {/* Main Connecting Terminal Card */}
      <main className="w-full max-w-xl mx-auto my-auto relative z-10 flex flex-col items-center gap-6">
        <div className="w-full cyber-panel rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center gap-6 shadow-2xl border border-cyan-500/40 glow-cyan relative overflow-hidden">
          {/* Subtle top laser strip */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

          {/* Central Holographic Radar Icon */}
          <div className="relative flex items-center justify-center my-2">
            {/* Outer rotating dashed ring */}
            <div className="w-28 h-28 rounded-full border-2 border-dashed border-cyan-500/30 animate-spin duration-[10s]" />

            {/* Middle pulsing ring */}
            <div className="absolute w-20 h-20 rounded-full border border-cyan-400/50 animate-ping duration-[3s]" />

            {/* Inner Glowing Badge */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${
                isJoinRejected
                  ? 'bg-rose-950/90 border border-rose-500 text-rose-400 glow-red'
                  : isFinishing
                  ? 'bg-emerald-950/90 border border-emerald-400 text-emerald-300 glow-emerald scale-110'
                  : hostSignalLost && !isRoomCreator
                  ? 'bg-amber-950/90 border border-amber-400/80 text-amber-300 glow-amber'
                  : 'bg-cyan-950/80 border border-cyan-400/60 text-cyan-300 glow-cyan'
              }`}
            >
              {isJoinRejected ? (
                <ShieldAlert className="w-8 h-8 animate-bounce" />
              ) : isFinishing ? (
                <ShieldCheck className="w-8 h-8 animate-pulse" />
              ) : hostSignalLost && !isRoomCreator ? (
                <WifiOff className="w-8 h-8 animate-pulse" />
              ) : isHost ? (
                <Radio className="w-8 h-8 animate-pulse" />
              ) : (
                <Wifi className="w-8 h-8 animate-pulse" />
              )}
            </div>
          </div>

          {/* Status Text & Room Code */}
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-widest block ${
                hostSignalLost && !isFinishing && !isJoinRejected && !isRoomCreator
                  ? 'text-amber-300'
                  : 'text-cyan-400'
              }`}
            >
              //{' '}
              {isFinishing
                ? 'UPLINK SECURED'
                : hostSignalLost && !isRoomCreator
                ? 'HOST SIGNAL LOST'
                : 'INITIALIZING SQUAD FREQUENCY'}{' '}
              //
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-cyber-shimmer uppercase tracking-wider">
              {roomCode}
            </h2>
            <p className="text-xs text-slate-300 font-mono mt-1">
              {isFinishing
                ? 'Clearance verified. Entering tactical staging...'
                : isRoomCreator
                ? 'Broadcasting host beacon across decentralized relays...'
                : hostSignalLost
                ? hostDisconnectReason || 'Host signal lost. Attempting to re-establish uplink...'
                : 'Seeking Host Commander & synchronizing tactical roster...'}
            </p>
          </div>

          {/* Dynamic Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-cyan-500/30 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFinishing
                  ? 'w-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-emerald-500/50'
                  : isRoomCreator
                  ? 'w-4/5 bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse'
                  : 'w-3/5 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 animate-pulse'
              }`}
            />
          </div>

          {/* Tactical Terminal Stream Logs */}
          <div className="w-full bg-slate-950/90 rounded-2xl border border-slate-800 p-3.5 flex flex-col gap-1.5 text-left font-mono text-[11px] text-slate-400 shadow-inner">
            <div className="flex items-center gap-2 text-cyan-400 pb-1 border-b border-slate-800/80 text-[10px] uppercase font-bold tracking-wider">
              <Terminal className="w-3.5 h-3.5" />
              <span>P2P Relay Transmission Log</span>
              <span className="ml-auto text-slate-500 text-[9px]">{elapsedSeconds}s</span>
            </div>
            {logs.slice(0, stepIndex + 1).map((log, idx) => (
              <div
                key={idx}
                className={`truncate ${
                  idx === stepIndex
                    ? isFinishing
                      ? 'text-emerald-300 font-bold'
                      : 'text-cyan-300'
                    : 'text-slate-500'
                }`}
              >
                {log}
              </div>
            ))}
          </div>

          {/* Host Rejection Card (If rejected by host authority) */}
          {isJoinRejected && (
            <div className="w-full cyber-panel-red rounded-2xl p-4 flex flex-col items-center gap-3 border border-rose-500/60 glow-red">
              <div className="text-xs font-bold text-rose-300">
                {rejectionReason ||
                  'Match is currently in progress. Only enlisted squad members from the initial deployment can rejoin this battle.'}
              </div>
              <button
                onClick={onCancel}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-rose-950"
              >
                Return to Main Menu
              </button>
            </div>
          )}

          {/* Host Signal Lost / Timeout Fallback Alert */}
          {showTimeoutFallback && !isFinishing && !isJoinRejected && (
            <div className="w-full bg-slate-950/90 border border-amber-500/50 rounded-2xl p-4 flex flex-col items-center gap-3 text-center">
              <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">
                {hostSignalLost
                  ? `[ HOST SIGNAL LOST • RECONNECTING${hostReconnectAttempts > 0 ? ` #${hostReconnectAttempts}` : ''} ]`
                  : '[ AWAITING ROOM HOST ]'}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {hostSignalLost
                  ? hostDisconnectReason ||
                    'Could not maintain uplink with squad commander. The host may have closed the room.'
                  : 'Dialing the squad commander via PeerJS P2P signaling... The room may be closed or the host has not initialized yet.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    networkManager.retryHostConnection();
                  }}
                  className="py-2.5 px-4 bg-amber-500/20 hover:bg-amber-400/30 text-amber-200 hover:text-white rounded-xl text-xs font-mono font-bold border border-amber-400/60 transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Uplink</span>
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold border border-slate-700 transition cursor-pointer"
                >
                  Cancel & Return to Menu
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-2xl flex items-center justify-center text-center relative z-10 pb-2">
        <span className="text-[10px] font-mono text-slate-500">
          Direct PeerJS Star Topology • WebRTC Encrypted DataChannel
        </span>
      </footer>
    </div>
  );
}
