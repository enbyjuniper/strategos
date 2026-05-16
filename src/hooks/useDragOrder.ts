import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Attachments } from '../types';

interface UseDragOrderArgs {
  attachments: Attachments;
  setUnitOrder: Dispatch<SetStateAction<string[]>>;
}

export function useDragOrder({ attachments, setUnitOrder }: UseDragOrderArgs) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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

  return { activeId, overId, sensors, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel };
}
