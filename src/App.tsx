import { useState, useEffect, useMemo } from 'react';
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
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [unitImages, setUnitImages] = useState<Record<string, string>>(() => {
    try {
      const imgs = localStorage.getItem('strategos_images');
      return imgs ? JSON.parse(imgs) : {};
    } catch { return {}; }
  });
  // Tracks acted units; tagged with phase+army so stale toggles are discarded on phase/army change
  const [actedStore, setActedStore] = useState<{ phase: Phase; army: Army | null; ids: Set<string> }>({
    phase: 'move',
    army: null,
    ids: new Set(),
  });

  const actedIds = useMemo(() => {
    if (!army) return new Set<string>();
    const auto = new Set(
      army.units
        .filter(u => (phase === 'shoot' && u.ranged.length === 0) || (phase === 'melee' && u.melee.length === 0))
        .map(u => u.id)
    );
    if (actedStore.phase !== phase || actedStore.army !== army) return auto;
    return actedStore.ids;
  }, [army, phase, actedStore]);

  function getClusterIds(unitId: string): string[] {
    if (attachments[unitId]?.length > 0) return [unitId, ...attachments[unitId]];
    for (const [primaryId, attached] of Object.entries(attachments)) {
      if (attached.includes(unitId)) return [primaryId, ...attached];
    }
    return [unitId];
  }

  function toggleActed(unitId: string) {
    setActedStore(prev => {
      const autoIds = army?.units
        .filter(u => (phase === 'shoot' && u.ranged.length === 0) || (phase === 'melee' && u.melee.length === 0))
        .map(u => u.id) ?? [];
      const base = (prev.phase === phase && prev.army === army)
        ? new Set(prev.ids)
        : new Set<string>(autoIds);
      const ids = getClusterIds(unitId);
      if (base.has(unitId)) ids.forEach(id => base.delete(id));
      else ids.forEach(id => base.add(id));
      return { phase, army, ids: base };
    });
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  useEffect(() => {
    try { localStorage.setItem('strategos_attachments', JSON.stringify(attachments)); } catch { /* ignore */ }
  }, [attachments]);

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
    setPickerFor(null);
  }

  // ── Render ────────────────────────────────────────────────────

  if (!army) {
    return (
      <>
        <Header army={null} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} onRawJson={handleRawJson} />
        <div className={styles.content}>
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No army loaded</div>
            <div className={styles.emptySub}>Tap ☰ above to import a New Recruit JSON file.</div>
          </div>
        </div>
        <PhaseTabs phase={phase} onChange={setPhase} />
      </>
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
    <>
      <Header army={army} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} onRawJson={handleRawJson} />
      <div className={styles.content}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={visibleIds} strategy={() => null}>
            <div className={styles.grid}>
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
                  const color = colorForCluster(unit.id);
                  return (
                    <SortableSlot key={id} id={id} className={styles.gridItem} indicator={indicatorFor(id)}>
                      <UnitSlot acted={actedIds.has(unit.id)} cluster={color}>
                        <UnitCard unit={unit} phase={phase} nested imageUrl={unitImages[unit.id]} onOpenPicker={() => setPickerFor(unit.id)} acted={actedIds.has(unit.id)} onToggleActed={() => toggleActed(unit.id)} />
                        {sortedAttached.map(u => (
                          <UnitCard key={u.id} unit={u} phase={phase} nested imageUrl={unitImages[u.id]} onOpenPicker={() => setPickerFor(u.id)} acted={actedIds.has(u.id)} onToggleActed={() => toggleActed(u.id)} />
                        ))}
                      </UnitSlot>
                    </SortableSlot>
                  );
                }

                return (
                  <SortableSlot key={id} id={id} className={styles.gridItem} indicator={indicatorFor(id)}>
                    <UnitSlot acted={actedIds.has(unit.id)}>
                      <UnitCard unit={unit} phase={phase} imageUrl={unitImages[unit.id]} onOpenPicker={() => setPickerFor(unit.id)} acted={actedIds.has(unit.id)} onToggleActed={() => toggleActed(unit.id)} />
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
      <PhaseTabs phase={phase} onChange={setPhase} />

      {pickerFor && (
        <UnitPicker
          unitId={pickerFor}
          army={army}
          attachments={attachments}
          imageUrl={unitImages[pickerFor]}
          onClose={() => setPickerFor(null)}
          onDissolve={() => dissolve(pickerFor)}
          onDetach={() => detach(pickerFor)}
          onReattach={newPrimaryId => reattach(pickerFor, newPrimaryId)}
          onAttach={bodyguardId => attachTo(bodyguardId, pickerFor)}
          onSetImage={url => setImage(pickerFor, url)}
        />
      )}
    </>
  );
}

export default App;
