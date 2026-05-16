import { useState } from 'react';
import type { Phase } from './types';
import { migrate, CURRENT_KEY } from './utils/storage';
import { colorForCluster } from './utils/clusterColors';
import { useTheme } from './hooks/useTheme';
import { useArmyStore } from './hooks/useArmyStore';
import { usePhaseSwipe } from './hooks/usePhaseSwipe';
import { useDragOrder } from './hooks/useDragOrder';
import { Header } from './components/Header';
import { SideMenu } from './components/SideMenu';
import { PhaseTabs } from './components/PhaseTabs';
import { ArmyGrid } from './components/ArmyGrid';
import { UnitPicker } from './components/UnitPicker';
import { Calculator } from './components/Calculator';
import styles from './App.module.scss';

migrate();

function App() {
  const { theme, toggleTheme } = useTheme();
  const store = useArmyStore();
  const drag = useDragOrder({ attachments: store.attachments, setUnitOrder: store.setUnitOrder });
  const { phase, setPhase, swipe, pillRef, gridRef, touchHandlers } = usePhaseSwipe(drag.activeId);

  const [page, setPage] = useState<'grid' | 'calculator'>('grid');
  const [headerOpen, setHeaderOpen] = useState(() => !localStorage.getItem(CURRENT_KEY));
  const [pickerFor, setPickerFor] = useState<{ unitId: string; section: 'image' | 'cluster' } | null>(null);

  const allAttachedIds = new Set(Object.values(store.attachments).flat());
  const visibleIds = store.army
    ? store.unitOrder.filter(id => !allAttachedIds.has(id) && store.army!.units.some(u => u.id === id))
    : [];

  function handleSelectList(id: string) {
    store.selectList(id);
    setHeaderOpen(false);
  }

  function handleImport(raw: string) {
    store.importRaw(raw);
    setPickerFor(null);
    setHeaderOpen(false);
  }

  const header = (
    <Header army={store.army} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} theme={theme} onToggleTheme={toggleTheme} page={page} onNavigatePage={() => setPage(p => p === 'grid' ? 'calculator' : 'grid')} />
  );
  const sideMenu = (
    <SideMenu army={store.army} isOpen={headerOpen} onToggle={() => setHeaderOpen(o => !o)} savedLists={store.savedLists} currentListId={store.currentListId} onSelectList={handleSelectList} onDeleteList={store.deleteList} onImport={handleImport} />
  );

  if (page === 'calculator') {
    return (
      <div>
        {header}
        {sideMenu}
        <Calculator savedLists={store.savedLists} />
      </div>
    );
  }

  if (!store.army) {
    return (
      <div data-swiping={swipe !== null || undefined}>
        {header}
        {sideMenu}
        <div className={styles.content} {...touchHandlers}>
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

  return (
    <div data-swiping={swipe !== null || undefined}>
      {header}
      {sideMenu}
      <div className={styles.content} {...touchHandlers}>
        <ArmyGrid
          army={store.army}
          phase={phase as Phase}
          visibleIds={visibleIds}
          activeId={drag.activeId}
          overId={drag.overId}
          attachments={store.attachments}
          clusterColors={store.clusterColors}
          unitImages={store.unitImages}
          sensors={drag.sensors}
          onDragStart={drag.handleDragStart}
          onDragOver={drag.handleDragOver}
          onDragEnd={drag.handleDragEnd}
          onDragCancel={drag.handleDragCancel}
          onPickerOpen={(unitId, section) => setPickerFor({ unitId, section })}
          gridRef={gridRef}
        />
      </div>
      <div ref={pillRef} className={styles.swipeIndicator} />
      <PhaseTabs phase={phase} onChange={setPhase} preview={swipe?.target} />

      {pickerFor && (
        <UnitPicker
          unitId={pickerFor.unitId}
          section={pickerFor.section}
          army={store.army}
          attachments={store.attachments}
          imageUrl={store.unitImages[pickerFor.unitId]}
          onClose={() => setPickerFor(null)}
          onDissolve={() => { store.dissolve(pickerFor.unitId); setPickerFor(null); }}
          onDetach={() => { store.detach(pickerFor.unitId); setPickerFor(null); }}
          onDetachUnit={uid => { store.detach(uid); setPickerFor(null); }}
          onReattach={newPrimaryId => { store.reattach(pickerFor.unitId, newPrimaryId); setPickerFor(null); }}
          onAttach={bodyguardId => { store.attachTo(bodyguardId, pickerFor.unitId); setPickerFor(null); }}
          onSetImage={url => store.setImage(pickerFor.unitId, url)}
          clusterColor={store.clusterColors[pickerFor.unitId] ?? colorForCluster(pickerFor.unitId)}
          onSetClusterColor={hex => store.setClusterColor(pickerFor.unitId, hex)}
        />
      )}
    </div>
  );
}

export default App;
