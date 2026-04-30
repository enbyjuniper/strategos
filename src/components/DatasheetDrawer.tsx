import { useEffect, useState } from 'react';
import type { WahapediaDatasheet, WahapediaWeapon } from '../utils/wahapedia';
import { fetchDatasheet } from '../utils/wahapedia';
import { BottomSheet, useSheetClose } from './BottomSheet';
import styles from './DatasheetDrawer.module.scss';

interface Props {
  unitName: string;
  onClose: () => void;
}

function Html({ html, block }: { html: string | null | undefined; block?: boolean }) {
  if (!html) return null;
  const Tag = block ? 'div' : 'span';
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />;
}

function groupWeapons(weapons: WahapediaWeapon[]): WahapediaWeapon[][] {
  const map = new Map<string, WahapediaWeapon[]>();
  for (const w of weapons) {
    const key = w.line ?? `_${w.name}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return [...map.values()];
}

function WeaponTable({ weapons, isMelee }: { weapons: WahapediaWeapon[]; isMelee: boolean }) {
  const groups = groupWeapons(weapons);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.nameCell}>Weapon</th>
            {!isMelee && <th>Range</th>}
            <th>A</th>
            <th>{isMelee ? 'WS' : 'BS'}</th>
            <th>S</th>
            <th>AP</th>
            <th>D</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) =>
            group.map((w, pi) => (
              <tr key={`${gi}-${pi}`} className={pi > 0 ? styles.profileRow : undefined}>
                <td className={styles.nameCell}>
                  <div className={styles.wName}>{w.name ?? '—'}</div>
                  {w.type && <div className={styles.wType}><Html html={w.type} /></div>}
                </td>
                {!isMelee && <td>{w.range ?? '—'}</td>}
                <td>{w.a ?? '—'}</td>
                <td>{w.bs_ws ?? '—'}</td>
                <td>{w.s ?? '—'}</td>
                <td>{w.ap ?? '—'}</td>
                <td>{w.d ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Inner component — rendered inside BottomSheet's context provider,
// so useSheetClose() resolves to the sheet's animated close.
function DatasheetContent({ unitName }: { unitName: string }) {
  const closeSheet = useSheetClose();
  const [data, setData] = useState<WahapediaDatasheet | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetchDatasheet(unitName).then(result => {
      if (result) { setData(result); setStatus('ok'); }
      else setStatus('error');
    });
  }, [unitName]);

  const ranged = data?.wargear.filter(w => w.range !== 'Melee') ?? [];
  const melee  = data?.wargear.filter(w => w.range === 'Melee') ?? [];

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>{unitName}</div>
        <button className={styles.closeBtn} onClick={closeSheet}>✕</button>
      </div>

      {status === 'loading' && (
        <div className={styles.statusMsg}>Loading Wahapedia data…</div>
      )}
      {status === 'error' && (
        <div className={styles.statusMsg}>Not found in Wahapedia database</div>
      )}

      {status === 'ok' && data && (
        <div className={styles.body}>

          <div className={styles.meta}>
            {data.datasheet.role && <span className={styles.role}>{data.datasheet.role}</span>}
            {data.composition.map((c, i) => (
              <span key={i} className={styles.comp}><Html html={c.description} /></span>
            ))}
          </div>

          {data.models.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Stats</div>
              {data.models.map((m, i) => (
                <div key={i} className={data.models.length > 1 ? styles.modelRow : undefined}>
                  {data.models.length > 1 && m.name && (
                    <div className={styles.modelLabel}>{m.name}</div>
                  )}
                  <div className={styles.stats}>
                    <div className={styles.stat}><div className={styles.statLabel}>M</div><div className={styles.statValue}>{m.m ?? '—'}</div></div>
                    <div className={styles.stat}><div className={styles.statLabel}>T</div><div className={styles.statValue}>{m.t ?? '—'}</div></div>
                    <div className={styles.stat}><div className={styles.statLabel}>Sv</div><div className={styles.statValue}>{m.sv ?? '—'}</div></div>
                    <div className={`${styles.stat}${!m.inv_sv ? ` ${styles.absent}` : ''}`}><div className={styles.statLabel}>INV</div><div className={styles.statValue}>{m.inv_sv ?? '—'}</div></div>
                    <div className={styles.stat}><div className={styles.statLabel}>W</div><div className={styles.statValue}>{m.w ?? '—'}</div></div>
                    <div className={styles.stat}><div className={styles.statLabel}>Ld</div><div className={styles.statValue}>{m.ld ?? '—'}</div></div>
                    <div className={styles.stat}><div className={styles.statLabel}>OC</div><div className={styles.statValue}>{m.oc ?? '—'}</div></div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {ranged.length > 0 && (
            <section className={styles.section}>
              <div className={`${styles.sectionTitle} ${styles.shoot}`}>Ranged Weapons</div>
              <WeaponTable weapons={ranged} isMelee={false} />
            </section>
          )}

          {melee.length > 0 && (
            <section className={styles.section}>
              <div className={`${styles.sectionTitle} ${styles.melee}`}>Melee Weapons</div>
              <WeaponTable weapons={melee} isMelee={true} />
            </section>
          )}

          {data.abilities.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Abilities</div>
              <div className={styles.abilities}>
                {data.abilities.map((a, i) => (
                  <div key={i} className={styles.ability}>
                    {a.name && <span className={styles.abilName}><Html html={a.name} />: </span>}
                    <span className={styles.abilDesc}><Html html={a.description} /></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.options.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Options</div>
              {data.options.map((o, i) => (
                <div key={i} className={`${styles.abilDesc} ${styles.optionRow}`}><Html html={o.description} /></div>
              ))}
            </section>
          )}

          {data.datasheet.transport && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Transport</div>
              <div className={styles.abilDesc}><Html html={data.datasheet.transport} /></div>
            </section>
          )}

          {data.datasheet.damaged_description && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>
                Damaged ({data.datasheet.damaged_w})
              </div>
              <div className={styles.abilDesc}><Html html={data.datasheet.damaged_description} /></div>
            </section>
          )}

          {data.leads.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Can Lead</div>
              <div className={styles.tagRow}>
                {data.leads.map((l, i) => (
                  <span key={i} className={styles.tag}>{l.name}</span>
                ))}
              </div>
            </section>
          )}

          {data.datasheet.loadout && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Loadout</div>
              <div className={styles.abilDesc}><Html html={data.datasheet.loadout} /></div>
            </section>
          )}

          {data.keywords.length > 0 && (
            <section className={styles.section}>
              <div className={styles.tagRow}>
                {data.keywords.map((k, i) => (
                  <span
                    key={i}
                    className={`${styles.tag} ${k.is_faction_keyword === 'true' ? styles.factionTag : ''}`}
                  >
                    {k.keyword}
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </>
  );
}

export function DatasheetDrawer({ unitName, onClose }: Props) {
  return (
    <BottomSheet onClose={onClose} maxHeight="92vh">
      <DatasheetContent unitName={unitName} />
    </BottomSheet>
  );
}
