import type { ReactNode } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import styles from './UnitSlot.module.scss';

interface Props {
  children: ReactNode;
  acted: boolean;
  cluster?: { line: string; bg: string };
}

export function UnitSlot({ children, acted, cluster }: Props) {
  return (
    <div
      className={cluster ? styles.cluster : styles.shell}
      style={cluster ? { borderLeftColor: cluster.line, background: cluster.bg } : undefined}
    >
      {acted && (
        <div className={styles.actedMark}>
          <CheckIcon weight="bold" />
        </div>
      )}
      {children}
    </div>
  );
}
