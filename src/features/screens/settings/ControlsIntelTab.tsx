import { useState } from 'react';
import {
  Bomb,
  Crosshair,
  Gamepad2,
  Keyboard,
  MapPin,
  Sliders,
  Smartphone,
  Vibrate,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { sounds } from '../../audio/soundEngine';
import {
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  computeAutoCameraZoom,
} from '../../camera/cameraMath';
import type { WeaponType } from '../../combat/types';
import { WEAPONS } from '../../combat/weaponsConfig';
import { getScaledStickMetrics } from '../../controls/touchStickMath';
import {
  DEFAULT_TOUCH_CONTROL_SCALE,
  MAX_TOUCH_CONTROL_OPACITY,
  MAX_TOUCH_CONTROL_SCALE,
  MAX_TOUCH_DEADZONE,
  MIN_TOUCH_CONTROL_OPACITY,
  MIN_TOUCH_CONTROL_SCALE,
  MIN_TOUCH_DEADZONE,
  type TouchAimMode,
  type TouchLayout,
  useSettingsStore,
} from '../../settings/settingsStore';
import { ControlsSampleMap, type ControlSelection } from './ControlsSampleMap';

const CONTROL_SIZE_PRESETS = [
  { scale: 0.7, label: 'Small' },
  { scale: 0.85, label: 'Compact' },
  { scale: 1.0, label: 'Standard' },
  { scale: 1.15, label: 'Large' },
];

const DEADZONE_PRESETS = [
  { dz: 4, label: 'Tight' },
  { dz: 6, label: 'Normal' },
  { dz: 10, label: 'Wide' },
];

const WEAPON_OPTIONS: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'rocket', 'pistol'];

const SELECTOR_CHIPS: { id: ControlSelection; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'move', label: 'Move Stick' },
  { id: 'aim', label: 'Aim & Fire' },
  { id: 'actions', label: 'Action Btns' },
  { id: 'camera', label: 'Zoom' },
  { id: 'bindings', label: 'Keys' },
];

export function ControlsIntelTab() {
  const settings = useSettingsStore();
  const [selectedControl, setSelectedControl] = useState<ControlSelection>('all');
  const [framingSpot, setFramingSpot] = useState<'center' | 'red_flag'>('center');

  const autoPreviewZoom =
    typeof window !== 'undefined'
      ? computeAutoCameraZoom(window.innerWidth, window.innerHeight)
      : 1;
  const activeZoomDisplay =
    settings.cameraZoomMode === 'auto' ? autoPreviewZoom : settings.cameraZoom;

  const previewMetrics = getScaledStickMetrics(
    settings.touchControlScale,
    settings.touchStickDeadzone,
  );
  const previewBtnW = Math.round(52 * previewMetrics.scale);
  const previewBtnH = Math.round(44 * previewMetrics.scale);

  const showSizeOpacity =
    selectedControl === 'all' ||
    selectedControl === 'move' ||
    selectedControl === 'aim' ||
    selectedControl === 'actions';
  const showDeadzone =
    selectedControl === 'all' || selectedControl === 'move' || selectedControl === 'aim';
  const showCamera = selectedControl === 'all' || selectedControl === 'camera';
  const showHandedness =
    selectedControl === 'all' || selectedControl === 'move' || selectedControl === 'actions';
  const showAimMode = selectedControl === 'all' || selectedControl === 'aim';
  const showActionsExtras =
    selectedControl === 'all' || selectedControl === 'actions';
  const showMoveOrAimToggles =
    selectedControl === 'all' ||
    selectedControl === 'move' ||
    selectedControl === 'aim' ||
    selectedControl === 'actions' ||
    selectedControl === 'camera';
  const showBindings = selectedControl === 'all' || selectedControl === 'bindings';

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col min-[520px]:flex-row gap-2.5 sm:gap-4 overflow-hidden">
      {/* Pinned Interactive Sample Map with ONLY Controls */}
      <div className="h-[195px] xs:h-[215px] min-[520px]:h-full min-[520px]:flex-1 min-w-0 shrink-0 min-[520px]:shrink flex flex-col">
        <ControlsSampleMap
          selectedControl={selectedControl}
          onSelectControl={setSelectedControl}
          framingSpot={framingSpot}
          onChangeFramingSpot={setFramingSpot}
        />
      </div>

      {/* Scrollable Right Control Inspector */}
      <div className="flex-1 min-[520px]:flex-none min-[520px]:w-[265px] sm:w-[300px] lg:w-[355px] min-h-0 h-full flex flex-col overflow-hidden bg-slate-950/55 border border-slate-800 clip-chamfer">
        {/* Sticky Inspector Target Bar */}
        <div className="shrink-0 p-2 sm:p-2.5 border-b border-slate-800 bg-slate-950/90 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 truncate">
              <Gamepad2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {selectedControl === 'all'
                ? 'All Control Settings'
                : selectedControl === 'move'
                  ? 'Editing: Move Stick'
                  : selectedControl === 'aim'
                    ? 'Editing: Aim & Fire Stick'
                    : selectedControl === 'actions'
                      ? 'Editing: Action Buttons'
                      : selectedControl === 'camera'
                        ? 'Editing: Camera & Zoom'
                        : 'Keybindings & Guide'}
            </span>
            <span className="text-[9.5px] font-mono font-bold text-slate-400 shrink-0">
              {Math.round(settings.touchControlScale * 100)}% • {activeZoomDisplay.toFixed(2)}x
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto cyber-scroll pb-0.5">
            {SELECTOR_CHIPS.map((chip) => {
              const active = selectedControl === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    setSelectedControl(chip.id);
                  }}
                  className={`shrink-0 px-2 py-1 text-[9.5px] font-mono font-bold uppercase clip-chamfer border cursor-pointer transition ${
                    active
                      ? 'bg-cyan-500/25 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Options Body */}
        <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll p-2.5 sm:p-3 flex flex-col gap-3">
          {/* Touch Controls Size, Opacity & Deadzone */}
          {showSizeOpacity && (
            <div className="bg-slate-950/80 border border-cyan-500/30 p-3 clip-chamfer space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 shrink-0" /> Size &amp; Opacity
                </div>
                <span className="px-2 py-0.5 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-black clip-chamfer">
                  {Math.round(settings.touchControlScale * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {CONTROL_SIZE_PRESETS.map((preset) => {
                  const active = Math.abs(settings.touchControlScale - preset.scale) < 0.025;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        sounds.playUiClick();
                        settings.updateSettings({ touchControlScale: preset.scale });
                      }}
                      className={`py-1.5 px-1 text-[9.5px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition flex flex-col items-center leading-tight ${
                        active
                          ? 'bg-cyan-500/25 border-cyan-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{preset.label}</span>
                      <span className="text-[8.5px] text-cyan-300/80">
                        {Math.round(preset.scale * 100)}%
                        {preset.scale === DEFAULT_TOUCH_CONTROL_SCALE ? '•' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                type="range"
                min={MIN_TOUCH_CONTROL_SCALE}
                max={MAX_TOUCH_CONTROL_SCALE}
                step={0.05}
                value={settings.touchControlScale}
                onChange={(e) =>
                  settings.updateSettings({ touchControlScale: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
                aria-label="Touch Controls Size"
              />

              <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 bg-slate-900/70 border border-slate-800 px-2 py-1 clip-chamfer">
                <span>
                  Pad: <strong className="text-slate-200">{previewMetrics.movePadSize}px</strong>
                </span>
                <span>
                  Btn:{' '}
                  <strong className="text-slate-200">
                    {previewBtnW}×{previewBtnH}
                  </strong>
                </span>
                <span>
                  Hit: <strong className="text-slate-200">{previewMetrics.stickHitRadius}px</strong>
                </span>
              </div>

              {/* Opacity */}
              <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-white">Controls Opacity</span>
                  <span className="font-mono font-black text-cyan-300 text-[10.5px]">
                    {Math.round(settings.touchControlOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_TOUCH_CONTROL_OPACITY}
                  max={MAX_TOUCH_CONTROL_OPACITY}
                  step={0.05}
                  value={settings.touchControlOpacity}
                  onChange={(e) =>
                    settings.updateSettings({ touchControlOpacity: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                  aria-label="Touch Controls Opacity"
                />
              </div>

              {/* Deadzone */}
              {showDeadzone && (
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white">Stick Deadzone</span>
                    <span className="font-mono font-black text-cyan-300 text-[10.5px]">
                      {settings.touchStickDeadzone}px
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {DEADZONE_PRESETS.map((p) => (
                      <button
                        key={p.dz}
                        type="button"
                        onClick={() => {
                          sounds.playUiClick();
                          settings.updateSettings({ touchStickDeadzone: p.dz });
                        }}
                        className={`py-1 px-1 text-[9.5px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                          settings.touchStickDeadzone === p.dz
                            ? 'bg-cyan-500/25 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={MIN_TOUCH_DEADZONE}
                    max={MAX_TOUCH_DEADZONE}
                    step={1}
                    value={settings.touchStickDeadzone}
                    onChange={(e) =>
                      settings.updateSettings({ touchStickDeadzone: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                    aria-label="Stick Deadzone"
                  />
                </div>
              )}
            </div>
          )}

          {/* Camera Zoom */}
          {showCamera && (
            <div className="bg-slate-950/80 border border-cyan-500/30 p-3 clip-chamfer space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 shrink-0" /> Default Camera Zoom
                </div>
                <span className="px-2 py-0.5 bg-slate-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-black clip-chamfer">
                  {settings.cameraZoomMode === 'auto' ? 'AUTO ' : ''}
                  {activeZoomDisplay.toFixed(2)}x
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ cameraZoomMode: 'auto' });
                  }}
                  className={`py-1.5 px-2 text-[10px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                    settings.cameraZoomMode === 'auto'
                      ? 'bg-cyan-500/25 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Auto ({autoPreviewZoom.toFixed(2)}x)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ cameraZoomMode: 'custom' });
                  }}
                  className={`py-1.5 px-2 text-[10px] font-mono font-black uppercase border clip-chamfer cursor-pointer transition ${
                    settings.cameraZoomMode === 'custom'
                      ? 'bg-cyan-500/25 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Custom ({settings.cameraZoom.toFixed(2)}x)
                </button>
              </div>

              <input
                type="range"
                min={MIN_CAMERA_ZOOM}
                max={MAX_CAMERA_ZOOM}
                step={0.05}
                value={
                  settings.cameraZoomMode === 'auto' ? autoPreviewZoom : settings.cameraZoom
                }
                onChange={(e) =>
                  settings.updateSettings({
                    cameraZoomMode: 'custom',
                    cameraZoom: Number(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 cursor-pointer"
                aria-label="Default Camera Zoom"
              />

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { z: 0.55, label: '0.55x Wide' },
                  { z: 0.7, label: '0.70x Mob' },
                  { z: 0.85, label: '0.85x Tac' },
                  { z: 1.0, label: '1.00x Std' },
                  { z: 1.2, label: '1.20x Close' },
                ].map((preset) => (
                  <button
                    key={preset.z}
                    type="button"
                    onClick={() => {
                      sounds.playUiClick();
                      settings.updateSettings({
                        cameraZoomMode: 'custom',
                        cameraZoom: preset.z,
                      });
                    }}
                    className={`px-2 py-1 text-[9.5px] font-mono font-bold border clip-chamfer cursor-pointer ${
                      settings.cameraZoomMode === 'custom' &&
                      Math.abs(settings.cameraZoom - preset.z) < 0.02
                        ? 'bg-cyan-500/25 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setFramingSpot(framingSpot === 'center' ? 'red_flag' : 'center');
                }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-700 hover:border-rose-400/50 clip-chamfer text-[10px] font-mono text-slate-200 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-rose-400" />
                  Preview Arena Edge Overscan
                </span>
                <span className="text-cyan-300 font-bold uppercase">
                  {framingSpot === 'red_flag' ? 'Red Flag' : 'Center'}
                </span>
              </button>
            </div>
          )}

          {/* Handedness / Aim Mode / Action Buttons */}
          {(showHandedness || showAimMode || showActionsExtras) && (
            <div className="bg-slate-950/80 border border-slate-800 p-3 clip-chamfer space-y-3">
              {showAimMode && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                    Aim Stick Fire Mode
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Perimeter fires on the outer ring; Instant fires immediately when dragging past deadzone.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'precision', label: 'Perimeter' },
                        { id: 'instant', label: 'Instant Drag' },
                      ] as { id: TouchAimMode; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          sounds.playUiClick();
                          settings.updateSettings({ touchAimMode: opt.id });
                        }}
                        className={`py-1.5 px-2 text-[10px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                          settings.touchAimMode === opt.id
                            ? 'bg-amber-500/25 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showHandedness && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80 first:border-t-0 first:pt-0">
                  <div className="text-[11px] font-bold text-white">Thumb Cluster Layout</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'right_handed', label: 'Right-Handed' },
                        { id: 'left_handed', label: 'Left-Handed' },
                      ] as { id: TouchLayout; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          sounds.playUiClick();
                          settings.updateSettings({ touchLayout: opt.id });
                        }}
                        className={`py-1.5 px-2 text-[10px] font-mono font-bold uppercase border clip-chamfer cursor-pointer transition ${
                          settings.touchLayout === opt.id
                            ? 'bg-cyan-500/25 border-cyan-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showActionsExtras && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80 first:border-t-0 first:pt-0">
                  <div className="text-[11px] font-bold text-white">Default Quick-Switch Weapon</div>
                  <div className="grid grid-cols-5 gap-1">
                    {WEAPON_OPTIONS.map((wId) => {
                      const active = settings.defaultWeapon === wId;
                      return (
                        <button
                          key={wId}
                          type="button"
                          onClick={() => {
                            sounds.playWeaponSound(wId);
                            settings.updateSettings({ defaultWeapon: wId });
                          }}
                          className={`py-1 text-[9.5px] font-mono font-bold uppercase border clip-chamfer cursor-pointer ${
                            active
                              ? 'bg-cyan-500/25 border-cyan-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {WEAPONS[wId].name.split(' ').pop()?.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Toggles */}
          {showMoveOrAimToggles && (
            <div className="grid grid-cols-1 gap-1.5">
              {(selectedControl === 'all' || selectedControl === 'aim') && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ touchAimLine: !settings.touchAimLine });
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
                    settings.touchAimLine
                      ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10.5px] font-mono font-bold uppercase">Aim Laser Line</span>
                  <span className="text-[10px] font-mono font-black">
                    {settings.touchAimLine ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {(selectedControl === 'all' || selectedControl === 'actions') && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({
                      showTouchGrenadeButton: !settings.showTouchGrenadeButton,
                    });
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
                    settings.showTouchGrenadeButton
                      ? 'bg-lime-500/15 border-lime-400/70 text-lime-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10.5px] font-mono font-bold uppercase flex items-center gap-1.5">
                    <Bomb className="w-3.5 h-3.5 shrink-0" />
                    Frag Grenade Button
                  </span>
                  <span className="text-[10px] font-mono font-black">
                    {settings.showTouchGrenadeButton ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {(selectedControl === 'all' ||
                selectedControl === 'move' ||
                selectedControl === 'aim') && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ showTouchHints: !settings.showTouchHints });
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
                    settings.showTouchHints
                      ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10.5px] font-mono font-bold uppercase">Stick Hint Labels</span>
                  <span className="text-[10px] font-mono font-black">
                    {settings.showTouchHints ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {(selectedControl === 'all' || selectedControl === 'actions') && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ hapticsEnabled: !settings.hapticsEnabled });
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
                    settings.hapticsEnabled
                      ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10.5px] font-mono font-bold uppercase flex items-center gap-1.5">
                    <Vibrate className="w-3.5 h-3.5 shrink-0" />
                    Haptics
                  </span>
                  <span className="text-[10px] font-mono font-black">
                    {settings.hapticsEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {(selectedControl === 'all' || selectedControl === 'camera') && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playUiClick();
                    settings.updateSettings({ screenShake: !settings.screenShake });
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 border clip-chamfer text-left cursor-pointer transition ${
                    settings.screenShake
                      ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10.5px] font-mono font-bold uppercase flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    Combat Screen Shake
                  </span>
                  <span className="text-[10px] font-mono font-black">
                    {settings.screenShake ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Desktop Keybindings & Mobile Guide */}
          {showBindings && (
            <div className="space-y-3">
              <div className="bg-slate-950/80 border border-slate-800 p-3 clip-chamfer space-y-2">
                <div className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5" /> Desktop Keybindings
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {[
                    ['A / D or ← / →', 'Strafe Left / Right'],
                    ['W / Space / ↑', 'Fire Jetpack & Hop'],
                    ['S / ↓', 'Drop Through Platforms'],
                    ['Shift / E', 'Thruster Air-Dash'],
                    ['Mouse + Click', '360° Aim & Shoot'],
                    ['G / Right Click', 'Throw Frag Grenade'],
                    ['Wheel / + / - / 0', 'Camera Zoom / Auto'],
                    ['1 – 5 / Q', 'Weapon / Quick Cycle'],
                    ['Tab / Esc', 'Scoreboard / Menu'],
                  ].map(([key, desc]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 pb-1 border-b border-slate-900 last:border-0"
                    >
                      <span className="shrink-0 whitespace-nowrap text-[9.5px] font-mono font-bold text-cyan-200 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {key}
                      </span>
                      <span className="text-slate-300 text-right text-[10.5px]">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3 clip-chamfer space-y-1.5">
                <div className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Touch Guide
                </div>
                <ul className="space-y-1.5 text-[10.5px] text-slate-300 list-disc list-inside leading-snug">
                  <li>
                    <strong className="text-white">Move Stick:</strong> Drag left/right to strafe, up to boost jetpack, down to drop through platforms.
                  </li>
                  <li>
                    <strong className="text-white">Aim Stick:</strong> Push to outer ring (Perimeter) or drag past deadzone (Instant) to shoot.
                  </li>
                  <li>
                    <strong className="text-white">Frag Button:</strong> Tap to lob a bouncing Frag Grenade along your aim line (Supply stations refill grenades).
                  </li>
                  <li>
                    <strong className="text-white">Radar Zoom Pill:</strong> Tap − / Auto / + on the battlefield to zoom anytime.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
