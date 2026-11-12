import type { Camera } from '../camera';
import type { GameMap, MapThemeId } from './types';

export interface ThemePalette {
  id: MapThemeId;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  nebulaPrimary: string;
  nebulaSecondary: string;
  farRidge: string;
  farRidgeHighlight: string;
  midRidge: string;
  midStructure: string;
  midAccent: string;
  shaftColor: string;
  particleColor: string;
  particleKind: 'ember' | 'snow' | 'dust' | 'spark';
  celestialKind:
    | 'eclipsed_ringed_planet'
    | 'twin_moons'
    | 'solar_nimbus'
    | 'cryo_skylight'
    | 'vault_arches'
    | 'orbital_ring';
  celestialCore: string;
  celestialGlow: string;
  turbineColor: string;
  conduitColor: string;
  starTint: string;
  starCount: number;
  previewBgTop: string;
  previewBgBottom: string;
  terrainRock: string;
  terrainRockAlt: string;
  terrainTrim: string;
}

const THEME_PALETTES: Record<MapThemeId, ThemePalette> = {
  caldera_orbital: {
    id: 'caldera_orbital',
    skyTop: '#0b0816',
    skyMid: '#1f1024',
    skyHorizon: '#3b1518',
    nebulaPrimary: 'rgba(249, 115, 22, 0.14)',
    nebulaSecondary: 'rgba(56, 189, 248, 0.08)',
    farRidge: '#1c1221',
    farRidgeHighlight: 'rgba(251, 146, 60, 0.24)',
    midRidge: '#140e19',
    midStructure: '#0f0b14',
    midAccent: 'rgba(249, 115, 22, 0.42)',
    shaftColor: 'rgba(251, 146, 60, 0.045)',
    particleColor: '#fb923c',
    particleKind: 'ember',
    celestialKind: 'eclipsed_ringed_planet',
    celestialCore: '#140c1c',
    celestialGlow: '#fb923c',
    turbineColor: 'rgba(51, 35, 45, 0.55)',
    conduitColor: 'rgba(251, 146, 60, 0.14)',
    starTint: 'rgba(254, 215, 170, 0.85)',
    starCount: 48,
    previewBgTop: '#160c1d',
    previewBgBottom: '#2b1218',
    terrainRock: '#1e1926',
    terrainRockAlt: '#2e2234',
    terrainTrim: '#fb923c',
  },
  canyon_outpost: {
    id: 'canyon_outpost',
    skyTop: '#060a16',
    skyMid: '#0f172a',
    skyHorizon: '#1e2235',
    nebulaPrimary: 'rgba(56, 189, 248, 0.10)',
    nebulaSecondary: 'rgba(244, 63, 94, 0.08)',
    farRidge: '#141c2f',
    farRidgeHighlight: 'rgba(56, 189, 248, 0.22)',
    midRidge: '#0e1525',
    midStructure: '#0b101d',
    midAccent: 'rgba(56, 189, 248, 0.36)',
    shaftColor: 'rgba(125, 211, 252, 0.04)',
    particleColor: '#38bdf8',
    particleKind: 'dust',
    celestialKind: 'twin_moons',
    celestialCore: '#1e293b',
    celestialGlow: '#38bdf8',
    turbineColor: 'rgba(30, 41, 59, 0.58)',
    conduitColor: 'rgba(56, 189, 248, 0.14)',
    starTint: 'rgba(186, 230, 253, 0.9)',
    starCount: 64,
    previewBgTop: '#080e1d',
    previewBgBottom: '#171d2f',
    terrainRock: '#182235',
    terrainRockAlt: '#233149',
    terrainTrim: '#38bdf8',
  },
  sky_citadel: {
    id: 'sky_citadel',
    skyTop: '#050b1d',
    skyMid: '#0d2142',
    skyHorizon: '#18365c',
    nebulaPrimary: 'rgba(34, 211, 238, 0.14)',
    nebulaSecondary: 'rgba(129, 140, 248, 0.12)',
    farRidge: '#0f2342',
    farRidgeHighlight: 'rgba(103, 232, 249, 0.28)',
    midRidge: '#0b1b34',
    midStructure: '#081326',
    midAccent: 'rgba(34, 211, 238, 0.45)',
    shaftColor: 'rgba(165, 243, 252, 0.05)',
    particleColor: '#a5f3fc',
    particleKind: 'spark',
    celestialKind: 'solar_nimbus',
    celestialCore: '#e0f2fe',
    celestialGlow: '#22d3ee',
    turbineColor: 'rgba(20, 48, 78, 0.52)',
    conduitColor: 'rgba(34, 211, 238, 0.16)',
    starTint: 'rgba(224, 242, 254, 0.85)',
    starCount: 54,
    previewBgTop: '#07132b',
    previewBgBottom: '#132a4a',
    terrainRock: '#132642',
    terrainRockAlt: '#1e3a5f',
    terrainTrim: '#22d3ee',
  },
  cryo_reactor: {
    id: 'cryo_reactor',
    skyTop: '#040b14',
    skyMid: '#0a1e2e',
    skyHorizon: '#102b3d',
    nebulaPrimary: 'rgba(45, 212, 191, 0.12)',
    nebulaSecondary: 'rgba(56, 189, 248, 0.12)',
    farRidge: '#0d2233',
    farRidgeHighlight: 'rgba(94, 234, 212, 0.26)',
    midRidge: '#091826',
    midStructure: '#07121c',
    midAccent: 'rgba(45, 212, 191, 0.40)',
    shaftColor: 'rgba(153, 246, 228, 0.045)',
    particleColor: '#99f6e4',
    particleKind: 'snow',
    celestialKind: 'cryo_skylight',
    celestialCore: '#134e4a',
    celestialGlow: '#2dd4bf',
    turbineColor: 'rgba(19, 54, 72, 0.62)',
    conduitColor: 'rgba(45, 212, 191, 0.16)',
    starTint: 'rgba(204, 251, 241, 0.8)',
    starCount: 30,
    previewBgTop: '#05111e',
    previewBgBottom: '#0e2838',
    terrainRock: '#122638',
    terrainRockAlt: '#1a384e',
    terrainTrim: '#5eead4',
  },
  bunker_vault: {
    id: 'bunker_vault',
    skyTop: '#090b10',
    skyMid: '#131820',
    skyHorizon: '#1e2228',
    nebulaPrimary: 'rgba(245, 158, 11, 0.10)',
    nebulaSecondary: 'rgba(56, 189, 248, 0.06)',
    farRidge: '#181e28',
    farRidgeHighlight: 'rgba(245, 158, 11, 0.22)',
    midRidge: '#12161f',
    midStructure: '#0c0f16',
    midAccent: 'rgba(245, 158, 11, 0.36)',
    shaftColor: 'rgba(251, 191, 36, 0.035)',
    particleColor: '#fbbf24',
    particleKind: 'spark',
    celestialKind: 'vault_arches',
    celestialCore: '#1f2937',
    celestialGlow: '#f59e0b',
    turbineColor: 'rgba(38, 46, 58, 0.68)',
    conduitColor: 'rgba(245, 158, 11, 0.14)',
    starTint: 'rgba(253, 230, 138, 0.5)',
    starCount: 14,
    previewBgTop: '#0b0e14',
    previewBgBottom: '#1a2029',
    terrainRock: '#1e2632',
    terrainRockAlt: '#2a3545',
    terrainTrim: '#f59e0b',
  },
  training_deck: {
    id: 'training_deck',
    skyTop: '#0a0f1a',
    skyMid: '#131d2e',
    skyHorizon: '#1c283d',
    nebulaPrimary: 'rgba(56, 189, 248, 0.11)',
    nebulaSecondary: 'rgba(16, 185, 129, 0.08)',
    farRidge: '#162233',
    farRidgeHighlight: 'rgba(56, 189, 248, 0.22)',
    midRidge: '#111a28',
    midStructure: '#0d1420',
    midAccent: 'rgba(56, 189, 248, 0.34)',
    shaftColor: 'rgba(125, 211, 252, 0.04)',
    particleColor: '#7dd3fc',
    particleKind: 'dust',
    celestialKind: 'orbital_ring',
    celestialCore: '#1e293b',
    celestialGlow: '#38bdf8',
    turbineColor: 'rgba(30, 41, 59, 0.55)',
    conduitColor: 'rgba(56, 189, 248, 0.14)',
    starTint: 'rgba(186, 230, 253, 0.85)',
    starCount: 44,
    previewBgTop: '#0b1220',
    previewBgBottom: '#162338',
    terrainRock: '#1f2b3d',
    terrainRockAlt: '#2a3b52',
    terrainTrim: '#38bdf8',
  },
};

export function resolveMapTheme(map: GameMap): MapThemeId {
  if (map.theme && map.theme in THEME_PALETTES) {
    return map.theme;
  }
  if (map.id === 'helios-caldera') return 'caldera_orbital';
  if (map.id === 'ctf-canyon-arena') return 'canyon_outpost';
  if (map.id === 'sky-citadel') return 'sky_citadel';
  if (map.id === 'cryo-facility') return 'cryo_reactor';
  if (map.id === 'bunker') return 'bunker_vault';
  return 'training_deck';
}

export function getMapThemePalette(map: GameMap): ThemePalette {
  return THEME_PALETTES[resolveMapTheme(map)];
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

function createRng(seedStr: string): () => number {
  let state = hashSeed(seedStr);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BackdropParticle {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  r: number;
  alpha: number;
  phase: number;
}

interface HarmonicSpec {
  freq: number;
  amp: number;
  phase: number;
  ridged?: boolean;
}

export interface BackdropCache {
  key: string;
  viewW: number;
  viewH: number;
  periodW: number;
  skyCanvas: HTMLCanvasElement;
  farCanvas: HTMLCanvasElement;
  midCanvas: HTMLCanvasElement;
  particles: BackdropParticle[];
  stars: { x: number; y: number; r: number; alpha: number; offset: number }[];
}

function evalHarmonics(tNorm: number, harmonics: HarmonicSpec[]): number {
  let sum = 0;
  for (let i = 0; i < harmonics.length; i++) {
    const h = harmonics[i];
    const angle = Math.PI * 2 * h.freq * tNorm + h.phase;
    const val = Math.sin(angle);
    sum += (h.ridged ? 1 - Math.abs(val) * 1.45 : val) * h.amp;
  }
  return sum;
}

function drawCelestial(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: ThemePalette,
): void {
  const cx = w * 0.72;
  const cy = h * 0.25;
  const radius = Math.max(44, Math.min(w, h) * 0.13);

  ctx.save();
  if (palette.celestialKind === 'eclipsed_ringed_planet') {
    // Soft outer corona
    const aura = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 2.5);
    aura.addColorStop(0, 'rgba(251, 146, 60, 0.30)');
    aura.addColorStop(0.5, 'rgba(249, 115, 22, 0.08)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Tilted shattered orbital ring (back half)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.26);
    ctx.strokeStyle = 'rgba(253, 186, 116, 0.26)';
    ctx.lineWidth = Math.max(2, radius * 0.065);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.95, radius * 0.42, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Eclipsed planet disc
    ctx.fillStyle = palette.celestialCore;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eclipse crescent rim
    const rimGrad = ctx.createRadialGradient(
      cx + radius * 0.28,
      cy + radius * 0.15,
      radius * 0.75,
      cx,
      cy,
      radius * 1.05,
    );
    rimGrad.addColorStop(0, 'rgba(20, 12, 28, 0)');
    rimGrad.addColorStop(0.84, 'rgba(251, 146, 60, 0.22)');
    rimGrad.addColorStop(1, 'rgba(253, 186, 116, 0.62)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Tilted ring (front half)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.26);
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.42)';
    ctx.lineWidth = Math.max(2, radius * 0.065);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.95, radius * 0.42, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 2.18, radius * 0.47, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.restore();
  } else if (palette.celestialKind === 'twin_moons') {
    const r1 = radius * 0.85;
    const g1 = ctx.createRadialGradient(w * 0.74 - r1 * 0.35, cy - r1 * 0.3, 4, w * 0.74, cy, r1);
    g1.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    g1.addColorStop(0.55, '#17253b');
    g1.addColorStop(1, '#090e1a');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(w * 0.74, cy, r1, 0, Math.PI * 2);
    ctx.fill();

    const r2 = radius * 0.38;
    const m2x = w * 0.61;
    const m2y = cy + r1 * 0.45;
    const g2 = ctx.createRadialGradient(m2x - r2 * 0.3, m2y - r2 * 0.3, 2, m2x, m2y, r2);
    g2.addColorStop(0, 'rgba(251, 113, 133, 0.32)');
    g2.addColorStop(0.6, '#271726');
    g2.addColorStop(1, '#0a0d17');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(m2x, m2y, r2, 0, Math.PI * 2);
    ctx.fill();
  } else if (palette.celestialKind === 'solar_nimbus') {
    const sunGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius * 2.2);
    sunGrad.addColorStop(0, 'rgba(224, 242, 254, 0.42)');
    sunGrad.addColorStop(0.28, 'rgba(34, 211, 238, 0.22)');
    sunGrad.addColorStop(1, 'rgba(5, 11, 29, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Giant orbital citadel ring bisecting the upper sky
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.14)';
    ctx.lineWidth = Math.max(3, h * 0.012);
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 1.15, w * 0.92, h * 0.98, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  } else if (palette.celestialKind === 'cryo_skylight') {
    // Geodesic ice dome ribs across ceiling glow
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.1, 10, w * 0.5, h * 0.1, w * 0.6);
    glow.addColorStop(0, 'rgba(94, 234, 212, 0.16)');
    glow.addColorStop(1, 'rgba(4, 11, 20, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(45, 212, 191, 0.08)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + i * w * 0.16, 0);
      ctx.quadraticCurveTo(w * 0.5 + i * w * 0.26, h * 0.35, w * 0.5 + i * w * 0.34, h);
      ctx.stroke();
    }
  } else if (palette.celestialKind === 'vault_arches') {
    // Heavy industrial concrete rib vaulting
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.lineWidth = Math.max(4, w * 0.014);
    for (let i = 0; i < 4; i++) {
      const rx = w * (0.14 + i * 0.24);
      ctx.beginPath();
      ctx.arc(rx, h * 0.58, w * 0.18, Math.PI, 0);
      ctx.stroke();
    }
  } else {
    // Orbital drydock arc
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 1.05, w * 0.8, h * 0.85, -0.06, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.restore();
}

function buildSkyCanvas(
  w: number,
  h: number,
  palette: ThemePalette,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, palette.skyTop);
  skyGrad.addColorStop(0.58, palette.skyMid);
  skyGrad.addColorStop(1, palette.skyHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Twin subtle atmosphere/nebula clouds
  const neb1 = ctx.createRadialGradient(w * 0.24, h * 0.36, 15, w * 0.24, h * 0.36, Math.max(w, h) * 0.62);
  neb1.addColorStop(0, palette.nebulaPrimary);
  neb1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, w, h);

  const neb2 = ctx.createRadialGradient(w * 0.78, h * 0.44, 15, w * 0.78, h * 0.44, Math.max(w, h) * 0.56);
  neb2.addColorStop(0, palette.nebulaSecondary);
  neb2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, w, h);

  drawCelestial(ctx, w, h, palette);
  return canvas;
}

function buildFarCanvas(
  periodW: number,
  h: number,
  palette: ThemePalette,
  rng: () => number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, periodW);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const isRidged =
    palette.id === 'caldera_orbital' ||
    palette.id === 'canyon_outpost' ||
    palette.id === 'cryo_reactor';

  const harmonics: HarmonicSpec[] = [
    { freq: 1, amp: h * 0.065, phase: rng() * Math.PI * 2, ridged: isRidged },
    { freq: 2, amp: h * 0.045, phase: rng() * Math.PI * 2, ridged: isRidged },
    { freq: 3, amp: h * 0.032, phase: rng() * Math.PI * 2 },
    { freq: 5, amp: h * 0.018, phase: rng() * Math.PI * 2, ridged: isRidged },
    { freq: 9, amp: h * 0.008, phase: rng() * Math.PI * 2 },
  ];

  // Diagonal crepuscular light shafts
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const bx = periodW * (0.12 + i * 0.24) + (rng() - 0.5) * 40;
    const width = 70 + rng() * 90;
    const shaftGrad = ctx.createLinearGradient(bx, 0, bx + width * 1.4, h * 0.85);
    shaftGrad.addColorStop(0, palette.shaftColor);
    shaftGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + width, 0);
    ctx.lineTo(bx + width * 2.5, h);
    ctx.lineTo(bx + width * 1.1, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Floating sky citadel spires if aerial theme
  if (palette.id === 'sky_citadel') {
    for (let i = 0; i < 6; i++) {
      const ix = periodW * ((i + 0.35) / 6);
      const iy = h * (0.42 + (rng() - 0.5) * 0.14);
      const iw = 90 + rng() * 110;
      const ih = 36 + rng() * 44;
      ctx.fillStyle = palette.farRidge;
      ctx.beginPath();
      ctx.moveTo(ix - iw * 0.5, iy);
      ctx.lineTo(ix + iw * 0.5, iy);
      ctx.lineTo(ix + iw * 0.22, iy + ih);
      ctx.lineTo(ix, iy + ih * 1.3);
      ctx.lineTo(ix - iw * 0.28, iy + ih);
      ctx.closePath();
      ctx.fill();

      // Spire silhouette atop floating island
      ctx.fillRect(ix - 8, iy - 42, 16, 42);
      ctx.fillStyle = palette.farRidgeHighlight;
      ctx.fillRect(ix - iw * 0.45, iy, iw * 0.9, 1.5);
    }
  }

  // Far mountain / canyon / ice silhouette band
  const baseLine = palette.id === 'sky_citadel' ? h * 0.80 : h * 0.62;
  const step = 10;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= periodW; x += step) {
    const tNorm = x / periodW;
    let y = baseLine - Math.abs(evalHarmonics(tNorm, harmonics));
    if (palette.id === 'canyon_outpost') {
      // Terrace quantization gives stepped sandstone mesa silhouettes
      y = Math.round(y / 14) * 14;
    }
    ctx.lineTo(x, y);
  }
  ctx.lineTo(periodW, h);
  ctx.closePath();

  const ridgeGrad = ctx.createLinearGradient(0, baseLine - h * 0.2, 0, h);
  ridgeGrad.addColorStop(0, palette.farRidge);
  ridgeGrad.addColorStop(1, palette.midRidge);
  ctx.fillStyle = ridgeGrad;
  ctx.fill();

  // Crisp subtle rim light along top contour
  ctx.beginPath();
  for (let x = 0; x <= periodW; x += step) {
    const tNorm = x / periodW;
    let y = baseLine - Math.abs(evalHarmonics(tNorm, harmonics));
    if (palette.id === 'canyon_outpost') {
      y = Math.round(y / 14) * 14;
    }
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = palette.farRidgeHighlight;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Cryo stalactites along ceiling when indoor cryo cavern
  if (palette.id === 'cryo_reactor') {
    ctx.fillStyle = palette.farRidge;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= periodW; x += 14) {
      const drop = 26 + Math.abs(evalHarmonics(x / periodW, harmonics)) * 0.65;
      ctx.lineTo(x, drop);
    }
    ctx.lineTo(periodW, 0);
    ctx.closePath();
    ctx.fill();
  }

  return canvas;
}

function buildMidCanvas(
  periodW: number,
  h: number,
  palette: ThemePalette,
  rng: () => number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, periodW);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const harmonics: HarmonicSpec[] = [
    { freq: 2, amp: h * 0.042, phase: rng() * Math.PI * 2 },
    { freq: 4, amp: h * 0.025, phase: rng() * Math.PI * 2, ridged: true },
    { freq: 7, amp: h * 0.012, phase: rng() * Math.PI * 2 },
  ];

  const midBase = h * 0.76;
  const step = 12;

  // Midground industrial silhouette props (drawn behind mid contour)
  const propCount = 7;
  for (let i = 0; i < propCount; i++) {
    const px = periodW * ((i + 0.5) / propCount);
    const groundY = midBase - Math.abs(evalHarmonics(px / periodW, harmonics));
    const kind = i % 3;

    ctx.save();
    ctx.fillStyle = palette.midStructure;
    ctx.strokeStyle = palette.midAccent;
    ctx.lineWidth = 1.2;

    if (kind === 0) {
      // Heavy industrial extraction tower / pylon
      const tw = 34 + rng() * 20;
      const th = 110 + rng() * 80;
      ctx.beginPath();
      ctx.moveTo(px - tw * 0.65, h);
      ctx.lineTo(px - tw * 0.25, groundY - th);
      ctx.lineTo(px + tw * 0.25, groundY - th);
      ctx.lineTo(px + tw * 0.65, h);
      ctx.closePath();
      ctx.fill();

      // Tower observation deck + beacon dot
      ctx.fillRect(px - tw * 0.42, groundY - th + 12, tw * 0.84, 9);
      ctx.fillStyle = palette.midAccent;
      ctx.beginPath();
      ctx.arc(px, groundY - th - 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 1) {
      // Geodesic dome / geothermal reactor silo
      const rw = 44 + rng() * 22;
      const rh = 68 + rng() * 44;
      ctx.fillRect(px - rw, groundY - rh, rw * 2, h - (groundY - rh));
      ctx.beginPath();
      ctx.arc(px, groundY - rh, rw * 0.88, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = palette.midAccent;
      ctx.beginPath();
      ctx.moveTo(px - rw * 0.6, groundY - rh + 18);
      ctx.lineTo(px + rw * 0.6, groundY - rh + 18);
      ctx.stroke();
    } else {
      // Cross-braced suspension gantry
      const gw = 26;
      const gh = 85 + rng() * 55;
      ctx.fillRect(px - gw * 0.5, groundY - gh, gw, h - (groundY - gh));
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.beginPath();
      ctx.moveTo(px - gw * 0.5, groundY - gh);
      ctx.lineTo(px + gw * 0.5, groundY - gh + 40);
      ctx.moveTo(px + gw * 0.5, groundY - gh);
      ctx.lineTo(px - gw * 0.5, groundY - gh + 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Secondary closer terrain contour
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= periodW; x += step) {
    const y = midBase - Math.abs(evalHarmonics(x / periodW, harmonics)) * 0.85;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(periodW, h);
  ctx.closePath();
  ctx.fillStyle = palette.midRidge;
  ctx.fill();

  // Horizontal mist veil in lower sky to preserve gameplay contrast
  const mistGrad = ctx.createLinearGradient(0, h * 0.56, 0, h);
  mistGrad.addColorStop(0, 'rgba(6, 9, 19, 0)');
  mistGrad.addColorStop(1, 'rgba(6, 9, 19, 0.42)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, h * 0.56, periodW, h * 0.44);

  return canvas;
}

export function createBackdropCache(
  map: GameMap,
  viewW: number,
  viewH: number,
): BackdropCache {
  const palette = getMapThemePalette(map);
  const periodW = Math.max(1600, Math.min(2400, Math.ceil(viewW * 1.45)));
  const rng = createRng(`${map.id}:${palette.id}`);

  const skyCanvas = buildSkyCanvas(viewW, viewH, palette);
  const farCanvas = buildFarCanvas(periodW, viewH, palette, rng);
  const midCanvas = buildMidCanvas(periodW, viewH, palette, rng);

  const stars = Array.from({ length: palette.starCount }, () => ({
    x: rng(),
    y: rng() * 0.78,
    r: 0.65 + rng() * 1.3,
    alpha: 0.22 + rng() * 0.55,
    offset: rng() * Math.PI * 2,
  }));

  const particles: BackdropParticle[] = Array.from({ length: 34 }, () => ({
    x: rng(),
    y: rng(),
    speedX:
      palette.particleKind === 'dust'
        ? 0.015 + rng() * 0.025
        : (rng() - 0.5) * 0.018,
    speedY:
      palette.particleKind === 'ember'
        ? -(0.028 + rng() * 0.045)
        : palette.particleKind === 'snow'
          ? 0.022 + rng() * 0.035
          : (rng() - 0.5) * 0.012,
    r: 0.9 + rng() * 1.7,
    alpha: 0.16 + rng() * 0.34,
    phase: rng() * Math.PI * 2,
  }));

  return {
    key: `${map.id}:${palette.id}:${viewW}x${viewH}`,
    viewW,
    viewH,
    periodW,
    skyCanvas,
    farCanvas,
    midCanvas,
    particles,
    stars,
  };
}

function drawWrappedLayer(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  periodW: number,
  viewW: number,
  viewH: number,
  scrollX: number,
  offsetY: number,
): void {
  const sx = ((scrollX % periodW) + periodW) % periodW;
  let destX = 0;
  let srcX = sx;
  while (destX < viewW) {
    const sliceW = Math.min(periodW - srcX, viewW - destX);
    if (sliceW <= 0) break;
    ctx.drawImage(layer, srcX, 0, sliceW, viewH, destX, offsetY, sliceW, viewH);
    destX += sliceW;
    srcX = 0;
  }
}

export function renderProceduralBackdrop(
  ctx: CanvasRenderingContext2D,
  cache: BackdropCache,
  map: GameMap,
  camera: Camera,
  viewW: number,
  viewH: number,
  timeSec: number,
): void {
  const palette = getMapThemePalette(map);

  // 1. Sky & Celestial Body
  ctx.drawImage(cache.skyCanvas, 0, 0, viewW, viewH);

  // 2. Twinkling Celestial Stars
  const starParX = camera.x * 0.06;
  const starParY = camera.y * 0.04;
  ctx.fillStyle = palette.starTint;
  for (let i = 0; i < cache.stars.length; i++) {
    const s = cache.stars[i];
    const sx = (((s.x * viewW - starParX) % viewW) + viewW) % viewW;
    const sy = (((s.y * viewH - starParY) % (viewH * 0.85)) + viewH * 0.85) % (viewH * 0.85);
    const tw = 0.6 + 0.4 * Math.sin(timeSec * 2.1 + s.offset);
    ctx.globalAlpha = s.alpha * tw;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Vertical parallax bias relative to map center
  const mapNormY = map.height > 0 ? Math.max(0, Math.min(1, camera.y / map.height)) : 0.5;
  const farOffsetY = (0.35 - mapNormY) * 26;
  const midOffsetY = (0.35 - mapNormY) * 48;

  // 3. Far Vista Silhouette & Light Shafts (0.14x Parallax)
  drawWrappedLayer(
    ctx,
    cache.farCanvas,
    cache.periodW,
    viewW,
    viewH,
    camera.x * 0.14,
    farOffsetY,
  );

  // 4. Midground Architecture & Mist (0.30x Parallax)
  drawWrappedLayer(
    ctx,
    cache.midCanvas,
    cache.periodW,
    viewW,
    viewH,
    camera.x * 0.30,
    midOffsetY,
  );

  // 5. Drifting Environmental Motes (Embers / Snowflakes / Spores)
  ctx.fillStyle = palette.particleColor;
  for (let i = 0; i < cache.particles.length; i++) {
    const p = cache.particles[i];
    const rawX = p.x + timeSec * p.speedX + Math.sin(timeSec * 1.4 + p.phase) * 0.015 - camera.x * 0.00022;
    const rawY = p.y + timeSec * p.speedY - camera.y * 0.00018;
    const px = (((rawX % 1) + 1) % 1) * viewW;
    const py = (((rawY % 1) + 1) % 1) * viewH;
    ctx.globalAlpha = p.alpha * (0.65 + 0.35 * Math.sin(timeSec * 3.1 + p.phase));
    ctx.beginPath();
    ctx.arc(px, py, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Renders subtle animated world-space props (reactor turbines, team conduits)
 * inside the camera transform, strictly behind solid arena terrain.
 */
export function renderBackdropWorldProps(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  timeSec: number,
): void {
  const palette = getMapThemePalette(map);
  const cx = map.width * 0.5;
  const cy = map.height * 0.52;

  ctx.save();

  // Subtle recessed energy conduits connecting bases through center arena
  if (map.baseBlue && map.baseRed) {
    const bx = map.baseBlue.x + map.baseBlue.width * 0.5;
    const by = map.baseBlue.y + map.baseBlue.height * 0.7;
    const rx = map.baseRed.x + map.baseRed.width * 0.5;
    const ry = map.baseRed.y + map.baseRed.height * 0.7;

    ctx.strokeStyle = palette.conduitColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.lineDashOffset = -timeSec * 28;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(cx, cy + map.height * 0.14, rx, ry);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Slow industrial core turbines behind center & flanks
  const turbineSpots =
    map.width >= 2000
      ? [
          { x: cx, y: cy, r: Math.min(180, map.height * 0.115), speed: 0.24 },
          { x: map.width * 0.26, y: map.height * 0.56, r: 95, speed: -0.32 },
          { x: map.width * 0.74, y: map.height * 0.56, r: 95, speed: 0.32 },
        ]
      : [{ x: cx, y: map.height * 0.48, r: 78, speed: 0.28 }];

  for (let i = 0; i < turbineSpots.length; i++) {
    const t = turbineSpots[i];
    ctx.save();
    ctx.translate(t.x, t.y);

    // Outer recessed shroud ring
    ctx.strokeStyle = palette.turbineColor;
    ctx.lineWidth = Math.max(4, t.r * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, t.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = palette.conduitColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, t.r * 1.07, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating turbine blades
    ctx.rotate(timeSec * t.speed + i * 0.9);
    ctx.fillStyle = palette.turbineColor;
    const blades = 6;
    for (let b = 0; b < blades; b++) {
      ctx.rotate((Math.PI * 2) / blades);
      ctx.beginPath();
      ctx.moveTo(t.r * 0.18, -t.r * 0.06);
      ctx.lineTo(t.r * 0.9, -t.r * 0.13);
      ctx.lineTo(t.r * 0.92, t.r * 0.05);
      ctx.lineTo(t.r * 0.18, t.r * 0.06);
      ctx.closePath();
      ctx.fill();
    }

    // Center hub ring
    ctx.fillStyle = '#090e1a';
    ctx.beginPath();
    ctx.arc(0, 0, t.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.conduitColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}
