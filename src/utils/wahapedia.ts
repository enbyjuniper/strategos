const API_BASE = 'http://localhost:5000';

export interface WahapediaModel {
  name: string | null;
  m: string | null; t: string | null; sv: string | null;
  inv_sv: string | null; inv_sv_descr: string | null;
  w: string | null; ld: string | null; oc: string | null;
  base_size: string | null;
}

export interface WahapediaWeapon {
  line: string | null; line_in_wargear: string | null;
  name: string | null; dice: string | null; description: string | null;
  range: string | null; type: string | null;
  a: string | null; bs_ws: string | null; s: string | null;
  ap: string | null; d: string | null;
}

export interface WahapediaAbility {
  name: string | null; description: string | null; type: string | null;
}

export interface WahapediaStratagem {
  name: string; type: string | null; cp_cost: string | null;
  turn: string | null; phase: string | null; description: string;
}

export interface WahapediaDatasheet {
  datasheet: {
    id: string; name: string; role: string | null; faction_id: string | null;
    loadout: string | null; transport: string | null;
    damaged_w: string | null; damaged_description: string | null;
  };
  models: WahapediaModel[];
  wargear: WahapediaWeapon[];
  abilities: WahapediaAbility[];
  keywords: { keyword: string; is_faction_keyword: string }[];
  composition: { description: string }[];
  options: { description: string }[];
  stratagems: WahapediaStratagem[];
  leads: { name: string }[];
}

export async function fetchDatasheet(unitName: string): Promise<WahapediaDatasheet | null> {
  try {
    const res = await fetch(`${API_BASE}/api/datasheet?name=${encodeURIComponent(unitName)}`);
    if (!res.ok) return null;
    return res.json() as Promise<WahapediaDatasheet>;
  } catch {
    return null;
  }
}
