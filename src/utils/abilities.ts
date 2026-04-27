import type { Ability } from '../types';

const KEYWORDS = new Set([
  'leader', 'feel no pain', 'invulnerable save', 'deep strike',
  'lone operative', 'stealth', 'infiltrators',
]);

export function isKeyword(name: string): boolean {
  const n = name.toLowerCase().trim();
  return KEYWORDS.has(n) || n.startsWith('feel no pain') || n.includes('invulnerable save');
}

export function getInv(abilities: Ability[]): string | null {
  for (const a of abilities) {
    if (a.name.toLowerCase().includes('invulnerable')) {
      const m = (a.name + ' ' + a.desc).match(/(\d)\+\s*invulnerable|invulnerable[^0-9]*(\d)\+/i);
      if (m) return (m[1] ?? m[2]) + '+';
      const m2 = a.name.match(/\((\d\+)\)/);
      if (m2) return m2[1];
      return '??+';
    }
  }
  return null;
}

export function getFNP(abilities: Ability[]): string | null {
  for (const a of abilities) {
    const lower = a.name.toLowerCase();
    if (lower.includes('feel no pain') || lower.includes('fnp')) {
      const m = a.name.match(/(\d)\+/);
      if (m) return m[1] + '+';
      return '??+';
    }
  }
  return null;
}
