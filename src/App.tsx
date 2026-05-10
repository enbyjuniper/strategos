import { useState, useEffect, useMemo, useRef } from 'react';
import {
  DndContext, closestCenter, MouseSensor, TouchSensor,
  DragOverlay, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';
import type { Army, Phase, Attachments } from './types';
import { parseNR } from './utils/parseNR';
import { isLeader } from './utils/abilities';
import type { NRJson } from './utils/parseNR';
import { Header } from './components/Header';
import { PhaseTabs } from './components/PhaseTabs';
import { UnitCard } from './components/UnitCard';
import { UnitSlot } from './components/UnitSlot';
import { SortableSlot } from './components/SortableSlot';
import { UnitPicker } from './components/UnitPicker';
import styles from './App.module.scss';

const PHASES: Phase[] = ['move', 'shoot', 'melee', 'dur', 'abil'];
const PHASE_LABELS: Record<Phase, string> = {
  move: 'Movement', shoot: 'Shooting', melee: 'Melee', dur: 'Durability', abil: 'Abilities',
};

const SWIPE_TRIGGER = 150; // px — change this to tune swipe sensitivity
const SWIPE_SHOW = SWIPE_TRIGGER / 2; // pill starts appearing halfway to the trigger
const SWIPE_LERP = 0.18; // exponential smoothing per frame — lower = more lag

const CHAR_COLOR = { line: 'var(--char)', bg: 'rgba(240,192,96,0.06)' };

const CLUSTER_COLORS = [
  { line: '#4a9eff', bg: 'rgba(74,158,255,0.06)' },
  { line: '#b070ff', bg: 'rgba(176,112,255,0.06)' },
  { line: '#e8a020', bg: 'rgba(232,160,32,0.06)' },
  { line: '#e05050', bg: 'rgba(224,80,80,0.06)' },
  { line: '#00c8a0', bg: 'rgba(0,200,160,0.06)' },
];

function colorForCluster(primaryId: string) {
  let h = 0;
  for (const c of primaryId) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return CLUSTER_COLORS[h % CLUSTER_COLORS.length];
}

function hexToClusterColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return { line: hex, bg: 'rgba(0,0,0,0.06)' };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { line: hex, bg: `rgba(${r},${g},${b},0.06)` };
}

function buildOrder(unitIds: string[], saved: string | null): string[] {
  if (saved) {
    try {
      const parsed: string[] = JSON.parse(saved);
      const valid = parsed.filter(id => unitIds.includes(id));
      const missing = unitIds.filter(id => !valid.includes(id));
      return [...valid, ...missing];
    } catch { /* ignore */ }
  }
  return [...unitIds];
}

function App() {
  const [army, setArmy] = useState<Army | null>(() => {
    try {
      const saved = localStorage.getItem('strategos_list');
      return saved ? parseNR(JSON.parse(saved) as NRJson) : null;
    } catch { return null; }
  });
  const [phase, setPhase] = useState<Phase>('move');
  const [swipe, setSwipe] = useState<{ target: Phase; isNext: boolean } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pillPRef = useRef(0);        // current displayed progress (0–1)
  const pillTargetRef = useRef(0);   // target progress from finger position
  const pillRAFRef = useRef(0);      // requestAnimationFrame handle
  const pillIsNextRef = useRef(false);
  const [headerOpen, setHeaderOpen] = useState(() => !localStorage.getItem('strategos_list'));
  const [attachments, setAttachments] = useState<Attachments>(() => {
    try {
      const saved = localStorage.getItem('strategos_attachments');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [unitOrder, setUnitOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('strategos_list');
      if (!saved) return [];
      const parsed = parseNR(JSON.parse(saved) as NRJson);
      return buildOrder(parsed.units.map(u => u.id), localStorage.getItem('strategos_order'));
    } catch { return []; }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<{ unitId: string; section: 'image' | 'cluster' } | null>(null);
  const [unitImages, setUnitImages] = useState<Record<string, string>>(() => {
    try {
      const imgs = localStorage.getItem('strategos_images');
      return imgs ? JSON.parse(imgs) : {};
    } catch { return {}; }
  });
  const [clusterColors, setClusterColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('strategos_cluster_colors');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // Tracks acted units per phase; tagged with army so stale state is discarded on army change
  const [actedStore, setActedStore] = useState<{ army: Army | null; byPhase: Partial<Record<Phase, Set<string>>> }>({
    army: null,
    byPhase: {},
  });

  const actedIds = useMemo(() => {
    if (!army || actedStore.army !== army) return new Set<string>();
    return actedStore.byPhase[phase] ?? new Set<string>();
  }, [army, phase, actedStore]);

  const hasAnyActed = useMemo(() => {
    if (!army || actedStore.army !== army) return false;
    return Object.values(actedStore.byPhase).some(s => s.size > 0);
  }, [army, actedStore]);

  function getClusterIds(unitId: string): string[] {
    if (attachments[unitId]?.length > 0) return [unitId, ...attachments[unitId]];
    for (const [primaryId, attached] of Object.entries(attachments)) {
      if (attached.includes(unitId)) return [primaryId, ...attached];
    }
    return [unitId];
  }

  function clearActed() {
    if (!army) return;
    setActedStore({ army, byPhase: {} });
  }

  function toggleActed(unitId: string) {
    setActedStore(prev => {
      const prevByPhase = prev.army === army ? prev.byPhase : {};
      const current = new Set(prevByPhase[phase] ?? []);
      const ids = getClusterIds(unitId);
      if (current.has(unitId)) ids.forEach(id => current.delete(id));
      else ids.forEach(id => current.add(id));
      return { army, byPhase: { ...prevByPhase, [phase]: current } };
    });
  }

  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeAxisLockedRef = useRef(false);

  function handleTouchStart(e: React.TouchEvent) {
    if (activeId) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeAxisLockedRef.current = false;
  }

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
    pillRef.current.className = `${styles.swipeIndicator} ${isNext ? styles.swipeRight : styles.swipeLeft}`;
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

  useEffect(() => () => cancelAnimationFrame(pillRAFRef.current), []);

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
    const target = isNext ? PHASES[(idx + 1) % PHASES.length] : PHASES[(idx - 1 + PHASES.length) % PHASES.length];
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  useEffect(() => {
    try { localStorage.setItem('strategos_attachments', JSON.stringify(attachments)); } catch { /* ignore */ }
  }, [attachments]);

  useEffect(() => {
    try { localStorage.setItem('strategos_cluster_colors', JSON.stringify(clusterColors)); } catch { /* ignore */ }
  }, [clusterColors]);

  useEffect(() => {
    if (unitOrder.length > 0) {
      try { localStorage.setItem('strategos_order', JSON.stringify(unitOrder)); } catch { /* ignore */ }
    }
  }, [unitOrder]);

  function handleRawJson(raw: string) {
    try {
      const parsed = parseNR(JSON.parse(raw) as NRJson);
      setArmy(parsed);
      setAttachments({});
      setClusterColors({});
      setUnitOrder(parsed.units.map(u => u.id));
      setPickerFor(null);
      setHeaderOpen(false);
      try { localStorage.setItem('strategos_list', raw); } catch { /* ignore */ }
    } catch (err) {
      alert('Could not parse JSON: ' + (err as Error).message);
    }
  }

  // ── Drag ──────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
    setOverId(null);
  }

  function handleDragOver(e: DragOverEvent) {
    setOverId(e.over ? String(e.over.id) : null);
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const aId = active.id as string;
    const oId = over.id as string;

    setUnitOrder(prev => {
      const attachedSet = new Set(Object.values(attachments).flat());
      const blocks: string[][] = [];
      const seen = new Set<string>();
      for (const id of prev) {
        if (seen.has(id) || attachedSet.has(id)) continue;
        const block = [id, ...(attachments[id] ?? []).filter(aid => prev.includes(aid))];
        blocks.push(block);
        block.forEach(bid => seen.add(bid));
      }
      const fromIdx = blocks.findIndex(b => b[0] === aId);
      const toIdx = blocks.findIndex(b => b[0] === oId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      return arrayMove(blocks, fromIdx, toIdx).flat();
    });
  }

  // ── Attachments ───────────────────────────────────────────────

  function attachTo(unitId: string, primaryId: string) {
    setAttachments(prev => ({ ...prev, [primaryId]: [...(prev[primaryId] ?? []), unitId] }));
    setClusterColors(prev => prev[primaryId] ? prev : { ...prev, [primaryId]: colorForCluster(primaryId).line });
    setPickerFor(null);
  }

  function detach(unitId: string) {
    setAttachments(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(id => id !== unitId);
        if (next[key].length === 0) delete next[key];
      }
      return next;
    });
    setPickerFor(null);
  }

  function reattach(unitId: string, newPrimaryId: string) {
    setAttachments(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter(id => id !== unitId);
        if (next[key].length === 0) delete next[key];
      }
      next[newPrimaryId] = [...(next[newPrimaryId] ?? []), unitId];
      return next;
    });
    setPickerFor(null);
  }

  function setImage(unitId: string, url: string | null) {
    setUnitImages(prev => {
      const next = { ...prev };
      if (url) next[unitId] = url;
      else delete next[unitId];
      try { localStorage.setItem('strategos_images', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function dissolve(primaryId: string) {
    setAttachments(prev => { const next = { ...prev }; delete next[primaryId]; return next; });
    setClusterColors(prev => { const next = { ...prev }; delete next[primaryId]; return next; });
    setPickerFor(null);
  }

  // ── Render ────────────────────────────────────────────────────

  if (!army) {
    return (
      <div data-swiping={swipe !== null || undefined}>
        <Header army={null} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} onRawJson={handleRawJson} />
        <div className={styles.content} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}>
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No army loaded</div>
            <div className={styles.emptySub}>Tap ☰ above to import a New Recruit JSON file.</div>
          </div>
        </div>
        <div ref={pillRef} className={styles.swipeIndicator} />
        <PhaseTabs phase={phase} onChange={setPhase} preview={swipe?.target} />
      </div>
    );
  }

  const allAttachedIds = new Set(Object.values(attachments).flat());
  const visibleIds = unitOrder.filter(id => !allAttachedIds.has(id) && army.units.some(u => u.id === id));
  const activeUnit = activeId ? army.units.find(u => u.id === activeId) ?? null : null;

  const activeIdx = activeId ? visibleIds.indexOf(activeId) : -1;
  const overIdx = overId ? visibleIds.indexOf(overId) : -1;

  function indicatorFor(id: string): 'top' | 'bottom' | undefined {
    if (!overId || id !== overId || activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return undefined;
    return activeIdx > overIdx ? 'top' : 'bottom';
  }

  return (
    <div data-swiping={swipe !== null || undefined}>
      <Header army={army} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} onRawJson={handleRawJson} />
      <div className={styles.content} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={visibleIds} strategy={() => null}>
            <div ref={gridRef} className={styles.grid}>
              {visibleIds.map(id => {
                const unit = army.units.find(u => u.id === id);
                if (!unit) return null;

                const attached = (attachments[unit.id] ?? [])
                  .map(aid => army.units.find(u => u.id === aid))
                  .filter(Boolean) as typeof army.units;

                if (attached.length > 0) {
                  const sortedAttached = [
                    ...attached.filter(u => isLeader(u)),
                    ...attached.filter(u => !isLeader(u)),
                  ];
                  const color = clusterColors[unit.id] ? hexToClusterColor(clusterColors[unit.id]) : colorForCluster(unit.id);
                  return (
                    <SortableSlot key={id} id={id} className={styles.gridItem} indicator={indicatorFor(id)}>
                      <UnitSlot acted={actedIds.has(unit.id)} accent={color}>
                        <UnitCard unit={unit} phase={phase} imageUrl={unitImages[unit.id]} onOpenImagePicker={() => setPickerFor({ unitId: unit.id, section: 'image' })} onOpenPicker={isLeader(unit) ? () => setPickerFor({ unitId: unit.id, section: 'cluster' }) : undefined} acted={actedIds.has(unit.id)} onToggleActed={() => toggleActed(unit.id)} />
                        {sortedAttached.map(u => (
                          <UnitCard key={u.id} unit={u} phase={phase} imageUrl={unitImages[u.id]} onOpenImagePicker={() => setPickerFor({ unitId: u.id, section: 'image' })} onOpenPicker={isLeader(u) ? () => setPickerFor({ unitId: u.id, section: 'cluster' }) : undefined} acted={actedIds.has(u.id)} onToggleActed={() => toggleActed(u.id)} />
                        ))}
                      </UnitSlot>
                    </SortableSlot>
                  );
                }

                return (
                  <SortableSlot key={id} id={id} className={styles.gridItem} indicator={indicatorFor(id)}>
                    <UnitSlot acted={actedIds.has(unit.id)} accent={unit.isChar ? CHAR_COLOR : undefined}>
                      <UnitCard unit={unit} phase={phase} imageUrl={unitImages[unit.id]} onOpenImagePicker={() => setPickerFor({ unitId: unit.id, section: 'image' })} onOpenPicker={isLeader(unit) ? () => setPickerFor({ unitId: unit.id, section: 'cluster' }) : undefined} acted={actedIds.has(unit.id)} onToggleActed={() => toggleActed(unit.id)} />
                    </UnitSlot>
                  </SortableSlot>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeUnit && (
              <div className={styles.dragGhost}>
                <span className={styles.dragGhostName}>{activeUnit.name}</span>
                {attachments[activeUnit.id]?.length > 0 && (
                  <span className={styles.dragGhostCount}>+{attachments[activeUnit.id].length}</span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      <div ref={pillRef} className={styles.swipeIndicator} />
      <PhaseTabs phase={phase} onChange={setPhase} preview={swipe?.target} />
      {hasAnyActed && (
        <button className={styles.clearBtn} onClick={clearActed}>Ready all</button>
      )}

      {pickerFor && (
        <UnitPicker
          unitId={pickerFor.unitId}
          section={pickerFor.section}
          army={army}
          attachments={attachments}
          imageUrl={unitImages[pickerFor.unitId]}
          onClose={() => setPickerFor(null)}
          onDissolve={() => dissolve(pickerFor.unitId)}
          onDetach={() => detach(pickerFor.unitId)}
          onDetachUnit={uid => detach(uid)}
          onReattach={newPrimaryId => reattach(pickerFor.unitId, newPrimaryId)}
          onAttach={bodyguardId => attachTo(bodyguardId, pickerFor.unitId)}
          onSetImage={url => setImage(pickerFor.unitId, url)}
          clusterColor={clusterColors[pickerFor.unitId] ?? colorForCluster(pickerFor.unitId).line}
          onSetClusterColor={hex => setClusterColors(prev => ({ ...prev, [pickerFor.unitId]: hex }))}
        />
      )}
    </div>
  );
}

export default App;
