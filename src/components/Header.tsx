import { useEffect, useRef } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';
import type { Army } from '../types';
import styles from './Header.module.scss';
import { renderRichText } from '../utils/richText';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

interface Props {
  army: Army | null;
  isOpen: boolean;
  onToggle: () => void;
  onRawJson: (raw: string) => void;
}

const DISMISS_PX  = 60;
const DISMISS_VEL = 0.3; // px/ms

export function Header({ army, isOpen, onToggle, onRawJson }: Props) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  // Keep fresh copies for use inside native event listener closures
  const isOpenRef   = useRef(isOpen);
  const onToggleRef = useRef(onToggle);
  useEffect(() => { isOpenRef.current = isOpen; },   [isOpen]);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

  // After React removes the sidebarOpen class, clear any inline styles the
  // gesture may have applied so the CSS transition takes over cleanly.
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || isOpen) return;
    sidebar.style.transform  = '';
    sidebar.style.transition = '';
  }, [isOpen]);

  // Lock background scroll while the sidebar is open (iOS-safe pattern).
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => unlockScroll();
  }, [isOpen]);

  // Swipe-left-to-dismiss on the sidebar.
  // touch-action: pan-y on the sidebar element (set in CSS) tells the browser
  // to only claim vertical scrolling natively, leaving horizontal touches to JS.
  // That's why we don't need preventDefault or any passive:false tricks here.
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
        if (Math.abs(dy) >= Math.abs(dx) || dx >= 0) return; // vertical or rightward — ignore
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
        setTimeout(() => onToggleRef.current(), 200);
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

      <aside ref={sidebarRef} className={`${styles.sidebar}${isOpen ? ` ${styles.sidebarOpen}` : ''}`}>
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
