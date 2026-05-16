import type { RefObject } from "react";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import type {
  SensorDescriptor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Army, Phase, Attachments } from "../types";
import { isLeader } from "../utils/abilities";
import { colorForCluster } from "../utils/clusterColors";
import { UnitCard } from "./UnitCard";
import { UnitSlot } from "./UnitSlot";
import { SortableSlot } from "./SortableSlot";
import styles from "./ArmyGrid.module.scss";

interface ArmyGridProps {
  army: Army;
  phase: Phase;
  visibleIds: string[];
  activeId: string | null;
  overId: string | null;
  attachments: Attachments;
  clusterColors: Record<string, string>;
  unitImages: Record<string, string>;
  sensors: SensorDescriptor<object>[];
  onDragStart: (e: DragStartEvent) => void;
  onDragOver: (e: DragOverEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onDragCancel: () => void;
  onPickerOpen: (unitId: string, section: "image" | "cluster") => void;
  gridRef: RefObject<HTMLDivElement | null>;
}

export function ArmyGrid({
  army,
  phase,
  visibleIds,
  activeId,
  overId,
  attachments,
  clusterColors,
  unitImages,
  sensors,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  onPickerOpen,
  gridRef,
}: ArmyGridProps) {
  const activeUnit = activeId
    ? (army.units.find((u) => u.id === activeId) ?? null)
    : null;
  const activeIdx = activeId ? visibleIds.indexOf(activeId) : -1;
  const overIdx = overId ? visibleIds.indexOf(overId) : -1;

  function indicatorFor(id: string): "top" | "bottom" | undefined {
    if (
      !overId ||
      id !== overId ||
      activeIdx === -1 ||
      overIdx === -1 ||
      activeIdx === overIdx
    )
      return undefined;
    return activeIdx > overIdx ? "top" : "bottom";
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={visibleIds} strategy={() => null}>
        <div ref={gridRef} className={styles.grid}>
          {visibleIds.map((id) => {
            const unit = army.units.find((u) => u.id === id);
            if (!unit) return null;

            const attached = (attachments[unit.id] ?? [])
              .map((aid) => army.units.find((u) => u.id === aid))
              .filter(Boolean) as typeof army.units;

            if (attached.length > 0) {
              const sortedAttached = [
                ...attached.filter((u) => isLeader(u)),
                ...attached.filter((u) => !isLeader(u)),
              ];
              const color = clusterColors[unit.id] ?? colorForCluster(unit.id);
              return (
                <SortableSlot
                  key={id}
                  id={id}
                  className={styles.gridItem}
                  indicator={indicatorFor(id)}
                >
                  <UnitSlot accent={color}>
                    <UnitCard
                      unit={unit}
                      phase={phase}
                      imageUrl={unitImages[unit.id]}
                      onOpenImagePicker={() => onPickerOpen(unit.id, "image")}
                      onOpenPicker={
                        isLeader(unit)
                          ? () => onPickerOpen(unit.id, "cluster")
                          : undefined
                      }
                      clusterNameColor={color}
                    />
                    {sortedAttached.map((u) => (
                      <UnitCard
                        key={u.id}
                        unit={u}
                        phase={phase}
                        imageUrl={unitImages[u.id]}
                        onOpenImagePicker={() => onPickerOpen(u.id, "image")}
                        onOpenPicker={
                          isLeader(u)
                            ? () => onPickerOpen(u.id, "cluster")
                            : undefined
                        }
                        clusterNameColor={color}
                      />
                    ))}
                  </UnitSlot>
                </SortableSlot>
              );
            }

            return (
              <SortableSlot
                key={id}
                id={id}
                className={styles.gridItem}
                indicator={indicatorFor(id)}
              >
                <UnitSlot
                  accent={
                    unit.isChar ||
                    unit.models?.some((m) => m.keywords.includes("Character"))
                      ? "var(--char)"
                      : undefined
                  }
                >
                  <UnitCard
                    unit={unit}
                    phase={phase}
                    imageUrl={unitImages[unit.id]}
                    onOpenImagePicker={() => onPickerOpen(unit.id, "image")}
                    onOpenPicker={
                      isLeader(unit)
                        ? () => onPickerOpen(unit.id, "cluster")
                        : undefined
                    }
                  />
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
              <span className={styles.dragGhostCount}>
                +{attachments[activeUnit.id].length}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
