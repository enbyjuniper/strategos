export interface WeaponConfig {
  A: string;
  skill: string; // value of BS or WS (e.g. "3+")
  S: string;
  AP: string;
  D: string;
  lethalHits: boolean;
  devastatingWounds: boolean;
  twinLinked: boolean;
  torrent: boolean;
  indirectFire: boolean;
  sustainedHits: boolean;
  sustainedN: string;
  rapidFire: boolean;
  rapidFireN: string;
  melta: boolean;
  meltaN: string;
  blast: boolean;
  critHit: string; // crit hit threshold (default "6")
  critWound: string; // crit wound threshold (default "6")
  rerollHits: "none" | "ones" | "all" | "noncrits";
  rerollWounds: "none" | "ones" | "all" | "noncrits";
  lance: boolean;
  lanceCharged: boolean; // lance: bearer charged this turn
  heavy: boolean;
  heavyStationary: boolean; // heavy: unit remained stationary
  halfRange: boolean;
  ignoresCover: boolean;
}

export interface WeaponSlot {
  idx: number;
  config: WeaponConfig | null;
}

export interface DefenderConfig {
  T: string;
  Sv: string;
  W: string;
  inv: string;
  fnp: string;
  cover: boolean;
  woundPenaltyIfSGtT: boolean;
}

export const EMPTY_DEF: DefenderConfig = {
  T: "",
  Sv: "",
  W: "",
  inv: "",
  fnp: "",
  cover: false,
  woundPenaltyIfSGtT: false,
};

export const KW_TOGGLES: { key: keyof WeaponConfig; label: string }[] = [
  { key: "lethalHits", label: "Lethal Hits" },
  { key: "devastatingWounds", label: "Dev. Wounds" },
  { key: "twinLinked", label: "Twin-linked" },
  { key: "torrent", label: "Torrent" },
  { key: "indirectFire", label: "Indirect" },
  { key: "lance", label: "Lance" },
  { key: "heavy", label: "Heavy" },
  { key: "ignoresCover", label: "Ignores Cover" },
];

export const MANAGED_KWS = new Set([
  "TORRENT",
  "LETHAL HITS",
  "DEVASTATING WOUNDS",
  "TWIN-LINKED",
  "INDIRECT FIRE",
  "LANCE",
  "HEAVY",
  "IGNORES COVER",
  "BLAST",
]);
