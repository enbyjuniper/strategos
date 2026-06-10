import type { Army, WeaponStats } from "../../types";
import { parseNR } from "../../utils/parseNR";
import type { NRJson } from "../../utils/parseNR";
import { readStore } from "../../utils/storage";
import type { WeaponConfig } from "./types";
import { MANAGED_KWS } from "./types";

export function initConfig(weapon: WeaponStats): WeaponConfig {
  const parts = (weapon.Keywords ?? "")
    .toUpperCase()
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const kwSet = new Set(parts);
  const sustained = parts.find((k) => /^SUSTAINED HITS \S+$/.test(k));
  const rfKw = parts.find((k) => /^RAPID FIRE \d+$/.test(k));
  const meltaKw = parts.find((k) => /^MELTA \d+$/.test(k));
  return {
    A: "",
    skill: "",
    S: "",
    AP: "",
    D: "",
    lethalHits: kwSet.has("LETHAL HITS"),
    devastatingWounds: kwSet.has("DEVASTATING WOUNDS"),
    twinLinked: kwSet.has("TWIN-LINKED"),
    torrent: kwSet.has("TORRENT"),
    indirectFire: kwSet.has("INDIRECT FIRE"),
    sustainedHits: sustained !== undefined,
    sustainedN: sustained ? (sustained.split(" ")[2] ?? "1") : "1",
    rapidFire: rfKw !== undefined,
    rapidFireN: rfKw ? (rfKw.split(" ")[2] ?? "1") : "",
    melta: meltaKw !== undefined,
    meltaN: meltaKw ? (meltaKw.split(" ")[1] ?? "1") : "",
    blast: kwSet.has("BLAST"),
    critHit: "",
    critWound: "",
    rerollHits: "none",
    rerollWounds: "none",
    lance: kwSet.has("LANCE"),
    lanceCharged: false,
    heavy: kwSet.has("HEAVY"),
    heavyStationary: false,
    halfRange: false,
    ignoresCover: kwSet.has("IGNORES COVER"),
  };
}

export function buildEffectiveWeapon(
  base: WeaponStats,
  skill: "BS" | "WS",
  cfg: WeaponConfig,
): WeaponStats {
  const kws: string[] = [];
  if (cfg.torrent) kws.push("TORRENT");
  if (cfg.lethalHits) kws.push("LETHAL HITS");
  if (cfg.devastatingWounds) kws.push("DEVASTATING WOUNDS");
  if (cfg.sustainedHits) kws.push(`SUSTAINED HITS ${cfg.sustainedN || "1"}`);
  if (cfg.twinLinked) kws.push("TWIN-LINKED");
  if (cfg.indirectFire) kws.push("INDIRECT FIRE");
  if (cfg.ignoresCover) kws.push("IGNORES COVER");
  if (cfg.blast) kws.push("BLAST");
  if (cfg.lance && cfg.lanceCharged) kws.push("LANCE");
  if (cfg.heavy && cfg.heavyStationary) kws.push("HEAVY");
  for (const k of (base.Keywords ?? "")
    .toUpperCase()
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)) {
    if (!MANAGED_KWS.has(k) && !/^SUSTAINED HITS/.test(k)) kws.push(k);
  }
  return {
    ...base,
    A: cfg.A || base.A,
    [skill]: cfg.skill || base[skill],
    S: cfg.S || base.S,
    AP: cfg.AP || base.AP,
    D: cfg.D || base.D,
    Keywords: kws.join(", "),
  };
}

export function attackDetail(
  modelCount: number,
  count: number | undefined,
  A: string,
): string {
  const c = count ?? 1;
  if (c > 1) return `${modelCount} × ${c}× ${A || "?"}`;
  return `${modelCount} × ${A || "?"}`;
}

export function loadArmy(listId: string): Army | null {
  try {
    const entry = readStore()[listId];
    return entry ? parseNR(JSON.parse(entry.raw) as NRJson) : null;
  } catch {
    return null;
  }
}
