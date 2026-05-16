import type { Army, Unit, WeaponStats, Ability, UnitStats, ModelProfile } from '../types';

interface NRCharacteristic {
  name: string;
  '$text': string;
}

interface NRProfile {
  name: string;
  typeName: string;
  characteristics?: NRCharacteristic[];
}

interface NRRule {
  name: string;
  description: string;
}

interface NRCategory {
  name: string;
}

interface NRCost {
  name: string;
  value: number;
}

interface NRSelection {
  id?: string;
  name: string;
  type: string;
  number?: number;
  entryGroupId?: string;
  group?: string;
  profiles?: NRProfile[];
  selections?: NRSelection[];
  categories?: NRCategory[];
  costs?: NRCost[];
  rules?: NRRule[];
}

export interface NRJson {
  roster: {
    id?: string;
    name?: string;
    costs: NRCost[];
    forces: Array<{ selections: NRSelection[] }>;
  };
}

function getChar(profile: NRProfile, name: string): string | null {
  const c = (profile.characteristics ?? []).find(c => c.name === name);
  return c ? c['$text'] : null;
}

function findUnitProfile(sel: NRSelection): NRProfile | null {
  let p = (sel.profiles ?? []).find(p => p.typeName === 'Unit');
  if (p) return p;
  for (const sub of (sel.selections ?? [])) {
    p = (sub.profiles ?? []).find(p => p.typeName === 'Unit');
    if (p) return p;
  }
  return null;
}

function weaponFromProfile(prof: NRProfile): WeaponStats {
  const w: Record<string, string> = { name: prof.name };
  (prof.characteristics ?? []).forEach(c => {
    w[c.name] = c['$text'];
  });
  return w as unknown as WeaponStats;
}

function extractWeapons(selections: NRSelection[], ranged: WeaponStats[], melee: WeaponStats[], modelCount = 1): void {
  for (const sub of selections) {
    const subMelee = (sub.profiles ?? []).filter(p => p.typeName === 'Melee Weapons');
    const subRanged = (sub.profiles ?? []).filter(p => p.typeName === 'Ranged Weapons');

    // A single selection with 2+ profiles of the same type = "choose one" weapon modes.
    if (subMelee.length > 1) melee.push({ name: sub.name, profiles: subMelee.map(weaponFromProfile) });
    else if (subMelee.length === 1) {
      const w = weaponFromProfile(subMelee[0]);
      const perModel = Math.round((sub.number ?? 1) / modelCount);
      if (perModel > 1) w.count = perModel;
      melee.push(w);
    }

    if (subRanged.length > 1) ranged.push({ name: sub.name, profiles: subRanged.map(weaponFromProfile) });
    else if (subRanged.length === 1) {
      const w = weaponFromProfile(subRanged[0]);
      const perModel = Math.round((sub.number ?? 1) / modelCount);
      if (perModel > 1) w.count = perModel;
      ranged.push(w);
    }

    if (sub.selections) extractWeapons(sub.selections, ranged, melee, modelCount);
  }
}

function dedup<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => seen.has(item.name) ? false : (seen.add(item.name), true));
}

function collectGrantedKeywords(selections: NRSelection[]): string[] {
  const result: string[] = [];
  for (const sub of selections) {
    if (sub.type === 'upgrade') {
      for (const cat of (sub.categories ?? [])) {
        const n = cat.name;
        if (!n.startsWith('Faction:') && !n.includes('Weapon') && !n.includes('Modifier')) {
          result.push(n);
        }
      }
    }
    if (sub.selections) result.push(...collectGrantedKeywords(sub.selections));
  }
  return result;
}

function extractAbilities(selections: NRSelection[], out: Ability[]): void {
  for (const sub of selections) {
    if (sub.group?.startsWith('Enhancements')) continue;
    for (const prof of (sub.profiles ?? [])) {
      if (prof.typeName === 'Abilities') {
        out.push({
          name: prof.name,
          desc: (prof.characteristics ?? []).find(c => c.name === 'Description')?.['$text'] ?? '',
        });
      }
    }
    if (sub.selections) extractAbilities(sub.selections, out);
  }
}

export function parseNR(json: NRJson): Army {
  const force = json.roster.forces[0];

  const detachmentSubSel = force.selections
    .find(s => s.name === 'Detachment')
    ?.selections?.[0];
  const detachment = detachmentSubSel ? {
    name: detachmentSubSel.name,
    rules: (detachmentSubSel.rules ?? []).map(r => ({ name: r.name, desc: r.description })),
  } : undefined;

  const units: Unit[] = force.selections
    .filter(s => s.type !== 'upgrade')
    .map((sel, idx) => {
      const unitProfile = findUnitProfile(sel);

      const profileAbilities: Ability[] = (sel.profiles ?? [])
        .filter(p => p.typeName === 'Abilities')
        .map(p => ({
          name: p.name,
          desc: (p.characteristics ?? []).find(c => c.name === 'Description')?.['$text'] ?? '',
        }));

      const ruleAbilities: Ability[] = (sel.rules ?? []).map(r => ({
        name: r.name,
        desc: r.description,
      }));

      const subAbilities: Ability[] = [];
      extractAbilities(sel.selections ?? [], subAbilities);

      const totalModels = sel.type === 'model'
        ? (sel.number ?? 1)
        : (sel.selections ?? []).filter(s => s.type === 'model').reduce((n, ms) => n + (ms.number ?? 1), 0) || 1;

      const ranged: WeaponStats[] = [];
      const melee: WeaponStats[] = [];

      for (const prof of (sel.profiles ?? [])) {
        if (prof.typeName === 'Ranged Weapons') ranged.push(weaponFromProfile(prof));
        if (prof.typeName === 'Melee Weapons') melee.push(weaponFromProfile(prof));
      }
      extractWeapons(sel.selections ?? [], ranged, melee, totalModels);

      const keywords = (sel.categories ?? [])
        .map(c => c.name)
        .filter(n => !n.startsWith('Faction:'));

      const pts = (sel.costs ?? []).find(c => c.name === 'pts');

      const stats: UnitStats | null = unitProfile ? {
        M: getChar(unitProfile, 'M'),
        T: getChar(unitProfile, 'T'),
        Sv: getChar(unitProfile, 'SV'),
        W: getChar(unitProfile, 'W'),
        Ld: getChar(unitProfile, 'LD'),
        OC: getChar(unitProfile, 'OC'),
      } : null;

      const enhancementSel = (sel.selections ?? []).find(s => s.group?.startsWith('Enhancements'));
      const enhancementProfile = enhancementSel?.profiles?.find(p => p.typeName === 'Abilities');
      const enhancement: Ability | undefined = enhancementSel && enhancementProfile ? {
        name: enhancementSel.name,
        desc: (enhancementProfile.characteristics ?? []).find(c => c.name === 'Description')?.['$text'] ?? '',
      } : undefined;

      const modelSels = (sel.selections ?? []).filter(s => s.type === 'model');
      const extractedModels: ModelProfile[] = [];
      for (const ms of modelSels) {
        const up = (ms.profiles ?? []).find(p => p.typeName === 'Unit');
        if (!up) continue;
        const mRanged: WeaponStats[] = [];
        const mMelee: WeaponStats[] = [];
        for (const prof of (ms.profiles ?? [])) {
          if (prof.typeName === 'Ranged Weapons') mRanged.push(weaponFromProfile(prof));
          if (prof.typeName === 'Melee Weapons') mMelee.push(weaponFromProfile(prof));
        }
        extractWeapons(ms.selections ?? [], mRanged, mMelee, ms.number ?? 1);
        const mKeywords = (ms.categories ?? [])
          .map(c => c.name)
          .filter(n => !n.startsWith('Faction:'));
        extractedModels.push({
          name: ms.name,
          number: ms.number,
          stats: {
            M: getChar(up, 'M'),
            T: getChar(up, 'T'),
            Sv: getChar(up, 'SV'),
            W: getChar(up, 'W'),
            Ld: getChar(up, 'LD'),
            OC: getChar(up, 'OC'),
          },
          ranged: dedup(mRanged),
          melee: dedup(mMelee),
          keywords: mKeywords,
        });
      }
      const distinctModelNames = new Set(extractedModels.map(m => m.name));
      const models = distinctModelNames.size > 1 ? extractedModels : undefined;

      const grantedKeywords = [...new Set(collectGrantedKeywords(sel.selections ?? []))];

      return {
        id: sel.id ?? `${idx}-${sel.name}`,
        name: sel.name,
        points: pts?.value ?? 0,
        modelCount: totalModels > 1 ? totalModels : undefined,
        isChar: keywords.includes('Character'),
        keywords,
        stats,
        models,
        ranged: dedup(ranged),
        melee: dedup(melee),
        abilities: dedup([...profileAbilities, ...subAbilities]),
        rules: dedup(ruleAbilities),
        enhancement,
        grantedKeywords,
      };
    });

  return {
    id: json.roster.id ?? json.roster.name ?? 'unknown',
    name: json.roster.name ?? 'My Army',
    points: json.roster.costs[0].value,
    units,
    detachment,
  };
}
