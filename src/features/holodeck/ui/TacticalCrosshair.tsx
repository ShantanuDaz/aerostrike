import { memo } from 'react';

interface TacticalCrosshairProps {
  spreadRadius: number; // in pixels
  isScoped?: boolean;
}

export const TacticalCrosshair = memo(function TacticalCrosshair({
  spreadRadius,
  isScoped = false,
}: TacticalCrosshairProps) {
  if (isScoped) return null; // Scope view renders its own sniper overlay

  const gap = Math.max(3, Math.min(32, 4 + spreadRadius * 120));
  const tickLength = 7;
  const tickThickness = 2;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none z-20">
      {/* Center dot */}
      <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_#06b6d4]" />

      {/* Top tick */}
      <div
        className="absolute bg-cyan-300 shadow-[0_0_3px_#06b6d4]"
        style={{
          width: tickThickness,
          height: tickLength,
          transform: `translateY(-${gap + tickLength / 2}px)`,
        }}
      />
      {/* Bottom tick */}
      <div
        className="absolute bg-cyan-300 shadow-[0_0_3px_#06b6d4]"
        style={{
          width: tickThickness,
          height: tickLength,
          transform: `translateY(${gap + tickLength / 2}px)`,
        }}
      />
      {/* Left tick */}
      <div
        className="absolute bg-cyan-300 shadow-[0_0_3px_#06b6d4]"
        style={{
          width: tickLength,
          height: tickThickness,
          transform: `translateX(-${gap + tickLength / 2}px)`,
        }}
      />
      {/* Right tick */}
      <div
        className="absolute bg-cyan-300 shadow-[0_0_3px_#06b6d4]"
        style={{
          width: tickLength,
          height: tickThickness,
          transform: `translateX(${gap + tickLength / 2}px)`,
        }}
      />
    </div>
  );
});
