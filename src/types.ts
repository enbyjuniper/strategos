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
  abilities: Ability[];
  rules: Ability[];
  enhancement?: Ability;
}

export interface Army {
  id: string;
  name: string;
  points: number;
  units: Unit[];
  detachment?: { name: string; rules: Ability[] };
}

export type Attachments = Record<string, string[]>;
