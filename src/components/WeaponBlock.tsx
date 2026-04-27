import type { WeaponStats } from '../types';
import styles from './WeaponBlock.module.scss';

interface Props {
  weapons: WeaponStats[];
  accentColor: string;
}

function WeaponRow({ w }: { w: WeaponStats }) {
  const hit = w.BS ?? w.WS ?? '—';
  const kw = w.Keywords && w.Keywords !== '-' ? w.Keywords : null;
  return (
    <>
      <div className={styles.name}>{w.name}</div>
      <div className={styles.row}>
        {w.Range && w.Range !== 'Melee' && (
          <div className={styles.pip}>
            <div className={styles.pipLabel}>RNG</div>
            <div className={styles.pipValue}>{w.Range}</div>
          </div>
        )}
        <div className={styles.pip}>
          <div className={styles.pipLabel}>A</div>
          <div className={styles.pipValue}>{w.A}</div>
        </div>
        <div className={styles.pip}>
          <div className={styles.pipLabel}>{w.BS ? 'BS' : 'WS'}</div>
          <div className={styles.pipValue}>{hit}</div>
        </div>
        <div className={styles.pip}>
          <div className={styles.pipLabel}>S</div>
          <div className={styles.pipValue}>{w.S}</div>
        </div>
        <div className={styles.pip}>
          <div className={styles.pipLabel}>AP</div>
          <div className={styles.pipValue}>{w.AP}</div>
        </div>
        <div className={styles.pip}>
          <div className={styles.pipLabel}>D</div>
          <div className={styles.pipValue}>{w.D}</div>
        </div>
      </div>
      {kw && (
        <div className={styles.kwRow}>
          {kw.split(',').map(k => k.trim()).filter(Boolean).map(k => (
            <span key={k} className={styles.kwPip}>{k}</span>
          ))}
        </div>
      )}
    </>
  );
}

export function WeaponBlock({ weapons, accentColor }: Props) {
  if (!weapons.length) {
    return <div className={styles.nodata}>— none —</div>;
  }

  return (
    <div className={styles.list}>
      {weapons.map(w => {
        if (w.profiles) {
          return (
            <div key={w.name} className={styles.weaponGroup} style={{ borderLeftColor: accentColor }}>
              <div className={styles.chooseOne}>choose one</div>
              {w.profiles.map((p, i) => (
                <div key={p.name} className={styles.weapon}>
                  {i > 0 && <div className={styles.orDivider}>— or —</div>}
                  <WeaponRow w={p} />
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={w.name} className={styles.weapon}>
            <WeaponRow w={w} />
          </div>
        );
      })}
    </div>
  );
}
