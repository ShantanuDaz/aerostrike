/**
 * Procedural Scope Overlay Shader & Canvas Drawer.
 * Renders high-precision sniper scope vignette with blackout border, mil-dot crosshair lines,
 * and edge chromatic blur without any external raster textures.
 */
export function drawScopeOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spreadFactor = 0,
) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.42;

  ctx.save();

  // 1. Dark Blackout Mask outside scope aperture
  ctx.fillStyle = 'rgba(2, 6, 23, 0.98)';
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, true); // counter-clockwise cutout
  ctx.fill();

  // 2. Outer Scope Metallic Bevel Ring
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#0ea5e9';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner Subtle Reticle Circle
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Precision Crosshair Wires
  const spreadOffset = spreadFactor * 120;
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)'; // Neon ruby crosshairs
  ctx.lineWidth = 1.5;

  // Horizontal wires
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx - 8 - spreadOffset, cy);
  ctx.moveTo(cx + 8 + spreadOffset, cy);
  ctx.lineTo(cx + radius, cy);

  // Vertical wires
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy - 8 - spreadOffset);
  ctx.moveTo(cx, cy + 8 + spreadOffset);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // 4. Center Mil-Dot
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // 5. Telemetry Range Marks
  ctx.fillStyle = 'rgba(14, 165, 233, 0.8)';
  ctx.font = '10px monospace';
  ctx.fillText('OP-50 // 8X MAG', cx - radius + 20, cy - radius * 0.5);
  ctx.fillText('RANGE: AUTO-LOCK', cx - radius + 20, cy - radius * 0.5 + 14);

  ctx.restore();
}
