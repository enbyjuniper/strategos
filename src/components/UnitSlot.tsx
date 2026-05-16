import React, { type ReactNode } from 'react';
import styles from './UnitSlot.module.scss';

interface Props {
  children: ReactNode;
  accent?: string;
}

export function UnitSlot({ children, accent }: Props) {
  return (
    <div
      className={`${styles.frame}${accent ? ` ${styles.hasAccent}` : ''}`}
      style={accent ? { '--slot-accent': accent } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  );
}
