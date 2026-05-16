import { ListIcon, XIcon, ArrowClockwiseIcon, SunIcon, MoonIcon, CrosshairSimpleIcon, SquaresFourIcon } from '@phosphor-icons/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { Army } from '../types';
import styles from './Header.module.scss';

interface Props {
  army: Army | null;
  isOpen: boolean;
  onToggle: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  page: 'grid' | 'calculator';
  onNavigatePage: () => void;
}

export function Header({ army, isOpen, onToggle, theme, onToggleTheme, page, onNavigatePage }: Props) {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  return (
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
        {needRefresh && (
          <button
            className={styles.updateBtn}
            onClick={() => updateServiceWorker(true)}
            aria-label="Update app"
          >
            <ArrowClockwiseIcon size={14} weight="bold" />
            Update app
          </button>
        )}
        <button
          className={styles.navBtn}
          onClick={onNavigatePage}
          aria-label={page === 'grid' ? 'Open combat calculator' : 'Back to army grid'}
          data-active={page === 'calculator' || undefined}
        >
          {page === 'grid'
            ? <CrosshairSimpleIcon size={16} weight="bold" />
            : <SquaresFourIcon size={16} weight="bold" />}
        </button>
        <button
          className={styles.themeBtn}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <SunIcon size={16} weight="bold" /> : <MoonIcon size={16} weight="bold" />}
        </button>
      </div>
    </header>
  );
}
