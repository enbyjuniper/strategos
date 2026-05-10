import type { ReactNode } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import styles from './UnitSlot.module.scss';

interface Props {
  children: ReactNode;
  acted: boolean;
  accent?: { line: string; bg: string };
}

export function UnitSlot({ children, acted, accent }: Props) {
  return (
    <div
      className={styles.frame}
      style={accent ? {
        borderLeftColor: accent.line,
        borderLeftWidth: '0.1875rem',
        background: accent.bg,
      } : undefined}
    >
      {children}
      {acted && (
        <div className={styles.actedMark}>
          <CheckIcon weight="bold" />
        </div>
      )}
    </div>
  );
}
