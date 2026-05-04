import { useRef } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';
import type { Army } from '../types';
import styles from './Header.module.scss';
import { renderRichText } from '../utils/richText';

interface Props {
  army: Army | null;
  isOpen: boolean;
  onToggle: () => void;
  onRawJson: (raw: string) => void;
}

export function Header({ army, isOpen, onToggle, onRawJson }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { onRawJson(ev.target!.result as string); };
    reader.readAsText(file);
    e.target.value = '';
  }

  const charCount = army?.units.filter(u => u.isChar).length ?? 0;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <button
            className={styles.toggle}
            onClick={onToggle}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <XIcon size={20} weight="bold" /> : <ListIcon size={20} weight="bold" />}
          </button>
          <div className={styles.compact}>
            <span className={styles.brand}>Strategos</span>
            {army ? (
              <>
                <span className={styles.sep}>·</span>
                <span className={styles.armyName}>{army.name}</span>
                <span className={styles.sep}>·</span>
                <span className={styles.pts}>{army.points}pts</span>
              </>
            ) : (
              <span className={styles.noArmy}>No army loaded</span>
            )}
          </div>
        </div>
      </header>

      <div
        className={`${styles.backdrop}${isOpen ? ` ${styles.backdropVisible}` : ''}`}
        onClick={onToggle}
      />

      <aside className={`${styles.sidebar}${isOpen ? ` ${styles.sidebarOpen}` : ''}`}>
        <div className={styles.panel}>
          {army ? (
            <>
              <div className={styles.armyBlock}>
                <div className={styles.armyTitle}>{army.name}</div>
                <div className={styles.armyMeta}>
                  <span><strong>{army.units.length}</strong> units</span>
                  <span className={styles.dot}>·</span>
                  <span><strong>{army.points}</strong>pts</span>
                  <span className={styles.dot}>·</span>
                  <span><strong>{charCount}</strong> characters</span>
                </div>
              </div>

              {army.detachment && (
                <div className={styles.infoSection}>
                  <div className={styles.infoLabel}>Detachment</div>
                  <div className={styles.detachmentName}>{army.detachment.name}</div>
                  {army.detachment.rules.map(r => (
                    <div key={r.name} className={styles.ruleEntry}>
                      <div className={styles.ruleName}>{r.name}</div>
                      <div className={styles.ruleDesc}>{renderRichText(r.desc)}</div>
                    </div>
                  ))}
                </div>
              )}

              {army.units.some(u => u.enhancement) && (
                <div className={styles.infoSection}>
                  <div className={styles.infoLabel}>Enhancements</div>
                  {army.units.filter(u => u.enhancement).map(u => (
                    <div key={u.id} className={styles.enhancementEntry}>
                      <div className={styles.enhancementHeader}>
                        <span className={styles.enhancementName}>{u.enhancement!.name}</span>
                        <span className={styles.enhancementUnit}>{u.name}</span>
                      </div>
                      <div className={styles.ruleDesc}>{renderRichText(u.enhancement!.desc)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={styles.logoBlock}>
              <span className={styles.logoBig}>Strategos</span>
              <span className={styles.logoSub}>Army Reference</span>
            </div>
          )}
        </div>

        <div className={styles.importRow}>
          <button className={styles.importBtn} onClick={() => inputRef.current?.click()}>
            ↑ Import New Recruit JSON
          </button>
          <div className={styles.hint}>Export from newrecruit.eu → Share → Download JSON</div>
        </div>
      </aside>

      <input ref={inputRef} type="file" accept=".json" className={styles.fileInput} onChange={handleFile} />
    </>
  );
}
