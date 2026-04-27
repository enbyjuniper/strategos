export type Phase = 'move' | 'shoot' | 'melee' | 'dur' | 'abil';

export interface WeaponStats {
  name: string;
  Range?: string;
  A?: string;
  BS?: string;
  WS?: string;
  S?: string;
  AP?: string;
  D?: string;
  Keywords?: string;
  profiles?: WeaponStats[]; // "choose one" alternatives from the same wargear group
}

export interface Ability {
  name: string;
  desc: string;
}

export interface UnitStats {
  M: string | null;
  T: string | null;
  Sv: string | null;
  W: string | null;
  Ld: string | null;
  OC: string | null;
}

export interface Unit {
  id: string;
  name: string;
  points: number;
  isChar: boolean;
  keywords: string[];
  stats: UnitStats | null;
  ranged: WeaponStats[];
  melee: WeaponStats[];
  ownAbilities: Ability[];
  ruleAbilities: Ability[];
  enhancement?: Ability;
}

export interface Army {
  name: string;
  points: number;
  units: Unit[];
  detachment?: { name: string; rules: Ability[] };
}

export type Attachments = Record<string, string[]>;

export interface ImageTransform {
  x: number;   // object-position-x, 0–100
  y: number;   // object-position-y, 0–100
  zoom: number; // scale factor, 1–3
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = { x: 0, y: 0, zoom: 1 };
