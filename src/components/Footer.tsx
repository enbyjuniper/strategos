import type { Unit } from '../types';
import styles from './Footer.module.scss';

interface Props {
  units: Unit[];
}

export function Footer({ units }: Props) {
  const total = units.reduce((s, u) => s + u.points, 0);
  const charCount = units.filter(u => u.isChar).length;

  return (
    <div className={styles.footer}>
      <span><strong>{units.length}</strong> units</span>
      <span><strong>{total}</strong>pts</span>
      <span><strong>{charCount}</strong> characters</span>
    </div>
  );
}
