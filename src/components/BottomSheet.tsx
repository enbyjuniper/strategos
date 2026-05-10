import { createContext, useContext, useEffect, useRef, useState } from 'react';
import styles from './BottomSheet.module.scss';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

const CtxClose = createContext<() => void>(() => {});
// eslint-disable-next-line react-refresh/only-export-components
export const useSheetClose = () => useContext(CtxClose);

interface Props {
  onClose: () => void;
  maxHeight?: string;
  children: React.ReactNode;
}

const DISMISS_PX = 100;
const DISMISS_VEL = 0.5; // px/ms

export function BottomSheet({ onClose, maxHeight = '70vh', children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  // Keep onClose fresh inside native event listener closures
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !done.current) setClosing(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock background scroll while open. On iOS, overflow:hidden alone doesn't
  // stop momentum scroll, so we fix the body in place and restore scroll on close.
  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, []);

  // Native drag listeners on the handle so we can use passive:false on touchmove
  // and support mouse drag on desktop.
  useEffect(() => {
    const handle = handleRef.current;
    const body   = bodyRef.current;
    const sheet  = sheetRef.current;
    if (!handle || !body || !sheet) return;

    let startY = 0;
    let startT = 0;
    let dragging = false;

    function start(y: number) {
      startY = y;
      startT = Date.now();
      dragging = true;
      sheet!.style.transition = 'none';
    }

    function move(y: number) {
      if (!dragging) return;
      const dy = Math.max(0, y - startY);
      sheet!.style.transform = `translateY(${dy}px)`;
    }

    function end(y: number) {
      if (!dragging || done.current) return;
      dragging = false;
      const dy = Math.max(0, y - startY);
      const vel = (Date.now() - startT) > 0 ? dy / (Date.now() - startT) : 0;
      if (dy > DISMISS_PX || vel > DISMISS_VEL) {
        sheet!.style.transition = 'transform 0.2s ease-in';
        sheet!.style.transform = 'translateY(100%)';
        setTimeout(() => { done.current = true; onCloseRef.current(); }, 200);
      } else {
        sheet!.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        sheet!.style.transform = '';
      }
    }

    const onTouchStart = (e: TouchEvent) => start(e.touches[0].clientY);
    const onTouchMove  = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientY); };
    const onTouchEnd   = (e: TouchEvent) => end(e.changedTouches[0].clientY);
    const onMouseDown  = (e: MouseEvent) => start(e.clientY);
    const onMouseMove  = (e: MouseEvent) => move(e.clientY);
    const onMouseUp    = (e: MouseEvent) => end(e.clientY);

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove',  onTouchMove,  { passive: false });
    handle.addEventListener('touchend',   onTouchEnd,   { passive: true });
    handle.addEventListener('mousedown',  onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    // Overscroll-to-dismiss: when the body content is scrolled to the top and
    // the user pulls down, translate the sheet instead of rubber-banding.
    let bodyStartY = 0;
    let bodyStartT = 0;
    let bodyStartScrollTop = 0;
    let bodyDragging = false;

    const onBodyTouchStart = (e: TouchEvent) => {
      bodyStartY = e.touches[0].clientY;
      bodyStartT = Date.now();
      bodyStartScrollTop = body.scrollTop;
      bodyDragging = false;
    };

    const onBodyTouchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - bodyStartY;
      if (!bodyDragging) {
        if (bodyStartScrollTop <= 0 && dy > 5) {
          bodyDragging = true;
          sheet!.style.transition = 'none';
        } else {
          return;
        }
      }
      e.preventDefault();
      sheet!.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };

    const onBodyTouchEnd = (e: TouchEvent) => {
      if (!bodyDragging || done.current) return;
      bodyDragging = false;
      const dy = Math.max(0, e.changedTouches[0].clientY - bodyStartY);
      const vel = (Date.now() - bodyStartT) > 0 ? dy / (Date.now() - bodyStartT) : 0;
      if (dy > DISMISS_PX || vel > DISMISS_VEL) {
        sheet!.style.transition = 'transform 0.2s ease-in';
        sheet!.style.transform = 'translateY(100%)';
        setTimeout(() => { done.current = true; onCloseRef.current(); }, 200);
      } else {
        sheet!.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        sheet!.style.transform = '';
      }
    };

    body.addEventListener('touchstart', onBodyTouchStart, { passive: true });
    body.addEventListener('touchmove',  onBodyTouchMove,  { passive: false });
    body.addEventListener('touchend',   onBodyTouchEnd,   { passive: true });

    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove',  onTouchMove);
      handle.removeEventListener('touchend',   onTouchEnd);
      handle.removeEventListener('mousedown',  onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      body.removeEventListener('touchstart', onBodyTouchStart);
      body.removeEventListener('touchmove',  onBodyTouchMove);
      body.removeEventListener('touchend',   onBodyTouchEnd);
    };
  }, []);

  function dismiss() {
    if (done.current) return;
    done.current = true;
    onClose();
  }

  function requestClose() {
    if (closing || done.current) return;
    setClosing(true);
  }

  function onAnimationEnd(e: React.AnimationEvent) {
    if (e.target === sheetRef.current && closing) dismiss();
  }

  return (
    <CtxClose.Provider value={requestClose}>
      <div
        className={`${styles.overlay}${closing ? ` ${styles.overlayOut}` : ''}`}
        onClick={requestClose}
      >
        <div
          ref={sheetRef}
          className={`${styles.sheet}${closing ? ` ${styles.sheetOut}` : ''}`}
          style={{ maxHeight }}
          onClick={e => e.stopPropagation()}
          onAnimationEnd={onAnimationEnd}
        >
          <div ref={handleRef} className={styles.handle} />
          <div ref={bodyRef} className={styles.body}>{children}</div>
        </div>
      </div>
    </CtxClose.Provider>
  );
}
