export type HeadgearType =
  | 'none'
  | 'soldier_helmet'
  | 'beret'
  | 'headband'
  | 'gas_mask'
  | 'robo_visor'
  | 'horns';

export type VisorStyle = 'classic' | 'cyborg' | 'sunglasses' | 'goggles' | 'neon';

export type JetpackStyle = 'dual_tank' | 'single_heavy' | 'falcon_wings';

export interface AvatarConfig {
  callsign: string;
  bodyColor: string;
  skinTone: string;
  headgear: HeadgearType;
  headgearColor: string;
  visorStyle: VisorStyle;
  visorColor: string;
  jetpackStyle: JetpackStyle;
}
