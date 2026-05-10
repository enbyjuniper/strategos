import { ImageIcon, LinkIcon } from '@phosphor-icons/react';
import type { Unit, Phase } from '../types';
import { getInv, getFNP, hasFightFirst, isKeyword } from '../utils/abilities';
import { renderRichText } from '../utils/richText';
import { WeaponBlock } from './WeaponBlock';
import styles from './UnitCard.module.scss';

const UNIT_TYPES = new Set(['Infantry', 'Swarm', 'Beast', 'Vehicle', 'Monster', 'Mounted', 'Titanic']);

const TYPE_COLOR: Record<string, string> = {
  Infantry:  '#5b8dd9',
  Swarm:     '#a0c830',
  Beast:     '#d07030',
  Vehicle:   '#40c0d8',
  Monster:   '#d04060',
  Mounted:   '#c09050',
  Titanic:   '#ff5540',
};
const MOVE_TAG_PREFIXES = ['Fly', 'Deep Strike', 'Infiltrators', 'Scouts', 'Walker'];
const DUR_TAG_PREFIXES = ['Deadly Demise'];
const DUR_OVERLAY_PREFIXES = ['Lone Operative', 'Stealth'];

function findTags(prefixes: string[], pool: string[]): string[] {
  return prefixes.flatMap(prefix => {
    const lower = prefix.toLowerCase();
    const match = pool.find(s => {
      const sl = s.toLowerCase();
      return sl === lower || sl.startsWith(lower + ' ');
    });
    return match ? [match] : [];
  });
}

interface Props {
  unit: Unit;
  phase: Phase;
  onOpenImagePicker?: () => void;
  onOpenPicker?: () => void;
  imageUrl?: string;
  acted?: boolean;
  onToggleActed?: () => void;
}

export function UnitCard({ unit, phase, onOpenImagePicker, onOpenPicker, imageUrl, acted, onToggleActed }: Props) {
  if (!unit.stats) return null;

  const inv = getInv(unit.abilities);
  const fnp = getFNP([...unit.abilities, ...unit.rules]);
  const kwAbilities = unit.abilities.filter(a => isKeyword(a.name));
  const regAbilities = unit.abilities.filter(a => !isKeyword(a.name));

  const unitType = unit.keywords.find(k => UNIT_TYPES.has(k));
  const tagPool = [...unit.keywords, ...unit.abilities.map(a => a.name), ...unit.rules.map(a => a.name)];
  const moveTags = findTags(MOVE_TAG_PREFIXES, tagPool);
  const durTags = findTags(DUR_TAG_PREFIXES, tagPool);
  const durOverlayTags = findTags(DUR_OVERLAY_PREFIXES, tagPool);
  const fightFirst = hasFightFirst(unit.rules);

  const isInactive = (phase === 'shoot' && unit.ranged.length === 0) || (phase === 'melee' && unit.melee.length === 0);

  const cardClass = [
    styles.card,
    imageUrl ? styles.hasImage : '',
    fightFirst && phase === 'melee' ? styles.hasCornerOverlay : '',
    durOverlayTags.length > 0 && phase === 'dur' ? styles.hasCornerOverlay : '',
    acted ? styles.acted : '',
    isInactive ? styles.inactive : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} onClick={onToggleActed}>
      {fightFirst && phase === 'melee' && (
        <div className={`${styles.cornerOverlay} ${styles.meleeOverlay}`}>
          <span>Fights First</span>
        </div>
      )}
      {durOverlayTags.length > 0 && phase === 'dur' && (
        <div className={`${styles.cornerOverlay} ${styles.durOverlay}`}>
          {durOverlayTags.map(t => <span key={t}>{t}</span>)}
        </div>
      )}
      {imageUrl && (
        <div className={styles.imageWrapper}>
          <img
            src={imageUrl}
            className={styles.unitImage}
            alt=""
            aria-hidden="true"
          />
        </div>
      )}
      <div className={styles.cardContent}>
      <div className={styles.top}>
        <div
          className={`${styles.name}${unit.isChar ? ` ${styles.nameChar}` : ''}`}
        >
          {unit.name}
        </div>
        <div className={styles.topRight}>
          {onOpenPicker && (
            <button
            className={styles.button}
            onPointerDown={e => { if (!acted) e.stopPropagation(); }}
            onClick={e => { if (!acted) { e.stopPropagation(); onOpenPicker(); } }}
            title="Manage cluster"
            disabled={acted}
            >
              <LinkIcon size={16} weight="bold" />
            </button>
          )}
          {onOpenImagePicker && (
            <button
            className={styles.button}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onOpenImagePicker(); }}
            title="Set unit image"
            disabled={acted}
            >
              <ImageIcon size={16} weight="fill" />
            </button>
          )}
          {unitType && (
            <span
              className={styles.typePip}
              style={{ color: TYPE_COLOR[unitType], borderColor: TYPE_COLOR[unitType] }}
            >
              {unitType}
            </span>
          )}
        </div>
      </div>

      {phase === 'move' && (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>M</div>
              <div className={`${styles.statValue}`}>{unit.stats.M}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>OC</div>
              <div className={`${styles.statValue}`}>{unit.stats.OC}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Ld</div>
              <div className={`${styles.statValue}`}>{unit.stats.Ld}</div>
            </div>
          </div>
          {moveTags.length > 0 && (
            <div className={styles.tagRow}>
              {moveTags.map(t => (
                <span key={t} className={`${styles.tagPip} ${styles.moveTag}`}>{t}</span>
              ))}
            </div>
          )}
        </>
      )}

      {phase === 'dur' && (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>T</div>
              <div className={`${styles.statValue}`}>{unit.stats.T}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Sv</div>
              <div className={`${styles.statValue}`}>{unit.stats.Sv}</div>
            </div>
            <div className={`${styles.stat}${!inv ? ` ${styles.absent}` : ''}`}>
              <div className={styles.statLabel}>INV</div>
              <div className={`${styles.statValue}`}>{inv ?? '—'}</div>
            </div>
            <div className={`${styles.stat}${!fnp ? ` ${styles.absent}` : ''}`}>
              <div className={styles.statLabel}>FNP</div>
              <div className={`${styles.statValue}`}>{fnp ?? '—'}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>W</div>
              <div className={`${styles.statValue}`}>{unit.stats.W}</div>
            </div>
          </div>
          {durTags.length > 0 && (
            <div className={styles.tagRow}>
              {durTags.map(t => (
                <span key={t} className={`${styles.tagPip} ${styles.durTag}`}>{t}</span>
              ))}
            </div>
          )}
        </>
      )}

      {(phase === 'shoot' || phase === 'melee') && (
        <>
          <WeaponBlock
            weapons={phase === 'shoot' ? unit.ranged : unit.melee}
            accentColor={phase === 'shoot' ? 'var(--shoot)' : 'var(--melee)'}
          />
        </>
      )}

      {phase === 'abil' && (
        <>
          {kwAbilities.length > 0 && (
            <div className={styles.kwAbs}>
              {kwAbilities.map((a, i) => (
                <span key={`${a.name}-${i}`} className={styles.kwBadge}>{a.name}</span>
              ))}
            </div>
          )}
          {unit.enhancement && (
            <div className={styles.enhancement}>
              <div className={styles.enhancementName}>{unit.enhancement.name}</div>
              <div className={styles.abilDesc}>{renderRichText(unit.enhancement.desc)}</div>
            </div>
          )}
          <div className={styles.abilities}>
            {regAbilities.length > 0 ? (
              regAbilities.map((a, i) => (
                <div key={`${a.name}-${i}`}>
                  <div className={styles.abilName}>{a.name}</div>
                  <div className={styles.abilDesc}>{renderRichText(a.desc)}</div>
                </div>
              ))
            ) : kwAbilities.length === 0 && !unit.enhancement ? (
              <div className={styles.nodata}>no listed abilities</div>
            ) : null}
          </div>
          <div className={styles.keywords}>
            {unit.keywords.map(k => (
              <span
                key={k}
                className={`${styles.keyword}`}
              >
                {k}
              </span>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
