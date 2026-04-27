import type { CSSProperties } from 'react';
import type { Phase } from '../types';
import styles from './PhaseTabs.module.scss';

interface TabDef {
  id: Phase;
  label: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'move',  label: 'Movement',   color: 'var(--move)'  },
  { id: 'shoot', label: 'Shooting',   color: 'var(--shoot)' },
  { id: 'melee', label: 'Melee',      color: 'var(--melee)' },
  { id: 'dur',   label: 'Durability', color: 'var(--dur)'   },
  { id: 'abil',  label: 'Abilities',  color: 'var(--abil)'  },
];

interface Props {
  phase: Phase;
  onChange: (p: Phase) => void;
}

export function PhaseTabs({ phase, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${styles.tab}${phase === t.id ? ` ${styles.active}` : ''}`}
          style={phase === t.id ? { '--tab-color': t.color } as CSSProperties : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
