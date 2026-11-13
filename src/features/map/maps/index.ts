import { defaultMap } from './defaultMap';
import { bunkerMap } from './bunkerMap';
import { ctfArenaMap } from './ctfArenaMap';
import { skyCitadelMap } from './skyCitadelMap';
import { cryoFacilityMap } from './cryoFacilityMap';
import { heliosCalderaMap } from './heliosCalderaMap';
import { catacombOutpostMap } from './catacombOutpostMap';
import { holodeckMap } from './holodeckMap';
import { holodeckBravoMap } from './holodeckBravoMap';
import type { GameMap } from '../types';

export const availableMaps: Record<string, GameMap> = {
  [catacombOutpostMap.id]: catacombOutpostMap,
  [heliosCalderaMap.id]: heliosCalderaMap,
  [ctfArenaMap.id]: ctfArenaMap,
  [skyCitadelMap.id]: skyCitadelMap,
  [cryoFacilityMap.id]: cryoFacilityMap,
  [defaultMap.id]: defaultMap,
  [bunkerMap.id]: bunkerMap,
  [holodeckMap.id]: holodeckMap,
  [holodeckBravoMap.id]: holodeckBravoMap,
};

export {
  defaultMap,
  bunkerMap,
  ctfArenaMap,
  skyCitadelMap,
  cryoFacilityMap,
  heliosCalderaMap,
  catacombOutpostMap,
  holodeckMap,
  holodeckBravoMap,
};
