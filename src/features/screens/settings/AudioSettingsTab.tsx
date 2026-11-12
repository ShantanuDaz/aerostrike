import { useState } from "react";
import { sounds } from "../../audio/soundEngine";
import {
  music,
  MUSIC_TRACKS,
  type MusicTrackId,
} from "../../audio/musicEngine";
import { useSettingsStore } from "../../settings/settingsStore";
import { Mic, MicOff, Music, Play, Square, Volume2, VolumeX } from "lucide-react";

interface AudioSettingsTabProps {
  previewingTrack: MusicTrackId | null;
  onToggleTrackPreview: (trackId: MusicTrackId) => void;
  onStopTrackPreview: () => void;
}

export function AudioSettingsTab({
  previewingTrack,
  onToggleTrackPreview,
  onStopTrackPreview,
}: AudioSettingsTabProps) {
  const settings = useSettingsStore();
  const [lastTriggeredSound, setLastTriggeredSound] = useState<string | null>(null);

  const triggerTestSound = (label: string, fn: () => void) => {
    fn();
    setLastTriggeredSound(label);
  };

  const sfxLevel = settings.sfxMuted ? 0 : settings.masterVolume;
  const musicLevel = settings.musicEnabled ? settings.musicVolume : 0;
  const voiceLevel = settings.voiceMuted ? 0 : settings.voiceVolume;

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col min-[520px]:flex-row gap-2.5 sm:gap-4 overflow-hidden">
      {/* Pinned Left Acoustic Deck & Test Pads */}
      <div className="shrink-0 min-[520px]:w-[210px] sm:w-[245px] lg:w-[270px] min-[520px]:h-full flex flex-col justify-between gap-2 bg-slate-950/75 p-2.5 sm:p-3 border border-cyan-500/25 clip-chamfer overflow-hidden">
        {/* Live Channel Mix Meters */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Live Audio Mix
            </span>
            {previewingTrack && (
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  onStopTrackPreview();
                  music.setPreviewTrack(null);
                }}
                className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400 text-cyan-200 rounded text-[8.5px] cursor-pointer flex items-center gap-1"
              >
                <Square className="w-2.5 h-2.5 fill-cyan-300" /> Stop
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 min-[520px]:grid-cols-1 gap-1.5">
            {/* SFX Meter */}
            <button
              type="button"
              onClick={() => settings.toggleMute()}
              className="p-1.5 bg-slate-900/80 border border-slate-800 hover:border-cyan-400/50 clip-chamfer text-left cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-slate-300 font-bold">SFX</span>
                <span className={sfxLevel > 0 ? "text-emerald-300 font-black" : "text-rose-400 font-black"}>
                  {sfxLevel > 0 ? `${sfxLevel}%` : "MUTE"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${sfxLevel}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-150"
                />
              </div>
            </button>

            {/* Music Meter */}
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                const next = !settings.musicEnabled;
                settings.updateSettings({ musicEnabled: next });
                if (!next) {
                  onStopTrackPreview();
                  music.setPreviewTrack(null);
                }
              }}
              className="p-1.5 bg-slate-900/80 border border-slate-800 hover:border-cyan-400/50 clip-chamfer text-left cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-slate-300 font-bold">MUSIC</span>
                <span className={musicLevel > 0 ? "text-cyan-300 font-black" : "text-slate-500 font-black"}>
                  {musicLevel > 0 ? `${musicLevel}%` : "OFF"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${musicLevel}%` }}
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-150"
                />
              </div>
            </button>

            {/* Voice Meter */}
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                settings.updateSettings({ voiceMuted: !settings.voiceMuted });
              }}
              className="p-1.5 bg-slate-900/80 border border-slate-800 hover:border-emerald-400/50 clip-chamfer text-left cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-slate-300 font-bold">VOICE</span>
                <span className={voiceLevel > 0 ? "text-emerald-300 font-black" : "text-rose-400 font-black"}>
                  {voiceLevel > 0 ? `${voiceLevel}%` : "MUTE"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  style={{ width: `${voiceLevel}%` }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-150"
                />
              </div>
            </button>
          </div>
        </div>

        {/* Always-Visible Sound Test Pad */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[9.5px] font-mono font-bold text-cyan-300 uppercase tracking-wider">
            <span>Sound Test Pad</span>
            {lastTriggeredSound && (
              <span className="text-[8.5px] text-amber-300">{lastTriggeredSound}</span>
            )}
          </div>
          <div className="grid grid-cols-4 min-[520px]:grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => triggerTestSound("Rifle", () => sounds.playRifle())}
              className="py-1.5 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-[10px] font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
            >
              Rifle
            </button>
            <button
              type="button"
              onClick={() => triggerTestSound("Shotgun", () => sounds.playShotgun())}
              className="py-1.5 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-[10px] font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
            >
              Shotgun
            </button>
            <button
              type="button"
              onClick={() => triggerTestSound("Blast", () => sounds.playExplosion())}
              className="py-1.5 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-rose-400 text-[10px] font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
            >
              Blast
            </button>
            <button
              type="button"
              onClick={() => triggerTestSound("Flag", () => sounds.playFlagCapture())}
              className="py-1.5 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400 text-[10px] font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
            >
              Flag
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Right Audio Controls */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto cyber-scroll pr-1 flex flex-col gap-3 pb-2">
        {/* Master SFX Mute & Volume */}
        <div className="p-3 sm:p-3.5 bg-slate-950/75 border border-slate-800 clip-chamfer space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                {settings.sfxMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                Master SFX ({settings.masterVolume}%)
              </div>
              <div className="text-[10.5px] text-slate-400">
                Weapon fire, explosions, UI &amp; flag chimes.
              </div>
            </div>
            <button
              type="button"
              onClick={() => settings.toggleMute()}
              className={`shrink-0 px-3 py-1.5 text-[10px] font-mono font-black uppercase clip-chamfer border transition cursor-pointer ${
                !settings.sfxMuted
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  : "bg-rose-500/20 border-rose-400 text-rose-300"
              }`}
            >
              {settings.sfxMuted ? "MUTED" : "ENABLED"}
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={settings.masterVolume}
            onChange={(e) =>
              settings.updateSettings({
                masterVolume: Number(e.target.value),
                sfxMuted: Number(e.target.value) === 0,
              })
            }
            className="w-full accent-cyan-400 cursor-pointer"
            aria-label="Master Volume"
          />

          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 80, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  settings.updateSettings({
                    masterVolume: preset,
                    sfxMuted: false,
                  });
                  sounds.playUiClick();
                }}
                className={`py-1 text-[10px] font-mono font-bold border clip-chamfer cursor-pointer ${
                  settings.masterVolume === preset && !settings.sfxMuted
                    ? "bg-cyan-500/25 border-cyan-400 text-white"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* Background Music Section */}
        <div className="p-3 sm:p-3.5 bg-slate-950/75 border border-cyan-500/30 clip-chamfer space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Music className="w-4 h-4 text-cyan-400 shrink-0" /> Adaptive Background Music
              </div>
              <div className="text-[10.5px] text-slate-400">
                Procedural synth tracks per game state.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                const next = !settings.musicEnabled;
                settings.updateSettings({ musicEnabled: next });
                if (!next) {
                  onStopTrackPreview();
                  music.setPreviewTrack(null);
                }
              }}
              className={`px-3 py-1.5 text-[10px] font-mono font-black uppercase clip-chamfer border transition cursor-pointer shrink-0 ${
                settings.musicEnabled
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                  : "bg-slate-900 border-slate-700 text-slate-400"
              }`}
            >
              {settings.musicEnabled ? "ON" : "OFF"}
            </button>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-300">
                Music Volume
              </span>
              <span className="text-[11px] font-mono font-black text-cyan-300">
                {!settings.musicEnabled || settings.musicVolume === 0
                  ? "Off"
                  : `${settings.musicVolume}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.musicVolume}
              onChange={(e) =>
                settings.updateSettings({
                  musicVolume: Number(e.target.value),
                  musicEnabled: Number(e.target.value) > 0,
                })
              }
              className="w-full accent-cyan-400 cursor-pointer"
              aria-label="Music Volume"
            />
            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    settings.updateSettings({
                      musicVolume: preset,
                      musicEnabled: true,
                    });
                    sounds.playUiClick();
                  }}
                  className={`py-1 text-[10px] font-mono font-bold border clip-chamfer cursor-pointer ${
                    settings.musicVolume === preset && settings.musicEnabled
                      ? "bg-cyan-500/25 border-cyan-400 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          {/* Screen Soundtracks Audition Deck */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-widest">
              Soundtrack Preview Deck
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {(
                [
                  ["landing", "Hangar Theme"],
                  ["connecting", "Uplink"],
                  ["war_room", "War Room"],
                  ["combat", "Combat"],
                  ["victory", "Victory"],
                ] as [MusicTrackId, string][]
              ).map(([trackId, screenLabel]) => {
                const meta = MUSIC_TRACKS[trackId];
                const isPreviewing = previewingTrack === trackId;
                return (
                  <button
                    key={trackId}
                    type="button"
                    onClick={() => onToggleTrackPreview(trackId)}
                    className={`flex items-center justify-between gap-2 p-2 border clip-chamfer text-left transition cursor-pointer ${
                      isPreviewing
                        ? "bg-cyan-500/20 border-cyan-400 text-white glow-cyan"
                        : "bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 text-slate-300"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        {meta.title}
                      </div>
                      <div className="text-[9.5px] font-mono text-slate-400 truncate">
                        {screenLabel} • {meta.bpm} BPM
                      </div>
                    </div>
                    <span
                      className={`p-1 rounded border shrink-0 ${
                        isPreviewing
                          ? "bg-cyan-400 text-slate-950 border-cyan-300"
                          : "bg-slate-950 text-cyan-400 border-slate-700"
                      }`}
                    >
                      {isPreviewing ? (
                        <Square className="w-2.5 h-2.5 fill-slate-950" />
                      ) : (
                        <Play className="w-2.5 h-2.5 fill-cyan-400" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Jetpack Thruster Audio Toggle */}
        <button
          type="button"
          onClick={() => {
            settings.updateSettings({ jetpackAudio: !settings.jetpackAudio });
            sounds.playUiClick();
          }}
          className="flex items-center justify-between gap-3 p-3 bg-slate-950/75 border border-slate-800 clip-chamfer text-left cursor-pointer"
        >
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-white">
              Jetpack Thruster Hum
            </div>
            <div className="text-[10.5px] text-slate-400">
              Continuous low-frequency thrust hum during flight boost.
            </div>
          </div>
          <span
            className={`shrink-0 px-3 py-1.5 text-[10px] font-mono font-black uppercase clip-chamfer border transition ${
              settings.jetpackAudio
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                : "bg-slate-900 border-slate-700 text-slate-400"
            }`}
          >
            {settings.jetpackAudio ? "ON" : "OFF"}
          </span>
        </button>

        {/* Squad Voice Chat Audio */}
        <div className="p-3 sm:p-3.5 bg-slate-950/75 border border-emerald-500/25 clip-chamfer space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                {settings.voiceMuted ? (
                  <MicOff className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                Squad Voice Comms ({settings.voiceVolume}%)
              </div>
              <div className="text-[10.5px] text-slate-400">
                Incoming squadmate voice volume &amp; mute state.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                settings.updateSettings({ voiceMuted: !settings.voiceMuted });
              }}
              className={`shrink-0 px-3 py-1.5 text-[10px] font-mono font-black uppercase clip-chamfer border transition cursor-pointer ${
                !settings.voiceMuted
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  : "bg-rose-500/20 border-rose-400 text-rose-300"
              }`}
            >
              {settings.voiceMuted ? "MUTED" : "ENABLED"}
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={settings.voiceVolume}
            onChange={(e) =>
              settings.updateSettings({
                voiceVolume: Number(e.target.value),
                voiceMuted: Number(e.target.value) === 0,
              })
            }
            className="w-full accent-emerald-400 cursor-pointer"
            aria-label="Voice Volume"
          />
        </div>
      </div>
    </div>
  );
}
