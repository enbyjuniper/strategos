import { useState, useEffect } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  DragOverlay, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { Army, Phase, Attachments, ImageTransform } from './types';
import { DEFAULT_IMAGE_TRANSFORM } from './types';
import { parseNR } from './utils/parseNR';
import type { NRJson } from './utils/parseNR';
import { Header } from './components/Header';
import { PhaseTabs } from './components/PhaseTabs';
import { UnitCard } from './components/UnitCard';
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
    } catch {}
  }
  return [...unitIds];
}

function App() {
  const [army, setArmy] = useState<Army | null>(null);
  const [phase, setPhase] = useState<Phase>('move');
  const [headerOpen, setHeaderOpen] = useState(true);
  const [attachments, setAttachments] = useState<Attachments>({});
  const [unitOrder, setUnitOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [unitImages, setUnitImages] = useState<Record<string, string>>({});
  const [unitImageTransforms, setUnitImageTransforms] = useState<Record<string, ImageTransform>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem('strategos_list');
      if (saved) {
        const parsed = parseNR(JSON.parse(saved) as NRJson);
        setArmy(parsed);
        const att = localStorage.getItem('strategos_attachments');
        if (att) setAttachments(JSON.parse(att));
        const imgs = localStorage.getItem('strategos_images');
        if (imgs) setUnitImages(JSON.parse(imgs));
        const imgPos = localStorage.getItem('strategos_image_transforms');
        if (imgPos) setUnitImageTransforms(JSON.parse(imgPos));
        setUnitOrder(buildOrder(parsed.units.map(u => u.id), localStorage.getItem('strategos_order')));
        setHeaderOpen(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('strategos_attachments', JSON.stringify(attachments)); } catch {}
  }, [attachments]);


  useEffect(() => {
    if (unitOrder.length > 0) {
      try { localStorage.setItem('strategos_order', JSON.stringify(unitOrder)); } catch {}
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
      try { localStorage.setItem('strategos_list', raw); } catch {}
    } catch (err) {
      alert('Could not parse JSON: ' + (err as Error).message);
    }
  }

  // ── Drag ──────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
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
      try { localStorage.setItem('strategos_images', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function setImageTransform(unitId: string, transform: ImageTransform) {
    setUnitImageTransforms(prev => {
      const next = { ...prev, [unitId]: transform };
      try { localStorage.setItem('strategos_image_transforms', JSON.stringify(next)); } catch {}
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

  return (
    <>
      <Header army={army} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} onRawJson={handleRawJson} />
      <div className={styles.content}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
            <div className={styles.grid}>
              {visibleIds.map(id => {
                const unit = army.units.find(u => u.id === id);
                if (!unit) return null;

                const attached = (attachments[unit.id] ?? [])
                  .map(aid => army.units.find(u => u.id === aid))
                  .filter(Boolean) as typeof army.units;

                if (attached.length > 0) {
                  const color = colorForCluster(unit.id);
                  return (
                    <SortableSlot key={id} id={id} className={styles.gridItem}>
                      <div className={styles.cluster} style={{ borderLeftColor: color.line, background: color.bg }}>
                        <UnitCard unit={unit} phase={phase} nested imageUrl={unitImages[unit.id]} imageTransform={unitImageTransforms[unit.id]} onOpenPicker={() => setPickerFor(unit.id)} />
                        {attached.map(u => (
                          <UnitCard key={u.id} unit={u} phase={phase} nested imageUrl={unitImages[u.id]} imageTransform={unitImageTransforms[u.id]} onOpenPicker={() => setPickerFor(u.id)} />
                        ))}
                      </div>
                    </SortableSlot>
                  );
                }

                return (
                  <SortableSlot key={id} id={id} className={styles.gridItem}>
                    <UnitCard unit={unit} phase={phase} imageUrl={unitImages[unit.id]} imageTransform={unitImageTransforms[unit.id]} onOpenPicker={() => setPickerFor(unit.id)} />
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
          imageTransform={unitImageTransforms[pickerFor] ?? DEFAULT_IMAGE_TRANSFORM}
          onClose={() => setPickerFor(null)}
          onDissolve={() => dissolve(pickerFor)}
          onDetach={() => detach(pickerFor)}
          onReattach={newPrimaryId => reattach(pickerFor, newPrimaryId)}
          onAttach={primaryId => attachTo(pickerFor, primaryId)}
          onSetImage={url => setImage(pickerFor, url)}
          onSetImageTransform={t => setImageTransform(pickerFor, t)}
        />
      )}
    </>
  );
}

export default App;
