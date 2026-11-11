import { defaultMap } from './defaultMap';
import { bunkerMap } from './bunkerMap';
import { ctfArenaMap } from './ctfArenaMap';
import { skyCitadelMap } from './skyCitadelMap';
import { cryoFacilityMap } from './cryoFacilityMap';
import type { GameMap } from '../types';

export const availableMaps: Record<string, GameMap> = {
  [ctfArenaMap.id]: ctfArenaMap,
  [skyCitadelMap.id]: skyCitadelMap,
  [cryoFacilityMap.id]: cryoFacilityMap,
  [defaultMap.id]: defaultMap,
  [bunkerMap.id]: bunkerMap,
};

export { defaultMap, bunkerMap, ctfArenaMap, skyCitadelMap, cryoFacilityMap };
