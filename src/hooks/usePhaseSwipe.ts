import { useState, useRef, useEffect } from 'react';
import type { Phase } from '../types';

const PHASES: Phase[] = ['move', 'shoot', 'melee', 'dur', 'abil'];
const PHASE_LABELS: Record<Phase, string> = {
  move: 'Movement', shoot: 'Shooting', melee: 'Melee', dur: 'Durability', abil: 'Abilities',
};

const SWIPE_TRIGGER = 75;
const SWIPE_SHOW = SWIPE_TRIGGER / 2;
const SWIPE_LERP = 0.18;

export function usePhaseSwipe(activeId: string | null) {
  const [phase, setPhase] = useState<Phase>('move');
  const [swipe, setSwipe] = useState<{ target: Phase; isNext: boolean } | null>(null);

  const pillRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pillPRef = useRef(0);
  const pillTargetRef = useRef(0);
  const pillRAFRef = useRef(0);
  const pillIsNextRef = useRef(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeAxisLockedRef = useRef(false);

  useEffect(() => () => cancelAnimationFrame(pillRAFRef.current), []);

  function writePill(p: number) {
    if (!pillRef.current) return;
    const d = pillIsNextRef.current ? 1 : -1;
    pillRef.current.style.transform = `translateY(-50%) translateX(${d * (1 - p) * 100}%)`;
    pillRef.current.style.opacity = String(p);
  }

  function writeGrid(p: number) {
    if (!gridRef.current) return;
    const d = pillIsNextRef.current ? -1 : 1;
    gridRef.current.style.transform = `translateX(${d * p * 10}px)`;
    gridRef.current.style.opacity = String(1 - 0.45 * p);
  }

  function hidePill(immediate = false) {
    pillPRef.current = 0;
    cancelAnimationFrame(pillRAFRef.current);
    if (pillRef.current) {
      pillRef.current.style.opacity = '0';
      pillRef.current.style.transform = '';
    }
    if (gridRef.current) {
      if (immediate) {
        gridRef.current.style.transition = '';
        gridRef.current.style.transform = '';
        gridRef.current.style.opacity = '';
      } else {
        gridRef.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
        gridRef.current.style.transform = '';
        gridRef.current.style.opacity = '';
        gridRef.current.addEventListener('transitionend', () => {
          if (gridRef.current) gridRef.current.style.transition = '';
        }, { once: true });
      }
    }
  }

  function runPillAnim() {
    const next = pillPRef.current + (pillTargetRef.current - pillPRef.current) * SWIPE_LERP;
    pillPRef.current = Math.abs(next - pillTargetRef.current) < 0.002 ? pillTargetRef.current : next;
    writePill(pillPRef.current);
    writeGrid(pillPRef.current);
    if (pillPRef.current !== pillTargetRef.current) {
      pillRAFRef.current = requestAnimationFrame(runPillAnim);
    }
  }

  function updatePillContent(target: Phase, isNext: boolean) {
    if (!pillRef.current) return;
    pillRef.current.setAttribute('data-direction', isNext ? 'next' : 'prev');
    pillRef.current.style.setProperty('--swipe-color', `var(--${target})`);
    pillRef.current.textContent = PHASE_LABELS[target];
  }

  function applyPillStyle(absX: number, isNext: boolean) {
    if (!pillRef.current) return;
    pillTargetRef.current = Math.min(1, Math.max(0, (absX - SWIPE_SHOW) / (SWIPE_TRIGGER - SWIPE_SHOW)));
    pillIsNextRef.current = isNext;
    cancelAnimationFrame(pillRAFRef.current);
    pillRAFRef.current = requestAnimationFrame(runPillAnim);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (activeId) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeAxisLockedRef.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (activeId || swipeStartX.current === null || swipeStartY.current === null) return;
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = e.touches[0].clientY - swipeStartY.current;
    const absX = Math.abs(dx);
    if (!swipeAxisLockedRef.current) {
      if (Math.abs(dy) > absX || absX < SWIPE_SHOW) {
        if (swipe !== null) {
          hidePill();
          setSwipe(null);
        }
        return;
      }
      swipeAxisLockedRef.current = true;
    }
    const idx = PHASES.indexOf(phase);
    const isNext = dx < 0;
    const target = isNext
      ? PHASES[(idx + 1) % PHASES.length]
      : PHASES[(idx - 1 + PHASES.length) % PHASES.length];
    if (gridRef.current) gridRef.current.style.transition = '';
    updatePillContent(target, isNext);
    applyPillStyle(absX, isNext);
    if (target !== swipe?.target || isNext !== swipe?.isNext) setSwipe({ target, isNext });
  }

  function handleTouchEnd(e: React.TouchEvent) {
    setSwipe(null);
    const wasAxisLocked = swipeAxisLockedRef.current;
    swipeAxisLockedRef.current = false;
    if (activeId || swipeStartX.current === null || swipeStartY.current === null) {
      hidePill(false);
      return;
    }
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    const completed = wasAxisLocked && Math.abs(dy) <= Math.abs(dx) && Math.abs(dx) >= SWIPE_TRIGGER;
    hidePill(completed);
    if (!completed) return;
    const idx = PHASES.indexOf(phase);
    if (dx < 0) setPhase(PHASES[(idx + 1) % PHASES.length]);
    else setPhase(PHASES[(idx - 1 + PHASES.length) % PHASES.length]);
  }

  function handleTouchCancel() {
    swipeAxisLockedRef.current = false;
    hidePill();
    swipeStartX.current = null;
    swipeStartY.current = null;
    setSwipe(null);
  }

  return {
    phase,
    setPhase,
    swipe,
    pillRef,
    gridRef,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}
