import { parseNR } from './parseNR';
import type { NRJson } from './parseNR';
import type { Attachments } from '../types';

export interface ListEntry {
  raw: string;
  name: string;
  attachments: Attachments;
  clusterColors: Record<string, string>;
  order: string[];
  images: Record<string, string>;
}

export const LISTS_KEY = 'strategos_lists';
export const CURRENT_KEY = 'strategos_current';

export function readStore(): Record<string, ListEntry> {
  try {
    const s = localStorage.getItem(LISTS_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

export function writeStore(store: Record<string, ListEntry>) {
  try { localStorage.setItem(LISTS_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

export function buildOrder(unitIds: string[], saved: string[] | null): string[] {
  if (saved) {
    const valid = saved.filter(id => unitIds.includes(id));
    const missing = unitIds.filter(id => !valid.includes(id));
    return [...valid, ...missing];
  }
  return [...unitIds];
}

export function migrate() {
  if (localStorage.getItem(LISTS_KEY) !== null) return;
  try {
    const raw = localStorage.getItem('strategos_list');
    if (!raw) return;
    const parsed = parseNR(JSON.parse(raw) as NRJson);
    const attachments: Attachments = JSON.parse(localStorage.getItem('strategos_attachments') ?? '{}');
    const clusterColors: Record<string, string> = JSON.parse(localStorage.getItem('strategos_cluster_colors') ?? '{}');
    const order: string[] = JSON.parse(localStorage.getItem('strategos_order') ?? 'null') ?? parsed.units.map(u => u.id);
    const images: Record<string, string> = JSON.parse(localStorage.getItem('strategos_images') ?? '{}');
    const store: Record<string, ListEntry> = {
      [parsed.id]: { raw, name: parsed.name, attachments, clusterColors, order, images },
    };
    writeStore(store);
    localStorage.setItem(CURRENT_KEY, parsed.id);
  } catch { /* ignore */ }
}
