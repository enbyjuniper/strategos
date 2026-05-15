import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import type { Army } from '../types';
import { Badge } from './Badge';
import styles from './SideMenu.module.scss';
import { renderRichText } from '../utils/richText';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

interface Props {
  army: Army | null;
  isOpen: boolean;
  onToggle: () => void;
  savedLists: Record<string, string>;
  currentListId: string | null;
  onSelectList: (id: string) => void;
  onDeleteList: (id: string) => void;
  onImport: (raw: string) => void;
}

const DISMISS_PX  = 60;
const DISMISS_VEL = 0.3; // px/ms

export function SideMenu({ army, isOpen, onToggle, savedLists, currentListId, onSelectList, onDeleteList, onImport }: Props) {
  const sidebarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'army' | 'lists'>('army');
  const isOpenRef        = useRef(isOpen);
  const onToggleRef      = useRef(onToggle);
  const closeAndResetRef = useRef(() => { setView('army'); onToggle(); });
  useEffect(() => { isOpenRef.current = isOpen; },   [isOpen]);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);
  useEffect(() => { closeAndResetRef.current = () => { setView('army'); onToggle(); }; }, [onToggle]);

  function closeAndReset() {
    setView('army');
    onToggle();
  }

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || isOpen) return;
    sidebar.style.transform  = '';
    sidebar.style.transition = '';
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => unlockScroll();
  }, [isOpen]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let dragging = false;
    let decided  = false;

    const onTouchStart = (e: TouchEvent) => {
      if (!isOpenRef.current) return;
      startX   = e.touches[0].clientX;
      startY   = e.touches[0].clientY;
      startT   = Date.now();
      dragging = false;
      decided  = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isOpenRef.current) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        decided = true;
        if (Math.abs(dy) >= Math.abs(dx) || dx >= 0) return;
        dragging = true;
        sidebar.style.transition = 'none';
      }

      if (!dragging) return;
      sidebar.style.transform = `translateX(${Math.min(0, dx)}px)`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      const dx    = Math.min(0, e.changedTouches[0].clientX - startX);
      const absDx = Math.abs(dx);
      const vel   = (Date.now() - startT) > 0 ? absDx / (Date.now() - startT) : 0;
      if (absDx > DISMISS_PX || vel > DISMISS_VEL) {
        sidebar.style.transition = 'transform 0.2s ease-in';
        sidebar.style.transform  = 'translateX(-100%)';
        setTimeout(() => closeAndResetRef.current(), 200);
      } else {
        sidebar.style.transition = 'transform 0.25s ease';
        sidebar.style.transform  = '';
      }
    };

    sidebar.addEventListener('touchstart', onTouchStart, { passive: true });
    sidebar.addEventListener('touchmove',  onTouchMove,  { passive: true });
    sidebar.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      sidebar.removeEventListener('touchstart', onTouchStart);
      sidebar.removeEventListener('touchmove',  onTouchMove);
      sidebar.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { onImport(ev.target!.result as string); };
    reader.readAsText(file);
    e.target.value = '';
  }

  const charCount = army?.units.filter(u => u.isChar).length ?? 0;
  const listEntries = Object.entries(savedLists);

  return (
    <>
      <div
        className={`${styles.backdrop}${isOpen ? ` ${styles.backdropVisible}` : ''}`}
        onClick={closeAndReset}
      />

      <aside ref={sidebarRef} className={`${styles.sidebar}${isOpen ? ` ${styles.sidebarOpen}` : ''}`}>
        <div className={styles.slidingContainer}>

          {/* Army panel */}
          <div
            className={styles.slide}
            style={{ transform: view === 'lists' ? 'translateX(-25%)' : 'translateX(0)', pointerEvents: view === 'lists' ? 'none' : 'auto' }}
          >
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
              <button className={styles.importBtn} onClick={() => setView('lists')}>
                Lists
              </button>
            </div>
          </div>

          {/* Lists panel */}
          <div
            className={styles.slide}
            style={{ transform: view === 'lists' ? 'translateX(0)' : 'translateX(100%)', pointerEvents: view === 'lists' ? 'auto' : 'none' }}
          >
            <div className={styles.listsHeader}>
              <button className={styles.backBtn} onClick={() => setView('army')}>
                <ArrowLeftIcon size={14} weight="bold" />
              </button>
              <span className={styles.listsTitle}>Lists</span>
            </div>

            <div className={styles.listPanel}>
              {listEntries.length === 0 ? (
                <div className={styles.listsEmpty}>No saved lists</div>
              ) : (
                <div className={styles.listEntries}>
                  {listEntries.map(([id, name]) => (
                    <div key={id} className={`${styles.listRow}${id === currentListId ? ` ${styles.listRowActive}` : ''}`}>
                      <button className={styles.listName} onClick={() => { onSelectList(id); closeAndReset(); }}>
                        <span className={styles.listNameText}>{name}</span>
                        {id === currentListId && <Badge color="var(--accent)" borderColor="var(--accent-dim)">Active</Badge>}
                      </button>
                      {id !== currentListId && (
                        <button className={styles.deleteBtn} onClick={() => onDeleteList(id)} aria-label={`Delete ${name}`}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.importRow}>
              <button className={styles.importBtn} onClick={() => fileInputRef.current?.click()}>
                ↑ Import New Recruit JSON
              </button>
              <div className={styles.hint}>Export from newrecruit.eu → Share → Download JSON</div>
            </div>
          </div>

        </div>
      </aside>

      <input ref={fileInputRef} type="file" accept=".json" className={styles.fileInput} onChange={handleFile} />
    </>
  );
}
