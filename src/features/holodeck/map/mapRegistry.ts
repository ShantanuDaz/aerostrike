import type * as THREE from 'three';
import {
  generateHolodeckAlphaData,
  buildHolodeckAlphaMapGroup,
  type HolodeckMapData,
} from './holodeckAlpha';
import {
  generateHolodeckBravoData,
  buildHolodeckBravoMapGroup,
} from './holodeckBravo';

export function getHolodeckMapData(mapId: string): HolodeckMapData {
  if (mapId === 'holodeck-bravo') {
    return generateHolodeckBravoData();
  }
  return generateHolodeckAlphaData();
}

export function buildHolodeckMapGroup(mapId: string, data: HolodeckMapData): THREE.Group {
  if (mapId === 'holodeck-bravo') {
    return buildHolodeckBravoMapGroup(data);
  }
  return buildHolodeckAlphaMapGroup(data);
}
