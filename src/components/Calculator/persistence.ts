import type { WeaponConfig, WeaponSlot, DefenderConfig } from "./types";
import { EMPTY_DEF } from "./types";

export const CALC_KEY = "strategos_calc";

export function loadCalcState(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CALC_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function sanitizeDefenderConfig(raw: unknown): DefenderConfig | null {
  if (!raw || typeof raw !== "object") return null;
  return { ...EMPTY_DEF, ...(raw as Partial<DefenderConfig>) };
}

export function sanitizeWeaponConfig(raw: unknown): WeaponConfig | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    A: "",
    skill: "",
    S: "",
    AP: "",
    D: "",
    lethalHits: false,
    devastatingWounds: false,
    twinLinked: false,
    torrent: false,
    indirectFire: false,
    sustainedHits: false,
    sustainedN: "1",
    rapidFire: false,
    rapidFireN: "",
    melta: false,
    meltaN: "",
    blast: false,
    critHit: "",
    critWound: "",
    rerollHits: "none",
    rerollWounds: "none",
    lance: false,
    lanceCharged: false,
    heavy: false,
    heavyStationary: false,
    halfRange: false,
    ignoresCover: false,
    ...(raw as Partial<WeaponConfig>),
  };
}

export function sanitizeWeaponSlots(raw: unknown): WeaponSlot[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((s) => ({
    idx: Number((s as { idx?: unknown }).idx ?? -1),
    config: sanitizeWeaponConfig((s as { config?: unknown }).config),
  }));
}
