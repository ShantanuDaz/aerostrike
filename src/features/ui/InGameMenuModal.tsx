import { useState } from 'react';
import {
  MAX_TOUCH_CONTROL_OPACITY,
  MAX_TOUCH_CONTROL_SCALE,
  MIN_TOUCH_CONTROL_OPACITY,
  MIN_TOUCH_CONTROL_SCALE,
  useSettingsStore,
  type HudScale,
} from '../settings/settingsStore';
import { useNetworkStore } from '../network/networkStore';
import {
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  computeAutoCameraZoom,
} from '../camera';
import {
  isFullscreenActive,
  isFullscreenSupported,
  isIOSDevice,
  isStandalonePWA,
  toggleFullscreen,
} from '../controls/mobileFullscreen';
import { sounds } from '../audio/soundEngine';
import {
  Eye,
  LogOut,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Music,
  Pause,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Smartphone,
  Users,
  Vibrate,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface InGameMenuModalProps {
  open: boolean;
  isTouchHUD: boolean;
  onClose: () => void;
  onLeaveMatch: () => void;
  onOpenScoreboard?: () => void;
}

export function InGameMenuModal({
  open,
  isTouchHUD,
  onClose,
  onLeaveMatch,
  onOpenScoreboard,
}: InGameMenuModalProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);

  const roomCode = useNetworkStore((s) => s.roomCode);
  const isHost = useNetworkStore((s) => s.isHost);
  const isMultiplayer = Boolean(roomCode);

  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const sfxMuted = useSettingsStore((s) => s.sfxMuted);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const voiceVolume = useSettingsStore((s) => s.voiceVolume);
  const voiceMuted = useSettingsStore((s) => s.voiceMuted);
  const cameraZoomMode = useSettingsStore((s) => s.cameraZoomMode);
  const cameraZoom = useSettingsStore((s) => s.cameraZoom);
  const hudScale = useSettingsStore((s) => s.hudScale);
  const highContrastTeamMarkers = useSettingsStore((s) => s.highContrastTeamMarkers);
  const touchLayout = useSettingsStore((s) => s.touchLayout);
  const touchAimLine = useSettingsStore((s) => s.touchAimLine);
  const touchControlScale = useSettingsStore((s) => s.touchControlScale);
  const touchControlOpacity = useSettingsStore((s) => s.touchControlOpacity);
  const touchAimMode = useSettingsStore((s) => s.touchAimMode);
  const showTouchGrenadeButton = useSettingsStore((s) => s.showTouchGrenadeButton);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const toggleMute = useSettingsStore((s) => s.toggleMute);

  if (!open) return null;

  const autoPreview =
    typeof window !== 'undefined'
      ? computeAutoCameraZoom(window.innerWidth, window.innerHeight)
      : 1;
  const activeZoom = cameraZoomMode === 'auto' ? autoPreview : cameraZoom;

  const canFullscreen = isFullscreenSupported();
  const fsActive = isFullscreenActive();
  const showIOSTip = isIOSDevice() && !isStandalonePWA();

  return (
    <div
      data-no-joystick="true"
      onClick={() => {
        setConfirmLeave(false);
        onClose();
      }}
      className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2.5 sm:p-4 select-none animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg max-w-lg w-full max-h-[92dvh] overflow-hidden border border-cyan-500/45 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 clip-chamfer bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center shrink-0">
              {isMultiplayer ? (
                <Sliders className="w-4 h-4 text-cyan-300" />
              ) : (
                <Pause className="w-4 h-4 text-cyan-300" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white truncate">
                {isMultiplayer ? 'Tactical Systems' : 'Skirmish Paused'}
              </h3>
              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 truncate">
                {isMultiplayer
                  ? 'Live P2P Combat • Match continues in background'
                  : 'AI & Clock Paused • Tune camera & controls'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              setConfirmLeave(false);
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-400 clip-chamfer cursor-pointer"
            aria-label="Close Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Quick Settings Body */}
        <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll p-3.5 sm:p-4 flex flex-col gap-3">
          {/* Camera Zoom */}
          <div className="bg-slate-950/75 border border-cyan-500/25 clip-chamfer p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-200">
                  Camera Field Zoom
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({ cameraZoomMode: 'auto' });
                  }}
                  className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                    cameraZoomMode === 'auto'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <RotateCcw className="w-2.5 h-2.5 inline mr-1" />
                  Auto ({autoPreview.toFixed(2)}x)
                </button>
                <span className="text-xs font-mono font-black text-white min-w-[40px] text-right">
                  {activeZoom.toFixed(2)}x
                </span>
              </div>
            </div>

            <input
              type="range"
              min={MIN_CAMERA_ZOOM}
              max={MAX_CAMERA_ZOOM}
              step={0.05}
              value={activeZoom}
              onChange={(e) =>
                updateSettings({
                  cameraZoomMode: 'custom',
                  cameraZoom: Number(e.target.value),
                })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-1">
              <span>Wider Arena ({MIN_CAMERA_ZOOM}x)</span>
              <span>Closer ({MAX_CAMERA_ZOOM}x)</span>
            </div>
          </div>

          {/* Audio Row */}
          <div className="bg-slate-950/75 border border-slate-800 clip-chamfer p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-300">
                Audio & Mix ({masterVolume}%)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleMute()}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                    sfxMuted
                      ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                      : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                  }`}
                >
                  {sfxMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  <span>SFX</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({ musicEnabled: !musicEnabled });
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                    musicEnabled
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  <Music className="w-3 h-3" />
                  <span>Music</span>
                </button>
                {isMultiplayer && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      updateSettings({ voiceMuted: !voiceMuted });
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                      !voiceMuted
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                    }`}
                    title="Mute or unmute incoming squad voice"
                  >
                    {voiceMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>Voice</span>
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={masterVolume}
              onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            {isMultiplayer && (
              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/70">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300/90 shrink-0">
                  Voice {voiceMuted ? 'Off' : `${voiceVolume}%`}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={voiceVolume}
                  onChange={(e) =>
                    updateSettings({
                      voiceVolume: Number(e.target.value),
                      voiceMuted: Number(e.target.value) === 0,
                    })
                  }
                  className="flex-1 accent-emerald-400 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* HUD Scale & Accessibility */}
          <div className="bg-slate-950/75 border border-slate-800 clip-chamfer p-3 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-300">
                HUD Size
              </span>
              <div className="flex items-center gap-1">
                {(['compact', 'standard', 'large'] as HudScale[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      updateSettings({ hudScale: sz });
                    }}
                    className={`px-2 py-1 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                      hudScale === sz
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                updateSettings({ highContrastTeamMarkers: !highContrastTeamMarkers });
              }}
              className={`flex items-center justify-between px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                highContrastTeamMarkers
                  ? 'bg-amber-500/15 border-amber-400/60 text-amber-200'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>High-Contrast Team Shapes (◆ Blue / ▲ Red)</span>
              <span>{highContrastTeamMarkers ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Touch Controls Section (Shown prominently when touch HUD active) */}
          {isTouchHUD && (
            <div className="bg-slate-950/75 border border-slate-800 clip-chamfer p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Touch Ergonomics</span>
                </div>
                <span className="text-[10px] font-mono font-black text-white">
                  {Math.round(touchControlScale * 100)}%
                </span>
              </div>

              {/* Controls Size Presets + Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: '70%', value: 0.7 },
                    { label: '85%', value: 0.85 },
                    { label: '100%', value: 1.0 },
                    { label: '115%', value: 1.15 },
                  ].map((preset) => {
                    const active = Math.abs(touchControlScale - preset.value) < 0.025;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          sounds.playUiClick();
                          updateSettings({ touchControlScale: preset.value });
                        }}
                        className={`py-1 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="range"
                  min={MIN_TOUCH_CONTROL_SCALE}
                  max={MAX_TOUCH_CONTROL_SCALE}
                  step={0.05}
                  value={touchControlScale}
                  onChange={(e) =>
                    updateSettings({ touchControlScale: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                  aria-label="Touch Controls Size"
                />
              </div>

              {/* Controls Opacity Slider */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 shrink-0">
                  Opacity {Math.round(touchControlOpacity * 100)}%
                </span>
                <input
                  type="range"
                  min={MIN_TOUCH_CONTROL_OPACITY}
                  max={MAX_TOUCH_CONTROL_OPACITY}
                  step={0.05}
                  value={touchControlOpacity}
                  onChange={(e) =>
                    updateSettings({ touchControlOpacity: Number(e.target.value) })
                  }
                  className="flex-1 accent-cyan-400 cursor-pointer"
                  aria-label="Touch Controls Opacity"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({
                      touchLayout:
                        touchLayout === 'right_handed' ? 'left_handed' : 'right_handed',
                    });
                  }}
                  className="flex flex-col items-start px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400/50 clip-chamfer text-left cursor-pointer"
                >
                  <span className="text-[8px] font-mono uppercase text-slate-400">Thumb Layout</span>
                  <span className="text-[10px] font-mono font-black text-white uppercase">
                    {touchLayout === 'left_handed' ? 'Left-Handed' : 'Right-Handed'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({
                      touchAimMode:
                        touchAimMode === 'precision' ? 'instant' : 'precision',
                    });
                  }}
                  className="flex flex-col items-start px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400/50 clip-chamfer text-left cursor-pointer"
                >
                  <span className="text-[8px] font-mono uppercase text-slate-400">Aim Fire Mode</span>
                  <span className="text-[10px] font-mono font-black text-cyan-200 uppercase">
                    {touchAimMode === 'instant' ? 'Instant Drag' : 'Perimeter Edge'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({ touchAimLine: !touchAimLine });
                  }}
                  className={`px-2 py-1.5 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer ${
                    touchAimLine
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Laser: {touchAimLine ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({ showTouchGrenadeButton: !showTouchGrenadeButton });
                  }}
                  className={`px-2 py-1.5 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer ${
                    showTouchGrenadeButton
                      ? 'bg-lime-500/15 border-lime-400/60 text-lime-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Frag Btn: {showTouchGrenadeButton ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    updateSettings({ hapticsEnabled: !hapticsEnabled });
                  }}
                  className={`px-2 py-1.5 text-[9px] font-mono font-bold uppercase clip-chamfer border cursor-pointer flex items-center justify-center gap-1 ${
                    hapticsEnabled
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Vibrate className="w-3 h-3" />
                  <span>{hapticsEnabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tactical Scoreboard Access */}
          {onOpenScoreboard && (
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                onClose();
                onOpenScoreboard();
              }}
              className="w-full py-2 px-3 bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 text-xs font-mono font-bold uppercase tracking-wider clip-chamfer flex items-center justify-between cursor-pointer transition glow-cyan"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tactical Scoreboard & Stats</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">[Tab]</span>
            </button>
          )}

          {/* Display / Fullscreen Row */}
          {(canFullscreen || showIOSTip) && (
            <div className="flex flex-col gap-1.5">
              {canFullscreen && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    toggleFullscreen();
                  }}
                  className="w-full py-2 px-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/50 text-cyan-200 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  {fsActive ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                  <span>{fsActive ? 'Exit Fullscreen' : 'Enter Fullscreen Mode'}</span>
                </button>
              )}
              {showIOSTip && (
                <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 clip-chamfer text-[9px] font-mono text-slate-300 text-center">
                  iOS Tip: Use Share → Add to Home Screen for edge-to-edge fullscreen.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions: Resume + Leave Match Confirmation */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col gap-2">
          {confirmLeave ? (
            <div className="flex items-center gap-2 bg-rose-950/45 border border-rose-500/50 clip-chamfer p-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-[10px] font-mono text-rose-200 font-bold uppercase flex-1">
                {roomCode
                  ? isHost
                    ? 'Pull entire squad back to War Room?'
                    : 'Leave this active match?'
                  : 'End Solo Skirmish session?'}
              </span>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setConfirmLeave(false);
                  onClose();
                  onLeaveMatch();
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-black uppercase clip-chamfer cursor-pointer"
              >
                Confirm
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setConfirmLeave(true);
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-900/90 hover:bg-rose-950/70 border border-rose-500/40 text-rose-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer cursor-pointer transition"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>{roomCode && isHost ? 'War Room' : 'Leave Match'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  onClose();
                }}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-[11px] sm:text-xs uppercase tracking-[0.14em] clip-chamfer shadow-lg cursor-pointer glow-cyan"
              >
                Resume Combat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
