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

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-cyan-400" /> Procedural Audio
          Synthesizer
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure master volume, SFX mute state, adaptive music, and jetpack
          acoustics.
        </p>
      </div>

      {/* Master SFX Mute Toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            {settings.sfxMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            Master Sound Effects
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Enable or mute weapon, explosion, UI, and CTF fanfare sound effects
            independently from music.
          </div>
        </div>
        <button
          type="button"
          onClick={() => settings.toggleMute()}
          className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            !settings.sfxMuted
              ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
              : "bg-rose-500/20 border-rose-400 text-rose-300"
          }`}
        >
          {settings.sfxMuted ? "MUTED" : "ENABLED"}
        </button>
      </div>

      {/* Master Volume Slider */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 clip-chamfer space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">Master Volume</span>
          <span className="text-sm font-mono font-black text-cyan-300">
            {settings.masterVolume === 0
              ? "0%"
              : settings.sfxMuted
                ? `${settings.masterVolume}% (SFX Muted)`
                : `${settings.masterVolume}%`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.masterVolume}
          onChange={(e) =>
            settings.updateSettings({
              masterVolume: Number(e.target.value),
              sfxMuted: Number(e.target.value) === 0 ? true : false,
            })
          }
          className="w-full accent-cyan-400 cursor-pointer"
        />
        <div className="flex items-center gap-2 flex-wrap">
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
              className={`px-2.5 py-1 text-[11px] font-mono font-bold border clip-chamfer cursor-pointer ${
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
      <div className="p-4 bg-slate-950/70 border border-cyan-500/30 clip-chamfer space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-cyan-400" /> Adaptive Background
              Music
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Procedural synth soundtracks tailored for Hangar, War Room, and
              Combat.
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
            className={`px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer shrink-0 ${
              settings.musicEnabled
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                : "bg-slate-900 border-slate-700 text-slate-400"
            }`}
          >
            {settings.musicEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {/* Music Volume Slider */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Music Volume
            </span>
            <span className="text-xs font-mono font-black text-cyan-300">
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
          />
          <div className="flex items-center gap-2 flex-wrap">
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
                className={`px-2.5 py-1 text-[11px] font-mono font-bold border clip-chamfer cursor-pointer ${
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
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-widest">
            Screen Soundtrack Preview Deck
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                ["landing", "Landing / Hangar"],
                ["connecting", "Uplink Connecting"],
                ["war_room", "War Room Staging"],
                ["combat", "In-Game Skirmish"],
                ["victory", "Match Victory"],
              ] as [MusicTrackId, string][]
            ).map(([trackId, screenLabel]) => {
              const meta = MUSIC_TRACKS[trackId];
              const isPreviewing = previewingTrack === trackId;
              return (
                <button
                  key={trackId}
                  type="button"
                  onClick={() => onToggleTrackPreview(trackId)}
                  className={`flex items-center justify-between gap-2 p-2.5 border clip-chamfer text-left transition cursor-pointer ${
                    isPreviewing
                      ? "bg-cyan-500/20 border-cyan-400 text-white glow-cyan"
                      : "bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 text-slate-300"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {meta.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {screenLabel} • {meta.bpm} BPM
                    </div>
                  </div>
                  <span
                    className={`p-1.5 rounded border shrink-0 ${
                      isPreviewing
                        ? "bg-cyan-400 text-slate-950 border-cyan-300"
                        : "bg-slate-950 text-cyan-400 border-slate-700"
                    }`}
                  >
                    {isPreviewing ? (
                      <Square className="w-3 h-3 fill-slate-950" />
                    ) : (
                      <Play className="w-3 h-3 fill-cyan-400" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Jetpack Thruster Audio Toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/70 border border-slate-800 clip-chamfer">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white">
            Jetpack Thruster Hum
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Play continuous low-frequency thrust hum while boosting in flight.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            settings.updateSettings({ jetpackAudio: !settings.jetpackAudio });
            sounds.playUiClick();
          }}
          className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
            settings.jetpackAudio
              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
              : "bg-slate-900 border-slate-700 text-slate-400"
          }`}
        >
          {settings.jetpackAudio ? "ON" : "OFF"}
        </button>
      </div>

      {/* Squad Voice Chat Audio */}
      <div className="p-4 bg-slate-950/70 border border-emerald-500/25 clip-chamfer space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              {settings.voiceMuted ? (
                <MicOff className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              Squad Voice Comms (Incoming)
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Adjust or mute incoming player voice volume independently of game SFX.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              settings.updateSettings({ voiceMuted: !settings.voiceMuted });
            }}
            className={`shrink-0 px-3.5 sm:px-4 py-2 text-xs font-mono font-black uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
              !settings.voiceMuted
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                : "bg-rose-500/20 border-rose-400 text-rose-300"
            }`}
          >
            {settings.voiceMuted ? "MUTED" : "ENABLED"}
          </button>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Voice Volume
            </span>
            <span className="text-xs font-mono font-black text-emerald-300">
              {settings.voiceMuted || settings.voiceVolume === 0
                ? "Muted"
                : `${settings.voiceVolume}%`}
            </span>
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
          />
        </div>
      </div>

      {/* Sound Test Pad */}
      <div className="p-4 bg-slate-950/70 border border-cyan-500/25 clip-chamfer space-y-2.5">
        <div className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest">
          Sound Calibration Pad
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => sounds.playRifle()}
            className="py-2 px-2 xs:px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-[11px] xs:text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
          >
            Rifle Shot
          </button>
          <button
            type="button"
            onClick={() => sounds.playShotgun()}
            className="py-2 px-2 xs:px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400 text-[11px] xs:text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
          >
            Shotgun Blast
          </button>
          <button
            type="button"
            onClick={() => sounds.playExplosion()}
            className="py-2 px-2 xs:px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-rose-400 text-[11px] xs:text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
          >
            Explosion
          </button>
          <button
            type="button"
            onClick={() => sounds.playFlagCapture()}
            className="py-2 px-2 xs:px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400 text-[11px] xs:text-xs font-mono font-bold text-slate-200 clip-chamfer cursor-pointer"
          >
            Flag Capture
          </button>
        </div>
      </div>
    </div>
  );
}
