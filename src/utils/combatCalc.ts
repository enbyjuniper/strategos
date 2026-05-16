import type { Unit, WeaponStats } from '../types';
import { getInv, getFNP } from './abilities';

export interface DefenderProfile {
  T: number;
  Sv: number;
  W: number;
  inv: number | null;
  fnp: number | null;
}

export interface WeaponOption {
  label: string;
  weapon: WeaponStats;
  skill: 'BS' | 'WS';
}

export interface CalcOptions {
  critHitThresh?: number;   // roll needed for a critical hit (default 6)
  critWoundThresh?: number; // roll needed for a critical wound (default 6)
  rerollHits?: 'none' | 'ones' | 'all' | 'noncrits';
  rerollWounds?: 'none' | 'ones' | 'all' | 'noncrits';
  rapidFireBonus?: number;  // extra attacks from Rapid Fire X at half range
  meltaBonus?: number;      // extra damage from Melta X at half range
  blastBonus?: number;      // extra attacks from Blast (floor(models / 5))
}

export interface CombatResult {
  valid: boolean;
  invalidReason?: string;
  totalAttacks: number;
  pHit: number;
  expectedHits: number;
  woundThresh: number;
  pWound: number;
  expectedWounds: number;
  effectiveSave: number;
  expectedCritHits: number;
  expectedWoundsAfterSave: number;
  expectedCritWounds: number;
  fnpThresh: number | null;
  expectedFinalWounds: number;
  avgDamagePerWound: number;
  expectedDamage: number;
  expectedModelsKilled: number;
  benefitOfCover: boolean;
  lance: boolean;
  heavy: boolean;
  rapidFireBonus: number;
  meltaBonus: number;
  blastBonus: number;
  torrent: boolean;
  lethalHits: boolean;
  devastatingWounds: boolean;
  sustainedHitsX: number;
  twinLinked: boolean;
  critHitThresh: number;
  critWoundThresh: number;
  rerollHits: 'none' | 'ones' | 'all' | 'noncrits';
  rerollWounds: 'none' | 'ones' | 'all' | 'noncrits';
}

// ── Damage distribution ───────────────────────────────────────────────────────
// Builds the full probability distribution for a dice expression so we can
// compute E(min(D, W)) correctly — excess damage wasted on a dead model is
// not the same as E(D) / W.

type Dist = Map<number, number>; // outcome → probability

function convolve(a: Dist, sides: number): Dist {
  const result: Dist = new Map();
  const p = 1 / sides;
  for (const [v, pa] of a) {
    for (let i = 1; i <= sides; i++) {
      const key = v + i;
      result.set(key, (result.get(key) ?? 0) + pa * p);
    }
  }
  return result;
}

function damageDistribution(s: string | undefined): Dist | null {
  if (!s) return null;
  const t = s.trim().replace(/\s/g, '');
  if (/^[×xX]2$/.test(t)) return null;

  const m = t.match(/^(\d*)(?:[Dd])(\d+)([+-]\d+)?$/);
  if (m) {
    const mult  = m[1] ? parseInt(m[1]) : 1;
    const sides = parseInt(m[2]);
    const mod   = m[3] ? parseInt(m[3]) : 0;
    // Start with a single die, convolve for multi-dice
    let dist: Dist = new Map();
    for (let i = 1; i <= sides; i++) dist.set(i, 1 / sides);
    for (let n = 1; n < mult; n++) dist = convolve(dist, sides);
    // Apply flat modifier
    if (mod !== 0) {
      const shifted: Dist = new Map();
      for (const [v, p] of dist) shifted.set(v + mod, p);
      return shifted;
    }
    return dist;
  }

  const n = parseFloat(t);
  if (!isNaN(n)) return new Map([[n, 1]]);
  return null;
}

function expectedValue(dist: Dist): number {
  let total = 0;
  for (const [v, p] of dist) total += v * p;
  return total;
}

// E(min(D, cap)) — expected effective damage per wound against a model with
// `cap` wounds, since excess damage beyond the model's remaining wounds is lost.
function expectedCappedValue(dist: Dist, cap: number): number {
  let total = 0;
  for (const [v, p] of dist) total += Math.min(v, cap) * p;
  return total;
}

function parseDice(s: string | undefined): number {
  if (!s) return NaN;
  const t = s.trim().replace(/\s/g, '');
  if (/^[×xX]2$/.test(t)) return NaN;
  const m = t.match(/^(\d*)(?:[Dd])(\d+)([+-]\d+)?$/);
  if (m) {
    const mult = m[1] ? parseInt(m[1]) : 1;
    const sides = parseInt(m[2]);
    const mod = m[3] ? parseInt(m[3]) : 0;
    return mult * (sides + 1) / 2 + mod;
  }
  const n = parseFloat(t);
  return isNaN(n) ? NaN : n;
}

function parseSkillNum(s: string | null | undefined): number {
  if (!s) return NaN;
  const m = s.match(/^(\d+)\+?$/);
  return m ? parseInt(m[1]) : NaN;
}

function parseAP(s: string | undefined): number {
  if (!s) return 0;
  const n = parseInt(s);
  return isNaN(n) ? 0 : n;
}

function woundThreshold(S: number, T: number): number {
  if (S >= T * 2) return 2;
  if (S > T) return 3;
  if (S === T) return 4;
  if (S * 2 <= T) return 6;
  return 5;
}

function parseKeywords(kw: string | undefined): string[] {
  if (!kw) return [];
  return kw.toUpperCase().split(',').map(k => k.trim()).filter(Boolean);
}

export function buildDefender(unit: Unit): DefenderProfile | null {
  const primaryStats = unit.stats ?? unit.models?.[0]?.stats ?? null;
  if (!primaryStats?.T || !primaryStats.Sv) return null;
  const T = parseInt(primaryStats.T);
  const Sv = parseSkillNum(primaryStats.Sv);
  if (isNaN(T) || isNaN(Sv)) return null;

  // Weighted average wounds across model profiles so "models killed" covers the whole unit
  let W: number;
  if (unit.models && unit.models.length > 1) {
    let totalModels = 0;
    let totalWounds = 0;
    for (const m of unit.models) {
      const n = m.number ?? 1;
      const w = parseInt(m.stats.W ?? '');
      totalModels += n;
      totalWounds += n * (isNaN(w) ? 1 : w);
    }
    W = totalModels > 0 ? totalWounds / totalModels : 1;
  } else {
    if (!primaryStats.W) return null;
    W = parseInt(primaryStats.W);
    if (isNaN(W)) return null;
  }

  const allAbilities = [...unit.abilities, ...unit.rules];
  const invStr = getInv(allAbilities);
  const fnpStr = getFNP(allAbilities);
  const inv = invStr ? parseSkillNum(invStr) : null;
  const fnp = fnpStr ? parseSkillNum(fnpStr) : null;

  return {
    T, Sv, W,
    inv: inv !== null && !isNaN(inv) ? inv : null,
    fnp: fnp !== null && !isNaN(fnp) ? fnp : null,
  };
}

export function flattenWeapons(unit: Unit): WeaponOption[] {
  const opts: WeaponOption[] = [];
  for (const w of unit.ranged) {
    if (w.profiles) {
      for (const p of w.profiles) {
        opts.push({ label: `${w.name} — ${p.name}`, weapon: { ...p, count: w.count }, skill: 'BS' });
      }
    } else {
      opts.push({ label: w.name, weapon: w, skill: 'BS' });
    }
  }
  for (const w of unit.melee) {
    if (w.profiles) {
      for (const p of w.profiles) {
        opts.push({ label: `${w.name} — ${p.name}`, weapon: { ...p, count: w.count }, skill: 'WS' });
      }
    } else {
      opts.push({ label: w.name, weapon: w, skill: 'WS' });
    }
  }
  return opts;
}

export function calcCombat(
  weapon: WeaponStats,
  skill: 'BS' | 'WS',
  modelCount: number,
  defender: DefenderProfile,
  options?: CalcOptions,
): CombatResult {
  const critHitThresh   = options?.critHitThresh   ?? 6;
  const critWoundThresh = options?.critWoundThresh  ?? 6;
  const rerollHits      = options?.rerollHits      ?? 'none';
  const rerollWounds    = options?.rerollWounds    ?? 'none';
  const rapidFireBonus  = options?.rapidFireBonus  ?? 0;
  const meltaBonus      = options?.meltaBonus      ?? 0;
  const blastBonus      = options?.blastBonus      ?? 0;
  const kws = parseKeywords(weapon.Keywords);
  const torrent = kws.includes('TORRENT');
  const lethalHits = kws.includes('LETHAL HITS');
  const devastatingWounds = kws.includes('DEVASTATING WOUNDS');
  const lance = kws.includes('LANCE');
  const heavy = kws.includes('HEAVY');
  const sustainedHitsX = (() => {
    for (const k of kws) {
      const m = k.match(/^SUSTAINED HITS (\d+)$/);
      if (m) return parseInt(m[1]);
    }
    return 0;
  })();
  const twinLinked = kws.includes('TWIN-LINKED');
  const indirect = kws.includes('INDIRECT FIRE');

  const eA   = parseDice(weapon.A) + rapidFireBonus + blastBonus;
  let damDist = damageDistribution(weapon.D);
  if (meltaBonus > 0 && damDist !== null) {
    const shifted: Dist = new Map();
    for (const [v, p] of damDist) shifted.set(v + meltaBonus, p);
    damDist = shifted;
  }
  const S   = parseInt(weapon.S ?? '');
  const AP  = parseAP(weapon.AP);

  const invalid = (reason: string): CombatResult => ({
    valid: false, invalidReason: reason,
    totalAttacks: 0, pHit: 0, expectedHits: 0,
    expectedCritHits: 0,
    woundThresh: 4, pWound: 0, expectedWounds: 0,
    effectiveSave: 7, expectedWoundsAfterSave: 0, expectedCritWounds: 0,
    fnpThresh: defender.fnp, expectedFinalWounds: 0,
    avgDamagePerWound: 0, expectedDamage: 0, expectedModelsKilled: 0,
    benefitOfCover: false, lance: false, heavy: false,
    rapidFireBonus: 0, meltaBonus: 0, blastBonus: 0,
    torrent, lethalHits, devastatingWounds, sustainedHitsX, twinLinked,
    critHitThresh, critWoundThresh, rerollHits, rerollWounds,
  });

  if (isNaN(eA))  return invalid('Variable attacks (×2) — cannot calculate');
  if (!damDist)   return invalid('Variable damage (×2) — cannot calculate');
  const eD = expectedValue(damDist);

  const weaponCount = weapon.count ?? 1;
  const totalAttacks = weaponCount * modelCount * eA;

  // ── Hit roll ──────────────────────────────────────────────────────────────
  let pHit: number;
  let pCritHit: number;

  if (torrent || isNaN(parseSkillNum(weapon[skill]))) {
    pHit = 1;
    pCritHit = 0;
  } else {
    // Heavy: +1 to hit when stationary; Indirect: -1 to hit, 1-3 always fail
    const rawSkill = parseSkillNum(weapon[skill]);
    const hitMod = (indirect ? 1 : 0) - (heavy ? 1 : 0);
    const modHitThresh = Math.min(rawSkill + hitMod, 7);
    const hitThresh = indirect
      ? Math.max(modHitThresh, 4)  // unmodified 1-3 always fail
      : Math.max(2, modHitThresh); // unmodified 1 always fails
    const pHitBase = Math.max(0, (7 - hitThresh) / 6);
    const pCritHitBase = Math.min(pHitBase, Math.max(0, (7 - critHitThresh) / 6));
    // Rerolls: ones → ×(7/6); all → base×(2−base) for pHit, base×(2−pHitBase) for pCrit
    if (rerollHits === 'ones') {
      pHit     = Math.min(1, pHitBase     * (7 / 6));
      pCritHit = Math.min(pHit, pCritHitBase * (7 / 6));
    } else if (rerollHits === 'all') {
      pHit     = Math.min(1, pHitBase * (2 - pHitBase));
      pCritHit = Math.min(pHit, pCritHitBase * (2 - pHitBase));
    } else if (rerollHits === 'noncrits') {
      // Keep crits; reroll all non-crits (both misses and non-crit hits)
      pCritHit = Math.min(1, pCritHitBase * (2 - pCritHitBase));
      pHit     = Math.min(1, pCritHitBase + (1 - pCritHitBase) * pHitBase);
    } else {
      pHit     = pHitBase;
      pCritHit = pCritHitBase;
    }
  }

  const pNormalHit = pHit - pCritHit;
  const eSustainedBonus = pCritHit * sustainedHitsX;
  const expectedHits = totalAttacks * (pHit + eSustainedBonus);

  // ── Wound roll ───────────────────────────────────────────────────────────
  const eAutoWoundFrac = lethalHits ? pCritHit : 0;
  const eHitsForWoundRoll = pNormalHit + eSustainedBonus;

  const wThreshBase = isNaN(S) ? 4 : woundThreshold(S, defender.T);
  // Lance: +1 to wound roll when bearer charged (threshold −1, floor at 2+)
  const wThresh = lance ? Math.max(2, wThreshBase - 1) : wThreshBase;
  const pWoundBase = Math.max(0, (7 - wThresh) / 6);

  // Twin-linked = reroll wound 1s; if user hasn't picked a reroll type, apply it
  const rerollWoundLevel = rerollWounds !== 'none' ? rerollWounds : (twinLinked ? 'ones' : 'none');

  // Devastating Wounds: wound rolls ≥ critWoundThresh become mortal wounds (skip save)
  const pCritWoundBase = devastatingWounds ? Math.max(0, (7 - critWoundThresh) / 6) : 0;

  let pWound: number;
  let pCritWound: number;
  if (rerollWoundLevel === 'ones') {
    pWound     = Math.min(1, pWoundBase * (7 / 6));
    pCritWound = Math.min(pWound, pCritWoundBase * (7 / 6));
  } else if (rerollWoundLevel === 'all') {
    pWound     = Math.min(1, pWoundBase * (2 - pWoundBase));
    pCritWound = Math.min(pWound, pCritWoundBase * (2 - pWoundBase));
  } else if (rerollWoundLevel === 'noncrits') {
    // Keep crits; reroll all non-crits (both failed wounds and non-crit wound successes)
    pCritWound = Math.min(1, pCritWoundBase * (2 - pCritWoundBase));
    pWound     = Math.min(1, pCritWoundBase + (1 - pCritWoundBase) * pWoundBase);
  } else {
    pWound     = pWoundBase;
    pCritWound = Math.min(pWound, pCritWoundBase);
  }
  const pNormalWound = pWound - pCritWound;

  const eMortalFrac = eHitsForWoundRoll * pCritWound;
  const eNormalWoundFrac = eAutoWoundFrac + eHitsForWoundRoll * pNormalWound;
  const expectedWounds = totalAttacks * (eNormalWoundFrac + eMortalFrac);

  // ── Save roll ────────────────────────────────────────────────────────────
  // Benefit of Cover: +1 to armour save (not inv). Does not apply to 3+ or
  // better saves against AP 0 weapons.
  const benefitOfCover = indirect && !(defender.Sv <= 3 && AP === 0);
  const coverMod = benefitOfCover ? 1 : 0;
  // AP is negative (e.g. -2), so effectiveSave = Sv - AP raises the needed roll
  const effectiveSvFromArmor = Math.min(7, defender.Sv - AP - coverMod);
  const effectiveSave = defender.inv !== null
    ? Math.min(effectiveSvFromArmor, defender.inv)
    : effectiveSvFromArmor;
  const pSave = Math.max(0, Math.min(1, (7 - effectiveSave) / 6));
  const pFailSave = 1 - pSave;

  const woundsNormalAfterSave = totalAttacks * eNormalWoundFrac * pFailSave;
  const woundsMortal = totalAttacks * eMortalFrac;
  const expectedWoundsAfterSave = woundsNormalAfterSave + woundsMortal;

  // ── Feel No Pain ─────────────────────────────────────────────────────────
  const fnpThresh = defender.fnp;
  const pFNP = fnpThresh !== null ? Math.max(0, (7 - fnpThresh) / 6) : 0;
  const expectedFinalWounds = expectedWoundsAfterSave * (1 - pFNP);

  // ── Damage ───────────────────────────────────────────────────────────────
  // Raw damage output (for display in the breakdown row)
  const expectedDamage = expectedFinalWounds * eD;
  // Each wound's damage is applied to one model and capped at that model's W;
  // excess is wasted, so we use E(min(D, W)) rather than E(D).
  const eEffective = expectedCappedValue(damDist, defender.W);
  const expectedModelsKilled = expectedFinalWounds * eEffective / defender.W;

  return {
    valid: true,
    totalAttacks,
    pHit,
    expectedHits,
    expectedCritHits: totalAttacks * pCritHit,
    woundThresh: wThresh,
    pWound,
    expectedWounds,
    effectiveSave,
    expectedWoundsAfterSave,
    expectedCritWounds: totalAttacks * eMortalFrac,
    fnpThresh,
    expectedFinalWounds,
    avgDamagePerWound: eD,
    expectedDamage,
    expectedModelsKilled,
    benefitOfCover, lance, heavy,
    rapidFireBonus, meltaBonus, blastBonus,
    torrent,
    lethalHits,
    devastatingWounds,
    sustainedHitsX,
    twinLinked,
    critHitThresh,
    critWoundThresh,
    rerollHits,
    rerollWounds: rerollWoundLevel,
  };
}
