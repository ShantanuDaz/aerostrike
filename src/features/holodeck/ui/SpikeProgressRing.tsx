import { memo } from 'react';

interface SpikeProgressRingProps {
  action: 'planting' | 'defusing';
  progress: number; // in seconds
  total: number; // in seconds (4.0 for plant, 7.0 for defuse)
}

export const SpikeProgressRing = memo(function SpikeProgressRing({
  action,
  progress,
  total,
}: SpikeProgressRingProps) {
  const fraction = Math.min(1.0, Math.max(0, progress / total));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - fraction * circumference;

  const isPlant = action === 'planting';
  const color = isPlant ? '#06b6d4' : '#10b981'; // cyan for plant, emerald for defuse

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center select-none z-30">
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* SVG Circular Progress */}
        <svg className="w-full h-full -rotate-90">
          {/* Background Track */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="#1e293b"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Active Progress Bar */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-75"
          />
        </svg>

        {/* Halfway Defuse Milestone Notch (50%) */}
        {!isPlant && (
          <div
            className="absolute w-1 h-3 bg-white shadow-[0_0_4px_#fff]"
            style={{ top: '16px', left: '55px' }}
          />
        )}

        {/* Center Countdown & Action Label */}
        <div className="absolute flex flex-col items-center justify-center font-mono">
          <span className="text-xs font-black text-white tracking-widest uppercase">
            {isPlant ? 'PLANTING' : 'DEFUSING'}
          </span>
          <span className="text-[10px] text-cyan-300 font-bold">
            {(total - progress).toFixed(1)}s
          </span>
        </div>
      </div>
      <span className="mt-2 text-[10px] font-mono tracking-widest text-slate-300 uppercase bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
        HOLD [E]
      </span>
    </div>
  );
});
