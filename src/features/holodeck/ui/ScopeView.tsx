import { useEffect, useRef } from 'react';
import { drawScopeOverlay } from '../weapons/shaders/scopeOverlayShader';

interface ScopeViewProps {
  isScoped: boolean;
  spreadFactor?: number;
}

export function ScopeView({ isScoped, spreadFactor = 0 }: ScopeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isScoped) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    drawScopeOverlay(ctx, width, height, spreadFactor);

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawScopeOverlay(ctx, window.innerWidth, window.innerHeight, spreadFactor);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isScoped, spreadFactor]);

  if (!isScoped) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-25 w-full h-full select-none"
    />
  );
}
