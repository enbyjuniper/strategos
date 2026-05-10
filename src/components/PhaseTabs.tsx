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
  preview?: Phase;
}

export function PhaseTabs({ phase, onChange, preview }: Props) {
  return (
    <div className={styles.tabs}>
      {TABS.map(t => {
        const isActive = phase === t.id;
        const isPreview = !isActive && preview === t.id;
        return (
          <button
            key={t.id}
            className={`${styles.tab}${isActive ? ` ${styles.active}` : ''}${isPreview ? ` ${styles.preview}` : ''}`}
            style={isActive || isPreview ? { '--tab-color': t.color } as CSSProperties : undefined}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
