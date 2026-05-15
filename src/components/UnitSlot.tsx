import React, { type ReactNode } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import styles from './UnitSlot.module.scss';

interface Props {
  children: ReactNode;
  acted: boolean;
  accent?: string;
}

export function UnitSlot({ children, acted, accent }: Props) {
  return (
    <div
      className={`${styles.frame}${accent ? ` ${styles.hasAccent}` : ''}`}
      style={accent ? { '--slot-accent': accent } as React.CSSProperties : undefined}
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
